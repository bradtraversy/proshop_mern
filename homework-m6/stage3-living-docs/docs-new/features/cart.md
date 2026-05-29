> **TODO(audit-2026-05-29):** Backend behaviour/flows accurate. Frontend screen references use old .js paths and Bootstrap-era UI — screens are now .jsx under good-shop (Tailwind v4 + shadcn).
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Cart Features — ProShop MERN

Покрывает добавление товаров, управление количеством, удаление, персистентность и расчёт итогов.

---

## Feature 1: Add to Cart

### Назначение
Добавление товара в корзину с выбранным количеством. Не требует авторизации — товар добавляется в localStorage немедленно. Persona: любой посетитель, нашедший товар.

### User flow
1. На странице товара (`/product/:id`) пользователь выбирает qty из dropdown.
2. Кликает «Add To Cart».
3. `addToCartHandler` формирует URL `/cart/:id?qty=N` и вызывает `history.push`.
4. CartScreen монтируется, `useEffect` видит `productId` в params и qty в location.search.
5. Диспатчит `addToCart(productId, qty)`.
6. Action делает GET-запрос на `/api/products/:id` для получения актуальных данных товара.
7. Диспатчит `CART_ADD_ITEM`, reducer обновляет `cartItems`, action сохраняет в localStorage.

### Технический impl
- **Screen:** `ProductScreen.js` — `addToCartHandler` только навигирует, не диспатчит.
- **Screen:** `CartScreen.js` — `useEffect` читает `match.params.id` и `location.search`.
- **Action:** `cartActions.addToCart(id, qty)`:
  ```js
  const { data } = await axios.get(`/api/products/${id}`)
  dispatch({ type: CART_ADD_ITEM, payload: { product, name, image, price, countInStock, qty } })
  localStorage.setItem('cartItems', JSON.stringify(getState().cart.cartItems))
  ```
- **Reducer:** `cartReducer` обрабатывает `CART_ADD_ITEM`:
  - Если товар уже в корзине → обновляет qty (replace).
  - Если нового нет → append в массив.
- **Store init:** `store.js` инициализирует `cart.cartItems` из `localStorage['cartItems']` при загрузке.

### API endpoints
- `GET /api/products/:id` — публичный, вызывается внутри action для получения цены и наличия.

### Edge cases
- Товар уже в корзине → qty перезаписывается (не суммируется). Прибавить к текущему нельзя стандартным путём.
- `countInStock` получается актуальным в момент добавления — но не синхронизируется при последующих изменениях.
- `qty` из URL: `Number(location.search.split('=')[1])` — если URL некорректен, `Number(undefined)=NaN`.
- Добавление с qty > countInStock невозможно через UI (dropdown ограничен), но API-запрос напрямую не защищён от этого.
- Открытие `/cart` без productId в params → useEffect не диспатчит, просто показывает текущую корзину.

### Зависимости
- Зависит от: Product Detail (productId + qty через URL), Product API (актуальные данные).
- От этой фичи зависят: Cart Summary (totals), Checkout flow.

---

## Feature 2: Update Cart Item Quantity

### Назначение
Изменение количества конкретного товара прямо в корзине. Persona: покупатель, решивший взять больше или меньше единиц.

### User flow
1. На странице `/cart` пользователь видит список товаров.
2. Рядом с каждым товаром — dropdown с текущим qty.
3. Меняет значение в dropdown.
4. `onChange` немедленно диспатчит `addToCart(item.product, Number(e.target.value))`.
5. Корзина обновляется без перезагрузки страницы, localStorage синхронизируется.

### Технический impl
- **Screen:** `CartScreen.js` — inline onChange:
  ```jsx
  onChange={(e) => dispatch(addToCart(item.product, Number(e.target.value)))}
  ```
- **Action:** та же `addToCart` — делает новый GET `/api/products/:id` для актуальности данных.
- **Reducer:** `CART_ADD_ITEM` с существующим product ID → заменяет item в массиве.
- Dropdown range: от 1 до `item.countInStock` — ограничен доступным остатком.

### API endpoints
- `GET /api/products/:id` — вызывается при каждом изменении dropdown.

### Edge cases
- Каждое изменение dropdown = новый HTTP-запрос → потенциально избыточная нагрузка при частых изменениях (debounce не реализован).
- Если между добавлением и обновлением `countInStock` изменился (другой покупатель купил) → актуальное значение придёт в ответе.
- `Number(e.target.value)` — гарантирует числовой тип qty.

### Зависимости
- Зависит от: `addToCart` action (переиспользуется), Product API.
- Обновляет те же reducers и localStorage что и Feature 1.

---

## Feature 3: Remove Item from Cart

### Назначение
Удаление конкретного товара из корзины. Persona: покупатель, передумавший насчёт товара.

### User flow
1. В списке корзины рядом с каждым товаром — кнопка с иконкой мусорки.
2. Клик → `removeFromCartHandler(item.product)`.
3. Товар мгновенно исчезает из списка, subtotal пересчитывается.
4. localStorage обновляется.

### Технический impl
- **Screen:** `CartScreen.js` — `removeFromCartHandler(id)` диспатчит `removeFromCart(id)`.
- **Action:** `cartActions.removeFromCart(id)`:
  ```js
  dispatch({ type: CART_REMOVE_ITEM, payload: id })
  localStorage.setItem('cartItems', JSON.stringify(getState().cart.cartItems))
  ```
- **Reducer:** фильтрует массив: `cartItems.filter(x => x.product !== action.payload)`.
- Нет подтверждения (`window.confirm`) — удаление немедленное.

### API endpoints
- Нет серверных запросов. Только Redux + localStorage.

### Edge cases
- Нет отмены удаления — undo не реализован.
- После удаления последнего товара: корзина показывает `"Your cart is empty"` с ссылкой «Go Back».
- Кнопка «Proceed To Checkout» disabled при `cartItems.length === 0` — нельзя чекаутить пустую корзину.

### Зависимости
- Зависит от: Cart state.
- Влияет на: Cart totals (пересчитываются в JSX реактивно).

---

## Feature 4: Cart Persistence (localStorage)

### Назначение
Корзина сохраняется между сессиями браузера — товары не теряются при обновлении страницы или закрытии вкладки. Persona: покупатель, возвращающийся позже.

### Технический impl
- **Запись:** каждая cart action (`addToCart`, `removeFromCart`) вызывает `localStorage.setItem('cartItems', JSON.stringify(getState().cart.cartItems))`.
- **Восстановление:** `store.js`:
  ```js
  const cartItemsFromStorage = localStorage.getItem('cartItems')
    ? JSON.parse(localStorage.getItem('cartItems'))
    : []
  const initialState = { cart: { cartItems: cartItemsFromStorage, ... } }
  ```
- Аналогично сохраняются: `shippingAddress`, `paymentMethod`.
- **Logout:** `userActions.logout()` очищает `cartItems`, `shippingAddress`, `paymentMethod` из localStorage.

### Edge cases
- Устаревшие данные: если товар был удалён из базы после добавления в корзину → при попытке checkout `createOrder` может получить невалидный product ID.
- Цена в localStorage зафиксирована в момент добавления — если цена изменилась на сервере, корзина показывает старую цену.
- `countInStock` в localStorage может устареть — dropdown позволяет выбрать qty больше реального наличия.
- Кастомный `localStorage` overflow: при большом количестве товаров или больших images URL строка может превысить 5MB (редко).

### Зависимости
- Зависит от: cart reducers (`CART_ADD_ITEM`, `CART_REMOVE_ITEM`, `CART_SAVE_SHIPPING_ADDRESS`, `CART_SAVE_PAYMENT_METHOD`, `CART_CLEAR_ITEMS`).
- `CART_CLEAR_ITEMS` диспатчится после успешного создания заказа (`createOrder` action).

---

## Feature 5: Cart Summary & Totals Calculation

### Назначение
Отображение итоговой суммы в правой колонке корзины: количество всех товаров и итоговая сумма. Persona: покупатель перед чекаутом.

### User flow
1. Пользователь видит правую карточку с subtotal.
2. `Subtotal (N) items — $XX.XX` обновляется реактивно при любом изменении корзины.
3. Кнопка «Proceed To Checkout» → `history.push('/login?redirect=shipping')`.
4. Если залогинен — редирект идёт сразу на `/shipping` (redirect query param обрабатывается LoginScreen).

### Технический impl
- **Subtotal count:** `cartItems.reduce((acc, item) => acc + item.qty, 0)` — сумма qty всех позиций.
- **Subtotal price:** `cartItems.reduce((acc, item) => acc + item.qty * item.price, 0).toFixed(2)`.
- Расчёт происходит в JSX `CartScreen.js` — нет отдельного selector/мемоизации.
- `checkoutHandler` → `history.push('/login?redirect=shipping')` — всегда перебрасывает через login; если уже залогинен, LoginScreen немедленно редиректит на `/shipping`.

### Edge cases
- Floating point ошибки: `0.1 * 3 = 0.30000000000000004` → `.toFixed(2)` корректирует отображение, но не внутреннее значение.
- Кнопка disabled при `cartItems.length === 0` — но условие `cart.cartItems === 0` технически некорректно (сравнение массива с числом всегда false!); это баг — кнопка не блокируется при пустой корзине (учебный артефакт).

### Зависимости
- Зависит от: Cart state (`cartItems`).
- Передаёт управление Checkout flow.

---

## Feature 6: Cart Clear After Order

### Назначение
Автоматическая очистка корзины после успешного оформления заказа. Persona: покупатель, завершивший покупку.

### Технический impl
- **Триггер:** в `createOrder` action после успешного POST `/api/orders`:
  ```js
  dispatch({ type: CART_CLEAR_ITEMS })
  localStorage.removeItem('cartItems')
  ```
- **Reducer:** `CART_CLEAR_ITEMS` → `{ ...state, cartItems: [] }`.
- shippingAddress и paymentMethod **не очищаются** — остаются для следующего заказа.

### Edge cases
- Если POST `/api/orders` вернул ошибку → `CART_CLEAR_ITEMS` не диспатчится, корзина сохраняется.
- После redirect на `/order/:id` пользователь не может вернуться к корзине с теми же товарами.

### Зависимости
- Зависит от: `createOrder` action (orderActions).
- Обеспечивает чистое состояние для следующей сессии покупки.
