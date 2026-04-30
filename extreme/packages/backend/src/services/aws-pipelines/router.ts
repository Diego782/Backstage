import { Router } from 'express';
import { RouterOptions } from './types';
import { AwsPipelinesService } from './service';

export async function createRouter(
  options: RouterOptions,
): Promise<Router> {
  const { logger, config } = options;
  const router = Router();
  
  const pipelinesService = new AwsPipelinesService(config, logger);

  router.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/pipelines', async (_req, res) => {
    try {
      const pipelines = await pipelinesService.listPipelines();
      res.json(pipelines);
    } catch (e: unknown) {
      logger.error('Error listing pipelines:', e as Error);
      res.status(500).json({ error: 'Failed to list pipelines' });
    }
  });

  router.get('/pipelines/:pipelineName', async (req, res) => {
    try {
      const { pipelineName } = req.params;
      const pipeline = await pipelinesService.getPipelineState(pipelineName);
      res.json(pipeline);
    } catch (e: unknown) {
      logger.error(`Error getting pipeline ${req.params.pipelineName}:`, e as Error);
      res.status(500).json({ error: 'Failed to get pipeline details' });
    }
  });

  router.post('/pipelines/:pipelineName/execute', async (req, res) => {
    try {
      const { pipelineName } = req.params;
      const result = await pipelinesService.startPipelineExecution(pipelineName);
      res.json(result);
    } catch (e: unknown) {
      logger.error(`Error starting pipeline ${req.params.pipelineName}:`, e as Error);
      res.status(500).json({ error: 'Failed to start pipeline execution' });
    }
  });

  router.get('/pipelines/:pipelineName/executions', async (req, res) => {
    try {
      const { pipelineName } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const executions = await pipelinesService.listPipelineExecutions(pipelineName, limit);
      res.json(executions);
    } catch (e: unknown) {
      logger.error(`Error getting pipeline executions for ${req.params.pipelineName}:`, e as Error);
      res.status(500).json({ error: 'Failed to get pipeline executions' });
    }
  });

  router.get('/builds/:buildId/logs', async (req, res) => {
    try {
      const { buildId } = req.params;
      const logs = await pipelinesService.getBuildLogs(buildId);
      res.json(logs);
    } catch (e: unknown) {
      logger.error(`Error getting build logs for ${req.params.buildId}:`, e as Error);
      res.status(500).json({ error: 'Failed to get build logs' });
    }
  });

  return router;
}
