import axios from 'axios'
import {
  LATER_ADD_ITEM,
  LATER_REMOVE_ITEM,
  LATER_SAVE_SHIPPING_ADDRESS,
  LATER_SAVE_PAYMENT_METHOD,
} from '../constants/laterConstants'

export const addToLater = (id, qty) => async (dispatch, getState) => {
  const { data } = await axios.get(`/api/products/${id}`)

  dispatch({
    type: LATER_ADD_ITEM,
    payload: {
      product: data._id,
      name: data.name,
      image: data.image,
      price: data.price,
      countInStock: data.countInStock,
      qty,
    },
  })

  localStorage.setItem(
    'laterItems',
    JSON.stringify(getState().later.laterItems)
  )
}

export const removeFromLater = (id) => (dispatch, getState) => {
  dispatch({
    type: LATER_REMOVE_ITEM,
    payload: id,
  })

  localStorage.setItem(
    'laterItems',
    JSON.stringify(getState().later.laterItems)
  )
}

export const saveShippingAddress = (data) => (dispatch) => {
  dispatch({
    type: LATER_SAVE_SHIPPING_ADDRESS,
    payload: data,
  })

  localStorage.setItem('shippingAddress', JSON.stringify(data))
}

export const savePaymentMethod = (data) => (dispatch) => {
  dispatch({
    type: LATER_SAVE_PAYMENT_METHOD,
    payload: data,
  })

  localStorage.setItem('paymentMethod', JSON.stringify(data))
}
