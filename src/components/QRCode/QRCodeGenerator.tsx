import React, { useState, useEffect } from 'react';
import { Box, Button, Paper, Typography, CircularProgress } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { useQRCodes } from '../../hooks/useQRCodes';

interface QRCodeGeneratorProps {
  binId: string;
  qrCodeId?: string;
  baseUrl: string;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
  binId,
  qrCodeId,
  baseUrl,
}) => {
  const [url, setUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { getQRCodeById, createQRCode, loading, error } = useQRCodes();

  useEffect(() => {
    const fetchQRCode = async () => {
      if (qrCodeId) {
        try {
          const qrCode = await getQRCodeById(qrCodeId);
          setUrl(qrCode.url);
        } catch (error) {
          console.error('Error fetching QR code:', error);
        }
      }
    };

    if (qrCodeId) {
      fetchQRCode();
    }
  }, [qrCodeId, getQRCodeById]);

  const handleGenerateQRCode = async () => {
    try {
      setIsGenerating(true);
      const newQRCode = await createQRCode(binId);
      setUrl(newQRCode.url);
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;

    // Convert SVG to a data URL
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      // Create a download link
      const a = document.createElement('a');
      a.download = `qrcode-bin-${binId}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const fullUrl = url ? `${baseUrl}${url}` : '';

  return (
    <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        QR Code for Bin
      </Typography>

      {loading && <CircularProgress size={24} sx={{ mb: 2 }} />}

      {error && (
        <Typography color="error" gutterBottom>
          {error.message}
        </Typography>
      )}

      {!url && !loading && (
        <Button
          variant="contained"
          color="primary"
          onClick={handleGenerateQRCode}
          disabled={isGenerating || !binId}
          sx={{ mb: 2 }}
        >
          {isGenerating ? <CircularProgress size={24} /> : 'Generate QR Code'}
        </Button>
      )}

      {url && (
        <Box sx={{ mt: 2 }}>
          <QRCodeSVG
            id="qr-code"
            value={fullUrl}
            size={200}
            level="H"
            includeMargin
            bgColor="#ffffff"
            fgColor="#000000"
          />
          <Typography variant="body2" sx={{ mt: 2, mb: 2, wordBreak: 'break-all' }}>
            URL: {fullUrl}
          </Typography>
          <Button variant="outlined" color="primary" onClick={handleDownload}>
            Download QR Code
          </Button>
        </Box>
      )}
    </Paper>
  );
}; 