import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Header,
  Page,
  Content,
  Table,
  TableColumn,
  Progress,
  TabbedLayout,
} from '@backstage/core-components';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import StopIcon from '@material-ui/icons/Stop';
import ScheduleIcon from '@material-ui/icons/Schedule';
import RefreshIcon from '@material-ui/icons/Refresh';
import { Alert } from '@material-ui/lab';

interface EC2Instance {
  instanceId: string;
  name: string;
  state: string;
  instanceType: string;
  availabilityZone: string;
  tags: Record<string, string>;
  account: string;
  region: string;
  autoStartHour?: string;
  autoStopHour?: string;
}

interface RDSInstance {
  dbInstanceIdentifier: string;
  dbInstanceClass: string;
  engine: string;
  engineVersion: string;
  status: string;
  endpoint?: { address: string; port: number };
  account: string;
  region: string;
  autoStartHour?: string;
  autoStopHour?: string;
}

const API_BASE = '/api/aws-resources';

const getStateColor = (state: string) => {
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

const formatAge = (timestamp: number) => {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
};

// Shared data hook — loads once, caches in memory
function useResourceData() {
  const [ec2Instances, setEC2Instances] = useState<EC2Instance[]>([]);
  const [rdsInstances, setRDSInstances] = useState<RDSInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const fetchedRef = useRef(false);

  const loadAll = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      const refreshParam = forceRefresh ? '?refresh=true' : '';
      const [ec2Res, rdsRes] = await Promise.all([
        fetch(`${API_BASE}/ec2/instances${refreshParam}`),
        fetch(`${API_BASE}/rds/instances${refreshParam}`),
      ]);
      const [ec2Data, rdsData] = await Promise.all([ec2Res.json(), rdsRes.json()]);
      setEC2Instances(Array.isArray(ec2Data) ? ec2Data : []);
      setRDSInstances(Array.isArray(rdsData) ? rdsData : []);
      setLastFetched(Date.now());
    } catch (error) {
      console.error('Error loading resources:', error);
      setEC2Instances([]);
      setRDSInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      loadAll();
    }
  }, [loadAll]);

  return { ec2Instances, rdsInstances, loading, lastFetched, refresh: () => loadAll(true) };
}

interface EC2TabProps {
  instances: EC2Instance[];
  loading: boolean;
  lastFetched: number;
  onRefresh: () => void;
}

const EC2Tab = ({ instances, loading, lastFetched, onRefresh }: EC2TabProps) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<EC2Instance | null>(null);
  const [startHour, setStartHour] = useState('8');
  const [stopHour, setStopHour] = useState('18');

  const handleAction = async (instance: EC2Instance, action: 'start' | 'stop') => {
    try {
      setActionLoading(instance.instanceId);
      const response = await fetch(`${API_BASE}/ec2/instances/${instance.instanceId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: instance.region, account: instance.account }),
      });
      const result = await response.json();
      setMessage(result.message);
      setTimeout(() => setMessage(null), 3000);
      onRefresh();
    } catch (error) {
      console.error(`Error ${action}ing instance:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenScheduleDialog = (instance: EC2Instance) => {
    setSelectedInstance(instance);
    setStartHour(instance.autoStartHour || '8');
    setStopHour(instance.autoStopHour || '18');
    setScheduleDialogOpen(true);
  };

  const handleUpdateSchedule = async () => {
    if (!selectedInstance) return;
    try {
      const response = await fetch(`${API_BASE}/ec2/instances/${selectedInstance.instanceId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: selectedInstance.region, account: selectedInstance.account, startHour, stopHour }),
      });
      const result = await response.json();
      setMessage(result.message);
      setTimeout(() => setMessage(null), 5000);
      setScheduleDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  if (loading) return <Progress />;

  const filtered = instances.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.instanceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.account.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const columns: TableColumn<EC2Instance>[] = [
    { title: 'Name', field: 'name', highlight: true },
    { title: 'Instance ID', field: 'instanceId' },
    { title: 'State', render: row => <Chip label={row.state} color={getStateColor(row.state)} size="small" /> },
    { title: 'Type', field: 'instanceType' },
    { title: 'Account', field: 'account' },
    { title: 'Region', field: 'region' },
    { title: 'Schedule', render: row => <span>{row.autoStartHour && row.autoStopHour ? `${row.autoStartHour}:00 - ${row.autoStopHour}:00` : '-'}</span> },
    {
      title: 'Actions',
      render: row => (
        <Box>
          <Tooltip title="Start"><span>
            <IconButton size="small" onClick={() => handleAction(row, 'start')} disabled={row.state === 'running' || actionLoading === row.instanceId} color="primary"><PlayArrowIcon /></IconButton>
          </span></Tooltip>
          <Tooltip title="Stop"><span>
            <IconButton size="small" onClick={() => handleAction(row, 'stop')} disabled={row.state === 'stopped' || actionLoading === row.instanceId} color="secondary"><StopIcon /></IconButton>
          </span></Tooltip>
          <Tooltip title="Edit Schedule">
            <IconButton size="small" onClick={() => handleOpenScheduleDialog(row)} color="default"><ScheduleIcon /></IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      {message && <Box mb={2}><Alert severity="success">{message}</Alert></Box>}
      <Box display="flex" mb={2} alignItems="center" style={{ gap: '16px' }}>
        <TextField label="Search" variant="outlined" size="small" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ minWidth: 300 }} />
        <Tooltip title="Force refresh from AWS">
          <IconButton onClick={onRefresh} color="primary"><RefreshIcon /></IconButton>
        </Tooltip>
        {lastFetched > 0 && <Typography variant="caption" color="textSecondary">Updated {formatAge(lastFetched)}</Typography>}
      </Box>
      <Table title={`EC2 Development Instances (${filtered.length})`} options={{ search: false, paging: true, pageSize: 10 }} columns={columns} data={filtered} />

      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)}>
        <DialogTitle>Edit Auto Start/Stop Schedule</DialogTitle>
        <DialogContent>
          <Box mb={2}><strong>Instance:</strong> {selectedInstance?.name} ({selectedInstance?.instanceId})</Box>
          <Box mb={2}><strong>Account:</strong> {selectedInstance?.account} | <strong>Region:</strong> {selectedInstance?.region}</Box>
          <TextField label="Start Hour (0-23)" type="number" value={startHour} onChange={e => setStartHour(e.target.value)} inputProps={{ min: 0, max: 23 }} fullWidth margin="normal" />
          <TextField label="Stop Hour (0-23)" type="number" value={stopHour} onChange={e => setStopHour(e.target.value)} inputProps={{ min: 0, max: 23 }} fullWidth margin="normal" />
          <Box mt={2}><Alert severity="info">Instance will automatically start at {startHour}:00 and stop at {stopHour}:00 (UTC)</Alert></Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateSchedule} color="primary" variant="contained">Update Schedule</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

interface RDSTabProps {
  instances: RDSInstance[];
  loading: boolean;
  lastFetched: number;
  onRefresh: () => void;
}

const RDSTab = ({ instances, loading, lastFetched, onRefresh }: RDSTabProps) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAction = async (instance: RDSInstance, action: 'start' | 'stop') => {
    try {
      setActionLoading(instance.dbInstanceIdentifier);
      const response = await fetch(`${API_BASE}/rds/instances/${instance.dbInstanceIdentifier}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: instance.region, account: instance.account }),
      });
      const result = await response.json();
      setMessage(result.message);
      setTimeout(() => setMessage(null), 3000);
      onRefresh();
    } catch (error) {
      console.error(`Error ${action}ing RDS instance:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <Progress />;

  const columns: TableColumn<RDSInstance>[] = [
    { title: 'DB Identifier', field: 'dbInstanceIdentifier', highlight: true },
    { title: 'Status', render: row => <Chip label={row.status} color={getStateColor(row.status)} size="small" /> },
    { title: 'Engine', render: row => <span>{`${row.engine} ${row.engineVersion}`}</span> },
    { title: 'Class', field: 'dbInstanceClass' },
    { title: 'Account', field: 'account' },
    { title: 'Region', field: 'region' },
    { title: 'Schedule', render: row => <span>{row.autoStartHour && row.autoStopHour ? `${row.autoStartHour}:00 - ${row.autoStopHour}:00` : '-'}</span> },
    {
      title: 'Actions',
      render: row => (
        <Box>
          <Tooltip title="Start"><span>
            <IconButton size="small" onClick={() => handleAction(row, 'start')} disabled={row.status === 'available' || actionLoading === row.dbInstanceIdentifier} color="primary"><PlayArrowIcon /></IconButton>
          </span></Tooltip>
          <Tooltip title="Stop"><span>
            <IconButton size="small" onClick={() => handleAction(row, 'stop')} disabled={row.status === 'stopped' || actionLoading === row.dbInstanceIdentifier} color="secondary"><StopIcon /></IconButton>
          </span></Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      {message && <Box mb={2}><Alert severity="success">{message}</Alert></Box>}
      <Box display="flex" mb={2} alignItems="center" style={{ gap: '16px' }}>
        <Tooltip title="Force refresh from AWS">
          <IconButton onClick={onRefresh} color="primary"><RefreshIcon /></IconButton>
        </Tooltip>
        {lastFetched > 0 && <Typography variant="caption" color="textSecondary">Updated {formatAge(lastFetched)}</Typography>}
      </Box>
      <Table title={`RDS Development Instances (${instances.length})`} options={{ search: false, paging: true, pageSize: 10 }} columns={columns} data={instances} />
    </Box>
  );
};

export const AwsResourcesPage = () => {
  const { ec2Instances, rdsInstances, loading, lastFetched, refresh } = useResourceData();

  return (
    <Page themeId="tool">
      <Header title="AWS Development Resources" subtitle="Manage EC2 and RDS development instances across multiple accounts" />
      <Content>
        <TabbedLayout>
          <TabbedLayout.Route path="/" title="EC2 Instances">
            <EC2Tab instances={ec2Instances} loading={loading} lastFetched={lastFetched} onRefresh={refresh} />
          </TabbedLayout.Route>
          <TabbedLayout.Route path="/rds" title="RDS Instances">
            <RDSTab instances={rdsInstances} loading={loading} lastFetched={lastFetched} onRefresh={refresh} />
          </TabbedLayout.Route>
        </TabbedLayout>
      </Content>
    </Page>
  );
};
