import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

export interface Pipeline {
  name: string;
  created?: Date;
  updated?: Date;
  account?: string;
  region?: string;
}

export interface PipelineState {
  pipelineName: string;
  pipelineVersion: number;
  stages: StageState[];
  updated?: Date;
}

export interface StageState {
  stageName: string;
  status: string;
  actions: ActionState[];
}

export interface ActionState {
  actionName: string;
  status: string;
  lastStatusChange?: Date;
}

export interface PipelineExecution {
  pipelineExecutionId: string;
  status: string;
  startTime?: Date;
  lastUpdateTime?: Date;
  sourceRevisions?: SourceRevision[];
}

export interface SourceRevision {
  actionName: string;
  revisionId: string;
  revisionSummary?: string;
}

export interface BuildLogs {
  buildId: string;
  logs: LogEntry[];
  logGroupName: string;
  logStreamName: string;
}

export interface LogEntry {
  timestamp?: number;
  message: string;
}
