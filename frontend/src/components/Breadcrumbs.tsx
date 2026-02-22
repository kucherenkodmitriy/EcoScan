import { Link } from 'react-router-dom'
import { useBreadcrumbContext } from '../context/BreadcrumbContext'
import styles from './Breadcrumbs.module.css'

export default function Breadcrumbs() {
  const { breadcrumbs } = useBreadcrumbContext()

  if (breadcrumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      <ol className={styles.list}>
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1
          return (
            <li key={index} className={styles.item}>
              {index > 0 && <span className={styles.separator}>/</span>}
              {isLast || !item.path ? (
                <span className={styles.current}>{item.label}</span>
              ) : (
                <Link to={item.path} className={styles.link}>{item.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
