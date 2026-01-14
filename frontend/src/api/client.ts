const API_BASE = '/api'

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('ecoscan_token')

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (response.status === 401) {
    localStorage.removeItem('ecoscan_token')
    localStorage.removeItem('ecoscan_user')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  return response
}

export interface Bin {
  bin_id: string
  name: string
  bin_type: string
  address: string | null
  current_fullness: number
  reports_count: number
  last_updated: string | null
  is_active: boolean
}

export async function getBins(): Promise<Bin[]> {
  const response = await fetchWithAuth('/admin/bins')
  if (!response.ok) throw new Error('Failed to fetch bins')
  const data = await response.json()
  return data.bins || []
}

export interface PublicBinInfo {
  bin_id: string
  name: string
  bin_type: string
  address: string | null
}

export async function getPublicBinInfo(binId: string): Promise<PublicBinInfo> {
  const response = await fetch(`${API_BASE}/report/${binId}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Bin not found')
  }
  return response.json()
}

export async function submitBinStatus(binId: string, status: number): Promise<void> {
  const response = await fetch(`${API_BASE}/bins/${binId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, source: 'qr' }),
  })
  if (!response.ok) throw new Error('Failed to submit status')
}

export async function getBin(binId: string): Promise<Bin> {
  const response = await fetchWithAuth(`/admin/bins/${binId}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch bin')
  }
  return response.json()
}

export interface CreateBinRequest {
  name: string
  bin_type: string
  address?: string
  latitude?: number
  longitude?: number
}

export async function createBin(data: CreateBinRequest): Promise<Bin> {
  const response = await fetchWithAuth('/admin/bins', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create bin')
  }
  return response.json()
}

export interface UpdateBinRequest {
  name?: string
  bin_type?: string
  address?: string
  latitude?: number
  longitude?: number
  is_active?: boolean
}

export async function updateBin(binId: string, data: UpdateBinRequest): Promise<Bin> {
  const response = await fetchWithAuth(`/admin/bins/${binId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update bin')
  }
  return response.json()
}

export async function deleteBin(binId: string): Promise<void> {
  const response = await fetchWithAuth(`/admin/bins/${binId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete bin')
  }
}
