import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Icon from '../components/Icon'
import AutoPilotControls from '../components/AutoPilotControls'
import { updateFeatureFlag, loadFeatureFlags } from '../actions/featureFlagActions'

const STATUSES = ['Enabled', 'Testing', 'Disabled']
const STATUS_LABEL_SHORT = { Enabled: 'On', Testing: 'Testing', Disabled: 'Off' }

const statusBadgeClass = (status) => {
  if (status === 'Enabled') return 'ps-badge--success'
  if (status === 'Testing') return 'ps-badge--warning'
  return 'ps-badge'
}

const SkeletonCard = () => (
  <div className='ps-card ff-card' aria-hidden='true'>
    <div className='ps-skeleton' style={{ height: 18, width: '60%', marginBottom: 8 }} />
    <div className='ps-skeleton' style={{ height: 12, width: '40%', marginBottom: 14 }} />
    <div className='ps-skeleton' style={{ height: 12, width: '95%', marginBottom: 6 }} />
    <div className='ps-skeleton' style={{ height: 12, width: '80%', marginBottom: 16 }} />
    <div className='ps-skeleton' style={{ height: 32, width: '100%' }} />
  </div>
)

const EmptyState = ({ title, hint }) => (
  <div className='ps-empty' style={{ gridColumn: '1 / -1' }}>
    <span className='ps-empty-icon'><Icon name='flag' size={40} /></span>
    <h3>{title}</h3>
    <p>{hint}</p>
  </div>
)

const TrafficSlider = ({ value, disabled, onChange, onCommit, ariaLabel }) => (
  <div className='ff-slider-wrap'>
    <div className='ff-slider-track' aria-hidden='true'>
      <div className='ff-slider-fill' style={{ width: `${value}%` }} />
    </div>
    <input
      type='range'
      min='0' max='100' step='1'
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      onMouseUp={(e) => onCommit && onCommit(Number(e.target.value))}
      onTouchEnd={(e) => onCommit && onCommit(Number(e.target.value))}
      onKeyUp={(e) => onCommit && onCommit(Number(e.target.value))}
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className='ff-slider-input'
    />
  </div>
)

const FlagCard = ({ flag, selected, onSelect, onStatusChange, onTrafficChange }) => {
  const [localTraffic, setLocalTraffic] = useState(flag.traffic_percentage)
  useEffect(() => { setLocalTraffic(flag.traffic_percentage) }, [flag.traffic_percentage])

  const showSlider = flag.status === 'Testing'
  const commit = (v) => { if (v !== flag.traffic_percentage) onTrafficChange(v) }

  return (
    <article className={`ps-card ff-card${selected ? ' is-selected' : ''}`}>
      <header className='ff-card-head'>
        <div style={{ minWidth: 0 }}>
          <h3 className='ff-name' title={flag.name}>{flag.name}</h3>
          <div className='ff-key ps-mono' title={flag.key}>{flag.key}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className={`ps-badge ${statusBadgeClass(flag.status)}`}>{flag.status}</span>
          {flag.implemented === 'partial' && <span className='ps-badge ps-badge--warning'>partial</span>}
          {flag.implemented === 'no' && <span className='ps-badge'>not in code</span>}
        </div>
      </header>

      <p className='ff-desc'>{flag.description}</p>

      <div className='ps-seg ff-seg' role='group' aria-label={`Status for ${flag.name}`}>
        {STATUSES.map((s) => (
          <button
            key={s}
            type='button'
            className={flag.status === s ? 'is-active' : ''}
            aria-pressed={flag.status === s}
            onClick={() => { if (flag.status !== s) onStatusChange(s) }}
          >
            {STATUS_LABEL_SHORT[s]}
          </button>
        ))}
      </div>

      <div className={`ff-traffic${showSlider ? '' : ' is-disabled'}`}>
        <div className='ff-traffic-row'>
          <span className='ps-caption'>Traffic</span>
          <span className='ps-mono ff-traffic-val'>{localTraffic}%</span>
        </div>
        <TrafficSlider
          value={localTraffic}
          disabled={!showSlider}
          onChange={(v) => setLocalTraffic(v)}
          onCommit={(v) => commit(v)}
          ariaLabel={`Traffic percentage for ${flag.name}`}
        />
      </div>

      <footer className='ff-card-foot'>
        <span>rollout · {flag.rollout_strategy || '—'}</span>
        <span>upd · {flag.last_modified || '—'}</span>
        {onSelect && (
          <button
            type='button'
            className={`ps-btn ps-btn-ghost ff-ap-btn${selected ? ' is-active' : ''}`}
            onClick={() => onSelect(flag.key)}
            aria-pressed={!!selected}
          >
            {selected ? 'Auto-Pilot ✓' : 'Auto-Pilot'}
          </button>
        )}
      </footer>
    </article>
  )
}

const IMPL_OPTIONS = ['any', 'yes', 'partial', 'no']

const FeatureFlagsScreen = ({ history }) => {
  const dispatch = useDispatch()
  const { userInfo } = useSelector((s) => s.userLogin)
  const { loading, error, flags, updateError, lastChanged } = useSelector((s) => s.featureFlags)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [implFilter, setImplFilter] = useState('any')
  const [selectedKey, setSelectedKey] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!userInfo || !userInfo.isAdmin) history.push('/login')
  }, [history, userInfo])

  useEffect(() => {
    const id = setInterval(() => {
      dispatch(loadFeatureFlags({ silent: true }))
    }, 3000)
    return () => clearInterval(id)
  }, [dispatch])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const liveLabel = (() => {
    if (!lastChanged) return 'ожидание данных'
    const sec = Math.max(0, Math.floor((now - lastChanged) / 1000))
    if (sec < 2) return 'обновлено только что'
    if (sec < 60) return `обновлено ${sec} сек назад`
    const min = Math.floor(sec / 60)
    return `обновлено ${min} мин назад`
  })()

  const counts = useMemo(() => {
    const c = { All: flags.length, Enabled: 0, Testing: 0, Disabled: 0 }
    flags.forEach((f) => { if (c[f.status] !== undefined) c[f.status]++ })
    return c
  }, [flags])

  const stale = useMemo(() => {
    return flags.filter((f) => {
      if (!f.last_modified) return false
      const d = new Date(f.last_modified)
      if (Number.isNaN(d.getTime())) return false
      const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
      return days > 30
    }).length
  }, [flags])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return flags.filter((f) => {
      if (statusFilter !== 'All' && f.status !== statusFilter) return false
      if (implFilter !== 'any' && (f.implemented || 'no') !== implFilter) return false
      if (!q) return true
      return (
        f.name.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
      )
    })
  }, [flags, search, statusFilter, implFilter])

  const cycleImpl = () => {
    const idx = IMPL_OPTIONS.indexOf(implFilter)
    setImplFilter(IMPL_OPTIONS[(idx + 1) % IMPL_OPTIONS.length])
  }

  return (
    <div className='ps-container ff-screen'>
      <header className='ps-page-header'>
        <div>
          <p className='ps-caption' style={{ marginBottom: 4 }}>Admin · Platform</p>
          <div className='ps-page-title'>
            <h1>Feature flags</h1>
            <span className='ps-caption'>
              {flags.length} flags · {counts.Testing} testing
              {stale > 0 ? ` · ${stale} stale` : ''}
            </span>
          </div>
        </div>
        <div className='ff-live' aria-live='polite' aria-atomic='true'>
          <span className='ff-live-dot' aria-hidden='true' />
          <span>Live · {liveLabel}</span>
        </div>
      </header>

      {updateError && (
        <div style={{ marginBottom: 16 }}>
          <Message variant='danger'>Failed to save change: {updateError}</Message>
        </div>
      )}

      <div className='ff-toolbar'>
        <div className='ps-search ff-search'>
          <span className='ps-search-icon' aria-hidden='true'><Icon name='search' size={18} /></span>
          <input
            type='search'
            placeholder='Search by name, key, or description…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label='Search feature flags'
          />
        </div>

        <div className='ps-seg' role='group' aria-label='Filter by status'>
          {['All', ...STATUSES].map((s) => (
            <button
              key={s}
              type='button'
              className={statusFilter === s ? 'is-active' : ''}
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            >
              {s} · {counts[s] ?? 0}
            </button>
          ))}
        </div>

        <button
          type='button'
          className={`ps-chip${implFilter !== 'any' ? ' is-active' : ''}`}
          onClick={cycleImpl}
          aria-label={`Filter by implementation: ${implFilter}`}
        >
          impl · {implFilter}
          <Icon name='chevronDown' size={14} />
        </button>
      </div>

      {loading ? (
        <div className='ff-grid'>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : error ? (
        <Message variant='danger'>Could not load feature flags: {error}</Message>
      ) : filtered.length === 0 ? (
        <div className='ff-grid'>
          <EmptyState
            title={flags.length === 0 ? 'No feature flags' : 'No matches'}
            hint={flags.length === 0 ? 'features.json appears empty.' : 'Adjust the search query or filters.'}
          />
        </div>
      ) : (
        <div className='ff-grid'>
          {filtered.map((flag) => (
            <FlagCard
              key={flag.key}
              flag={flag}
              selected={selectedKey === flag.key}
              onSelect={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
              onStatusChange={(s) => dispatch(updateFeatureFlag(flag.key, { status: s }))}
              onTrafficChange={(v) => dispatch(updateFeatureFlag(flag.key, { traffic_percentage: v }))}
            />
          ))}
        </div>
      )}

      {selectedKey && (() => {
        const selectedFlag = flags.find((f) => f.key === selectedKey)
        if (!selectedFlag) return null
        return (
          <div className='ap-panel'>
            <AutoPilotControls
              feature={selectedFlag}
              onUpdate={() => dispatch(loadFeatureFlags({ silent: true }))}
              onClose={() => setSelectedKey(null)}
            />
          </div>
        )
      })()}
    </div>
  )
}

export default FeatureFlagsScreen
