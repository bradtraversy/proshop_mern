import axios from 'axios'
import {
    FEATURE_LIST_REQUEST,
    FEATURE_LIST_SUCCESS,
    FEATURE_LIST_FAIL,
    FEATURE_UPDATE_REQUEST,
    FEATURE_UPDATE_SUCCESS,
    FEATURE_UPDATE_FAIL,
} from '../constants/featureConstants'
import { logout } from './userActions'

export const listFeatures = () => async (dispatch) => {
    try {
        dispatch({ type: FEATURE_LIST_REQUEST })

        const { data } = await axios.get('/api/feature-flags')

        const features = Object.entries(data).map(([key, feature]) => ({
            key,
            ...feature,
        }))

        dispatch({
            type: FEATURE_LIST_SUCCESS,
            payload: features,
        })
    } catch (error) {
        dispatch({
            type: FEATURE_LIST_FAIL,
            payload:
                error.response && error.response.data.message
                    ? error.response.data.message
                    : error.message,
        })
    }
}

export const updateFeature = (name, updates) => async (
    dispatch,
    getState
) => {
    try {
        dispatch({ type: FEATURE_UPDATE_REQUEST })

        const {
            userLogin: { userInfo },
        } = getState()

        const config = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userInfo.token}`,
            },
        }

        await axios.put(`/api/feature-flags/${name}`, updates, config)

        dispatch({ type: FEATURE_UPDATE_SUCCESS })
    } catch (error) {
        const message =
            error.response && error.response.data.message
                ? error.response.data.message
                : error.message
        if (message === 'Not authorized, token failed') {
            dispatch(logout())
        }
        dispatch({
            type: FEATURE_UPDATE_FAIL,
            payload: message,
        })
    }
}
