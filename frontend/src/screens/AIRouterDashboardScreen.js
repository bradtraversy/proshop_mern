import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useSelector } from 'react-redux'
import Message from '../components/Message'
import Icon from '../components/Icon'

const fmtTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString()
}

const fmtCost = (n) =>
  '$' + (Number(n) || 0).toFixed(4).replace(/0+$/, '').replace(/\.$/, '.00')

const ClampCell = ({ text, onExpand, expanded }) => {
  if (!text) return <span className='ps-caption'>—</span>
  const isLong = text.length > 140
  return (
    <div style={{ maxWidth: 320 }}>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.4,
        }}
      >
        {text}
      </div>
      {isLong && (
        <button
          type='button'
          onClick={onExpand}
          className='ps-btn ps-btn-ghost ps-btn-sm'
          style={{
            padding: '2px 6px',
            marginTop: 4,
            fontSize: 12,
            color: 'var(--accent, #1976d2)',
          }}
        >
          {expanded ? 'Collapse' : 'Show more'}
        </button>
      )}
    </div>
  )
}

const FullTextModal = ({ log, onClose }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!log) return null
  const isLocal = log.modelRoute === 'local'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      role='dialog'
      aria-modal='true'
      aria-label='Chat log details'
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elevated, #fff)',
          color: 'var(--fg, #111)',
          borderRadius: 12,
          maxWidth: 880,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e5e5e5)',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 600 }}>
              {log.user ? log.user.name : 'Unknown user'}
              <span className='ps-caption' style={{ marginLeft: 8 }}>
                {fmtTime(log.createdAt)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span
                className={`ps-badge ${
                  isLocal ? 'ps-badge--success' : 'ps-badge--accent'
                }`}
              >
                {isLocal ? 'local' : 'cloud'}
              </span>
              <span className='ps-badge ps-mono'>{log.model || '—'}</span>
              <span className='ps-badge'>{log.latencyMs} ms</span>
              <span className='ps-badge'>
                {isLocal
                  ? '$0.00'
                  : '$' + (Number(log.costUsd) || 0).toFixed(4)}
              </span>
              {(log.piiEntityTypes || []).map((p) => (
                <span key={p} className='ps-badge ps-badge--warning'>
                  {p}
                </span>
              ))}
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='ps-btn ps-btn-ghost ps-btn-sm'
            aria-label='Close'
          >
            <Icon name='x' size={18} />
          </button>
        </header>

        <div
          style={{
            padding: 20,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <section>
            <div
              className='ps-caption'
              style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              User message
            </div>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'var(--bg-muted, #f6f6f6)',
                borderRadius: 8,
                padding: 12,
                lineHeight: 1.5,
              }}
            >
              {log.message || <span className='ps-caption'>—</span>}
            </div>
          </section>

          <section>
            <div
              className='ps-caption'
              style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              Assistant reply
            </div>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: isLocal
                  ? 'rgba(46, 125, 50, 0.08)'
                  : 'rgba(25, 118, 210, 0.06)',
                borderRadius: 8,
                padding: 12,
                lineHeight: 1.5,
              }}
            >
              {log.reply || <span className='ps-caption'>—</span>}
            </div>
          </section>

          {log.toolsUsed && log.toolsUsed.length > 0 && (
            <section>
              <div
                className='ps-caption'
                style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}
              >
                Tools used
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {log.toolsUsed.map((t, i) => (
                  <span key={i} className='ps-badge ps-mono'>
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

const AIRouterDashboardScreen = ({ history }) => {
  const { userInfo } = useSelector((s) => s.userLogin)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState(null)
  const [expanded, setExpanded] = useState({}) // { [logId]: 'message'|'reply'|null }
  const [modalLog, setModalLog] = useState(null)

  useEffect(() => {
    if (!userInfo || !userInfo.isAdmin) {
      history.push('/login')
      return
    }
    let cancelled = false
    setLoading(true)
    axios
      .get('/api/assistant/logs?limit=200', {
        headers: { Authorization: `Bearer ${userInfo.token}` },
      })
      .then((res) => {
        if (cancelled) return
        setLogs(res.data.logs || [])
        setSummary(res.data.summary || null)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err.response && err.response.data && err.response.data.message
            ? err.response.data.message
            : err.message
        )
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [userInfo, history])

  return (
    <div className='ps-container' style={{ paddingTop: 32, paddingBottom: 64 }}>
      <header className='ps-page-header'>
        <div className='ps-page-title'>
          <h1>AI Router Dashboard</h1>
          {summary && (
            <span className='ps-caption'>{summary.total} requests</span>
          )}
        </div>
      </header>

      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div className='ps-card' style={{ padding: 16 }}>
            <div className='ps-caption'>Total</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{summary.total}</div>
          </div>
          <div className='ps-card' style={{ padding: 16 }}>
            <div className='ps-caption'>Local (private)</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--success, #2e7d32)' }}>
              {summary.local}
            </div>
          </div>
          <div className='ps-card' style={{ padding: 16 }}>
            <div className='ps-caption'>Cloud</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{summary.cloud}</div>
          </div>
          <div className='ps-card' style={{ padding: 16 }}>
            <div className='ps-caption'>Spent on cloud</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>
              ${summary.totalCostUsd.toFixed(4)}
            </div>
          </div>
          <div className='ps-card' style={{ padding: 16 }}>
            <div className='ps-caption'>Est. savings (local)</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--success, #2e7d32)' }}>
              ${summary.estimatedSavingsUsd.toFixed(4)}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className='ps-empty' aria-busy='true'>
          <span className='ps-empty-icon'>
            <Icon name='loader' size={40} />
          </span>
          <h3>Loading logs…</h3>
        </div>
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : logs.length === 0 ? (
        <div className='ps-empty'>
          <h3>No chat logs yet</h3>
          <p>Once users start chatting with the assistant, requests appear here.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className='ps-table'>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Message</th>
                <th>PII</th>
                <th>Route</th>
                <th>Model</th>
                <th>Reply</th>
                <th>Latency</th>
                <th>$</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const isLocal = l.modelRoute === 'local'
                return (
                  <tr
                    key={l._id}
                    style={{
                      background: isLocal
                        ? 'rgba(46, 125, 50, 0.06)'
                        : 'rgba(25, 118, 210, 0.04)',
                    }}
                  >
                    <td className='ps-mono' style={{ whiteSpace: 'nowrap', color: 'var(--fg-muted)' }}>
                      {fmtTime(l.createdAt)}
                    </td>
                    <td>
                      {l.user ? (
                        <>
                          <div style={{ fontWeight: 500 }}>{l.user.name}</div>
                          <div className='ps-caption ps-mono'>
                            {l.user._id ? String(l.user._id).slice(-6) : ''}
                          </div>
                        </>
                      ) : (
                        <span className='ps-caption'>—</span>
                      )}
                    </td>
                    <td>
                      <ClampCell
                        text={l.message}
                        expanded={expanded[l._id] === 'message'}
                        onExpand={() =>
                          setExpanded((p) => ({
                            ...p,
                            [l._id]: p[l._id] === 'message' ? null : 'message',
                          }))
                        }
                      />
                    </td>
                    <td>
                      {l.piiEntityTypes && l.piiEntityTypes.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {l.piiEntityTypes.map((p) => (
                            <span key={p} className='ps-badge ps-badge--warning'>
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className='ps-caption'>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`ps-badge ${
                          isLocal ? 'ps-badge--success' : 'ps-badge--accent'
                        }`}
                      >
                        {isLocal ? 'local' : 'cloud'}
                      </span>
                    </td>
                    <td className='ps-mono'>{l.model || '—'}</td>
                    <td>
                      <ClampCell
                        text={l.reply}
                        expanded={expanded[l._id] === 'reply'}
                        onExpand={() =>
                          setExpanded((p) => ({
                            ...p,
                            [l._id]: p[l._id] === 'reply' ? null : 'reply',
                          }))
                        }
                      />
                    </td>
                    <td className='ps-mono' style={{ whiteSpace: 'nowrap' }}>
                      {l.latencyMs} ms
                    </td>
                    <td className='ps-mono' style={{ whiteSpace: 'nowrap' }}>
                      {isLocal ? '$0.00' : fmtCost(l.costUsd)}
                    </td>
                    <td>
                      <button
                        type='button'
                        onClick={() => setModalLog(l)}
                        className='ps-btn ps-btn-ghost ps-btn-sm'
                        aria-label='Open full details'
                        title='Open full details'
                      >
                        <Icon name='external-link' size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalLog && (
        <FullTextModal log={modalLog} onClose={() => setModalLog(null)} />
      )}
    </div>
  )
}

export default AIRouterDashboardScreen
