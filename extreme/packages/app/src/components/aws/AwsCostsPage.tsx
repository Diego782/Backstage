import React, { useState, useEffect } from 'react';
import {
  Header,
  Page,
  Content,
  Table,
  TableColumn,
  Progress,
  InfoCard,
} from '@backstage/core-components';
import {
  Box,
  Grid,
  Typography,
  TextField,
  Button,
  Chip,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';

interface ResourceCostItem {
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

interface ResourceCostsSummary {
  startDate: string;
  endDate: string;
  totalCost: number;
  ec2TotalCost: number;
  rdsTotalCost: number;
  currency: string;
  resources: ResourceCostItem[];
}

const API_BASE = 'http://localhost:7007/api/aws-costs';

const getStateColor = (state: string): 'primary' | 'default' | 'secondary' => {
  switch (state) {
    case 'running':
    case 'available':
      return 'primary';
    case 'stopped':
      return 'default';
    default:
      return 'secondary';
  }
};

const getTypeColor = (type: string): 'primary' | 'secondary' => {
  return type === 'EC2' ? 'primary' : 'secondary';
};

export const AwsCostsPage = () => {
  const [summary, setSummary] = useState<ResourceCostsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const fetchedRef = React.useRef(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const loadCosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE}/costs/resources?startDate=${startDate}&endDate=${endDate}`,
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load resource costs');
      }

      const data: ResourceCostsSummary = await response.json();
      setSummary(data);
      setLastFetched(Date.now());
    } catch (err: any) {
      console.error('Error loading resource costs:', err);
      setError(err.message || 'Error loading costs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      loadCosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Progress />;

  const columns: TableColumn<ResourceCostItem>[] = [
    {
      title: 'Resource Name',
      field: 'resourceName',
      highlight: true,
    },
    {
      title: 'Resource ID',
      field: 'resourceId',
    },
    {
      title: 'Type',
      render: row => (
        <Chip label={row.resourceType} color={getTypeColor(row.resourceType)} size="small" />
      ),
    },
    {
      title: 'State',
      render: row => (
        <Chip label={row.state} color={getStateColor(row.state)} size="small" />
      ),
    },
    {
      title: 'Instance Type',
      field: 'instanceType',
    },
    {
      title: 'Account',
      field: 'account',
    },
    {
      title: 'Region',
      field: 'region',
    },
    {
      title: 'Cost',
      render: row => (
        <Typography style={{ fontWeight: 600 }}>
          ${row.cost.toFixed(2)}
        </Typography>
      ),
      defaultSort: 'desc',
      customSort: (a, b) => a.cost - b.cost,
    },
    {
      title: '% of Total',
      render: row => {
        const percentage = summary && summary.totalCost > 0
          ? (row.cost / summary.totalCost) * 100
          : 0;
        return <Typography>{percentage.toFixed(1)}%</Typography>;
      },
    },
  ];

  const ec2Resources = summary?.resources.filter(r => r.resourceType === 'EC2') || [];
  const rdsResources = summary?.resources.filter(r => r.resourceType === 'RDS') || [];

  return (
    <Page themeId="tool">
      <Header
        title="AWS Resource Costs"
        subtitle="Costs for EC2 and RDS development instances"
      />
      <Content>
        {error && (
          <Box mb={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        <Box mb={3}>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item>
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item>
              <Button variant="contained" color="primary" onClick={loadCosts}>
                Load Costs
              </Button>
            </Grid>
          </Grid>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <InfoCard title="Total Cost">
              <Box textAlign="center" py={2}>
                <Typography variant="h3">
                  ${summary?.totalCost.toFixed(2) ?? '0.00'}
                </Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  USD
                </Typography>
              </Box>
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={3}>
            <InfoCard title="EC2 Cost">
              <Box textAlign="center" py={2}>
                <Typography variant="h3" style={{ color: '#3f51b5' }}>
                  ${summary?.ec2TotalCost.toFixed(2) ?? '0.00'}
                </Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  {ec2Resources.length} instances
                </Typography>
              </Box>
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={3}>
            <InfoCard title="RDS Cost">
              <Box textAlign="center" py={2}>
                <Typography variant="h3" style={{ color: '#f50057' }}>
                  ${summary?.rdsTotalCost.toFixed(2) ?? '0.00'}
                </Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  {rdsResources.length} instances
                </Typography>
              </Box>
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={3}>
            <InfoCard title="Period">
              <Box textAlign="center" py={2}>
                <Typography variant="h6">
                  {new Date(startDate).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  to
                </Typography>
                <Typography variant="h6">
                  {new Date(endDate).toLocaleDateString()}
                </Typography>
              </Box>
            </InfoCard>
          </Grid>
        </Grid>

        <Box mt={3}>
          <Box mb={1}>
            <Alert severity="info">
              Los costos por instancia son estimados: se obtiene el costo total de EC2 por tipo de instancia y de RDS por motor, y se distribuye proporcionalmente entre las instancias de desarrollo del mismo tipo.
            </Alert>
          </Box>
          <Table
            title={`Resource Costs (${summary?.resources.length ?? 0} resources)`}
            options={{ search: true, paging: true, pageSize: 20 }}
            columns={columns}
            data={summary?.resources ?? []}
          />
        </Box>
      </Content>
    </Page>
  );
};
