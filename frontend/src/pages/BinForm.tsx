import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getBin, createBin, updateBin, Bin, CreateBinInput, UpdateBinInput } from '../api/client'
import styles from './BinForm.module.css'

// Must match backend BinType enum (lowercase)
const BIN_TYPES = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'paper', label: 'Paper' },
  { value: 'glass', label: 'Glass' },
]

export default function BinForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [binType, setBinType] = useState('mixed')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!isEdit || !id) return

    const loadBin = async () => {
      try {
        const bin: Bin = await getBin(id)
        setName(bin.name || '')
        setBinType(bin.bin_type || 'mixed')
        setAddress(bin.address || '')
        setIsActive(bin.is_active)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bin')
      } finally {
        setLoading(false)
      }
    }

    loadBin()
  }, [id, isEdit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)

    try {
      if (isEdit && id) {
        const data: UpdateBinInput = {
          name: name.trim(),
          bin_type: binType,
          address: address.trim() || undefined,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          is_active: isActive,
        }
        await updateBin(id, data)
        navigate(`/bins/${id}`)
      } else {
        const data: CreateBinInput = {
          name: name.trim(),
          bin_type: binType,
          address: address.trim() || undefined,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
        }
        const newBin = await createBin(data)
        navigate(`/bins/${newBin.bin_id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bin')
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to={isEdit ? `/bins/${id}` : '/dashboard'} className={styles.backLink}>
            &larr; Cancel
          </Link>
          <h1>EcoScan</h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.userInfo}>
            <strong>{user?.name}</strong>
            <span>{user?.role}</span>
          </div>
          <button className="btn btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className="spinner"></div>
            <p>Loading bin...</p>
          </div>
        ) : (
          <div className={styles.formCard}>
            <h2>{isEdit ? 'Edit Bin' : 'Create New Bin'}</h2>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter bin name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="binType">Type</label>
                <select
                  id="binType"
                  value={binType}
                  onChange={(e) => setBinType(e.target.value)}
                  className={styles.select}
                >
                  {BIN_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="address">Address</label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter address (optional)"
                />
              </div>

              <div className={styles.coordRow}>
                <div className="form-group">
                  <label htmlFor="latitude">Latitude</label>
                  <input
                    type="number"
                    id="latitude"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 48.8566"
                    step="any"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="longitude">Longitude</label>
                  <input
                    type="number"
                    id="longitude"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 2.3522"
                    step="any"
                  />
                </div>
              </div>

              {isEdit && (
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span>Active</span>
                  </label>
                  <p className={styles.hint}>Inactive bins won't appear in reports.</p>
                </div>
              )}

              <div className={styles.formActions}>
                <Link
                  to={isEdit ? `/bins/${id}` : '/dashboard'}
                  className={`btn ${styles.btnCancel}`}
                >
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Bin'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
