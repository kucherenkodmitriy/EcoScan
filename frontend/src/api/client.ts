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
  coordinates: Coordinates | null
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

export async function submitBinStatus(binId: string, status: number, recaptchaToken?: string): Promise<void> {
  const body: { status: number; source: string; recaptchaToken?: string } = {
    status,
    source: 'qr',
  }

  if (recaptchaToken) {
    body.recaptchaToken = recaptchaToken
  }

  const response = await fetch(`${API_BASE}/bins/${binId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to submit status' }))
    throw new Error(error.error || error.message || 'Failed to submit status')
  }
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

// =============================================================================
// Webhook API
// =============================================================================

export interface WebhookInfo {
  webhook_id: string
  name: string
  url: string
  auth_type: string
  auth_header: string | null
  events: string[]
  is_active: boolean
  created_at: string | null
  updated_at: string | null
  last_triggered_at: string | null
  success_count: number
  failure_count: number
}

export interface CreateWebhookInput {
  name: string
  url: string
  auth_type?: string
  auth_header?: string
  auth_value?: string
  events?: string[]
}

export interface UpdateWebhookInput {
  name?: string
  url?: string
  auth_type?: string
  auth_header?: string
  auth_value?: string
  events?: string[]
  is_active?: boolean
}

export async function getWebhooks(): Promise<WebhookInfo[]> {
  const response = await fetchWithAuth('/admin/webhooks')
  if (!response.ok) throw new Error('Failed to fetch webhooks')
  const data = await response.json()
  return data.webhooks || []
}

export async function getWebhook(webhookId: string): Promise<WebhookInfo> {
  const response = await fetchWithAuth(`/admin/webhooks/${webhookId}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch webhook')
  }
  return response.json()
}

export async function createWebhook(input: CreateWebhookInput): Promise<WebhookInfo> {
  const response = await fetchWithAuth('/admin/webhooks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Failed to create webhook'
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

export async function updateWebhook(webhookId: string, input: UpdateWebhookInput): Promise<WebhookInfo> {
  const response = await fetchWithAuth(`/admin/webhooks/${webhookId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Failed to update webhook'
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

export async function deleteWebhook(webhookId: string): Promise<void> {
  const response = await fetchWithAuth(`/admin/webhooks/${webhookId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Failed to delete webhook'
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error || errorJson.message || errorMessage
    } catch {
      if (errorText) errorMessage = errorText
    }
    throw new Error(errorMessage)
  }
}
