import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

export interface CostData {
  startDate: string;
  endDate: string;
  totalCost: number;
  currency: string;
  costs: DailyCost[];
}

export interface DailyCost {
  date: string;
  amount: number;
  unit: string;
}

export interface CostByService {
  service: string;
  cost: number;
  currency: string;
}

export interface CostForecast {
  startDate: string;
  endDate: string;
  forecastedCost: number;
  currency: string;
}

export interface ResourceCostItem {
  resourceId: string;
  resourceName: string;
  resourceType: 'EC2' | 'RDS';
  account: string;
  region: string;
  cost: number;
  currency: string;
  instanceType: string;
  state: string;
}

export interface ResourceCostsSummary {
  startDate: string;
  endDate: string;
  totalCost: number;
  ec2TotalCost: number;
  rdsTotalCost: number;
  currency: string;
  resources: ResourceCostItem[];
}
