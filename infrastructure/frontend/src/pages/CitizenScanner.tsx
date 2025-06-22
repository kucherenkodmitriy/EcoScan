import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  QrCodeIcon, 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  CameraIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import QrScanner from 'qr-scanner'
import toast from 'react-hot-toast'
import { submitBinStatus } from '../services/api'

const CitizenScanner = () => {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scannedBinId, setScannedBinId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scanner, setScanner] = useState<QrScanner | null>(null)

  const startScanning = useCallback(async () => {
    if (!videoRef.current) return

    try {
      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          const binId = extractBinId(result.data)
          if (binId) {
            setScannedBinId(binId)
            stopScanning()
            toast.success('QR Code scanned successfully!')
          } else {
            toast.error('Invalid QR code format')
          }
        },
        {
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      )

      await qrScanner.start()
      setScanner(qrScanner)
      setIsScanning(true)
    } catch (error) {
      console.error('Error starting scanner:', error)
      toast.error('Failed to access camera. Please check permissions.')
    }
  }, [])

  const stopScanning = useCallback(() => {
    if (scanner) {
      scanner.stop()
      scanner.destroy()
      setScanner(null)
    }
    setIsScanning(false)
  }, [scanner])

  const extractBinId = (qrData: string): string | null => {
    // Handle different QR code formats
    try {
      // Direct UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(qrData)) {
        return qrData
      }

      // URL format: extract bin ID from URL
      const urlMatch = qrData.match(/bin[Ii]d=([a-f0-9-]+)/i) || qrData.match(/bins\/([a-f0-9-]+)/i)
      if (urlMatch) {
        return urlMatch[1]
      }

      // JSON format
      const parsed = JSON.parse(qrData)
      return parsed.binId || parsed.bin_id || parsed.id || null
    } catch (error) {
      // Simple string format
      return qrData.includes('-') ? qrData : null
    }
  }

  const handleStatusSubmit = async () => {
    if (!scannedBinId || selectedStatus === null) return

    setIsSubmitting(true)
    try {
      await submitBinStatus(scannedBinId, selectedStatus)
      toast.success('Bin status reported successfully!')
      
      // Reset form
      setScannedBinId(null)
      setSelectedStatus(null)
      
      // Show success animation then redirect
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (error) {
      console.error('Error submitting status:', error)
      toast.error('Failed to submit status. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusInfo = (status: number) => {
    if (status <= 2) return { label: 'Empty', color: 'text-green-600', bg: 'bg-green-100' }
    if (status <= 4) return { label: 'Low', color: 'text-yellow-600', bg: 'bg-yellow-100' }
    if (status <= 6) return { label: 'Medium', color: 'text-orange-600', bg: 'bg-orange-100' }
    if (status <= 8) return { label: 'High', color: 'text-red-500', bg: 'bg-red-100' }
    return { label: 'Full', color: 'text-red-700', bg: 'bg-red-200' }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <motion.button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-green-600 hover:text-green-700 font-medium transition-colors"
              whileHover={{ x: -4 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span>Back to Home</span>
            </motion.button>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                EcoScan
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            Report Bin Status
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Scan the QR code on a trash bin and report its fullness level
          </p>

          <div className="space-y-8">
            {/* Step 1: QR Scanner */}
            <motion.div 
              className="bg-white rounded-3xl shadow-xl p-8 border border-green-100"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                  1
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Scan QR Code</h2>
              </div>

              {!scannedBinId ? (
                <div className="text-center">
                  <div className="relative mx-auto max-w-md">
                    <video
                      ref={videoRef}
                      className={`w-full h-64 bg-gray-900 rounded-2xl object-cover ${isScanning ? 'block' : 'hidden'}`}
                      playsInline
                      muted
                    />
                    
                    {!isScanning && (
                      <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                        <div className="text-center">
                          <CameraIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500 mb-4">Camera preview will appear here</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <motion.button
                    onClick={isScanning ? stopScanning : startScanning}
                    className={`mt-6 px-8 py-3 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                      isScanning 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="flex items-center space-x-3">
                      <QrCodeIcon className="w-6 h-6" />
                      <span>{isScanning ? 'Stop Scanning' : 'Start QR Scanner'}</span>
                    </div>
                  </motion.button>
                </div>
              ) : (
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <CheckCircleIcon className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">QR Code Scanned!</h3>
                  <p className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg inline-block font-mono">
                    Bin ID: {scannedBinId}
                  </p>
                </motion.div>
              )}
            </motion.div>

            {/* Step 2: Status Selection */}
            <AnimatePresence>
              {scannedBinId && (
                <motion.div 
                  className="bg-white rounded-3xl shadow-xl p-8 border border-green-100"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                      2
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Select Bin Status</h2>
                  </div>

                  <p className="text-gray-600 mb-6 text-center">
                    How full is this trash bin? Select the level that best matches what you see.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
                    {[0, 2, 4, 6, 8, 10].map((status) => {
                      const info = getStatusInfo(status)
                      const isSelected = selectedStatus === status
                      
                      return (
                        <motion.button
                          key={status}
                          onClick={() => setSelectedStatus(status)}
                          className={`p-4 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
                            isSelected 
                              ? 'border-green-600 bg-green-50 shadow-lg' 
                              : 'border-gray-200 hover:border-green-300 bg-white'
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <div className={`w-12 h-12 mx-auto mb-3 rounded-xl ${info.bg} flex items-center justify-center`}>
                            <div className={`w-8 h-8 bg-gradient-to-t from-gray-400 ${
                              status <= 2 ? 'to-gray-200' :
                              status <= 4 ? 'to-yellow-400' :
                              status <= 6 ? 'to-orange-400' :
                              status <= 8 ? 'to-red-400' : 'to-red-600'
                            } rounded`} style={{
                              background: `linear-gradient(to top, #gray 0%, #gray ${status * 10}%, transparent ${status * 10}%)`
                            }}>
                              <div className="w-full h-full border border-gray-300 rounded" style={{
                                background: `linear-gradient(to top, ${
                                  status <= 2 ? '#10B981' :
                                  status <= 4 ? '#F59E0B' :
                                  status <= 6 ? '#F97316' :
                                  status <= 8 ? '#EF4444' : '#DC2626'
                                } ${status * 10}%, transparent ${status * 10}%)`
                              }}></div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className={`text-sm font-medium ${info.color}`}>
                              {info.label}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {status}/10
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>

                  {selectedStatus !== null && (
                    <motion.div 
                      className="text-center"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <motion.button
                        onClick={handleStatusSubmit}
                        disabled={isSubmitting}
                        className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                        whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center space-x-3">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Submitting...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-3">
                            <CheckCircleIcon className="w-6 h-6" />
                            <span>Submit Report</span>
                          </div>
                        )}
                      </motion.button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default CitizenScanner
