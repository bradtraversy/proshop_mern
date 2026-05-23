import React, { useState } from 'react'

const AutoPilotControls = ({ feature, onUpdate, onClose }) => {
  const [loading, setLoading] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const callAutoPilot = async (action, extras = {}) => {
    setLoading(action)
    setFeedback(null)

    try {
      const response = await fetch('/api/autopilot/feature-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_id: feature.key,
          action,
          ...extras,
        }),
      })

      let result = {}
      try { result = await response.json() } catch (_) { /* non-JSON body */ }

      if (!response.ok || result.success === false) {
        setFeedback({ type: 'danger', message: result.message || `HTTP ${response.status}` })
        return
      }

      setFeedback({ type: 'success', message: result.message || 'Done' })
      if (result.current_state && onUpdate) onUpdate(result.current_state)
    } catch (e) {
      setFeedback({ type: 'danger', message: `Network: ${e.message}` })
    } finally {
      setLoading(null)
    }
  }

  const busy = loading !== null

  return (
    <section className='ps-card ap-card' aria-label='Auto-Pilot Controls'>
      <header className='ap-head'>
        <div style={{ minWidth: 0 }}>
          <p className='ps-caption' style={{ marginBottom: 4 }}>Auto-Pilot</p>
          <h3 className='ap-title' title={feature.name}>{feature.name}</h3>
          <div className='ps-mono ap-key' title={feature.key}>{feature.key}</div>
        </div>
        {onClose && (
          <button type='button' className='ps-btn ps-btn-ghost' onClick={onClose} aria-label='Close Auto-Pilot panel'>
            Close
          </button>
        )}
      </header>

      <div className='ap-actions' role='group' aria-label='Auto-Pilot actions'>
        <button
          type='button'
          className='ps-btn'
          onClick={() => callAutoPilot('check')}
          disabled={busy}
        >
          {loading === 'check' ? 'Checking…' : 'Run check'}
        </button>

        <button
          type='button'
          className='ps-btn ps-btn-primary'
          onClick={() => callAutoPilot('test', { target_state: 'Testing' })}
          disabled={busy}
        >
          {loading === 'test' ? 'Enabling…' : 'Testing mode'}
        </button>

        <button
          type='button'
          className='ps-btn ps-btn-danger'
          onClick={() => callAutoPilot('rollback', { target_state: 'Disabled' })}
          disabled={busy}
        >
          {loading === 'rollback' ? 'Rolling back…' : 'Rollback feature'}
        </button>
      </div>

      {feedback && (
        <div className={`ps-alert ps-alert--${feedback.type}`} role='alert'>
          {feedback.message}
        </div>
      )}
    </section>
  )
}

export default AutoPilotControls
