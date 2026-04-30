import { Router } from 'express';
import { RouterOptions } from './types';
import { AwsPipelinesService } from './service';

export async function createRouter(
  options: RouterOptions,
): Promise<Router> {
  const { logger, config } = options;
  const router = Router();
  
  const pipelinesService = new AwsPipelinesService(config, logger);

  // Health check
  router.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  // List all pipelines
  router.get('/pipelines', async (req, res) => {
    try {
      const pipelines = await pipelinesService.listPipelines();
      res.json(pipelines);
    } catch (error) {
      logger.error('Error listing pipelines:', error);
      res.status(500).json({ error: 'Failed to list pipelines' });
    }
  });

  // Get pipeline details
  router.get('/pipelines/:pipelineName', async (req, res) => {
    try {
      const { pipelineName } = req.params;
      const pipeline = await pipelinesService.getPipelineState(pipelineName);
      res.json(pipeline);
    } catch (error) {
      logger.error(`Error getting pipeline ${req.params.pipelineName}:`, error);
      res.status(500).json({ error: 'Failed to get pipeline details' });
    }
  });

  // Start pipeline execution
  router.post('/pipelines/:pipelineName/execute', async (req, res) => {
    try {
      const { pipelineName } = req.params;
      const result = await pipelinesService.startPipelineExecution(pipelineName);
      res.json(result);
    } catch (error) {
      logger.error(`Error starting pipeline ${req.params.pipelineName}:`, error);
      res.status(500).json({ error: 'Failed to start pipeline execution' });
    }
  });

  // Get pipeline execution history
  router.get('/pipelines/:pipelineName/executions', async (req, res) => {
    try {
      const { pipelineName } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const executions = await pipelinesService.listPipelineExecutions(pipelineName, limit);
      res.json(executions);
    } catch (error) {
      logger.error(`Error getting pipeline executions for ${req.params.pipelineName}:`, error);
      res.status(500).json({ error: 'Failed to get pipeline executions' });
    }
  });

  // Get build logs
  router.get('/builds/:buildId/logs', async (req, res) => {
    try {
      const { buildId } = req.params;
      const logs = await pipelinesService.getBuildLogs(buildId);
      res.json(logs);
    } catch (error) {
      logger.error(`Error getting build logs for ${req.params.buildId}:`, error);
      res.status(500).json({ error: 'Failed to get build logs' });
    }
  });

  return router;
}
