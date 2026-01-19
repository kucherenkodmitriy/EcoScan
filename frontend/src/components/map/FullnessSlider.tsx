import { useState, useEffect } from 'react'
import styles from './FullnessSlider.module.css'

interface FullnessSliderProps {
  value: [number, number]  // [min, max]
  onChange: (value: [number, number]) => void
}

export default function FullnessSlider({ value, onChange }: FullnessSliderProps) {
  const [minVal, setMinVal] = useState(value[0])
  const [maxVal, setMaxVal] = useState(value[1])

  useEffect(() => {
    setMinVal(value[0])
    setMaxVal(value[1])
  }, [value])

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Math.min(Number(e.target.value), maxVal - 5)
    setMinVal(newMin)
    onChange([newMin, maxVal])
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Math.max(Number(e.target.value), minVal + 5)
    setMaxVal(newMax)
    onChange([minVal, newMax])
  }

  // Calculate the position for the filled track
  const minPercent = (minVal / 100) * 100
  const maxPercent = (maxVal / 100) * 100

  return (
    <div className={styles.sliderContainer}>
      <label className={styles.label}>Filter by Fullness</label>
      <div className={styles.sliderWrapper}>
        <div
          className={styles.track}
          style={{
            background: `linear-gradient(to right,
              #e0e0e0 ${minPercent}%,
              #2e7d32 ${minPercent}%,
              #f57c00 ${Math.max(minPercent, 30)}%,
              #c62828 ${Math.max(minPercent, 70)}%,
              #c62828 ${maxPercent}%,
              #e0e0e0 ${maxPercent}%)`
          }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={minVal}
          onChange={handleMinChange}
          className={styles.slider}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={maxVal}
          onChange={handleMaxChange}
          className={styles.slider}
        />
      </div>
      <div className={styles.values}>
        <span className={styles.minValue}>{minVal}%</span>
        <span className={styles.maxValue}>{maxVal}%</span>
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: '#2e7d32' }}></span>
          0-30%
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: '#f57c00' }}></span>
          30-70%
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: '#c62828' }}></span>
          70-100%
        </span>
      </div>
    </div>
  )
}
