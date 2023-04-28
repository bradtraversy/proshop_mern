import {
    CONTACT_REQUEST,
    CONTACT_SUCCESS,
    CONTACT_FAIL
  } from '../constants/contactConstants'
  
  export const contactReducer = (state = {}, action) => {
    switch (action.type) {
      case CONTACT_REQUEST:
        return { loading: true }
      case CONTACT_SUCCESS:
        return { loading: false, subject: action.payload, message: action.payload }
      case CONTACT_FAIL:
        return { loading: false, error: action.payload }
      default:
        return state
    }
  }
  