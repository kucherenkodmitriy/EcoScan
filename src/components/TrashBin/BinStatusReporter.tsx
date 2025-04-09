import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Paper, 
  Typography, 
  CircularProgress,
  Grid,
  Alert,
  Snackbar
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { updateBinStatus } from '../../services/api';
import { TrashBin, BinStatus } from '../../types';

interface BinStatusReporterProps {
  bin: TrashBin;
  onStatusUpdated?: (bin: TrashBin) => void;
}

export const BinStatusReporter: React.FC<BinStatusReporterProps> = ({
  bin,
  onStatusUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const handleStatusUpdate = async (status: BinStatus) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedBin = await updateBinStatus(bin.id, status);
      
      setSuccess(true);
      
      if (onStatusUpdated) {
        onStatusUpdated(updatedBin);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update bin status'));
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSuccess(false);
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        Report Trash Bin Status
      </Typography>
      
      <Typography variant="body1" gutterBottom>
        Bin: {bin.name}
      </Typography>
      
      {loading ? (
        <Box display="flex" justifyContent="center" my={3}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={6}>
            <Button
              fullWidth
              variant="contained"
              color="success"
              size="large"
              startIcon={<CheckCircleIcon />}
              onClick={() => handleStatusUpdate(BinStatus.OK)}
              sx={{ py: 3 }}
            >
              OK
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              fullWidth
              variant="contained"
              color="error"
              size="large"
              startIcon={<ErrorIcon />}
              onClick={() => handleStatusUpdate(BinStatus.FULL)}
              sx={{ py: 3 }}
            >
              FULL
            </Button>
          </Grid>
        </Grid>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error.message}
        </Alert>
      )}
      
      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success">
          Thank you! Status has been updated successfully.
        </Alert>
      </Snackbar>
    </Paper>
  );
}; 