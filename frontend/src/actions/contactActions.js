import axios from 'axios'
import { CONTACT_REQUEST, CONTACT_SUCCESS, CONTACT_FAIL } from '../constants/contactConstants'

export const sendEmail = () => async (dispatch, getState) => {
    try {
        dispatch({
            type: CONTACT_REQUEST,
        })
        const {
            Subject: { subject } ,
            Message: { message },
        } = getState()

        const { data } = await axios.post(`/api/send-email`)
        dispatch({
            type: CONTACT_SUCCESS,
            payload: data,
          })
    } 
    catch (error) {
        const message = error.response && error.response.data.message
            ? error.response.data.message
            : error.message
        dispatch({
        type: CONTACT_FAIL,
        payload: message,
        })
    }
}