import axios from 'axios'
import { CONTACT_REQUEST, CONTACT_SUCCESS, CONTACT_FAIL } from '../constants/contactConstants'

export const sendEmail = (subject, message) => async (dispatch) => {
    // This function handles the submission of the Contact Us form in the web application
    try {
        dispatch({
            // Dispatch CONTACT_REQUEST action to the contactReducer,
            type: CONTACT_REQUEST, // goes to contactReducer
        })

        // Use axios to send a POST request to the server endpoint "/api/send-email" with the subject and message as parameters
        const { data } = await axios.post(`/api/send-email`, { subject, message })
        dispatch({
            // If request is successful, dispatch the CONTACT_SUCCESS action
            type: CONTACT_SUCCESS,  // goes to contactReducer
            payload: data, // payload is the data received from the server
        })
    } 
    catch (error) {
        const message = error.response && error.response.data.message
            ? error.response.data.message
            : error.message
        dispatch({
            // Dispatch the CONTACT_FAIL action
            type: CONTACT_FAIL,  // goes to contactReducer
            payload: message, // payload is an error message
        })
    }
}