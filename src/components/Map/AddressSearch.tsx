import React, { useState } from 'react';
import { TextField, Button, Grid, Paper, Typography, Box } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Map } from './Map';
import { useMapLocation } from '../../hooks/useMapLocation';

interface AddressSearchProps {
  onLocationSelect: (address: string, latitude: number, longitude: number) => void;
  initialAddress?: string;
  initialLatitude?: number;
  initialLongitude?: number;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({
  onLocationSelect,
  initialAddress = '',
  initialLatitude = 0,
  initialLongitude = 0,
}) => {
  const {
    address,
    latitude,
    longitude,
    isLoading,
    error,
    setAddress,
    searchAddress,
    handleMapClick,
  } = useMapLocation(initialAddress, initialLatitude, initialLongitude);

  const handleSearch = async () => {
    await searchAddress();
    if (latitude && longitude) {
      onLocationSelect(address, latitude, longitude);
    }
  };

  const handleMapLocationSelected = async (lat: number, lng: number) => {
    await handleMapClick(lat, lng);
    onLocationSelect(address, lat, lng);
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Location Search
      </Typography>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={9}>
          <TextField
            fullWidth
            label="Address"
            variant="outlined"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isLoading}
            error={!!error}
            helperText={error?.message}
          />
        </Grid>
        <Grid item xs={3}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={handleSearch}
            disabled={isLoading || !address}
            startIcon={<SearchIcon />}
          >
            Search
          </Button>
        </Grid>
      </Grid>
      <Box sx={{ height: '400px', width: '100%', mb: 2 }}>
        <Map
          latitude={latitude}
          longitude={longitude}
          onClick={handleMapLocationSelected}
          showMarker={!!latitude && !!longitude}
        />
      </Box>
      {latitude !== 0 && longitude !== 0 && (
        <Typography variant="body2" color="textSecondary">
          Selected coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Typography>
      )}
    </Paper>
  );
}; 