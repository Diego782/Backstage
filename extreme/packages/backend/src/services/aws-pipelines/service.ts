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

export class AwsPipelinesService {
  private codePipelineClient: CodePipelineClient;
  private codeBuildClient: CodeBuildClient;
  private cloudWatchLogsClient: CloudWatchLogsClient;
  private logger: LoggerService;
  private region: string;

  constructor(config: Config, logger: LoggerService) {
    this.logger = logger;
    this.region = config.getOptionalString('aws.region') || 'us-east-1';
    
    const awsConfig = { region: this.region };

    this.codePipelineClient = new CodePipelineClient(awsConfig);
    this.codeBuildClient = new CodeBuildClient(awsConfig);
    this.cloudWatchLogsClient = new CloudWatchLogsClient(awsConfig);
    
    this.logger.info(`AWS Pipelines Service initialized for region: ${this.region}`);
  }

  async listPipelines(): Promise<Pipeline[]> {
    try {
      const command = new ListPipelinesCommand({});
      const response = await this.codePipelineClient.send(command);
      
      const pipelines: Pipeline[] = (response.pipelines || []).map(p => ({
        name: p.name || 'unknown',
        created: p.created,
        updated: p.updated,
      }));

      this.logger.info(`Listed ${pipelines.length} pipelines`);
      return pipelines;
    } catch (error) {
      this.logger.error('Error listing pipelines:', error as Error);
      throw error;
    }
  }

  async getPipelineState(pipelineName: string): Promise<PipelineState> {
    try {
      const command = new GetPipelineStateCommand({
        name: pipelineName,
      });
      
      const response = await this.codePipelineClient.send(command);
      
      const stages = (response.stageStates || []).map(stage => ({
        stageName: stage.stageName || 'unknown',
        status: stage.latestExecution?.status || 'Unknown',
        actions: (stage.actionStates || []).map(action => ({
          actionName: action.actionName || 'unknown',
          status: action.latestExecution?.status || 'Unknown',
          lastStatusChange: action.latestExecution?.lastStatusChange,
        })),
      }));

      this.logger.info(`Got state for pipeline: ${pipelineName}`);
      
      return {
        pipelineName,
        pipelineVersion: response.pipelineVersion || 0,
        stages,
        updated: response.updated,
      };
    } catch (error) {
      this.logger.error(`Error getting pipeline state for ${pipelineName}:`, error as Error);
      throw error;
    }
  }

  async startPipelineExecution(pipelineName: string): Promise<{ executionId: string }> {
    try {
      const command = new StartPipelineExecutionCommand({
        name: pipelineName,
      });
      
      const response = await this.codePipelineClient.send(command);
      
      this.logger.info(`Started execution for pipeline: ${pipelineName}`);
      
      return {
        executionId: response.pipelineExecutionId || 'unknown',
      };
    } catch (error) {
      this.logger.error(`Error starting pipeline ${pipelineName}:`, error as Error);
      throw error;
    }
  }

  async listPipelineExecutions(pipelineName: string, maxResults: number = 10): Promise<PipelineExecution[]> {
    try {
      const command = new ListPipelineExecutionsCommand({
        pipelineName,
        maxResults,
      });
      
      const response = await this.codePipelineClient.send(command);
      
      const executions: PipelineExecution[] = (response.pipelineExecutionSummaries || []).map(exec => ({
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

      this.logger.info(`Listed ${executions.length} executions for pipeline: ${pipelineName}`);
      return executions;
    } catch (error) {
      this.logger.error(`Error listing executions for ${pipelineName}:`, error as Error);
      throw error;
    }
  }

  async getBuildLogs(buildId: string): Promise<BuildLogs> {
    try {
      // First, get build details to find log group and stream
      const buildCommand = new BatchGetBuildsCommand({
        ids: [buildId],
      });
      
      const buildResponse = await this.codeBuildClient.send(buildCommand);
      const build = buildResponse.builds?.[0];
      
      if (!build || !build.logs?.groupName || !build.logs?.streamName) {
        throw new Error('Build logs not available');
      }

      // Get logs from CloudWatch
      const logsCommand = new GetLogEventsCommand({
        logGroupName: build.logs.groupName,
        logStreamName: build.logs.streamName,
        startFromHead: true,
      });
      
      const logsResponse = await this.cloudWatchLogsClient.send(logsCommand);
      
      const logs = (logsResponse.events || []).map(event => ({
        timestamp: event.timestamp,
        message: event.message || '',
      }));

      this.logger.info(`Retrieved ${logs.length} log entries for build: ${buildId}`);
      
      return {
        buildId,
        logs,
        logGroupName: build.logs.groupName,
        logStreamName: build.logs.streamName,
      };
    } catch (error) {
      this.logger.error(`Error getting build logs for ${buildId}:`, error as Error);
      throw error;
    }
  }
}
