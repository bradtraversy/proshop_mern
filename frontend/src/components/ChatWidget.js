import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import axios from 'axios'
import '../styles/chat-widget.css'

const ENDPOINT = '/api/assistant/chat'
const STROKE = 1.5

const SIZE_STORAGE_KEY = 'chat_widget_size_v1'
const DEFAULT_SIZE = { width: 360, height: 480 }
const MIN_SIZE = { width: 300, height: 360 }
const MAX_SIZE = { width: 720, height: 800 }

const clamp = (n, min, max) => Math.min(Math.max(n, min), max)

const loadSize = () => {
  try {
    const raw = window.localStorage.getItem(SIZE_STORAGE_KEY)
    if (!raw) return DEFAULT_SIZE
    const parsed = JSON.parse(raw)
    return {
      width: clamp(Number(parsed.width) || DEFAULT_SIZE.width, MIN_SIZE.width, MAX_SIZE.width),
      height: clamp(Number(parsed.height) || DEFAULT_SIZE.height, MIN_SIZE.height, MAX_SIZE.height),
    }
  } catch (_) {
    return DEFAULT_SIZE
  }
}

// Lucide-style inline icons (line, 1.5 stroke). DESIGN §9.
const IconMessage = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={STROKE}
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
  >
    <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
  </svg>
)

const IconX = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={STROKE}
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
  >
    <path d='M18 6 6 18M6 6l12 12' />
  </svg>
)

const IconResize = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={STROKE}
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
  >
    <path d='M4 14 14 4' />
    <path d='M9 4h5v5' />
    <path d='M4 9V4h5' />
  </svg>
)

const IconSend = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={STROKE}
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
  >
    <path d='M22 2 11 13' />
    <path d='M22 2 15 22l-4-9-9-4z' />
  </svg>
)

// Minimal markdown renderer for chat content. React elements only, no
// innerHTML (XSS-safe). Supports: **bold**, *italic* / _italic_, `code`,
// unordered lists (- / *), ordered lists (1. ), headers (#, ##, ###),
// blank-line paragraphs. Anything else is plain text.
const renderInline = (text) => {
  const nodes = []
  let i = 0
  let key = 0
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2)
      if (end > i + 2) {
        nodes.push(<strong key={key++}>{text.slice(i + 2, end)}</strong>)
        i = end + 2
        continue
      }
    }
    if (text.startsWith('`', i)) {
      const end = text.indexOf('`', i + 1)
      if (end > i + 1) {
        nodes.push(<code key={key++}>{text.slice(i + 1, end)}</code>)
        i = end + 1
        continue
      }
    }
    if (text[i] === '*' || text[i] === '_') {
      const ch = text[i]
      const end = text.indexOf(ch, i + 1)
      if (
        end > i + 1 &&
        /[^\s]/.test(text[i + 1]) &&
        text[end - 1] !== ' '
      ) {
        nodes.push(<em key={key++}>{text.slice(i + 1, end)}</em>)
        i = end + 1
        continue
      }
    }
    let next = text.length
    for (const m of ['**', '`', '*', '_']) {
      const p = text.indexOf(m, i + 1)
      if (p !== -1 && p < next) next = p
    }
    nodes.push(text.slice(i, next))
    i = next
  }
  return nodes
}

const renderMarkdown = (raw) => {
  if (typeof raw !== 'string' || !raw) return null
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5'
      blocks.push(<Tag key={key++} className='cwmd-h'>{renderInline(h[2])}</Tag>)
      i++
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key++} className='cwmd-list'>
          {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
        </ul>
      )
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={key++} className='cwmd-list'>
          {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
        </ol>
      )
      continue
    }

    const paraLines = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s|\d+\.\s)/.test(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++} className='cwmd-p'>
        {paraLines.map((pl, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(pl)}
          </React.Fragment>
        ))}
      </p>
    )
  }
  return blocks
}

const ROUTE_LABELS = {
  'claude-haiku': { label: 'Claude Haiku', tone: 'info' },
  'qwen-local': { label: 'Qwen (local)', tone: 'success' },
}

const ModelBadge = ({ routed }) => {
  const meta = ROUTE_LABELS[routed] || { label: routed, tone: 'neutral' }
  return (
    <span
      className={`chat-widget-badge tone-${meta.tone}`}
      title={`Ответил: ${meta.label}`}
    >
      via {meta.label}
    </span>
  )
}

const ChatWidget = () => {
  const { userInfo } = useSelector((state) => state.userLogin)

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [size, setSize] = useState(loadSize)
  const [resizing, setResizing] = useState(false)

  const logRef = useRef(null)
  const inputRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !resizing) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, resizing])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size))
    } catch (_) {}
  }, [size])

  useEffect(() => {
    const onResize = () => {
      setSize((s) => ({
        width: clamp(s.width, MIN_SIZE.width, Math.min(MAX_SIZE.width, window.innerWidth - 24)),
        height: clamp(s.height, MIN_SIZE.height, Math.min(MAX_SIZE.height, window.innerHeight - 24)),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onResizeStart = useCallback((e) => {
    e.preventDefault()
    const point = e.touches ? e.touches[0] : e
    dragRef.current = {
      startX: point.clientX,
      startY: point.clientY,
      startW: size.width,
      startH: size.height,
    }
    setResizing(true)
  }, [size])

  useEffect(() => {
    if (!resizing) return
    const move = (e) => {
      const d = dragRef.current
      if (!d) return
      const point = e.touches ? e.touches[0] : e
      const maxW = Math.min(MAX_SIZE.width, window.innerWidth - 24)
      const maxH = Math.min(MAX_SIZE.height, window.innerHeight - 24)
      // Panel anchored bottom-right: drag the top-left handle leftward/upward
      // to grow.
      const nextW = clamp(d.startW + (d.startX - point.clientX), MIN_SIZE.width, maxW)
      const nextH = clamp(d.startH + (d.startY - point.clientY), MIN_SIZE.height, maxH)
      setSize({ width: nextW, height: nextH })
    }
    const end = () => {
      dragRef.current = null
      setResizing(false)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', end)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
    }
  }, [resizing])

  const onResizeKey = (e) => {
    const step = e.shiftKey ? 48 : 16
    let dw = 0
    let dh = 0
    if (e.key === 'ArrowLeft') dw = step
    else if (e.key === 'ArrowRight') dw = -step
    else if (e.key === 'ArrowUp') dh = step
    else if (e.key === 'ArrowDown') dh = -step
    else return
    e.preventDefault()
    setSize((s) => ({
      width: clamp(s.width + dw, MIN_SIZE.width, Math.min(MAX_SIZE.width, window.innerWidth - 24)),
      height: clamp(s.height + dh, MIN_SIZE.height, Math.min(MAX_SIZE.height, window.innerHeight - 24)),
    }))
  }

  if (!userInfo) return null

  const send = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const nextHistory = [
      ...messages,
      { role: 'user', content: text, intentRoute: null },
    ]
    setMessages(nextHistory)
    setInput('')
    setLoading(true)

    try {
      const { data } = await axios.post(
        ENDPOINT,
        {
          message: text,
          history: messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({
              role: m.role,
              content: m.content,
              intentRoute: m.intentRoute || null,
            })),
        },
        { timeout: 65000 }
      )
      const respRoute = data?.route || null
      setMessages((prev) => {
        const updated = [...prev]
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === 'user' && !updated[i].intentRoute) {
            updated[i] = { ...updated[i], intentRoute: respRoute }
            break
          }
        }
        updated.push({
          role: 'assistant',
          content: data?.reply || '(пустой ответ)',
          routed: data?.routed || null,
          toolsUsed: Array.isArray(data?.toolsUsed) ? data.toolsUsed : [],
          intentRoute: respRoute,
        })
        return updated
      })
    } catch (err) {
      const detail =
        err.response?.data?.message || err.message || 'network error'
      setMessages((prev) => [
        ...prev,
        { role: 'error', content: `Не удалось получить ответ: ${detail}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          type='button'
          className='chat-widget-fab'
          aria-label='Открыть чат с ассистентом'
          onClick={() => setOpen(true)}
        >
          <IconMessage size={24} />
        </button>
      )}
      {open && (
        <div
          className={`chat-widget-panel${resizing ? ' is-resizing' : ''}`}
          role='dialog'
          aria-modal='false'
          aria-labelledby='chat-widget-title'
          style={{ width: `${size.width}px`, height: `${size.height}px` }}
        >
          <div
            className='chat-widget-resize'
            role='slider'
            tabIndex={0}
            aria-label='Изменить размер чата'
            aria-valuemin={MIN_SIZE.width}
            aria-valuemax={MAX_SIZE.width}
            aria-valuenow={size.width}
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
            onKeyDown={onResizeKey}
          >
            <IconResize size={14} />
          </div>
          <header className='chat-widget-header'>
            <h3 id='chat-widget-title' className='chat-widget-title'>
              Ассистент
            </h3>
            <button
              type='button'
              className='chat-widget-close'
              aria-label='Закрыть чат'
              onClick={() => setOpen(false)}
            >
              <IconX size={20} />
            </button>
          </header>

          <div
            className='chat-widget-log'
            ref={logRef}
            aria-live='polite'
            aria-busy={loading}
          >
            {messages.length === 0 && (
              <div className='chat-widget-empty'>
                <IconMessage size={32} />
                <p className='chat-widget-empty-title'>Чем помочь, {userInfo.name}?</p>
                <p className='chat-widget-empty-text'>
                  Спросите про товары, статус заказа или доставку.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-widget-row ${m.role}`}>
                <div
                  className={`chat-widget-msg ${m.role}`}
                  role={m.role === 'error' ? 'alert' : undefined}
                >
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                </div>
                {m.role === 'assistant' && (m.routed || (m.toolsUsed && m.toolsUsed.length > 0)) && (
                  <div className='chat-widget-meta'>
                    {m.routed && <ModelBadge routed={m.routed} />}
                    {m.toolsUsed && m.toolsUsed.map((t, idx) => (
                      <span key={idx} className='chat-widget-chip'>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className='chat-widget-status' role='status'>
                <span className='chat-widget-dot' />
                Печатает…
              </div>
            )}
          </div>

          <form
            className='chat-widget-form'
            onSubmit={send}
            aria-busy={loading}
          >
            <input
              ref={inputRef}
              type='text'
              className='chat-widget-input'
              placeholder='Сообщение…'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              aria-label='Сообщение ассистенту'
            />
            <button
              type='submit'
              className='chat-widget-send'
              disabled={loading || !input.trim()}
              aria-label={loading ? 'Отправка…' : 'Отправить сообщение'}
            >
              {loading ? <span className='chat-widget-spinner' /> : <IconSend size={18} />}
            </button>
          </form>
        </div>
      )}
    </>
  )
}

export default ChatWidget
