import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  Granularity,
} from '@aws-sdk/client-cost-explorer';
import {
  CostData,
  CostByService,
  CostForecast,
  ResourceCostItem,
  ResourceCostsSummary,
} from './types';

interface AWSAccount {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface CostsCacheEntry {
  data: ResourceCostsSummary;
  timestamp: number;
  cacheKey: string;
}

const COSTS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class AwsCostsService {
  private logger: LoggerService;
  private accounts: AWSAccount[];
  private costsCache: CostsCacheEntry | null = null;

  constructor(_config: Config, logger: LoggerService) {
    this.logger = logger;
    this.accounts = this.loadAccounts();

    this.logger.info(`=== AWS Costs Service Initialized ===`);
    this.logger.info(`Accounts: ${this.accounts.map(a => a.name).join(', ')}`);
    this.logger.info(`Cache TTL: ${COSTS_CACHE_TTL_MS / 1000}s`);
    this.logger.info(`=====================================`);
  }

  private loadAccounts(): AWSAccount[] {
    const accounts: AWSAccount[] = [];
    const a1Key = process.env.AWS_ACCOUNT_1_ACCESS_KEY_ID;
    const a1Secret = process.env.AWS_ACCOUNT_1_SECRET_ACCESS_KEY;
    const a1Name = process.env.AWS_ACCOUNT_1_NAME || 'Account 1';
    if (a1Key && a1Secret) accounts.push({ name: a1Name, accessKeyId: a1Key, secretAccessKey: a1Secret });

    const a2Key = process.env.AWS_ACCOUNT_2_ACCESS_KEY_ID;
    const a2Secret = process.env.AWS_ACCOUNT_2_SECRET_ACCESS_KEY;
    const a2Name = process.env.AWS_ACCOUNT_2_NAME || 'Account 2';
    if (a2Key && a2Secret) accounts.push({ name: a2Name, accessKeyId: a2Key, secretAccessKey: a2Secret });

    return accounts;
  }

  private createCostExplorerClient(account: AWSAccount): CostExplorerClient {
    return new CostExplorerClient({
      region: 'us-east-1',
      credentials: { accessKeyId: account.accessKeyId, secretAccessKey: account.secretAccessKey },
    });
  }

  /**
   * Get EC2 costs grouped by INSTANCE_TYPE for an account.
   * No tag filter — just by service. We'll cross-reference with resources later.
   */
  private async getEC2CostsByInstanceType(
    account: AWSAccount, startDate: string, endDate: string,
  ): Promise<Map<string, number>> {
    const costMap = new Map<string, number>();
    try {
      const client = this.createCostExplorerClient(account);
      const response = await client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: Granularity.MONTHLY,
        Metrics: ['UnblendedCost'],
        Filter: { Dimensions: { Key: 'SERVICE', Values: ['Amazon Elastic Compute Cloud - Compute'] } },
        GroupBy: [{ Type: 'DIMENSION', Key: 'INSTANCE_TYPE' }],
      }));
      response.ResultsByTime?.forEach(period => {
        period.Groups?.forEach(group => {
          const t = group.Keys?.[0] || 'unknown';
          const c = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
          costMap.set(t, (costMap.get(t) || 0) + c);
        });
      });
      this.logger.info(`EC2 costs for ${account.name}: ${[...costMap.entries()].map(([k, v]) => `${k}=$${v.toFixed(2)}`).join(', ') || 'none'}`);
    } catch (error) {
      this.logger.error(`Error getting EC2 costs for ${account.name}:`, error as Error);
    }
    return costMap;
  }

  /**
   * Get RDS costs grouped by DATABASE_ENGINE for an account.
   * No tag filter — just by service.
   */
  private async getRDSCostsByEngine(
    account: AWSAccount, startDate: string, endDate: string,
  ): Promise<Map<string, number>> {
    const costMap = new Map<string, number>();
    try {
      const client = this.createCostExplorerClient(account);
      const response = await client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: Granularity.MONTHLY,
        Metrics: ['UnblendedCost'],
        Filter: { Dimensions: { Key: 'SERVICE', Values: ['Amazon Relational Database Service'] } },
        GroupBy: [{ Type: 'DIMENSION', Key: 'DATABASE_ENGINE' }],
      }));
      response.ResultsByTime?.forEach(period => {
        period.Groups?.forEach(group => {
          const e = group.Keys?.[0] || 'unknown';
          const c = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
          costMap.set(e, (costMap.get(e) || 0) + c);
        });
      });
      this.logger.info(`RDS costs for ${account.name}: ${[...costMap.entries()].map(([k, v]) => `${k}=$${v.toFixed(2)}`).join(', ') || 'none'}`);
    } catch (error) {
      this.logger.error(`Error getting RDS costs for ${account.name}:`, error as Error);
    }
    return costMap;
  }

  /**
   * Get costs for EC2 and RDS resources from the resources section.
   *
   * Strategy:
   * 1. Query Cost Explorer by SERVICE=EC2, grouped by INSTANCE_TYPE (no tag filter).
   * 2. Query Cost Explorer by SERVICE=RDS, grouped by DATABASE_ENGINE (no tag filter).
   * 3. For each dev instance, look up the cost for its instance type and divide
   *    by the total number of instances of that type in the account (dev + non-dev).
   *    This gives a proportional estimate per instance.
   *
   * Note: This includes ALL instances of that type in the cost division, not just dev ones.
   * The result is an estimate — but it's the best we can do without Cost Allocation Tags.
   */
  async getResourceCosts(
    ec2Instances: Array<{ instanceId: string; name: string; instanceType: string; state: string; account: string; region: string }>,
    rdsInstances: Array<{ dbInstanceIdentifier: string; dbInstanceClass: string; engine: string; status: string; account: string; region: string }>,
    startDate: string,
    endDate: string,
    forceRefresh = false,
  ): Promise<ResourceCostsSummary> {
    const cacheKey = `${startDate}|${endDate}|${ec2Instances.length}|${rdsInstances.length}`;
    if (!forceRefresh && this.costsCache && this.costsCache.cacheKey === cacheKey && (Date.now() - this.costsCache.timestamp) < COSTS_CACHE_TTL_MS) {
      this.logger.info(`Costs cache hit (age: ${Math.round((Date.now() - this.costsCache.timestamp) / 1000)}s)`);
      return this.costsCache.data;
    }

    this.logger.info('Costs cache miss — fetching from Cost Explorer (parallel)...');
    const t0 = Date.now();

    // All accounts in parallel
    const accountResults = await Promise.all(this.accounts.map(async (account) => {
      const aEC2 = ec2Instances.filter(i => i.account === account.name);
      const aRDS = rdsInstances.filter(i => i.account === account.name);
      if (aEC2.length === 0 && aRDS.length === 0) {
        return { ec2Items: [] as ResourceCostItem[], rdsItems: [] as ResourceCostItem[] };
      }

      const [ec2ByType, rdsByEngine] = await Promise.all([
        aEC2.length > 0 ? this.getEC2CostsByInstanceType(account, startDate, endDate) : Promise.resolve(new Map<string, number>()),
        aRDS.length > 0 ? this.getRDSCostsByEngine(account, startDate, endDate) : Promise.resolve(new Map<string, number>()),
      ]);

      // Count dev instances per type (for proportional distribution among dev instances)
      const ec2TypeCount = new Map<string, number>();
      for (const i of aEC2) ec2TypeCount.set(i.instanceType, (ec2TypeCount.get(i.instanceType) || 0) + 1);

      const rdsEngineCount = new Map<string, number>();
      for (const i of aRDS) { const k = normalizeRDSEngine(i.engine); rdsEngineCount.set(k, (rdsEngineCount.get(k) || 0) + 1); }

      const ec2Items: ResourceCostItem[] = aEC2.map(i => ({
        resourceId: i.instanceId, resourceName: i.name, resourceType: 'EC2' as const,
        account: i.account, region: i.region,
        cost: (ec2ByType.get(i.instanceType) || 0) / (ec2TypeCount.get(i.instanceType) || 1),
        currency: 'USD', instanceType: i.instanceType, state: i.state,
      }));

      const rdsItems: ResourceCostItem[] = aRDS.map(i => {
        const ek = normalizeRDSEngine(i.engine);
        return {
          resourceId: i.dbInstanceIdentifier, resourceName: i.dbInstanceIdentifier, resourceType: 'RDS' as const,
          account: i.account, region: i.region,
          cost: (rdsByEngine.get(ek) || 0) / (rdsEngineCount.get(ek) || 1),
          currency: 'USD', instanceType: i.dbInstanceClass, state: i.status,
        };
      });

      return { ec2Items, rdsItems };
    }));

    const resources: ResourceCostItem[] = [];
    let ec2Total = 0, rdsTotal = 0;
    for (const { ec2Items, rdsItems } of accountResults) {
      resources.push(...ec2Items, ...rdsItems);
      ec2Total += ec2Items.reduce((s, r) => s + r.cost, 0);
      rdsTotal += rdsItems.reduce((s, r) => s + r.cost, 0);
    }

    const result: ResourceCostsSummary = {
      startDate, endDate,
      totalCost: ec2Total + rdsTotal,
      ec2TotalCost: ec2Total, rdsTotalCost: rdsTotal,
      currency: 'USD',
      resources: resources.sort((a, b) => b.cost - a.cost),
    };

    this.costsCache = { data: result, timestamp: Date.now(), cacheKey };
    this.logger.info(`Costs fetched in ${Date.now() - t0}ms: EC2=$${ec2Total.toFixed(2)}, RDS=$${rdsTotal.toFixed(2)}`);
    return result;
  }

  // ---- Legacy methods ----

  async getCostAndUsage(startDate: string, endDate: string, tagKey?: string, tagValue?: string): Promise<CostData> {
    const filter = tagKey && tagValue ? { Tags: { Key: tagKey, Values: [tagValue] } } : undefined;
    const client = this.accounts.length > 0 ? this.createCostExplorerClient(this.accounts[0]) : new CostExplorerClient({ region: 'us-east-1' });
    const response = await client.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: startDate, End: endDate }, Granularity: Granularity.DAILY,
      Metrics: ['UnblendedCost', 'UsageQuantity'], Filter: filter,
    }));
    const costs = (response.ResultsByTime || []).map(r => ({ date: r.TimePeriod?.Start || '', amount: parseFloat(r.Total?.UnblendedCost?.Amount || '0'), unit: r.Total?.UnblendedCost?.Unit || 'USD' }));
    return { startDate, endDate, totalCost: costs.reduce((s, c) => s + c.amount, 0), currency: 'USD', costs };
  }

  async getCostByService(startDate: string, endDate: string, tagKey?: string, tagValue?: string): Promise<CostByService[]> {
    const filter = tagKey && tagValue ? { Tags: { Key: tagKey, Values: [tagValue] } } : undefined;
    const client = this.accounts.length > 0 ? this.createCostExplorerClient(this.accounts[0]) : new CostExplorerClient({ region: 'us-east-1' });
    const response = await client.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: startDate, End: endDate }, Granularity: Granularity.MONTHLY,
      Metrics: ['UnblendedCost'], GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }], Filter: filter,
    }));
    const m = new Map<string, number>();
    response.ResultsByTime?.forEach(r => r.Groups?.forEach(g => { const s = g.Keys?.[0] || ''; const c = parseFloat(g.Metrics?.UnblendedCost?.Amount || '0'); m.set(s, (m.get(s) || 0) + c); }));
    return Array.from(m.entries()).map(([service, cost]) => ({ service, cost, currency: 'USD' })).sort((a, b) => b.cost - a.cost);
  }

  async getCostForecast(startDate: string, endDate: string): Promise<CostForecast> {
    const client = this.accounts.length > 0 ? this.createCostExplorerClient(this.accounts[0]) : new CostExplorerClient({ region: 'us-east-1' });
    const response = await client.send(new GetCostForecastCommand({ TimePeriod: { Start: startDate, End: endDate }, Metric: 'UNBLENDED_COST', Granularity: Granularity.MONTHLY }));
    return { startDate, endDate, forecastedCost: parseFloat(response.Total?.Amount || '0'), currency: 'USD' };
  }
}

function normalizeRDSEngine(engine: string): string {
  const e = engine.toLowerCase();
  if (e.includes('aurora') && e.includes('mysql')) return 'Aurora MySQL';
  if (e.includes('aurora') && e.includes('postgres')) return 'Aurora PostgreSQL';
  if (e.includes('aurora')) return 'Aurora MySQL';
  if (e.includes('mysql')) return 'MySQL';
  if (e.includes('postgres')) return 'PostgreSQL';
  if (e.includes('mariadb')) return 'MariaDB';
  if (e.includes('oracle')) return 'Oracle';
  if (e.includes('sqlserver') || e.includes('sql server')) return 'SQL Server';
  return engine;
}
