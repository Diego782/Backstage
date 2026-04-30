import { Router } from 'express';
import { RouterOptions } from './types';
import { AwsCostsService } from './service';

const RESOURCES_API_BASE = 'http://localhost:7007/api/aws-resources';

export async function createRouter(
  options: RouterOptions,
): Promise<Router> {
  const { logger, config } = options;
  const router = Router();
  
  const costsService = new AwsCostsService(config, logger);

  // Health check
  router.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  // NEW: Get costs only for EC2 and RDS resources from the resources section
  router.get('/costs/resources', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'startDate and endDate are required (format: YYYY-MM-DD)',
        });
      }

      // Fetch EC2 and RDS instances from the resources service
      const [ec2Response, rdsResponse] = await Promise.all([
        fetch(`${RESOURCES_API_BASE}/ec2/instances`),
        fetch(`${RESOURCES_API_BASE}/rds/instances`),
      ]);

      if (!ec2Response.ok || !rdsResponse.ok) {
        logger.error('Failed to fetch resources from aws-resources service');
        return res.status(502).json({ error: 'Failed to fetch resource data' });
      }

      const ec2Instances = await ec2Response.json();
      const rdsInstances = await rdsResponse.json();

      const summary = await costsService.getResourceCosts(
        ec2Instances,
        rdsInstances,
        startDate as string,
        endDate as string,
      );

      res.json(summary);
    } catch (error) {
      logger.error('Error getting resource costs:', error);
      res.status(500).json({ error: 'Failed to get resource costs' });
    }
  });

  // Get cost and usage (legacy)
  router.get('/costs', async (req, res) => {
    try {
      const { startDate, endDate, tagKey, tagValue } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          error: 'startDate and endDate are required (format: YYYY-MM-DD)' 
        });
      }

      const costs = await costsService.getCostAndUsage(
        startDate as string,
        endDate as string,
        tagKey as string | undefined,
        tagValue as string | undefined,
      );
      
      res.json(costs);
    } catch (error) {
      logger.error('Error getting costs:', error);
      res.status(500).json({ error: 'Failed to get cost data' });
    }
  });

  // Get cost by service (legacy)
  router.get('/costs/by-service', async (req, res) => {
    try {
      const { startDate, endDate, tagKey, tagValue } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          error: 'startDate and endDate are required (format: YYYY-MM-DD)' 
        });
      }

      const costs = await costsService.getCostByService(
        startDate as string,
        endDate as string,
        tagKey as string | undefined,
        tagValue as string | undefined,
      );
      
      res.json(costs);
    } catch (error) {
      logger.error('Error getting costs by service:', error);
      res.status(500).json({ error: 'Failed to get cost by service' });
    }
  });

  // Get cost forecast (legacy)
  router.get('/costs/forecast', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          error: 'startDate and endDate are required (format: YYYY-MM-DD)' 
        });
      }

      const forecast = await costsService.getCostForecast(
        startDate as string,
        endDate as string,
      );
      
      res.json(forecast);
    } catch (error) {
      logger.error('Error getting cost forecast:', error);
      res.status(500).json({ error: 'Failed to get cost forecast' });
    }
  });

  return router;
}
