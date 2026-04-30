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

  router.get('/health', (_, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/costs/resources', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required (format: YYYY-MM-DD)' });
        return;
      }

      const [ec2Response, rdsResponse] = await Promise.all([
        fetch(`${RESOURCES_API_BASE}/ec2/instances`),
        fetch(`${RESOURCES_API_BASE}/rds/instances`),
      ]);

      if (!ec2Response.ok || !rdsResponse.ok) {
        logger.error('Failed to fetch resources from aws-resources service');
        res.status(502).json({ error: 'Failed to fetch resource data' });
        return;
      }

      const ec2Instances = await ec2Response.json();
      const rdsInstances = await rdsResponse.json();

      const summary = await costsService.getResourceCosts(
        ec2Instances, rdsInstances, startDate as string, endDate as string,
      );
      res.json(summary);
    } catch (e: unknown) {
      logger.error('Error getting resource costs:', e as Error);
      res.status(500).json({ error: 'Failed to get resource costs' });
    }
  });

  router.get('/costs', async (req, res) => {
    try {
      const { startDate, endDate, tagKey, tagValue } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required (format: YYYY-MM-DD)' });
        return;
      }
      const costs = await costsService.getCostAndUsage(
        startDate as string, endDate as string, tagKey as string | undefined, tagValue as string | undefined,
      );
      res.json(costs);
    } catch (e: unknown) {
      logger.error('Error getting costs:', e as Error);
      res.status(500).json({ error: 'Failed to get cost data' });
    }
  });

  router.get('/costs/by-service', async (req, res) => {
    try {
      const { startDate, endDate, tagKey, tagValue } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required (format: YYYY-MM-DD)' });
        return;
      }
      const costs = await costsService.getCostByService(
        startDate as string, endDate as string, tagKey as string | undefined, tagValue as string | undefined,
      );
      res.json(costs);
    } catch (e: unknown) {
      logger.error('Error getting costs by service:', e as Error);
      res.status(500).json({ error: 'Failed to get cost by service' });
    }
  });

  router.get('/costs/forecast', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ error: 'startDate and endDate are required (format: YYYY-MM-DD)' });
        return;
      }
      const forecast = await costsService.getCostForecast(startDate as string, endDate as string);
      res.json(forecast);
    } catch (e: unknown) {
      logger.error('Error getting cost forecast:', e as Error);
      res.status(500).json({ error: 'Failed to get cost forecast' });
    }
  });

  return router;
}
