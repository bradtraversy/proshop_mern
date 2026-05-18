import {
    FEATURE_LIST_REQUEST,
    FEATURE_LIST_SUCCESS,
    FEATURE_LIST_FAIL,
    FEATURE_UPDATE_REQUEST,
    FEATURE_UPDATE_SUCCESS,
    FEATURE_UPDATE_FAIL,
    FEATURE_UPDATE_RESET,
} from '../constants/featureConstants'

export const featureListReducer = (state = { features: [] }, action) => {
    switch (action.type) {
        case FEATURE_LIST_REQUEST:
            return { loading: true, features: [] }
        case FEATURE_LIST_SUCCESS:
            return { loading: false, features: action.payload }
        case FEATURE_LIST_FAIL:
            return { loading: false, error: action.payload }
        default:
            return state
    }
}

export const featureUpdateReducer = (state = {}, action) => {
    switch (action.type) {
        case FEATURE_UPDATE_REQUEST:
            return { loading: true }
        case FEATURE_UPDATE_SUCCESS:
            return { loading: false, success: true }
        case FEATURE_UPDATE_FAIL:
            return { loading: false, error: action.payload }
        case FEATURE_UPDATE_RESET:
            return {}
        default:
            return state
    }
}
