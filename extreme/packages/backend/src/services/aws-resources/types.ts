import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

export interface EC2Instance {
  instanceId: string;
  name: string;
  state: 'pending' | 'running' | 'stopping' | 'stopped' | 'shutting-down' | 'terminated';
  instanceType: string;
  availabilityZone: string;
  launchTime?: Date;
  tags: Record<string, string>;
  account: string;
  region: string;
  autoStartHour?: string;
  autoStopHour?: string;
}

export interface RDSInstance {
  dbInstanceIdentifier: string;
  dbInstanceClass: string;
  engine: string;
  engineVersion: string;
  status: string;
  endpoint?: {
    address: string;
    port: number;
  };
  availabilityZone: string;
  tags: Record<string, string>;
  account: string;
  region: string;
  autoStartHour?: string;
  autoStopHour?: string;
}

export interface InstanceActionRequest {
  instanceId: string;
  action: 'start' | 'stop';
  region: string;
  account: string;
}

export interface InstanceScheduleUpdateRequest {
  instanceId: string;
  region: string;
  account: string;
  startHour: string;
  stopHour: string;
}

export interface InstanceActionResponse {
  success: boolean;
  message: string;
  previousState?: string;
  currentState?: string;
}
