import React, { useState, useRef, useEffect } from 'react'
import { Route, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import SearchBox from './SearchBox'
import Icon from './Icon'
import { logout } from '../actions/userActions'
import useDarkMode from '../hooks/useDarkMode'
import useFeatureEnabled from '../hooks/useFeatureEnabled'

const NavMenu = ({ label, children, align = 'right' }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type='button'
        className='ps-btn ps-btn-ghost ps-btn-sm'
        aria-haspopup='menu'
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <Icon name='chevronDown' size={16} />
      </button>
      {open && (
        <div
          role='menu'
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            [align]: 0,
            minWidth: 200,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: 4,
            zIndex: 1000,
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

const MenuItem = ({ to, onClick, children }) => {
  const style = {
    display: 'block',
    padding: '8px 12px',
    fontSize: 'var(--text-body-sm)',
    color: 'var(--fg)',
    borderRadius: 'var(--radius-sm)',
    textDecoration: 'none',
    cursor: 'pointer',
    background: 'transparent',
    border: 0,
    width: '100%',
    textAlign: 'left',
  }
  if (to) return <Link to={to} role='menuitem' style={style}>{children}</Link>
  return (
    <button type='button' role='menuitem' onClick={onClick} style={style}>
      {children}
    </button>
  )
}

const Header = () => {
  const dispatch = useDispatch()

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const cart = useSelector((state) => state.cart)
  const cartCount = cart.cartItems.reduce((acc, it) => acc + it.qty, 0)

  const moderationEnabled = useFeatureEnabled('reviews_moderation')
  const darkModeEnabled = useFeatureEnabled('dark_mode')
  const [isDark, toggleDarkMode] = useDarkMode()

  const logoutHandler = () => dispatch(logout())

  return (
    <header className='ps-header'>
      <div className='ps-header-inner'>
        <Link to='/' className='ps-brand'>ProShop</Link>

        <div className='ps-header-search'>
          <Route render={({ history }) => <SearchBox history={history} />} />
        </div>

        <nav className='ps-header-actions' aria-label='Primary'>
          <Link
            to='/cart'
            className='ps-btn ps-btn-ghost ps-btn-sm ps-cart-btn'
            aria-label={`Cart (${cartCount} item${cartCount === 1 ? '' : 's'})`}
          >
            <Icon name='cart' size={18} />
            <span>Cart</span>
            {cartCount > 0 && (
              <span className='ps-cart-badge' aria-hidden='true'>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {userInfo ? (
            <NavMenu label={userInfo.name}>
              <MenuItem to='/profile'>Profile</MenuItem>
              <MenuItem onClick={logoutHandler}>Sign out</MenuItem>
            </NavMenu>
          ) : (
            <Link to='/login' className='ps-btn ps-btn-ghost ps-btn-sm'>
              <Icon name='user' size={18} />
              <span>Sign in</span>
            </Link>
          )}

          {userInfo && userInfo.isAdmin && (
            <NavMenu label='Admin'>
              <MenuItem to='/admin/userlist'>Users</MenuItem>
              <MenuItem to='/admin/productlist'>Products</MenuItem>
              <MenuItem to='/admin/orderlist'>Orders</MenuItem>
              <MenuItem to='/admin/featuredashboard'>Feature dashboard</MenuItem>
              <MenuItem to='/admin/ai-router'>AI Router</MenuItem>
              {moderationEnabled && <MenuItem to='/admin/reviews'>Review queue</MenuItem>}
            </NavMenu>
          )}

          {darkModeEnabled && (
            <button
              type='button'
              className='ps-btn ps-btn-icon'
              onClick={toggleDarkMode}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={isDark}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              <Icon name={isDark ? 'sun' : 'moon'} size={18} />
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
