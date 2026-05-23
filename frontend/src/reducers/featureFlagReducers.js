import {
  FEATURE_FLAGS_REQUEST,
  FEATURE_FLAGS_SUCCESS,
  FEATURE_FLAGS_FAIL,
  FEATURE_FLAG_UPDATE_OPTIMISTIC,
  FEATURE_FLAG_UPDATE_SUCCESS,
  FEATURE_FLAG_UPDATE_FAIL,
} from '../constants/featureFlagConstants'

const initialState = { flags: [], pending: {}, lastChanged: null }

export const featureFlagsReducer = (state = initialState, action) => {
  switch (action.type) {
    case FEATURE_FLAGS_REQUEST:
      return { ...state, loading: true, error: undefined }

    case FEATURE_FLAGS_SUCCESS: {
      const next = action.payload
      const pending = state.pending || {}
      const merged = Object.keys(pending).length === 0
        ? next
        : next.map((f) => {
            if (!pending[f.key]) return f
            const local = (state.flags || []).find((x) => x.key === f.key)
            return local || f
          })

      const sameLength = (state.flags || []).length === merged.length
      const equal = sameLength && JSON.stringify(state.flags) === JSON.stringify(merged)
      if (equal) {
        return { ...state, loading: false, error: undefined }
      }
      return {
        ...state,
        loading: false,
        error: undefined,
        flags: merged,
        lastChanged: Date.now(),
      }
    }

    case FEATURE_FLAGS_FAIL:
      return { ...state, loading: false, error: action.payload }

    case FEATURE_FLAG_UPDATE_OPTIMISTIC: {
      const { key, patch } = action.payload
      return {
        ...state,
        updateError: undefined,
        pending: { ...(state.pending || {}), [key]: true },
        flags: state.flags.map((f) =>
          f.key === key ? { ...f, ...patch } : f
        ),
      }
    }
    case FEATURE_FLAG_UPDATE_SUCCESS: {
      const updated = action.payload
      const pending = { ...(state.pending || {}) }
      delete pending[updated.key]
      return {
        ...state,
        pending,
        lastChanged: Date.now(),
        flags: state.flags.map((f) =>
          f.key === updated.key ? { ...f, ...updated } : f
        ),
      }
    }
    case FEATURE_FLAG_UPDATE_FAIL: {
      const { previous, error } = action.payload
      const pending = { ...(state.pending || {}) }
      delete pending[previous.key]
      return {
        ...state,
        pending,
        updateError: error,
        flags: state.flags.map((f) =>
          f.key === previous.key ? previous : f
        ),
      }
    }

    default:
      return state
  }
}
