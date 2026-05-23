import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'react-redux'
import axios from 'axios'
import store from './store'
import { logout } from './actions/userActions'
import './bootstrap.min.css'
import './index.css'
import App from './App'
import * as serviceWorker from './serviceWorker'

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error && error.response && error.response.status
    if (status === 401) {
      const onLogin = window.location.pathname === '/login'
      const wasLogged = !!(store.getState().userLogin && store.getState().userLogin.userInfo)
      if (wasLogged && !onLogin) {
        store.dispatch(logout())
      }
    }
    return Promise.reject(error)
  }
)

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()
