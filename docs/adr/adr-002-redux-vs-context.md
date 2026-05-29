# ADR-002: Use Redux (later Redux Toolkit) for Client State Management

**Status:** Accepted (original Redux decision); Partially superseded — RTK Query migration planned for v3.0
**Date:** 2023-01-14 (original); 2023-07-20 (RTK migration decision)
**Decision Makers:** Engineering team

---

## Context

The ProShop frontend needs to manage state across several dimensions:
- **Cart state:** items, quantities, totals — persisted across sessions
- **User/auth state:** current user object, login status — needed globally
- **Server data cache:** products, orders, user lists — fetched asynchronously from the Express API
- **UI state:** loading indicators, error messages per-feature

At project start (January 2023), the React ecosystem offered several approaches: Redux (the established solution), React Context + useReducer, React Query / SWR (for server state), Zustand, Jotai, and others. The application was modeled after a standard MERN tutorial architecture, which used Redux as its state management layer.

By July 2023, the hand-rolled Redux codebase had grown significantly and was identified as a maintenance burden. A decision was made to migrate to Redux Toolkit (RTK).

By 2025, the community consensus had moved substantially toward RTK Query for server state, leaving Redux's client state value proposition narrower.

---

## Decision (Original — January 2023)

Use **Redux** with `redux-thunk` for async operations. State is organized into slices: `cart`, `user` (auth), `product`, `order`. Each slice has:
- A constants file defining action type strings
- An actions file with creator functions (including async thunks)
- A reducer function
- A corresponding screen-level container that calls `useSelector` and `useDispatch`

Cart state is persisted to `localStorage` via `redux-persist`.

---

## Decision (Migration — July 2023)

Migrate all Redux code to **Redux Toolkit** (`@reduxjs/toolkit`). Replace:
- Hand-written action constants → `createSlice` (auto-generates action types)
- Hand-written async thunks → `createAsyncThunk` (handles pending/fulfilled/rejected automatically)
- Mutable reducer patterns → Immer-backed `createSlice` reducers (write "mutating" code that is actually immutable)

The migration was completed in three days and released in v1.0. Net result: ~800 lines removed, equivalent functionality maintained, Redux DevTools integration improved.

---

## Consequences

### Positive

- **Redux DevTools.** Time-travel debugging and action replay are valuable for complex cart/checkout flows. The DevTools integration is first-class and helped debug the order total manipulation bug (v0.6) quickly.
- **Predictable state container.** All state changes go through reducers. Side effects are isolated to thunks. Reasoning about "why does this screen show X" is straightforward.
- **RTK reduced boilerplate substantially.** The 3-day migration eliminated ~800 lines of repetitive code. `createAsyncThunk` automatically handles loading/error state that was previously written by hand in every slice.
- **`redux-persist` + localStorage for cart.** Cart state survives page refresh without a backend round-trip. Works reliably for the use case.
- **Ecosystem maturity.** Redux has extensive documentation, StackOverflow coverage, and third-party tooling. Onboarding a new engineer is straightforward.

### Negative

- **Significant ceremony for simple cases.** Even with RTK, a new data-fetching operation requires: a `createAsyncThunk`, a slice with `extraReducers`, a selector, and a `useSelector` call at the component. For a simple GET endpoint, this is 40–60 lines for something that RTK Query handles in 5.
- **Server state and client state are not naturally separated.** Products and orders are server data — they have a lifecycle (stale, loading, error) that differs from purely client state (cart items, UI toggles). Redux treats them the same, leading to manual cache invalidation logic and potential stale data.
- **`redux-persist` creates migration headaches.** When the Redux store shape changes (e.g., the v1.0 RTK migration), existing `localStorage` data from the old schema can cause subtle bugs. The solution (bump the storage version, invalidate old data) is fragile and easy to forget.

---

## Alternatives Considered

### React Context + useReducer

**Viable for:** auth state, theme, locale.
**Not viable at scale for:** async data fetching (no built-in loading/error handling), performance (Context re-renders all consumers on every state change — problematic for the cart which is accessed on every page).

**Reason not chosen at project start:** The initial scope included complex async flows (cart, checkout, PayPal integration) where Context's lack of middleware for side effects would require custom solutions approaching Redux's complexity anyway.

### React Query (TanStack Query)

**Would have been the right choice for server state.** React Query handles caching, background refetching, deduplication, and stale-while-revalidate out of the box. The products and orders data in this app is pure server state — React Query is designed exactly for this.

**Reason not chosen:** Project was modeled after a Redux-centric tutorial architecture. React Query was available in 2023 but less prominent in the educational materials the team referenced. In retrospect, a combination of React Query (server state) + Zustand or Context (client state) would have been a cleaner architecture.

### Zustand

Lighter than Redux, no boilerplate, good DevTools support. Would have been a valid alternative. Not chosen because the team was already familiar with Redux concepts and the project had tutorial precedent.

### RTK Query (for server state, current consideration)

RTK Query is Redux Toolkit's built-in data fetching and caching layer. It generates reducers, actions, and hooks from API endpoint definitions. Compared to the current manual thunk approach:
- ~60% less data-fetching code
- Automatic cache invalidation via tags (e.g., invalidate `Products` cache when a product is updated in admin)
- Loading/error/success states generated automatically
- Polling and background refetch built in

**Migration plan:** RTK Query POC was built for the `products` slice in Q1 2025. Full migration planned for v3.0. The primary cost is rewriting all existing slices; the benefit is a more maintainable codebase and elimination of manual cache invalidation bugs.

---

## Current Assessment (April 2026)

Redux (RTK) remains the production state management solution. For the client state portions (cart, auth), it continues to work well. For the server data portions (products, orders), RTK Query migration is the correct next step. The original decision to use Redux was reasonable given the 2023 context; RTK Query migration was not technically available as an obvious choice at the time, though React Query was.
