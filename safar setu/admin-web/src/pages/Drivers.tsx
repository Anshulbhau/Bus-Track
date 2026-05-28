import { useState, useMemo, useCallback, useEffect } from 'react'
import { useDriversWithRatings } from '../hooks/useSupabase'
import {
  insertDriver,
  updateDriver,
  deleteDriver,
  getDriverReviews,
  flagReview,
  deleteReview
} from '../lib/api'
import Modal from '../components/Modal'
import StatCard from '../components/StatCard'
import type { DriverReview } from '../types/database'

export default function Drivers() {
  const { data: drivers, loading, error, refetch } = useDriversWithRatings()

  // State for Add / Edit Driver Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)

  // Driver Table Sorting & Filtering States
  const [sortBy, setSortBy] = useState<
    'rating-desc' | 'rating-asc' | 'safety-desc' | 'safety-asc' | 'reviews-desc' | 'reviews-asc' | 'newest' | 'unsafe-first'
  >('rating-desc')
  const [filterBadge, setFilterBadge] = useState<'all' | 'safe' | 'good' | 'unsafe' | 'insufficient'>('all')
  const [minRating, setMinRating] = useState<number>(1.0)
  const [minSafety, setMinSafety] = useState<number>(0)

  // State for Driver Reviews Modal
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<any>(null)
  const [reviews, setReviews] = useState<DriverReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)

  // Reviews Modal Filters & Searching States
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [reviewSort, setReviewSort] = useState<'newest' | 'oldest' | 'rating-desc' | 'rating-asc' | 'flagged-first'>('newest')
  const [reviewFilter, setReviewFilter] = useState<
    'all' | 'positive' | 'negative' | 'flagged' | 'rash' | 'overspeeding' | 'sudden-braking' | 'polite' | 'clean'
  >('all')

  // Pagination inside Reviews Modal (Client-side over filtered results)
  const [reviewsPage, setReviewsPage] = useState(0)
  const pageSize = 5

  // State for Abusive Review Moderation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [moderatingId, setModeratingId] = useState<string | null>(null)

  // Toast Notifications
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Reactive Modal Synchronizer: Keep selected driver data in sync when stats update in background
  useEffect(() => {
    if (selectedDriver && drivers.length > 0) {
      const updated = drivers.find((d) => d.id === selectedDriver.id)
      if (updated) {
        setSelectedDriver(updated)
      }
    }
  }, [drivers, selectedDriver])

  // Debouncing Effect for Modal Review Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 250)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Static Fleet Aggregate Calculations (unfiltered)
  const fleetStats = useMemo(() => {
    const total = drivers.length
    let safeCount = 0
    let unsafeCount = 0
    let totalSafetyScore = 0
    let countWithScore = 0

    drivers.forEach((driver) => {
      const ratingStats = Array.isArray(driver.driver_rating_stats)
        ? driver.driver_rating_stats[0]
        : driver.driver_rating_stats

      if (ratingStats) {
        const rating = Number(ratingStats.average_rating) || 0
        const totalReviews = Number(ratingStats.total_reviews) || 0
        const safetyScore = Number(ratingStats.safety_score) ?? 100

        // Badge logic (Safe Driver: rating >= 4.5 AND safety_score >= 80, when total_reviews >= 5)
        if (totalReviews >= 5 && rating >= 4.5 && safetyScore >= 80) {
          safeCount++
        }

        // Unsafe logic (safety_score < 50 OR average_rating < 3.5, when total_reviews >= 5)
        if (totalReviews >= 5 && (safetyScore < 50 || rating < 3.5)) {
          unsafeCount++
        }

        totalSafetyScore += safetyScore
        countWithScore++
      }
    })

    const avgFleetSafety = countWithScore > 0 ? Math.round(totalSafetyScore / countWithScore) : 100

    return {
      total,
      safeCount,
      unsafeCount,
      avgFleetSafety
    }
  }, [drivers])

  // Client-Side Driver Sorting and Filtering (Memoized for optimal performance)
  const filteredAndSortedDrivers = useMemo(() => {
    return drivers
      .filter((driver) => {
        const ratingStats = Array.isArray(driver.driver_rating_stats)
          ? driver.driver_rating_stats[0]
          : driver.driver_rating_stats

        const rating = ratingStats ? Number(ratingStats.average_rating) || 0 : 0
        const score = ratingStats ? Number(ratingStats.safety_score) || 100 : 100
        const totalReviews = ratingStats ? Number(ratingStats.total_reviews) || 0 : 0

        // Sliders rating & score filter
        if (totalReviews > 0) {
          if (rating < minRating) return false
          if (score < minSafety) return false
        } else {
          // If driver has 0 reviews, they only pass if sliders are at minimum fallback defaults
          if (minRating > 1.0) return false
          if (minSafety > 0) return false
        }

        // Status Badge Chip filter
        if (filterBadge === 'insufficient') {
          return totalReviews < 5
        }
        if (totalReviews < 5 && filterBadge !== 'all') {
          return false // If filtering by anything other than 'all' or 'insufficient', exclude drivers with insufficient data
        }

        if (filterBadge === 'safe') {
          return rating >= 4.5 && score >= 80
        }
        if (filterBadge === 'good') {
          return rating >= 3.5 && !(rating >= 4.5 && score >= 80)
        }
        if (filterBadge === 'unsafe') {
          return rating < 3.5 || score < 50
        }

        return true
      })
      .sort((a, b) => {
        const aStats = Array.isArray(a.driver_rating_stats) ? a.driver_rating_stats[0] : a.driver_rating_stats
        const bStats = Array.isArray(b.driver_rating_stats) ? b.driver_rating_stats[0] : b.driver_rating_stats

        const aRating = aStats ? Number(aStats.average_rating) || 0 : 0
        const bRating = bStats ? Number(bStats.average_rating) || 0 : 0

        const aScore = aStats ? Number(aStats.safety_score) || 100 : 100
        const bScore = bStats ? Number(bStats.safety_score) || 100 : 100

        const aReviews = aStats ? Number(aStats.total_reviews) || 0 : 0
        const bReviews = bStats ? Number(bStats.total_reviews) || 0 : 0

        const aUnsafe = aStats && aReviews >= 5 && (aRating < 3.5 || aScore < 50) ? 1 : 0
        const bUnsafe = bStats && bReviews >= 5 && (bRating < 3.5 || bScore < 50) ? 1 : 0

        if (sortBy === 'rating-desc') return bRating - aRating
        if (sortBy === 'rating-asc') return aRating - bRating
        if (sortBy === 'safety-desc') return bScore - aScore
        if (sortBy === 'safety-asc') return aScore - bScore
        if (sortBy === 'reviews-desc') return bReviews - aReviews
        if (sortBy === 'reviews-asc') return aReviews - bReviews
        if (sortBy === 'unsafe-first') return bUnsafe - aUnsafe
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }

        return 0
      })
  }, [drivers, filterBadge, minRating, minSafety, sortBy])

  // Driver Add/Edit actions
  function openAdd() {
    setEditId(null)
    setForm({ name: '', phone: '' })
    setModalOpen(true)
  }

  function openEdit(driver: any) {
    setEditId(driver.id)
    setForm({ name: driver.name ?? '', phone: driver.phone ?? '' })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = editId ? await updateDriver(editId, form) : await insertDriver(form)

    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast(editId ? 'Driver updated!' : 'Driver added!')
      setModalOpen(false)
      refetch()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this driver? Any bus assignments will be affected.')) return
    const { error } = await deleteDriver(id)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Driver deleted!')
      refetch()
    }
  }

  // Load reviews list inside modal (fetch all so we can filter/sort/paginate client-side efficiently)
  const loadReviews = useCallback(async (driverId: string) => {
    setReviewsLoading(true)
    setReviewsError(null)
    const { data, error } = await getDriverReviews(driverId, 1000, 0)
    if (error) {
      setReviewsError(error.message)
    } else {
      setReviews(data || [])
    }
    setReviewsLoading(false)
  }, [])

  // Open driver reviews list modal
  function openReviewsModal(driver: any) {
    setSelectedDriver(driver)
    setReviewsPage(0)
    setReviews([])
    setSearchQuery('')
    setDebouncedSearchQuery('')
    setReviewSort('newest')
    setReviewFilter('all')
    setReviewsModalOpen(true)
    loadReviews(driver.id)
  }

  // Client-Side Reviews Filtering, Searching, and Sorting
  const filteredAndSortedReviews = useMemo(() => {
    return reviews
      .filter((r) => {
        // Search Term Check (debounced)
        const reviewerName = r.reviewer?.name?.toLowerCase() || ''
        const reviewText = r.review_text?.toLowerCase() || ''
        const search = debouncedSearchQuery.toLowerCase().trim()

        if (search) {
          if (!reviewerName.includes(search) && !reviewText.includes(search)) {
            return false
          }
        }

        // Chip Filter check
        if (reviewFilter === 'positive') return r.rating >= 4
        if (reviewFilter === 'negative') return r.rating <= 2
        if (reviewFilter === 'flagged') return r.is_flagged
        if (reviewFilter === 'rash') return r.rash_driving
        if (reviewFilter === 'overspeeding') return r.overspeeding
        if (reviewFilter === 'sudden-braking') return r.sudden_braking
        if (reviewFilter === 'polite') return r.polite_behavior
        if (reviewFilter === 'clean') return r.clean_bus

        return true
      })
      .sort((a, b) => {
        if (reviewSort === 'flagged-first') {
          const aFlag = a.is_flagged ? 1 : 0
          const bFlag = b.is_flagged ? 1 : 0
          if (aFlag !== bFlag) return bFlag - aFlag
        }
        if (reviewSort === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
        if (reviewSort === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        }
        if (reviewSort === 'rating-desc') return b.rating - a.rating
        if (reviewSort === 'rating-asc') return a.rating - b.rating

        return 0
      })
  }, [reviews, debouncedSearchQuery, reviewFilter, reviewSort])

  // Client-Side Paginated Reviews List
  const paginatedReviews = useMemo(() => {
    const start = reviewsPage * pageSize
    return filteredAndSortedReviews.slice(start, start + pageSize)
  }, [filteredAndSortedReviews, reviewsPage])

  // Reviews Sentiment and Praise/Complaint Analytics Memo
  const reviewAnalytics = useMemo(() => {
    if (reviews.length === 0) {
      return { positivePct: 0, negativePct: 0, commonPraise: '—', commonComplaint: '—' }
    }

    let positives = 0
    let negatives = 0

    let smooth = 0
    let polite = 0
    let clean = 0

    let rash = 0
    let speed = 0
    let brake = 0

    reviews.forEach((r) => {
      if (r.rating >= 4) positives++
      if (r.rating <= 2) negatives++

      if (r.smooth_driving) smooth++
      if (r.polite_behavior) polite++
      if (r.clean_bus) clean++

      if (r.rash_driving) rash++
      if (r.overspeeding) speed++
      if (r.sudden_braking) brake++
    })

    const positivePct = Math.round((positives / reviews.length) * 100)
    const negativePct = Math.round((negatives / reviews.length) * 100)

    const praises = [
      { label: 'Smooth Driving', count: smooth },
      { label: 'Polite Behavior', count: polite },
      { label: 'Clean Bus', count: clean }
    ]
    praises.sort((a, b) => b.count - a.count)
    const commonPraise = praises[0].count > 0 ? praises[0].label : '—'

    const complaints = [
      { label: 'Rash Driving', count: rash },
      { label: 'Overspeeding', count: speed },
      { label: 'Sudden Braking', count: brake }
    ]
    complaints.sort((a, b) => b.count - a.count)
    const commonComplaint = complaints[0].count > 0 ? complaints[0].label : '—'

    return {
      positivePct,
      negativePct,
      commonPraise,
      commonComplaint
    }
  }, [reviews])

  // Handle Review Pagination click
  function handleReviewsPageChange(newPage: number) {
    setReviewsPage(newPage)
  }

  // Moderation: Flag review as abusive
  async function handleFlagReview(reviewId: string) {
    setModeratingId(reviewId)
    const { error } = await flagReview(reviewId)
    setModeratingId(null)

    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Review successfully flagged.')
      if (selectedDriver) {
        loadReviews(selectedDriver.id)
      }
      refetch() // Refresh driver stats on table in background
    }
  }

  // Moderation: Soft delete review
  async function handleConfirmSoftDelete() {
    if (!confirmDeleteId) return
    setModeratingId(confirmDeleteId)
    const { error } = await deleteReview(confirmDeleteId)
    setModeratingId(null)
    setConfirmDeleteId(null)

    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Review soft-deleted successfully.')
      if (selectedDriver) {
        // Adjust page index if deletion made the current page empty
        const remainingCount = filteredAndSortedReviews.length - 1
        const maxPage = Math.max(0, Math.ceil(remainingCount / pageSize) - 1)
        setReviewsPage((curr) => Math.min(curr, maxPage))
        loadReviews(selectedDriver.id)
      }
      refetch() // Refresh driver stats on table in background
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header__left">
          <h2>Driver Management</h2>
          <p>View ratings, safety reports, and manage registered drivers</p>
        </div>
        <button className="btn btn--primary" id="btn-add-driver" onClick={openAdd}>
          + Add Driver
        </button>
      </div>

      {/* Fleet Analytics Cards */}
      <div className="stats-grid">
        <StatCard
          icon="👥"
          label="Total Drivers"
          value={loading ? '—' : fleetStats.total}
          variant="accent"
        />
        <StatCard
          icon="🛡️"
          label="Safe Drivers"
          value={loading ? '—' : fleetStats.safeCount}
          variant="success"
        />
        <StatCard
          icon="⚠"
          label="Unsafe Drivers"
          value={loading ? '—' : fleetStats.unsafeCount}
          variant="warning"
        />
        <StatCard
          icon="📈"
          label="Avg Fleet Safety"
          value={loading ? '—' : `${fleetStats.avgFleetSafety}/100`}
          variant="info"
        />
      </div>

      {/* Dynamic Client-Side Sorting & Filtering Controls */}
      <div
        className="glass-panel"
        style={{
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-md)'
          }}
        >
          {/* Badge filter chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              { id: 'all', label: 'All Drivers' },
              { id: 'safe', label: 'Safe Drivers' },
              { id: 'good', label: 'Good Drivers' },
              { id: 'unsafe', label: 'Unsafe Drivers' },
              { id: 'insufficient', label: 'Insufficient Reviews' }
            ].map((chip) => (
              <button
                key={chip.id}
                className={`btn btn--sm ${filterBadge === chip.id ? 'btn--primary' : 'btn--ghost'}`}
                style={{ padding: '6px 14px', borderRadius: '20px', fontSize: 'var(--font-size-xs)' }}
                onClick={() => {
                  setFilterBadge(chip.id as any)
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Table Sorting Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label
              htmlFor="driver-sort"
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}
            >
              Sort By:
            </label>
            <select
              id="driver-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                background: 'var(--color-bg-glass)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                padding: '8px 12px',
                fontSize: 'var(--font-size-sm)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="rating-desc">⭐ Highest Rating</option>
              <option value="rating-asc">⭐ Lowest Rating</option>
              <option value="safety-desc">🛡️ Highest Safety Score</option>
              <option value="safety-asc">🛡️ Lowest Safety Score</option>
              <option value="reviews-desc">💬 Most Reviews</option>
              <option value="reviews-asc">💬 Least Reviews</option>
              <option value="newest">📅 Newest Drivers</option>
              <option value="unsafe-first">⚠ Unsafe Drivers First</option>
            </select>
          </div>
        </div>

        {/* Minimum rating & score slider row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-lg)',
            paddingTop: 'var(--space-sm)',
            borderTop: '1px solid var(--color-border)'
          }}
        >
          <div className="filter-slider">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>Min Average Rating</label>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', fontWeight: 700 }}>
                {minRating > 1.0 ? `⭐ ${minRating.toFixed(1)}` : 'All'}
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
            />
          </div>

          <div className="filter-slider">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>Min Safety Score</label>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 700 }}>
                {minSafety > 0 ? `🛡️ ${minSafety}/100` : 'All'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={minSafety}
              onChange={(e) => setMinSafety(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Main Glass Panel Table */}
      <div className="glass-panel">
        <div className="glass-panel__header">
          <h3 className="glass-panel__title">All Drivers</h3>
        </div>

        {error && (
          <div className="glass-panel__body">
            <p style={{ color: 'var(--color-danger)' }}>Error: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="glass-panel__body">
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Loading driver statistics…
            </p>
          </div>
        ) : filteredAndSortedDrivers.length === 0 ? (
          /* High-Fidelity Custom Empty States */
          <div className="glass-panel__body" style={{ padding: '0' }}>
            {filterBadge === 'unsafe' ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl) var(--space-lg)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>🟢</div>
                <h4
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 700,
                    margin: '0 0 var(--space-xs)',
                    color: 'var(--color-success)'
                  }}
                >
                  All Fleet Drivers are Safe!
                </h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  Excellent job! There are currently no drivers flagged for rash driving or low safety scores.
                </p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl) var(--space-lg)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>🔍</div>
                <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 var(--space-xs)' }}>
                  No Drivers Match Filters
                </h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-lg)' }}>
                  Try adjusting your minimum score sliders or selecting a different safety badge category.
                </p>
                <button
                  className="btn btn--ghost"
                  onClick={() => {
                    setFilterBadge('all')
                    setMinRating(1.0)
                    setMinSafety(0)
                    setSortBy('rating-desc')
                  }}
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Phone</th>
                  <th>Rating</th>
                  <th>Safety Score</th>
                  <th>Reviews</th>
                  <th>Badge</th>
                  <th>Review Actions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedDrivers.map((driver) => {
                  const ratingStats = Array.isArray(driver.driver_rating_stats)
                    ? driver.driver_rating_stats[0]
                    : driver.driver_rating_stats

                  const avgRating = ratingStats ? Number(ratingStats.average_rating) : 0
                  const totalReviews = ratingStats ? Number(ratingStats.total_reviews) : 0
                  const safetyScore = ratingStats ? Number(ratingStats.safety_score) : 100

                  // Unsafe condition matching new badge guidelines: rating < 3.5 OR safety_score < 50 (with reviews >= 5)
                  const isUnsafe = ratingStats && totalReviews >= 5 && (safetyScore < 50 || avgRating < 3.5)

                  // Safety Badge Logic according to updated rules
                  let badgeClass = 'safety-badge--insufficient'
                  let badgeText = 'Insufficient Reviews'

                  if (totalReviews >= 5) {
                    if (avgRating >= 4.5 && safetyScore >= 80) {
                      badgeClass = 'safety-badge--safe'
                      badgeText = '🟢 Safe Driver'
                    } else if (avgRating >= 3.5) {
                      badgeClass = 'safety-badge--good'
                      badgeText = '🟢 Good Driver'
                    } else {
                      badgeClass = 'safety-badge--rash'
                      badgeText = '🔴 Rash Driving Complaints'
                    }
                  }

                  return (
                    <tr key={driver.id} className={isUnsafe ? 'row--unsafe' : ''}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{driver.name ?? '—'}</span>
                          {isUnsafe && (
                            <span className="row-warning-text" style={{ fontSize: '10px', marginTop: '2px' }}>
                              ⚠ Unsafe Driver
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{driver.phone ?? '—'}</td>
                      <td>{totalReviews === 0 ? '—' : `⭐ ${avgRating.toFixed(1)}`}</td>
                      <td>{totalReviews === 0 ? '—' : `${Math.round(safetyScore)}/100`}</td>
                      <td>{totalReviews} reviews</td>
                      <td>
                        <span className={`safety-badge ${badgeClass}`}>{badgeText}</span>
                      </td>
                      <td>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ padding: '6px 12px' }}
                          onClick={() => openReviewsModal(driver)}
                        >
                          💬 View Reviews
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn--ghost btn--sm" onClick={() => openEdit(driver)}>
                            Edit
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDelete(driver.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Driver Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Driver' : 'Add New Driver'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="driver_name">Full Name</label>
            <input
              id="driver_name"
              placeholder="e.g. Ravi Kumar"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="driver_phone">Phone Number</label>
            <input
              id="driver_phone"
              placeholder="e.g. +91 98765 43210"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Update Driver' : 'Add Driver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Driver Reviews Modal */}
      <Modal
        open={reviewsModalOpen}
        onClose={() => setReviewsModalOpen(false)}
        title="Driver Reviews & Moderation"
        width="680px"
      >
        {selectedDriver && (
          <div>
            {/* Driver Profile Summary Header */}
            <div
              className="glass-panel"
              style={{
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-md)',
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'var(--color-border)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 'var(--space-md)'
                }}
              >
                <div>
                  <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>
                    {selectedDriver.name}
                  </h4>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: '4px 0 0' }}>
                    📞 {selectedDriver.phone ?? 'No phone listed'}
                  </p>
                </div>

                {/* Rating score details */}
                {(() => {
                  const ratingStats = Array.isArray(selectedDriver.driver_rating_stats)
                    ? selectedDriver.driver_rating_stats[0]
                    : selectedDriver.driver_rating_stats

                  const avgRating = ratingStats ? Number(ratingStats.average_rating) : 0
                  const totalReviews = ratingStats ? Number(ratingStats.total_reviews) : 0
                  const safetyScore = ratingStats ? Number(ratingStats.safety_score) : 100

                  const isUnsafe = ratingStats && totalReviews >= 5 && (safetyScore < 50 || avgRating < 3.5)

                  return (
                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          Rating
                        </div>
                        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-warning)' }}>
                          ⭐ {totalReviews > 0 ? avgRating.toFixed(1) : '—'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {totalReviews} total reviews
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', borderLeft: '1px solid var(--color-border)', paddingLeft: 'var(--space-md)' }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          Safety Score
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--font-size-lg)',
                            fontWeight: 800,
                            color: isUnsafe ? 'var(--color-danger)' : 'var(--color-success)'
                          }}
                        >
                          🛡️ {totalReviews > 0 ? `${Math.round(safetyScore)}/100` : '—'}
                        </div>
                        {isUnsafe && (
                          <div style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 600 }}>
                            ⚠ Unsafe Driver
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Premium Compact Neon Analytics Grid Cards */}
            {!reviewsLoading && reviews.length > 0 && (
              <div className="analytics-grid--modal">
                <div className="analytics-card--compact analytics-card--compact-success">
                  <span className="analytics-card__val" style={{ color: 'var(--color-success)' }}>
                    {reviewAnalytics.positivePct}%
                  </span>
                  <span className="analytics-card__lbl">Positive Rate</span>
                </div>
                <div className="analytics-card--compact analytics-card--compact-danger">
                  <span className="analytics-card__val" style={{ color: 'var(--color-danger)' }}>
                    {reviewAnalytics.negativePct}%
                  </span>
                  <span className="analytics-card__lbl">Negative Rate</span>
                </div>
                <div className="analytics-card--compact analytics-card--compact-info">
                  <span
                    className="analytics-card__val"
                    style={{
                      color: 'var(--color-info)',
                      fontSize: '11px',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden'
                    }}
                    title={reviewAnalytics.commonPraise}
                  >
                    {reviewAnalytics.commonPraise}
                  </span>
                  <span className="analytics-card__lbl">Top Praise</span>
                </div>
                <div className="analytics-card--compact analytics-card--compact-warning">
                  <span
                    className="analytics-card__val"
                    style={{
                      color: 'var(--color-warning)',
                      fontSize: '11px',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden'
                    }}
                    title={reviewAnalytics.commonComplaint}
                  >
                    {reviewAnalytics.commonComplaint}
                  </span>
                  <span className="analytics-card__lbl">Top Complaint</span>
                </div>
              </div>
            )}

            {/* Advanced Search, Filtering, and Sorting Controls */}
            <div
              className="glass-panel"
              style={{
                padding: 'var(--space-sm) var(--space-md)',
                marginBottom: 'var(--space-md)',
                background: 'rgba(255,255,255,0.01)',
                borderColor: 'var(--color-border)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {/* Search Term & Reviews Sorting row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
                      🔍
                    </span>
                    <input
                      type="text"
                      placeholder="Search reviews by name or text..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setReviewsPage(0)
                      }}
                      style={{
                        background: 'var(--color-bg-glass)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-primary)',
                        padding: '6px 12px 6px 32px',
                        fontSize: 'var(--font-size-sm)',
                        width: '100%',
                        outline: 'none',
                        transition: 'border var(--transition-fast)'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label
                      htmlFor="review-sort"
                      style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}
                    >
                      Sort:
                    </label>
                    <select
                      id="review-sort"
                      value={reviewSort}
                      onChange={(e) => {
                        setReviewSort(e.target.value as any)
                        setReviewsPage(0)
                      }}
                      style={{
                        background: 'var(--color-bg-glass)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-primary)',
                        padding: '6px 10px',
                        fontSize: 'var(--font-size-xs)',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="newest">📅 Newest First</option>
                      <option value="oldest">📅 Oldest First</option>
                      <option value="rating-desc">⭐ Highest Rating</option>
                      <option value="rating-asc">⭐ Lowest Rating</option>
                      <option value="flagged-first">⚠ Flagged First</option>
                    </select>
                  </div>
                </div>

                {/* Filter chips list */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    borderTop: '1px dashed var(--color-border)',
                    paddingTop: 'var(--space-sm)'
                  }}
                >
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'positive', label: '⭐ Positive (4-5)' },
                    { id: 'negative', label: '⭐ Negative (1-2)' },
                    { id: 'flagged', label: '⚠ Flagged' },
                    { id: 'rash', label: '🚨 Rash' },
                    { id: 'overspeeding', label: '⚡ Overspeed' },
                    { id: 'sudden-braking', label: '🛑 Sudden Brake' },
                    { id: 'polite', label: '🤝 Polite' },
                    { id: 'clean', label: '✨ Clean' }
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      className={`btn btn--sm ${reviewFilter === chip.id ? 'btn--primary' : 'btn--ghost'}`}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        lineHeight: 1
                      }}
                      onClick={() => {
                        setReviewFilter(chip.id as any)
                        setReviewsPage(0)
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {reviewsError && (
              <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                Error fetching reviews: {reviewsError}
              </p>
            )}

            {/* Reviews Loading State */}
            {reviewsLoading ? (
              <div className="reviews-container">
                {[1, 2, 3].map((num) => (
                  <div key={num} className="review-card">
                    <div className="review-card__header">
                      <div className="skeleton skeleton-title"></div>
                      <div className="skeleton" style={{ width: '80px', height: '12px' }}></div>
                    </div>
                    <div className="skeleton skeleton-text" style={{ width: '90%' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '50%' }}></div>
                  </div>
                ))}
              </div>
            ) : filteredAndSortedReviews.length === 0 ? (
              /* High-fidelity empty states for reviews */
              <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>
                  {searchQuery || reviewFilter !== 'all' ? '🔍' : '💬'}
                </div>
                {searchQuery || reviewFilter !== 'all' ? (
                  <>
                    <p style={{ margin: '0 0 var(--space-sm)' }}>No reviews match your current search terms or filters.</p>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        setSearchQuery('')
                        setReviewFilter('all')
                        setReviewSort('newest')
                      }}
                    >
                      Reset Review Filters
                    </button>
                  </>
                ) : (
                  <p style={{ margin: 0 }}>No reviews have been written for this driver yet.</p>
                )}
              </div>
            ) : (
              <div className="reviews-container">
                {paginatedReviews.map((review) => {
                  const reviewerName = review.reviewer?.name ?? 'Anonymous Passenger'
                  const dateStr = new Date(review.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })

                  const hasWarnings = review.rash_driving || review.overspeeding || review.sudden_braking
                  const hasPositives = review.smooth_driving || review.polite_behavior || review.clean_bus

                  // Card border rating coloring
                  let cardRatingClass = ''
                  if (review.is_flagged) {
                    cardRatingClass = 'review-card--flagged'
                  } else if (review.rating >= 4) {
                    cardRatingClass = 'review-card--excellent'
                  } else if (review.rating === 3) {
                    cardRatingClass = 'review-card--neutral'
                  } else {
                    cardRatingClass = 'review-card--abysmal'
                  }

                  return (
                    <div key={review.id} className={`review-card ${cardRatingClass}`}>
                      <div className="review-card__header">
                        <span className="review-card__user">
                          {reviewerName}
                          {review.is_flagged && (
                            <span
                              className="safety-badge safety-badge--rash"
                              style={{
                                padding: '2px 8px',
                                fontSize: '8px',
                                borderRadius: '4px',
                                textTransform: 'uppercase'
                              }}
                            >
                              ⚠ Flagged as Abusive
                            </span>
                          )}
                        </span>
                        <span className="review-card__date">📅 {dateStr}</span>
                      </div>

                      <div className="review-card__rating">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <span key={idx}>{idx < review.rating ? '★' : '☆'}</span>
                        ))}
                        <span style={{ marginLeft: '4px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          ({review.rating}/5)
                        </span>
                      </div>

                      {review.review_text && <p className="review-card__text">"{review.review_text}"</p>}

                      <div className="review-card__footer">
                        {/* Behavior Tag Pills */}
                        <div className="review-card__tags">
                          {review.rash_driving && (
                            <span className="review-card__tag review-card__tag--warning">Rash Driving</span>
                          )}
                          {review.overspeeding && (
                            <span className="review-card__tag review-card__tag--warning">Overspeeding</span>
                          )}
                          {review.sudden_braking && (
                            <span className="review-card__tag review-card__tag--warning">Sudden Braking</span>
                          )}
                          {review.smooth_driving && (
                            <span className="review-card__tag review-card__tag--success">Smooth Driving</span>
                          )}
                          {review.polite_behavior && (
                            <span className="review-card__tag review-card__tag--success">Polite Behavior</span>
                          )}
                          {review.clean_bus && (
                            <span className="review-card__tag review-card__tag--success">Clean Bus</span>
                          )}
                          {!hasWarnings && !hasPositives && (
                            <span className="review-card__tag" style={{ background: 'transparent', border: 'none' }}>
                              No behavior tags logged
                            </span>
                          )}
                        </div>

                        {/* Moderation control buttons */}
                        <div className="review-card__actions">
                          <button
                            className="btn btn--ghost btn--sm"
                            style={{ padding: '4px 10px', fontSize: '11px', borderColor: 'rgba(245,158,11,0.3)' }}
                            onClick={() => handleFlagReview(review.id)}
                            disabled={review.is_flagged || moderatingId === review.id}
                          >
                            {review.is_flagged ? 'Flagged' : 'Flag'}
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            onClick={() => setConfirmDeleteId(review.id)}
                            disabled={moderatingId === review.id}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination controls for filtered reviews list */}
            {filteredAndSortedReviews.length > pageSize && (
              <div className="pagination">
                <span className="pagination__info">
                  Showing {reviewsPage * pageSize + 1} to{' '}
                  {Math.min((reviewsPage + 1) * pageSize, filteredAndSortedReviews.length)} of{' '}
                  {filteredAndSortedReviews.length} reviews
                </span>
                <div className="pagination__buttons">
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleReviewsPageChange(reviewsPage - 1)}
                    disabled={reviewsPage === 0 || reviewsLoading}
                  >
                    ← Previous
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleReviewsPageChange(reviewsPage + 1)}
                    disabled={(reviewsPage + 1) * pageSize >= filteredAndSortedReviews.length || reviewsLoading}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirmation Modal for review soft deletion */}
      <Modal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Confirm Review Deletion"
        width="440px"
      >
        <div style={{ padding: 'var(--space-xs) 0' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5, margin: 0 }}>
            Are you sure you want to delete this review? This action will hide it from the platform and automatically recalculate the driver's safety ratings, total reviews, and safety score in the backend.
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: 'var(--space-lg)'
            }}
          >
            <button className="btn btn--ghost" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              onClick={handleConfirmSoftDelete}
              disabled={moderatingId !== null}
            >
              {moderatingId !== null ? 'Deleting…' : 'Delete Review'}
            </button>
          </div>
        </div>
      </Modal>

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
