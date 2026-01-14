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
  status: number  // Fullness percentage (0-100)
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

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface CreateBinRequest {
  name: string
  bin_type?: string
  address?: string
  coordinates?: Coordinates
}

export interface CreateBinInput {
  name: string
  bin_type: string
  address?: string
  latitude?: number
  longitude?: number
}

export async function createBin(input: CreateBinInput): Promise<Bin> {
  // Transform to backend format
  const data: CreateBinRequest = {
    name: input.name,
    bin_type: input.bin_type,
    address: input.address,
    coordinates: input.latitude && input.longitude
      ? { latitude: input.latitude, longitude: input.longitude }
      : undefined,
  }

  const response = await fetchWithAuth('/admin/bins', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Failed to create bin'
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error || errorJson.message || errorMessage
    } catch {
      if (errorText) errorMessage = errorText
    }
    throw new Error(errorMessage)
  }
  return response.json()
}

export interface UpdateBinRequest {
  name?: string
  bin_type?: string
  address?: string
  coordinates?: Coordinates
  is_active?: boolean
}

export interface UpdateBinInput {
  name?: string
  bin_type?: string
  address?: string
  latitude?: number
  longitude?: number
  is_active?: boolean
}

export async function updateBin(binId: string, input: UpdateBinInput): Promise<Bin> {
  // Transform to backend format
  const data: UpdateBinRequest = {
    name: input.name,
    bin_type: input.bin_type,
    address: input.address,
    coordinates: input.latitude && input.longitude
      ? { latitude: input.latitude, longitude: input.longitude }
      : undefined,
    is_active: input.is_active,
  }

  const response = await fetchWithAuth(`/admin/bins/${binId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Failed to update bin'
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error || errorJson.message || errorMessage
    } catch {
      if (errorText) errorMessage = errorText
    }
    throw new Error(errorMessage)
  }
  return response.json()
}

export async function deleteBin(binId: string): Promise<void> {
  const response = await fetchWithAuth(`/admin/bins/${binId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Failed to delete bin'
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error || errorJson.message || errorMessage
    } catch {
      if (errorText) errorMessage = errorText
    }
    throw new Error(errorMessage)
  }
}
