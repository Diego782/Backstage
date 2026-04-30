import { Router } from 'express';
import { RouterOptions } from './types';
import { AwsResourcesService } from './service';

export async function createRouter(
  options: RouterOptions,
): Promise<Router> {
  const { logger, config } = options;
  const router = Router();
  
  const awsService = new AwsResourcesService(config, logger);

  // Health check
  router.get('/health', (_, res) => {
    res.json({ 
      status: 'ok',
      accounts: awsService.getAccountsInfo(),
      regions: awsService.getRegions(),
      devTags: awsService.getDevTags(),
    });
  });

  // EC2 Endpoints
  router.get('/ec2/instances', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const instances = await awsService.listEC2Instances(forceRefresh);
      res.json(instances);
    } catch (error) {
      logger.error('Error listing EC2 instances:', error);
      res.status(500).json({ error: 'Failed to list EC2 instances' });
    }
  });

  // Debug endpoint
  router.get('/ec2/instances/debug/all', async (req, res) => {
    try {
      const instances = await awsService.listAllEC2InstancesDebug();
      res.json(instances);
    } catch (error) {
      logger.error('Error listing all EC2 instances:', error);
      res.status(500).json({ error: 'Failed to list all EC2 instances' });
    }
  });

  router.post('/ec2/instances/:instanceId/start', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account } = req.body;
      if (!region || !account) {
        return res.status(400).json({ error: 'region and account are required' });
      }
      const result = await awsService.startEC2Instance(instanceId, region, account);
      res.json(result);
    } catch (error) {
      logger.error(`Error starting EC2 instance ${req.params.instanceId}:`, error);
      res.status(500).json({ error: 'Failed to start EC2 instance' });
    }
  });

  router.post('/ec2/instances/:instanceId/stop', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account } = req.body;
      if (!region || !account) {
        return res.status(400).json({ error: 'region and account are required' });
      }
      const result = await awsService.stopEC2Instance(instanceId, region, account);
      res.json(result);
    } catch (error) {
      logger.error(`Error stopping EC2 instance ${req.params.instanceId}:`, error);
      res.status(500).json({ error: 'Failed to stop EC2 instance' });
    }
  });

  router.post('/ec2/instances/:instanceId/schedule', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account, startHour, stopHour } = req.body;
      if (!region || !account || !startHour || !stopHour) {
        return res.status(400).json({ error: 'region, account, startHour, and stopHour are required' });
      }
      const result = await awsService.updateEC2InstanceSchedule(instanceId, region, account, startHour, stopHour);
      res.json(result);
    } catch (error) {
      logger.error(`Error updating EC2 instance schedule ${req.params.instanceId}:`, error);
      res.status(500).json({ error: 'Failed to update EC2 instance schedule' });
    }
  });

  // RDS Endpoints
  router.get('/rds/instances', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const instances = await awsService.listRDSInstances(forceRefresh);
      res.json(instances);
    } catch (error) {
      logger.error('Error listing RDS instances:', error);
      res.status(500).json({ error: 'Failed to list RDS instances' });
    }
  });

  router.post('/rds/instances/:instanceId/start', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account } = req.body;
      if (!region || !account) {
        return res.status(400).json({ error: 'region and account are required' });
      }
      const result = await awsService.startRDSInstance(instanceId, region, account);
      res.json(result);
    } catch (error) {
      logger.error(`Error starting RDS instance ${req.params.instanceId}:`, error);
      res.status(500).json({ error: 'Failed to start RDS instance' });
    }
  });

  router.post('/rds/instances/:instanceId/stop', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { region, account } = req.body;
      if (!region || !account) {
        return res.status(400).json({ error: 'region and account are required' });
      }
      const result = await awsService.stopRDSInstance(instanceId, region, account);
      res.json(result);
    } catch (error) {
      logger.error(`Error stopping RDS instance ${req.params.instanceId}:`, error);
      res.status(500).json({ error: 'Failed to stop RDS instance' });
    }
  });

  // Invalidate cache manually
  router.post('/cache/invalidate', (_, res) => {
    awsService.invalidateCache();
    res.json({ success: true, message: 'Cache invalidated' });
  });

  return router;
}
