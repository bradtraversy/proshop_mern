import axios from 'axios'
import { CONTACT_REQUEST, CONTACT_SUCCESS, CONTACT_FAIL } from '../constants/contactConstants'

// export const sendEmail = () => async (dispatch, getState) => {
export const sendEmail = (subject, message) => async (dispatch) => {
    console.log("In contactActions (sendEmail)!")
    console.log(subject, message)
    try {
        dispatch({
            type: CONTACT_REQUEST, // goes to contactReducer
        })

        const { data } = await axios.post(`/api/send-email`, { subject, message })
        dispatch({
            type: CONTACT_SUCCESS,  // goes to contactReducer
            payload: data,
        })
    } 
    catch (error) {
        const message = error.response && error.response.data.message
            ? error.response.data.message
            : error.message
        dispatch({
            type: CONTACT_FAIL,  // goes to contactReducer
            payload: message,
        })
    }
}