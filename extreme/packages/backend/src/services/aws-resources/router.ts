import { Router } from 'express';
import { RouterOptions } from './types';
import { AwsResourcesService } from './service';

export async function createRouter(
  options: RouterOptions,
): Promise<Router> {
  const { logger, config } = options;
  const router = Router();
  
  const awsService = new AwsResourcesService(config, logger);

  router.get('/health', (_, res) => {
    res.json({ 
      status: 'ok',
      accounts: awsService.getAccountsInfo(),
      regions: awsService.getRegions(),
      devTags: awsService.getDevTags(),
    });
  });

  router.get('/ec2/instances', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const instances = await awsService.listEC2Instances(forceRefresh);
      res.json(instances);
    } catch (e: unknown) {
      logger.error('Error listing EC2 instances:', e as Error);
      res.status(500).json({ error: 'Failed to list EC2 instances' });
    }
  });

  router.get('/ec2/instances/debug/all', async (_req, res) => {
    try {
      const instances = await awsService.listAllEC2InstancesDebug();
      res.json(instances);
    } catch (e: unknown) {
      logger.error('Error listing all EC2 instances:', e as Error);
      res.status(500).json({ error: 'Failed to list all EC2 instances' });
    }
  });

  router.post('/ec2/instances/:instanceId/start', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account } = req.body;
      if (!region || !account) {
        res.status(400).json({ error: 'region and account are required' });
        return;
      }
      const result = await awsService.startEC2Instance(instanceId, region, account);
      res.json(result);
    } catch (e: unknown) {
      logger.error(`Error starting EC2 instance ${req.params.instanceId}:`, e as Error);
      res.status(500).json({ error: 'Failed to start EC2 instance' });
    }
  });

  router.post('/ec2/instances/:instanceId/stop', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account } = req.body;
      if (!region || !account) {
        res.status(400).json({ error: 'region and account are required' });
        return;
      }
      const result = await awsService.stopEC2Instance(instanceId, region, account);
      res.json(result);
    } catch (e: unknown) {
      logger.error(`Error stopping EC2 instance ${req.params.instanceId}:`, e as Error);
      res.status(500).json({ error: 'Failed to stop EC2 instance' });
    }
  });

  router.post('/ec2/instances/:instanceId/schedule', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account, startHour, stopHour } = req.body;
      if (!region || !account || !startHour || !stopHour) {
        res.status(400).json({ error: 'region, account, startHour, and stopHour are required' });
        return;
      }
      const result = await awsService.updateEC2InstanceSchedule(instanceId, region, account, startHour, stopHour);
      res.json(result);
    } catch (e: unknown) {
      logger.error(`Error updating EC2 instance schedule ${req.params.instanceId}:`, e as Error);
      res.status(500).json({ error: 'Failed to update EC2 instance schedule' });
    }
  });

  router.get('/rds/instances', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const instances = await awsService.listRDSInstances(forceRefresh);
      res.json(instances);
    } catch (e: unknown) {
      logger.error('Error listing RDS instances:', e as Error);
      res.status(500).json({ error: 'Failed to list RDS instances' });
    }
  });

  router.post('/rds/instances/:instanceId/start', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account } = req.body;
      if (!region || !account) {
        res.status(400).json({ error: 'region and account are required' });
        return;
      }
      const result = await awsService.startRDSInstance(instanceId, region, account);
      res.json(result);
    } catch (e: unknown) {
      logger.error(`Error starting RDS instance ${req.params.instanceId}:`, e as Error);
      res.status(500).json({ error: 'Failed to start RDS instance' });
    }
  });

  router.post('/rds/instances/:instanceId/stop', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account } = req.body;
      if (!region || !account) {
        res.status(400).json({ error: 'region and account are required' });
        return;
      }
      const result = await awsService.stopRDSInstance(instanceId, region, account);
      res.json(result);
    } catch (e: unknown) {
      logger.error(`Error stopping RDS instance ${req.params.instanceId}:`, e as Error);
      res.status(500).json({ error: 'Failed to stop RDS instance' });
    }
  });

  router.post('/cache/invalidate', (_, res) => {
    awsService.invalidateCache();
    res.json({ success: true, message: 'Cache invalidated' });
  });

  return router;
}
