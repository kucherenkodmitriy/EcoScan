import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  PencilIcon,
  QrCodeIcon,
  MapPinIcon,
  ClockIcon,
  EyeIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { getAllBins, createBin, updateBin, deleteBin, generateQRCodeData } from '../../services/api'
import type { TrashBin, CreateBinRequest } from '../../services/api'

const BinManagement = () => {
  const navigate = useNavigate()
  const [bins, setBins] = useState<TrashBin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState('')

  useEffect(() => {
    loadBins()
  }, [])

  const loadBins = async () => {
    try {
      const data = await getAllBins()
      setBins(data)
    } catch (error) {
      console.error('Error loading bins:', error)
      toast.error('Failed to load bins')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredBins = bins.filter(bin => {
    const matchesSearch = bin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bin.binId.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'empty' && bin.status <= 2) ||
                         (statusFilter === 'low' && bin.status > 2 && bin.status <= 4) ||
                         (statusFilter === 'medium' && bin.status > 4 && bin.status <= 6) ||
                         (statusFilter === 'high' && bin.status > 6 && bin.status <= 8) ||
                         (statusFilter === 'full' && bin.status > 8)
    
    return matchesSearch && matchesStatus
  })

  const getStatusInfo = (status: number) => {
    if (status <= 2) return { label: 'Empty', color: 'text-green-600', bg: 'bg-green-100' }
    if (status <= 4) return { label: 'Low', color: 'text-yellow-600', bg: 'bg-yellow-100' }
    if (status <= 6) return { label: 'Medium', color: 'text-orange-600', bg: 'bg-orange-100' }
    if (status <= 8) return { label: 'High', color: 'text-red-500', bg: 'bg-red-100' }
    return { label: 'Full', color: 'text-red-700', bg: 'bg-red-200' }
  }

  const generateQRCode = async (bin: TrashBin) => {
    try {
      const qrData = generateQRCodeData(bin.binId)
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#059669', // Green color
          light: '#ffffff'
        }
      })
      setQrCodeUrl(qrCodeDataUrl)
      setSelectedBin(bin)
      setShowQRModal(true)
    } catch (error) {
      console.error('Error generating QR code:', error)
      toast.error('Failed to generate QR code')
    }
  }

  const downloadQRCode = () => {
    if (!qrCodeUrl || !selectedBin) return
    
    const link = document.createElement('a')
    link.download = `ecoscan-qr-${selectedBin.name.replace(/\s+/g, '-').toLowerCase()}.png`
    link.href = qrCodeUrl
    link.click()
  }

  const handleDeleteBin = async (binId: string) => {
    if (!confirm('Are you sure you want to delete this bin? This action cannot be undone.')) {
      return
    }

    try {
      await deleteBin(binId)
      setBins(bins.filter(bin => bin.binId !== binId))
      toast.success('Bin deleted successfully')
    } catch (error) {
      console.error('Error deleting bin:', error)
      toast.error('Failed to delete bin')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bins...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bin Management</h2>
          <p className="text-gray-600">Manage trash bin locations and generate QR codes</p>
        </div>
        <motion.button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <PlusIcon className="w-5 h-5" />
          <span>Add New Bin</span>
        </motion.button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search bins by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200"
            >
              <option value="all">All Status</option>
              <option value="empty">Empty</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="full">Full</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>Showing {filteredBins.length} of {bins.length} bins</span>
          <span>Total: {bins.length} bins registered</span>
        </div>
      </div>

      {/* Bins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredBins.map((bin, index) => {
            const statusInfo = getStatusInfo(bin.status)
            return (
              <motion.div
                key={bin.binId}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-green-100 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                {/* Status Bar */}
                <div className={`h-2 ${statusInfo.bg}`}></div>
                
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{bin.name}</h3>
                      <p className="text-sm text-gray-500 font-mono">{bin.binId}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bg}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Status Info */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Fullness Level</span>
                      <span className="text-sm font-medium text-gray-900">{bin.status}/10</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          bin.status <= 2 ? 'bg-green-500' :
                          bin.status <= 4 ? 'bg-yellow-500' :
                          bin.status <= 6 ? 'bg-orange-500' :
                          bin.status <= 8 ? 'bg-red-500' : 'bg-red-700'
                        }`}
                        style={{ width: `${bin.status * 10}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Location */}
                  {bin.location && (
                    <div className="mb-4 flex items-start space-x-2">
                      <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600">{bin.location.address}</p>
                    </div>
                  )}

                  {/* Last Updated */}
                  <div className="mb-6 flex items-center space-x-2 text-sm text-gray-500">
                    <ClockIcon className="w-4 h-4" />
                    <span>Updated {new Date(bin.lastUpdated).toLocaleDateString()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <motion.button
                      onClick={() => generateQRCode(bin)}
                      className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <QrCodeIcon className="w-4 h-4" />
                      <span className="text-sm">QR Code</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => navigate(`/admin/bins/${bin.binId}`)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <EyeIcon className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                      onClick={() => handleDeleteBin(bin.binId)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {filteredBins.length === 0 && (
        <motion.div 
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <TrashIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bins found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by adding your first trash bin'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <motion.button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Add Your First Bin
            </motion.button>
          )}
        </motion.div>
      )}

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && selectedBin && (
          <motion.div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowQRModal(false)}
          >
            <motion.div 
              className="bg-white rounded-3xl p-8 max-w-md w-full"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">QR Code</h3>
                <p className="text-gray-600 mb-6">{selectedBin.name}</p>
                
                <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code" 
                    className="mx-auto mb-4"
                  />
                  <p className="text-sm text-gray-500 font-mono break-all">
                    ID: {selectedBin.binId}
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={downloadQRCode}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors duration-200"
                  >
                    Download QR Code
                  </button>
                  <button
                    onClick={() => setShowQRModal(false)}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors duration-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Bin Modal */}
      <AddBinModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false)
          loadBins()
        }}
      />
    </div>
  )
}

// Add Bin Modal Component
const AddBinModal = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const binData: CreateBinRequest = {
        name: formData.name,
        location: {
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          address: formData.address
        }
      }

      await createBin(binData)
      toast.success('Bin created successfully!')
      onSuccess()
      setFormData({ name: '', address: '', latitude: '', longitude: '' })
    } catch (error) {
      console.error('Error creating bin:', error)
      toast.error('Failed to create bin')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <motion.div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="bg-white rounded-3xl p-8 max-w-md w-full"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-900 mb-6">Add New Bin</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bin Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., Central Park Main Entrance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Street address or landmark"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.latitude}
                onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="40.7829"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                required
                value={formData.longitude}
                onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="-73.9654"
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors duration-200 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Bin'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default BinManagement
