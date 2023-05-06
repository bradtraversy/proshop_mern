import {
    CONTACT_REQUEST,
    CONTACT_SUCCESS,
    CONTACT_FAIL
  } from '../constants/contactConstants'
  
  export const contactReducer = (state = {}, action) => {
    // This function is responsbile for updating the state in response to actions dispatched by the application
    switch (action.type) {
      // Use the 3 action types from contactConstants.js to determine how to update the state
      case CONTACT_REQUEST:
        // Set loading to true to indicate a request is being made
        return { loading: true }
      case CONTACT_SUCCESS:
        // Set loading to false and add subject and message properties to the state object 
        return { loading: false, subject: action.payload, message: action.payload }
      case CONTACT_FAIL:
        // Set loading to false and add error property to the state object
        return { loading: false, error: action.payload }
      default:
        return state
    }
  }
  