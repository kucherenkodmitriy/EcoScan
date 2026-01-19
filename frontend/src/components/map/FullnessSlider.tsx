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

  // Calculate the gradient for the track based on selected range
  const getTrackGradient = (min: number, max: number): string => {
    const stops: string[] = []

    // Gray before selection
    if (min > 0) {
      stops.push(`#e0e0e0 0%`)
      stops.push(`#e0e0e0 ${min}%`)
    }

    // Build colored section from min to max
    // Colors: 0-30% green, 30-70% orange, 70-100% red
    if (min < 30) {
      stops.push(`#2e7d32 ${min}%`)
      if (max <= 30) {
        stops.push(`#2e7d32 ${max}%`)
      } else {
        stops.push(`#2e7d32 30%`)
        stops.push(`#f57c00 30%`)
        if (max <= 70) {
          stops.push(`#f57c00 ${max}%`)
        } else {
          stops.push(`#f57c00 70%`)
          stops.push(`#c62828 70%`)
          stops.push(`#c62828 ${max}%`)
        }
      }
    } else if (min < 70) {
      stops.push(`#f57c00 ${min}%`)
      if (max <= 70) {
        stops.push(`#f57c00 ${max}%`)
      } else {
        stops.push(`#f57c00 70%`)
        stops.push(`#c62828 70%`)
        stops.push(`#c62828 ${max}%`)
      }
    } else {
      stops.push(`#c62828 ${min}%`)
      stops.push(`#c62828 ${max}%`)
    }

    // Gray after selection
    if (max < 100) {
      stops.push(`#e0e0e0 ${max}%`)
      stops.push(`#e0e0e0 100%`)
    }

    return `linear-gradient(to right, ${stops.join(', ')})`
  }

  return (
    <div className={styles.sliderContainer}>
      <label className={styles.label}>Filter by Fullness</label>
      <div className={styles.sliderWrapper}>
        <div
          className={styles.track}
          style={{ background: getTrackGradient(minVal, maxVal) }}
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
