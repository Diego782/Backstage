import { useState, useEffect } from 'react';
import {
  Header,
  Page,
  Content,
  Table,
  TableColumn,
  Progress,
} from '@backstage/core-components';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import RefreshIcon from '@material-ui/icons/Refresh';
import InfoIcon from '@material-ui/icons/Info';
import { Alert } from '@material-ui/lab';

interface Pipeline {
  name: string;
  created?: string;
  updated?: string;
}

interface PipelineDetails {
  pipelineName: string;
  stages: Array<{
    stageName: string;
    status: string;
    actions: Array<{
      actionName: string;
      status: string;
    }>;
  }>;
}

const API_BASE = 'http://localhost:7007/api/aws-pipelines';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Succeeded':
      return 'primary';
    case 'Failed':
      return 'secondary';
    case 'InProgress':
      return 'default';
    default:
      return 'default';
  }
};

export const AwsPipelinesPage = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loadPipelines = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/pipelines`);
      const data = await response.json();
      setPipelines(data);
    } catch (error) {
      console.error('Error loading pipelines:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelines();
  }, []);

  const handleExecute = async (pipelineName: string) => {
    try {
      setActionLoading(pipelineName);
      const response = await fetch(`${API_BASE}/pipelines/${pipelineName}/execute`, {
        method: 'POST',
      });
      const result = await response.json();
      setMessage(`Pipeline ${pipelineName} started: ${result.executionId}`);
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error executing pipeline:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = async (pipelineName: string) => {
    try {
      const response = await fetch(`${API_BASE}/pipelines/${pipelineName}`);
      const data = await response.json();
      setSelectedPipeline(data);
      setDetailsOpen(true);
    } catch (error) {
      console.error('Error loading pipeline details:', error);
    }
  };

  if (loading) return <Progress />;

  const filtered = pipelines.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: TableColumn<Pipeline>[] = [
    { title: 'Pipeline Name', field: 'name', highlight: true },
    {
      title: 'Created',
      render: row => (
        <span>{row.created ? new Date(row.created).toLocaleDateString() : '-'}</span>
      ),
    },
    {
      title: 'Updated',
      render: row => (
        <span>{row.updated ? new Date(row.updated).toLocaleDateString() : '-'}</span>
      ),
    },
    {
      title: 'Actions',
      render: row => (
        <Box>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={() => handleViewDetails(row.name)}
              color="default"
            >
              <InfoIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Execute Pipeline">
            <span>
              <IconButton
                size="small"
                onClick={() => handleExecute(row.name)}
                disabled={actionLoading === row.name}
                color="primary"
              >
                <PlayArrowIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Page themeId="tool">
      <Header title="AWS Pipelines" subtitle="Manage CodePipeline executions" />
      <Content>
        {message && (
          <Box mb={2}>
            <Alert severity="success">{message}</Alert>
          </Box>
        )}
        <Box display="flex" mb={2} style={{ gap: '16px' }}>
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ minWidth: 300 }}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={loadPipelines} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Table
          title={`Pipelines (${filtered.length})`}
          options={{ search: false, paging: true, pageSize: 10 }}
          columns={columns}
          data={filtered}
        />

        <Dialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>{selectedPipeline?.pipelineName} - Details</DialogTitle>
          <DialogContent>
            {selectedPipeline?.stages.map(stage => (
              <Box key={stage.stageName} mb={2}>
                <Box display="flex" alignItems="center" mb={1} style={{ gap: '8px' }}>
                  <strong>{stage.stageName}</strong>
                  <Chip label={stage.status} color={getStatusColor(stage.status)} size="small" />
                </Box>
                <Box ml={2}>
                  {stage.actions.map(action => (
                    <Box key={action.actionName} display="flex" alignItems="center" mb={0.5} style={{ gap: '8px' }}>
                      <span>• {action.actionName}</span>
                      <Chip label={action.status} size="small" />
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsOpen(false)} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};
