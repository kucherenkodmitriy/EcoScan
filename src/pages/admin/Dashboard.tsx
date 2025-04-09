import React, { useState } from 'react';
import { 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  Box, 
  Tabs, 
  Tab,
  Button,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MapIcon from '@mui/icons-material/Map';
import DeleteIcon from '@mui/icons-material/Delete';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import { useAuth } from '../../hooks/useAuth';
import { useLocations } from '../../hooks/useLocations';
import { useTrashBins } from '../../hooks/useTrashBins';
import { useQRCodes } from '../../hooks/useQRCodes';
import { BinStatus } from '../../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const { locations, loading: locationsLoading } = useLocations();
  const { trashBins, loading: binsLoading } = useTrashBins();
  const { qrCodes, loading: qrCodesLoading } = useQRCodes();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            You don't have permission to access the admin dashboard.
          </Typography>
        </Paper>
      </Container>
    );
  }

  const fullBins = trashBins.filter(bin => bin.status === BinStatus.FULL).length;
  const totalBins = trashBins.length;
  const locationCount = locations.length;
  const qrCodeCount = qrCodes.length;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard
      </Typography>
      
      {user && (
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Welcome, {user.username}
        </Typography>
      )}

      {/* Dashboard Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Total Bins
            </Typography>
            <Typography variant="h3" component="div" sx={{ flexGrow: 1 }}>
              {binsLoading ? <CircularProgress size={30} /> : totalBins}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Full Bins
            </Typography>
            <Typography variant="h3" component="div" sx={{ flexGrow: 1 }}>
              {binsLoading ? <CircularProgress size={30} /> : fullBins}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Locations
            </Typography>
            <Typography variant="h3" component="div" sx={{ flexGrow: 1 }}>
              {locationsLoading ? <CircularProgress size={30} /> : locationCount}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              QR Codes
            </Typography>
            <Typography variant="h3" component="div" sx={{ flexGrow: 1 }}>
              {qrCodesLoading ? <CircularProgress size={30} /> : qrCodeCount}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Main Tabs */}
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab icon={<MapIcon />} label="Locations" />
          <Tab label="Trash Bins" />
          <Tab icon={<QrCodeIcon />} label="QR Codes" />
        </Tabs>

        {/* Locations Tab */}
        <TabPanel value={tabIndex} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">Locations</Typography>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<AddIcon />}
            >
              Add Location
            </Button>
          </Box>
          
          {locationsLoading ? (
            <Box display="flex" justifyContent="center" sx={{ my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {locations.length === 0 ? (
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography>No locations found. Create your first location.</Typography>
                  </Paper>
                </Grid>
              ) : (
                locations.map(location => (
                  <Grid item xs={12} sm={6} md={4} key={location.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6">{location.name}</Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {location.address}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Coordinates:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button size="small">Edit</Button>
                        <Button size="small" color="error" startIcon={<DeleteIcon />}>
                          Delete
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}
        </TabPanel>

        {/* Trash Bins Tab */}
        <TabPanel value={tabIndex} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">Trash Bins</Typography>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<AddIcon />}
            >
              Add Trash Bin
            </Button>
          </Box>
          
          {binsLoading ? (
            <Box display="flex" justifyContent="center" sx={{ my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {trashBins.length === 0 ? (
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography>No trash bins found. Create your first bin.</Typography>
                  </Paper>
                </Grid>
              ) : (
                trashBins.map(bin => (
                  <Grid item xs={12} sm={6} md={4} key={bin.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="h6">{bin.name}</Typography>
                          <Chip
                            label={bin.status}
                            color={bin.status === BinStatus.FULL ? 'error' : 'success'}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Last Updated:</strong> {new Date(bin.lastUpdated).toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Location ID:</strong> {bin.locationId}
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button size="small">Edit</Button>
                        <Button size="small" color="primary" startIcon={<QrCodeIcon />}>
                          QR Code
                        </Button>
                        <Button size="small" color="error" startIcon={<DeleteIcon />}>
                          Delete
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}
        </TabPanel>

        {/* QR Codes Tab */}
        <TabPanel value={tabIndex} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">QR Codes</Typography>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<QrCodeIcon />}
            >
              Generate QR Code
            </Button>
          </Box>
          
          {qrCodesLoading ? (
            <Box display="flex" justifyContent="center" sx={{ my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {qrCodes.length === 0 ? (
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography>No QR codes found. Generate your first QR code.</Typography>
                  </Paper>
                </Grid>
              ) : (
                qrCodes.map(qrCode => (
                  <Grid item xs={12} sm={6} md={4} key={qrCode.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6">QR Code</Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Created:</strong> {new Date(qrCode.createdAt).toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Bin ID:</strong> {qrCode.binId}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          <strong>URL:</strong> {qrCode.url}
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button size="small" color="primary" startIcon={<QrCodeIcon />}>
                          View
                        </Button>
                        <Button size="small" color="error" startIcon={<DeleteIcon />}>
                          Delete
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}
        </TabPanel>
      </Paper>
    </Container>
  );
}; 