import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  CreateTagsCommand,
  Instance,
} from '@aws-sdk/client-ec2';
import {
  RDSClient,
  DescribeDBInstancesCommand,
  StartDBInstanceCommand,
  StopDBInstanceCommand,
  ListTagsForResourceCommand,
  DBInstance,
} from '@aws-sdk/client-rds';
import {
  EC2Instance,
  RDSInstance,
  InstanceActionResponse,
} from './types';

interface AWSAccount {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class AwsResourcesService {
  private logger: LoggerService;
  private accounts: AWSAccount[];
  private regions: string[];
  private devTagStart: string;
  private devTagStop: string;

  // In-memory cache
  private ec2Cache: CacheEntry<EC2Instance[]> | null = null;
  private rdsCache: CacheEntry<RDSInstance[]> | null = null;

  constructor(config: Config, logger: LoggerService) {
    this.logger = logger;
    this.accounts = this.loadAccounts();

    const regionsStr = process.env.AWS_REGIONS || 'us-east-1';
    this.regions = regionsStr.split(',').map(r => r.trim());

    this.devTagStart = process.env.AWS_DEV_TAG_START || 'newautostart';
    this.devTagStop = process.env.AWS_DEV_TAG_STOP || 'newautostop';

    this.logger.info(`=== AWS Resources Service Initialized ===`);
    this.logger.info(`Accounts: ${this.accounts.map(a => a.name).join(', ')}`);
    this.logger.info(`Regions: ${this.regions.join(', ')}`);
    this.logger.info(`Dev tags: ${this.devTagStart}, ${this.devTagStop}`);
    this.logger.info(`Cache TTL: ${CACHE_TTL_MS / 1000}s`);
    this.logger.info(`=========================================`);
  }

  private loadAccounts(): AWSAccount[] {
    const accounts: AWSAccount[] = [];

    const account1Key = process.env.AWS_ACCOUNT_1_ACCESS_KEY_ID;
    const account1Secret = process.env.AWS_ACCOUNT_1_SECRET_ACCESS_KEY;
    const account1Name = process.env.AWS_ACCOUNT_1_NAME || 'Account 1';
    if (account1Key && account1Secret) {
      accounts.push({ name: account1Name, accessKeyId: account1Key, secretAccessKey: account1Secret });
    }

    const account2Key = process.env.AWS_ACCOUNT_2_ACCESS_KEY_ID;
    const account2Secret = process.env.AWS_ACCOUNT_2_SECRET_ACCESS_KEY;
    const account2Name = process.env.AWS_ACCOUNT_2_NAME || 'Account 2';
    if (account2Key && account2Secret) {
      accounts.push({ name: account2Name, accessKeyId: account2Key, secretAccessKey: account2Secret });
    }

    return accounts;
  }

  private isCacheValid<T>(cache: CacheEntry<T> | null): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL_MS;
  }

  public invalidateCache() {
    this.ec2Cache = null;
    this.rdsCache = null;
    this.logger.info('Cache invalidated');
  }

  public getAccountsInfo() {
    return this.accounts.map(a => ({ name: a.name, hasCredentials: true }));
  }

  public getRegions() {
    return this.regions;
  }

  public getDevTags() {
    return { start: this.devTagStart, stop: this.devTagStop };
  }

  private createEC2Client(account: AWSAccount, region: string): EC2Client {
    return new EC2Client({
      region,
      credentials: {
        accessKeyId: account.accessKeyId,
        secretAccessKey: account.secretAccessKey,
      },
    });
  }

  private createRDSClient(account: AWSAccount, region: string): RDSClient {
    return new RDSClient({
      region,
      credentials: {
        accessKeyId: account.accessKeyId,
        secretAccessKey: account.secretAccessKey,
      },
    });
  }

  /**
   * Fetch EC2 instances for a single account+region combination.
   */
  private async fetchEC2ForAccountRegion(account: AWSAccount, region: string): Promise<EC2Instance[]> {
    const instances: EC2Instance[] = [];
    try {
      const ec2Client = this.createEC2Client(account, region);
      const command = new DescribeInstancesCommand({
        Filters: [{ Name: 'tag-key', Values: [this.devTagStart] }],
      });

      const response = await ec2Client.send(command);

      response.Reservations?.forEach(reservation => {
        reservation.Instances?.forEach((instance: Instance) => {
          if (instance.InstanceId) {
            const tags: Record<string, string> = {};
            instance.Tags?.forEach(tag => {
              if (tag.Key && tag.Value) tags[tag.Key] = tag.Value;
            });

            if (tags[this.devTagStart] && tags[this.devTagStop]) {
              instances.push({
                instanceId: instance.InstanceId,
                name: tags['Name'] || instance.InstanceId,
                state: (instance.State?.Name as any) || 'unknown',
                instanceType: instance.InstanceType || 'unknown',
                availabilityZone: instance.Placement?.AvailabilityZone || 'unknown',
                launchTime: instance.LaunchTime,
                tags,
                account: account.name,
                region,
                autoStartHour: tags[this.devTagStart],
                autoStopHour: tags[this.devTagStop],
              });
            }
          }
        });
      });
    } catch (error) {
      this.logger.error(`Error listing EC2 from ${account.name}/${region}:`, error);
    }
    return instances;
  }

  /**
   * Fetch RDS instances for a single account+region combination.
   */
  private async fetchRDSForAccountRegion(account: AWSAccount, region: string): Promise<RDSInstance[]> {
    const instances: RDSInstance[] = [];
    try {
      const rdsClient = this.createRDSClient(account, region);
      const command = new DescribeDBInstancesCommand({});
      const response = await rdsClient.send(command);

      // Fetch tags for all instances in parallel
      const tagPromises = (response.DBInstances || [])
        .filter(inst => inst.DBInstanceIdentifier && inst.DBInstanceArn)
        .map(async (instance) => {
          const tagsCommand = new ListTagsForResourceCommand({
            ResourceName: instance.DBInstanceArn!,
          });
          const tagsResponse = await rdsClient.send(tagsCommand);
          const tags: Record<string, string> = {};
          tagsResponse.TagList?.forEach(tag => {
            if (tag.Key && tag.Value) tags[tag.Key] = tag.Value;
          });
          return { instance, tags };
        });

      const results = await Promise.all(tagPromises);

      for (const { instance, tags } of results) {
        if (tags[this.devTagStart] && tags[this.devTagStop]) {
          instances.push({
            dbInstanceIdentifier: instance.DBInstanceIdentifier!,
            dbInstanceClass: instance.DBInstanceClass || 'unknown',
            engine: instance.Engine || 'unknown',
            engineVersion: instance.EngineVersion || 'unknown',
            status: instance.DBInstanceStatus || 'unknown',
            endpoint: instance.Endpoint ? {
              address: instance.Endpoint.Address || '',
              port: instance.Endpoint.Port || 0,
            } : undefined,
            availabilityZone: instance.AvailabilityZone || 'unknown',
            tags,
            account: account.name,
            region,
            autoStartHour: tags[this.devTagStart],
            autoStopHour: tags[this.devTagStop],
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error listing RDS from ${account.name}/${region}:`, error);
    }
    return instances;
  }

  // EC2 Methods
  async listEC2Instances(forceRefresh = false): Promise<EC2Instance[]> {
    if (!forceRefresh && this.isCacheValid(this.ec2Cache)) {
      this.logger.info(`EC2 cache hit (${this.ec2Cache!.data.length} instances, age: ${Math.round((Date.now() - this.ec2Cache!.timestamp) / 1000)}s)`);
      return this.ec2Cache!.data;
    }

    this.logger.info('EC2 cache miss — fetching from AWS (parallel)...');
    const startTime = Date.now();

    // Build all account+region combinations and fetch in parallel
    const promises: Promise<EC2Instance[]>[] = [];
    for (const account of this.accounts) {
      for (const region of this.regions) {
        promises.push(this.fetchEC2ForAccountRegion(account, region));
      }
    }

    const results = await Promise.all(promises);
    const allInstances = results.flat();

    this.ec2Cache = { data: allInstances, timestamp: Date.now() };
    this.logger.info(`EC2 fetch complete: ${allInstances.length} instances in ${Date.now() - startTime}ms`);
    return allInstances;
  }

  async listRDSInstances(forceRefresh = false): Promise<RDSInstance[]> {
    if (!forceRefresh && this.isCacheValid(this.rdsCache)) {
      this.logger.info(`RDS cache hit (${this.rdsCache!.data.length} instances, age: ${Math.round((Date.now() - this.rdsCache!.timestamp) / 1000)}s)`);
      return this.rdsCache!.data;
    }

    this.logger.info('RDS cache miss — fetching from AWS (parallel)...');
    const startTime = Date.now();

    const promises: Promise<RDSInstance[]>[] = [];
    for (const account of this.accounts) {
      for (const region of this.regions) {
        promises.push(this.fetchRDSForAccountRegion(account, region));
      }
    }

    const results = await Promise.all(promises);
    const allInstances = results.flat();

    this.rdsCache = { data: allInstances, timestamp: Date.now() };
    this.logger.info(`RDS fetch complete: ${allInstances.length} instances in ${Date.now() - startTime}ms`);
    return allInstances;
  }

  // Debug method
  async listAllEC2InstancesDebug(): Promise<any[]> {
    const allInstances: any[] = [];
    for (const account of this.accounts) {
      for (const region of this.regions) {
        try {
          const ec2Client = this.createEC2Client(account, region);
          const command = new DescribeInstancesCommand({});
          const response = await ec2Client.send(command);

          response.Reservations?.forEach(reservation => {
            reservation.Instances?.forEach((instance: Instance) => {
              if (instance.InstanceId) {
                const tags: Record<string, string> = {};
                instance.Tags?.forEach(tag => {
                  if (tag.Key && tag.Value) tags[tag.Key] = tag.Value;
                });
                allInstances.push({
                  instanceId: instance.InstanceId,
                  name: tags['Name'] || instance.InstanceId,
                  state: instance.State?.Name || 'unknown',
                  instanceType: instance.InstanceType || 'unknown',
                  account: account.name,
                  region,
                  tags,
                  hasStartTag: !!tags[this.devTagStart],
                  hasStopTag: !!tags[this.devTagStop],
                });
              }
            });
          });
        } catch (error) {
          this.logger.error(`DEBUG: Error from ${account.name}/${region}:`, error);
        }
      }
    }
    return allInstances;
  }

  async startEC2Instance(instanceId: string, region: string, accountName: string): Promise<InstanceActionResponse> {
    const account = this.accounts.find(a => a.name === accountName);
    if (!account) throw new Error(`Account ${accountName} not found`);

    const ec2Client = this.createEC2Client(account, region);
    const response = await ec2Client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
    const instance = response.StartingInstances?.[0];

    // Invalidate cache so next list reflects the new state
    this.ec2Cache = null;

    return {
      success: true,
      message: `Instance ${instanceId} is starting`,
      previousState: instance?.PreviousState?.Name,
      currentState: instance?.CurrentState?.Name,
    };
  }

  async stopEC2Instance(instanceId: string, region: string, accountName: string): Promise<InstanceActionResponse> {
    const account = this.accounts.find(a => a.name === accountName);
    if (!account) throw new Error(`Account ${accountName} not found`);

    const ec2Client = this.createEC2Client(account, region);
    const response = await ec2Client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
    const instance = response.StoppingInstances?.[0];

    this.ec2Cache = null;

    return {
      success: true,
      message: `Instance ${instanceId} is stopping`,
      previousState: instance?.PreviousState?.Name,
      currentState: instance?.CurrentState?.Name,
    };
  }

  async updateEC2InstanceSchedule(
    instanceId: string,
    region: string,
    accountName: string,
    startHour: string,
    stopHour: string,
  ): Promise<InstanceActionResponse> {
    const account = this.accounts.find(a => a.name === accountName);
    if (!account) throw new Error(`Account ${accountName} not found`);

    const ec2Client = this.createEC2Client(account, region);
    await ec2Client.send(new CreateTagsCommand({
      Resources: [instanceId],
      Tags: [
        { Key: this.devTagStart, Value: startHour },
        { Key: this.devTagStop, Value: stopHour },
      ],
    }));

    this.ec2Cache = null;

    return {
      success: true,
      message: `Instance ${instanceId} schedule updated: start at ${startHour}:00, stop at ${stopHour}:00`,
    };
  }

  async startRDSInstance(instanceId: string, region: string, accountName: string): Promise<InstanceActionResponse> {
    const account = this.accounts.find(a => a.name === accountName);
    if (!account) throw new Error(`Account ${accountName} not found`);

    const rdsClient = this.createRDSClient(account, region);
    await rdsClient.send(new StartDBInstanceCommand({ DBInstanceIdentifier: instanceId }));

    this.rdsCache = null;

    return { success: true, message: `RDS instance ${instanceId} is starting` };
  }

  async stopRDSInstance(instanceId: string, region: string, accountName: string): Promise<InstanceActionResponse> {
    const account = this.accounts.find(a => a.name === accountName);
    if (!account) throw new Error(`Account ${accountName} not found`);

    const rdsClient = this.createRDSClient(account, region);
    await rdsClient.send(new StopDBInstanceCommand({ DBInstanceIdentifier: instanceId }));

    this.rdsCache = null;

    return { success: true, message: `RDS instance ${instanceId} is stopping` };
  }
}
