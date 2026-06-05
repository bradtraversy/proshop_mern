import React, { useEffect } from 'react'
import { BrowserRouter as Router, Route } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import Header from './components/Header'
import Footer from './components/Footer'
import HomeScreen from './screens/HomeScreen'
import ProductScreen from './screens/ProductScreen'
import CartScreen from './screens/CartScreen'
import LoginScreen from './screens/LoginScreen'
import RegisterScreen from './screens/RegisterScreen'
import ProfileScreen from './screens/ProfileScreen'
import ShippingScreen from './screens/ShippingScreen'
import PaymentScreen from './screens/PaymentScreen'
import PlaceOrderScreen from './screens/PlaceOrderScreen'
import OrderScreen from './screens/OrderScreen'
import UserListScreen from './screens/UserListScreen'
import UserEditScreen from './screens/UserEditScreen'
import ProductListScreen from './screens/ProductListScreen'
import ProductEditScreen from './screens/ProductEditScreen'
import OrderListScreen from './screens/OrderListScreen'
import { loadFeatureFlags } from './actions/featureFlagActions'
import FeatureFlagsScreen from './screens/FeatureFlagsScreen'
import ReviewModerationScreen from './screens/ReviewModerationScreen'
import MultiStepCheckoutScreen from './screens/MultiStepCheckoutScreen'
import useFeatureEnabled from './hooks/useFeatureEnabled'
import ChatWidget from './components/ChatWidget'
import axios from 'axios'

const App = () => {
  const dispatch = useDispatch()

  const multiStepCheckoutEnabled = useFeatureEnabled('multi_step_checkout_v2')

  useEffect(() => {
    dispatch(loadFeatureFlags())
  }, [dispatch])

  useEffect(() => {
    const id = axios.interceptors.request.use((config) => {
      const bucket = sessionStorage.getItem('ff_traffic_bucket')
      if (bucket) config.headers['X-FF-Bucket'] = bucket

      if (!config.headers['Authorization']) {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null')
        if (userInfo?.token) {
          config.headers['Authorization'] = `Bearer ${userInfo.token}`
        }
      }

      return config
    })
    return () => axios.interceptors.request.eject(id)
  }, [])

  return (
    <Router>
      <Header />
      <main>
        <div>
          <Route path='/order/:id' component={OrderScreen} />
              {multiStepCheckoutEnabled && (
                <Route path='/checkout' component={MultiStepCheckoutScreen} />
              )}
          <Route path='/shipping' component={ShippingScreen} />
          <Route path='/payment' component={PaymentScreen} />
          <Route path='/placeorder' component={PlaceOrderScreen} />
          <Route path='/login' component={LoginScreen} />
          <Route path='/register' component={RegisterScreen} />
          <Route path='/profile' component={ProfileScreen} />
          <Route path='/product/:id' component={ProductScreen} />
          <Route path='/cart/:id?' component={CartScreen} />
          <Route path='/admin/userlist' component={UserListScreen} />
          <Route path='/admin/user/:id/edit' component={UserEditScreen} />
          <Route
            path='/admin/productlist'
            component={ProductListScreen}
            exact
          />
          <Route
            path='/admin/productlist/:pageNumber'
            component={ProductListScreen}
            exact
          />
          <Route path='/admin/product/:id/edit' component={ProductEditScreen} />
          <Route path='/admin/orderlist' component={OrderListScreen} />
          <Route path='/admin/featuredashboard' component={FeatureFlagsScreen} />
          <Route path='/admin/reviews' component={ReviewModerationScreen} />
          <Route path='/search/:keyword' component={HomeScreen} exact />
          <Route path='/page/:pageNumber' component={HomeScreen} exact />
          <Route
            path='/search/:keyword/page/:pageNumber'
            component={HomeScreen}
            exact
          />
          <Route path='/' component={HomeScreen} exact />
        </div>
      </main>
      <ChatWidget />
      <Footer />
    </Router>
  )
}

export default App
