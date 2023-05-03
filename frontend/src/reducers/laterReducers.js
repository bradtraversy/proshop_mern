import {
  LATER_ADD_ITEM,
  LATER_REMOVE_ITEM,
  LATER_SAVE_SHIPPING_ADDRESS,
  LATER_SAVE_PAYMENT_METHOD,
  LATER_CLEAR_ITEMS,
} from '../constants/laterConstants'

export const laterReducer = (
  state = { laterItems: [], shippingAddress: {} },
  action
) => {
  switch (action.type) {
    case LATER_ADD_ITEM:
      const item = action.payload

      const existItem = state.laterItems.find((x) => x.product === item.product)

      if (existItem) {
        return {
          ...state,
          laterItems: state.laterItems.map((x) =>
            x.product === existItem.product ? item : x
          ),
        }
      } else {
        return {
          ...state,
          laterItems: [...state.laterItems, item],
        }
      }
    case LATER_REMOVE_ITEM:
      return {
        ...state,
        laterItems: state.laterItems.filter(
          (x) => x.product !== action.payload
        ),
      }
    case LATER_SAVE_SHIPPING_ADDRESS:
      return {
        ...state,
        shippingAddress: action.payload,
      }
    case LATER_SAVE_PAYMENT_METHOD:
      return {
        ...state,
        paymentMethod: action.payload,
      }
    case LATER_CLEAR_ITEMS:
      return {
        ...state,
        laterItems: [],
      }
    default:
      return state
  }
}
