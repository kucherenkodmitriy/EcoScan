import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box, 
  Typography, 
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { getTrashBin } from '../services/api';
import { BinStatusReporter } from '../components/TrashBin/BinStatusReporter';
import { TrashBin } from '../types';

export const BinStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bin, setBin] = useState<TrashBin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBin = async () => {
      if (!id) {
        setError(new Error('No bin ID provided'));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const binData = await getTrashBin(id);
        setBin(binData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch bin data'));
      } finally {
        setLoading(false);
      }
    };

    fetchBin();
  }, [id]);

  const handleStatusUpdated = (updatedBin: TrashBin) => {
    setBin(updatedBin);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          EcoScan CZ
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Help keep your city clean
        </Typography>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error.message}
        </Alert>
      ) : bin ? (
        <>
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Trash Bin Information
            </Typography>
            <Typography variant="body1">
              <strong>Name:</strong> {bin.name}
            </Typography>
            <Typography variant="body1">
              <strong>Status:</strong> {bin.status}
            </Typography>
            <Typography variant="body1">
              <strong>Last Updated:</strong> {new Date(bin.lastUpdated).toLocaleString()}
            </Typography>
          </Paper>

          <BinStatusReporter bin={bin} onStatusUpdated={handleStatusUpdated} />
        </>
      ) : (
        <Alert severity="warning">Bin not found</Alert>
      )}
    </Container>
  );
}; 