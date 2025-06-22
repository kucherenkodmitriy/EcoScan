import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  MapIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area 
} from 'recharts'
import { getAnalytics, getAllBins } from '../../services/api'

const Analytics = () => {
  const [analytics, setAnalytics] = useState<any>(null)
  const [bins, setBins] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d')

  useEffect(() => {
    loadAnalyticsData()
  }, [selectedTimeframe])

  const loadAnalyticsData = async () => {
    try {
      const [analyticsData, binsData] = await Promise.all([
        getAnalytics(),
        getAllBins()
      ])
      setAnalytics(analyticsData)
      setBins(binsData)
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const timeframeOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 3 Months' },
    { value: '1y', label: 'Last Year' }
  ]

  const statusDistributionColors = ['#10B981', '#F59E0B', '#F97316', '#EF4444', '#DC2626']

  const getTimeframeData = () => {
    if (!analytics?.trendsData) return []
    
    const days = selectedTimeframe === '7d' ? 7 : 
                 selectedTimeframe === '30d' ? 30 : 
                 selectedTimeframe === '90d' ? 90 : 365
    
    return analytics.trendsData.slice(-days)
  }

  const calculateGrowthRate = (data: any[], field: string) => {
    if (data.length < 2) return "0"
    const current = data[data.length - 1][field]
    const previous = data[data.length - 2][field]
    return previous ? ((current - previous) / previous * 100).toFixed(1) : "0"
  }

  const timeframeData = getTimeframeData()
  const reportsGrowth = calculateGrowthRate(timeframeData, 'reports')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">Monitor system performance and bin usage patterns</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            {timeframeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Reports</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.totalReports || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {parseFloat(reportsGrowth) >= 0 ? (
              <ArrowUpIcon className="w-4 h-4 text-green-600 mr-1" />
            ) : (
              <ArrowDownIcon className="w-4 h-4 text-red-600 mr-1" />
            )}
            <span className={`text-sm ${parseFloat(reportsGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(parseFloat(reportsGrowth))}%
            </span>
            <span className="text-sm text-gray-600 ml-2">vs yesterday</span>
          </div>
        </motion.div>

        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Bins</p>
              <p className="text-3xl font-bold text-gray-900">{bins.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <MapIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-green-600">●</span>
            <span className="text-sm text-gray-600 ml-2">All operational</span>
          </div>
        </motion.div>

        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Response Time</p>
              <p className="text-3xl font-bold text-gray-900">2.4h</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <ClockIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <ArrowDownIcon className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-sm text-green-600">12%</span>
            <span className="text-sm text-gray-600 ml-2">improvement</span>
          </div>
        </motion.div>

        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Alerts</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.alertsCount || 0}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-red-600">●</span>
            <span className="text-sm text-gray-600 ml-2">Requires attention</span>
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reports Trend */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Reports Trend</h3>
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <ArrowTrendingUpIcon className="w-4 h-4" />
              <span>+{reportsGrowth}%</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeframeData}>
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
                <Area 
                  type="monotone" 
                  dataKey="reports" 
                  stroke="#10B981" 
                  fill="#10B981"
                  fillOpacity={0.2}
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Status Distribution */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Bin Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.statusDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {(analytics?.statusDistribution || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={statusDistributionColors[index]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${value} bins`, 'Count']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {(analytics?.statusDistribution || []).map((item: any, index: number) => (
              <div key={item.status} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: statusDistributionColors[index] }}
                ></div>
                <span className="text-sm text-gray-600">{item.status}: {item.count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Collection Efficiency & Hourly Pattern */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection Efficiency */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Collections</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeframeData}>
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
                  formatter={(value: any) => [`${value}`, 'Collections']}
                />
                <Bar 
                  dataKey="collections" 
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Performance Metrics */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Metrics</h3>
          <div className="space-y-6">
            {/* Collection Efficiency */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">Collection Efficiency</span>
                <span className="text-sm font-bold text-gray-900">87%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-green-500 h-3 rounded-full" style={{ width: '87%' }}></div>
              </div>
            </div>

            {/* Response Time */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">Avg Response Time</span>
                <span className="text-sm font-bold text-gray-900">2.4h</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-blue-500 h-3 rounded-full" style={{ width: '76%' }}></div>
              </div>
            </div>

            {/* Citizen Engagement */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">Citizen Engagement</span>
                <span className="text-sm font-bold text-gray-900">93%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-purple-500 h-3 rounded-full" style={{ width: '93%' }}></div>
              </div>
            </div>

            {/* System Uptime */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">System Uptime</span>
                <span className="text-sm font-bold text-gray-900">99.9%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-emerald-500 h-3 rounded-full" style={{ width: '99.9%' }}></div>
              </div>
            </div>
          </div>

          {/* Key Insights */}
          <div className="mt-6 p-4 bg-green-50 rounded-xl">
            <h4 className="text-sm font-semibold text-green-800 mb-2">Key Insights</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Peak collection times: 10-12 AM and 6-8 PM</li>
              <li>• 23% reduction in overflow incidents this month</li>
              <li>• Central Park bins require more frequent collection</li>
            </ul>
          </div>
        </motion.div>
      </div>

      {/* Recent Alerts */}
      <motion.div 
        className="bg-white rounded-2xl shadow-lg p-6 border border-green-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Alerts</h3>
        <div className="space-y-4">
          {[
            { 
              type: 'warning', 
              title: 'Bin Nearly Full', 
              message: 'Times Square bin at 90% capacity',
              time: '15 min ago',
              priority: 'high'
            },
            { 
              type: 'info', 
              title: 'Collection Completed', 
              message: 'Central Park bins successfully emptied',
              time: '2 hours ago',
              priority: 'normal'
            },
            { 
              type: 'success', 
              title: 'New Bin Online', 
              message: 'Brooklyn Bridge bin now operational',
              time: '1 day ago',
              priority: 'normal'
            }
          ].map((alert, index) => (
            <div key={index} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-xl">
              <div className={`w-3 h-3 rounded-full mt-2 ${
                alert.type === 'warning' ? 'bg-yellow-500' :
                alert.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
              }`}></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">{alert.title}</h4>
                  <span className="text-xs text-gray-500">{alert.time}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
              </div>
              {alert.priority === 'high' && (
                <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-full">
                  High
                </span>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default Analytics
