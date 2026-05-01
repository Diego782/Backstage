import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  CodePipelineClient,
  ListPipelinesCommand,
  GetPipelineStateCommand,
  StartPipelineExecutionCommand,
  ListPipelineExecutionsCommand,
} from '@aws-sdk/client-codepipeline';
import {
  CodeBuildClient,
  BatchGetBuildsCommand,
} from '@aws-sdk/client-codebuild';
import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  Pipeline,
  PipelineState,
  PipelineExecution,
  BuildLogs,
} from './types';

interface AWSAccount {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class AwsPipelinesService {
  private logger: LoggerService;
  private accounts: AWSAccount[];
  private regions: string[];

  constructor(config: Config, logger: LoggerService) {
    this.logger = logger;

    // Multi-account support (same pattern as aws-resources service)
    this.accounts = this.loadAccounts();

    const regionsStr =
      process.env.AWS_REGIONS ||
      config.getOptionalString('aws.regions') ||
      'us-east-1';
    this.regions = regionsStr.split(',').map(r => r.trim());

    this.logger.info(`AWS Pipelines Service initialized`);
    this.logger.info(`Accounts: ${this.accounts.map(a => a.name).join(', ')}`);
    this.logger.info(`Regions: ${this.regions.join(', ')}`);
  }

  private loadAccounts(): AWSAccount[] {
    const accounts: AWSAccount[] = [];

    const a1Key = process.env.AWS_ACCOUNT_1_ACCESS_KEY_ID;
    const a1Secret = process.env.AWS_ACCOUNT_1_SECRET_ACCESS_KEY;
    const a1Name = process.env.AWS_ACCOUNT_1_NAME || 'Account 1';
    if (a1Key && a1Secret)
      accounts.push({ name: a1Name, accessKeyId: a1Key, secretAccessKey: a1Secret });

    const a2Key = process.env.AWS_ACCOUNT_2_ACCESS_KEY_ID;
    const a2Secret = process.env.AWS_ACCOUNT_2_SECRET_ACCESS_KEY;
    const a2Name = process.env.AWS_ACCOUNT_2_NAME || 'Account 2';
    if (a2Key && a2Secret)
      accounts.push({ name: a2Name, accessKeyId: a2Key, secretAccessKey: a2Secret });

    return accounts;
  }

  private createPipelineClient(account: AWSAccount, region: string): CodePipelineClient {
    return new CodePipelineClient({
      region,
      credentials: {
        accessKeyId: account.accessKeyId,
        secretAccessKey: account.secretAccessKey,
      },
    });
  }

  async listPipelines(): Promise<Pipeline[]> {
    const allPipelines: Pipeline[] = [];

    // Query all accounts × regions in parallel
    const promises: Promise<void>[] = [];
    for (const account of this.accounts) {
      for (const region of this.regions) {
        promises.push(
          (async () => {
            try {
              const client = this.createPipelineClient(account, region);
              const response = await client.send(new ListPipelinesCommand({}));
              const pipelines = (response.pipelines || []).map(p => ({
                name: p.name || 'unknown',
                created: p.created,
                updated: p.updated,
                account: account.name,
                region,
              }));
              allPipelines.push(...pipelines);
              this.logger.info(
                `Found ${pipelines.length} pipelines in ${account.name}/${region}`,
              );
            } catch (error) {
              this.logger.error(
                `Error listing pipelines in ${account.name}/${region}:`,
                error as Error,
              );
            }
          })(),
        );
      }
    }

    await Promise.all(promises);
    this.logger.info(`Total pipelines found: ${allPipelines.length}`);
    return allPipelines;
  }

  async getPipelineState(
    pipelineName: string,
    region?: string,
    accountName?: string,
  ): Promise<PipelineState> {
    const account = accountName
      ? this.accounts.find(a => a.name === accountName)
      : this.accounts[0];
    const targetRegion = region || this.regions[0];

    if (!account) throw new Error(`Account ${accountName} not found`);

    const client = this.createPipelineClient(account, targetRegion);
    const response = await client.send(
      new GetPipelineStateCommand({ name: pipelineName }),
    );

    const stages = (response.stageStates || []).map(stage => ({
      stageName: stage.stageName || 'unknown',
      status: stage.latestExecution?.status || 'Unknown',
      actions: (stage.actionStates || []).map(action => ({
        actionName: action.actionName || 'unknown',
        status: action.latestExecution?.status || 'Unknown',
        lastStatusChange: action.latestExecution?.lastStatusChange,
      })),
    }));

    return {
      pipelineName,
      pipelineVersion: response.pipelineVersion || 0,
      stages,
      updated: response.updated,
    };
  }

  async startPipelineExecution(
    pipelineName: string,
    region?: string,
    accountName?: string,
  ): Promise<{ executionId: string }> {
    const account = accountName
      ? this.accounts.find(a => a.name === accountName)
      : this.accounts[0];
    const targetRegion = region || this.regions[0];

    if (!account) throw new Error(`Account ${accountName} not found`);

    const client = this.createPipelineClient(account, targetRegion);
    const response = await client.send(
      new StartPipelineExecutionCommand({ name: pipelineName }),
    );

    this.logger.info(`Started execution for pipeline: ${pipelineName}`);
    return { executionId: response.pipelineExecutionId || 'unknown' };
  }

  async listPipelineExecutions(
    pipelineName: string,
    maxResults: number = 10,
    region?: string,
    accountName?: string,
  ): Promise<PipelineExecution[]> {
    const account = accountName
      ? this.accounts.find(a => a.name === accountName)
      : this.accounts[0];
    const targetRegion = region || this.regions[0];

    if (!account) throw new Error(`Account ${accountName} not found`);

    const client = this.createPipelineClient(account, targetRegion);
    const response = await client.send(
      new ListPipelineExecutionsCommand({ pipelineName, maxResults }),
    );

    return (response.pipelineExecutionSummaries || []).map(exec => ({
      pipelineExecutionId: exec.pipelineExecutionId || 'unknown',
      status: exec.status || 'Unknown',
      startTime: exec.startTime,
      lastUpdateTime: exec.lastUpdateTime,
      sourceRevisions: exec.sourceRevisions?.map(sr => ({
        actionName: sr.actionName || 'unknown',
        revisionId: sr.revisionId || 'unknown',
        revisionSummary: sr.revisionSummary,
      })),
    }));
  }

  async getBuildLogs(buildId: string): Promise<BuildLogs> {
    const account = this.accounts[0];
    const region = this.regions[0];

    if (!account) throw new Error('No AWS account configured');

    const codeBuildClient = new CodeBuildClient({
      region,
      credentials: {
        accessKeyId: account.accessKeyId,
        secretAccessKey: account.secretAccessKey,
      },
    });

    const cloudWatchLogsClient = new CloudWatchLogsClient({
      region,
      credentials: {
        accessKeyId: account.accessKeyId,
        secretAccessKey: account.secretAccessKey,
      },
    });

    const buildResponse = await codeBuildClient.send(
      new BatchGetBuildsCommand({ ids: [buildId] }),
    );
    const build = buildResponse.builds?.[0];

    if (!build || !build.logs?.groupName || !build.logs?.streamName) {
      throw new Error('Build logs not available');
    }

    const logsResponse = await cloudWatchLogsClient.send(
      new GetLogEventsCommand({
        logGroupName: build.logs.groupName,
        logStreamName: build.logs.streamName,
        startFromHead: true,
      }),
    );

    return {
      buildId,
      logs: (logsResponse.events || []).map(event => ({
        timestamp: event.timestamp,
        message: event.message || '',
      })),
      logGroupName: build.logs.groupName,
      logStreamName: build.logs.streamName,
    };
  }
}
