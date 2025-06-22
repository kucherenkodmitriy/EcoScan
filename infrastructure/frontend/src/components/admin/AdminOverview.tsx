import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  TrashIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  MapIcon
} from '@heroicons/react/24/outline'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { getAllBins, getAnalytics } from '../../services/api'
import type { TrashBin } from '../../services/api'

const AdminOverview = () => {
  const [bins, setBins] = useState<TrashBin[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [binsData, analyticsData] = await Promise.all([
        getAllBins(),
        getAnalytics()
      ])
      setBins(binsData)
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusStats = () => {
    if (!bins.length) return { empty: 0, low: 0, medium: 0, high: 0, full: 0 }
    
    return bins.reduce((acc, bin) => {
      if (bin.status <= 2) acc.empty++
      else if (bin.status <= 4) acc.low++
      else if (bin.status <= 6) acc.medium++
      else if (bin.status <= 8) acc.high++
      else acc.full++
      return acc
    }, { empty: 0, low: 0, medium: 0, high: 0, full: 0 })
  }

  const getAverageStatus = () => {
    if (!bins.length) return "0"
    return (bins.reduce((sum, bin) => sum + bin.status, 0) / bins.length).toFixed(1)
  }

  const getRecentlyUpdated = () => {
    return bins
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 5)
  }

  const statusStats = getStatusStats()
  const averageStatus = getAverageStatus()
  const recentBins = getRecentlyUpdated()

  const statusDistributionData = [
    { name: 'Empty', value: statusStats.empty, color: '#10B981' },
    { name: 'Low', value: statusStats.low, color: '#F59E0B' },
    { name: 'Medium', value: statusStats.medium, color: '#F97316' },
    { name: 'High', value: statusStats.high, color: '#EF4444' },
    { name: 'Full', value: statusStats.full, color: '#DC2626' }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Stats Cards */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={itemVariants}
      >
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Bins</p>
              <p className="text-3xl font-bold text-gray-900">{bins.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <TrashIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-green-600">●</span>
            <span className="text-sm text-gray-600 ml-2">Active monitoring</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Status</p>
              <p className="text-3xl font-bold text-gray-900">{averageStatus}/10</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className={`text-sm ${parseFloat(averageStatus) > 6 ? 'text-red-600' : 'text-green-600'}`}>
              {parseFloat(averageStatus) > 6 ? '▲' : '▼'}
            </span>
            <span className="text-sm text-gray-600 ml-2">
              {parseFloat(averageStatus) > 6 ? 'Above optimal' : 'Within range'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Needs Attention</p>
              <p className="text-3xl font-bold text-gray-900">{statusStats.high + statusStats.full}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-red-600">●</span>
            <span className="text-sm text-gray-600 ml-2">High priority</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Reports</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.totalReports || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-green-600">●</span>
            <span className="text-sm text-gray-600 ml-2">This month</span>
          </div>
        </div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          variants={itemVariants}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bin Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${value} bins`, 'Count']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {statusDistributionData.map((item) => (
              <div key={item.name} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Trends Chart */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          variants={itemVariants}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reports Trend (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.trendsData?.slice(-7) || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: any) => [`${value}`, 'Reports']}
                />
                <Line 
                  type="monotone" 
                  dataKey="reports" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          variants={itemVariants}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Updated Bins</h3>
          <div className="space-y-4">
            {recentBins.map((bin) => {
              const getStatusColor = (status: number) => {
                if (status <= 2) return 'text-green-600 bg-green-100'
                if (status <= 4) return 'text-yellow-600 bg-yellow-100'
                if (status <= 6) return 'text-orange-600 bg-orange-100'
                if (status <= 8) return 'text-red-500 bg-red-100'
                return 'text-red-700 bg-red-200'
              }

              const getStatusLabel = (status: number) => {
                if (status <= 2) return 'Empty'
                if (status <= 4) return 'Low'
                if (status <= 6) return 'Medium'
                if (status <= 8) return 'High'
                return 'Full'
              }

              return (
                <div key={bin.binId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <MapIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{bin.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(bin.lastUpdated).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bin.status)}`}>
                      {getStatusLabel(bin.status)}
                    </span>
                    <span className="text-sm text-gray-500">{bin.status}/10</span>
                  </div>
                </div>
              )
            })}
            {recentBins.length === 0 && (
              <p className="text-gray-500 text-center py-8">No recent updates</p>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          variants={itemVariants}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Add New Bin</p>
                  <p className="text-sm text-green-100">Register a new trash bin location</p>
                </div>
                <TrashIcon className="w-6 h-6" />
              </div>
            </button>

            <button className="w-full p-4 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all duration-200 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">View Analytics</p>
                  <p className="text-sm text-blue-500">Detailed reports and insights</p>
                </div>
                <ChartBarIcon className="w-6 h-6" />
              </div>
            </button>

            <button className="w-full p-4 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-all duration-200 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">System Settings</p>
                  <p className="text-sm text-purple-500">Configure notifications and preferences</p>
                </div>
                <ClockIcon className="w-6 h-6" />
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default AdminOverview
