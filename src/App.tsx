import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { awsExports } from './config/aws-config';
import { AuthProvider } from './context/AuthContext';
import { MapProvider } from './context/MapContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/auth/Login';
import { AdminDashboard } from './pages/admin/Dashboard';
import { BinStatusPage } from './pages/BinStatusPage';
import { NotFound } from './pages/NotFound';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2e7d32', // Green for environmental theme
    },
    secondary: {
      main: '#00796b',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

function App() {
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'your-maps-api-key';
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <MapProvider googleMapsApiKey={googleMapsApiKey}>
          <Router>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/bin/:id" element={<BinStatusPage />} />
              <Route path="/admin" element={<Layout />}>
                <Route 
                  path="dashboard" 
                  element={
                    <ProtectedRoute>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } 
                />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </MapProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 