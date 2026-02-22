import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getBin, createBin, updateBin, Bin, CreateBinInput, UpdateBinInput } from '../api/client'
import { useBreadcrumbs } from '../context/BreadcrumbContext'
import AddressAutocomplete from '../components/map/AddressAutocomplete'
import styles from './BinForm.module.css'

export default function BinForm() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  // Bin types with translated labels
  const BIN_TYPES = [
    { value: 'mixed', label: t('binTypes.mixed') },
    { value: 'plastic', label: t('binTypes.plastic') },
    { value: 'paper', label: t('binTypes.paper') },
    { value: 'glass', label: t('binTypes.glass') },
  ]

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [binType, setBinType] = useState('mixed')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [isActive, setIsActive] = useState(true)

  useBreadcrumbs(
    isEdit
      ? [
          { label: t('breadcrumbs.dashboard'), path: '/dashboard' },
          { label: name || t('binDetail.unnamed'), path: `/bins/${id}` },
          { label: t('breadcrumbs.editBin') },
        ]
      : [
          { label: t('breadcrumbs.dashboard'), path: '/dashboard' },
          { label: t('breadcrumbs.newBin') },
        ]
  )

  useEffect(() => {
    if (!isEdit || !id) return

    const loadBin = async () => {
      try {
        const bin: Bin = await getBin(id)
        setName(bin.name || '')
        setBinType(bin.bin_type || 'mixed')
        setAddress(bin.address || '')
        if (bin.coordinates) {
          setLatitude(bin.coordinates.latitude.toFixed(6))
          setLongitude(bin.coordinates.longitude.toFixed(6))
        }
        setIsActive(bin.is_active)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('binDetail.failedToLoad'))
      } finally {
        setLoading(false)
      }
    }

    loadBin()
  }, [id, isEdit, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError(t('binForm.nameRequired'))
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
    <>
      <main className={styles.main}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className="spinner"></div>
            <p>{t('binDetail.loadingBin')}</p>
          </div>
        ) : (
          <div className={styles.formCard}>
            <h2>{isEdit ? t('binForm.editTitle') : t('binForm.createTitle')}</h2>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">{t('binForm.name')} *</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('binForm.namePlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="binType">{t('binForm.type')}</label>
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
                <label htmlFor="address">{t('binForm.address')}</label>
                <AddressAutocomplete
                  id="address"
                  value={address}
                  onChange={setAddress}
                  onPlaceSelect={(place) => {
                    setAddress(place.address)
                    setLatitude(place.lat.toFixed(6))
                    setLongitude(place.lng.toFixed(6))
                  }}
                  placeholder={t('binForm.addressPlaceholder')}
                />
              </div>

              <div className={styles.coordRow}>
                <div className="form-group">
                  <label htmlFor="latitude">{t('binForm.latitude')}</label>
                  <input
                    type="number"
                    id="latitude"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder={t('binForm.latitudePlaceholder')}
                    step="any"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="longitude">{t('binForm.longitude')}</label>
                  <input
                    type="number"
                    id="longitude"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder={t('binForm.longitudePlaceholder')}
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
                    <span>{t('binForm.activeLabel')}</span>
                  </label>
                  <p className={styles.hint}>{t('binForm.inactiveHint')}</p>
                </div>
              )}

              <div className={styles.formActions}>
                <Link
                  to={isEdit ? `/bins/${id}` : '/dashboard'}
                  className={`btn ${styles.btnCancel}`}
                >
                  {t('common.cancel')}
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('binForm.saving') : isEdit ? t('binForm.saveChanges') : t('binForm.createBin')}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  )
}
