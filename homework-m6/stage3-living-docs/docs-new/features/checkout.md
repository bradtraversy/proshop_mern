> **TODO(audit-2026-05-29):** Backend behaviour/flows accurate. Frontend screen references use old .js paths and Bootstrap-era UI — screens are now .jsx under good-shop (Tailwind v4 + shadcn).
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Checkout Features — ProShop MERN

Покрывает четырёхшаговый checkout flow: адрес доставки → метод оплаты → подтверждение заказа → страница заказа.

---

## Feature 1: Checkout Steps Navigation (Progress Indicator)

### Назначение
Визуальный индикатор прогресса из 4 шагов: Sign In → Shipping → Payment → Place Order. Показывает на каком этапе находится пользователь и позволяет вернуться к завершённым шагам. Persona: покупатель в процессе оформления.

### Технический impl
- **Component:** `CheckoutSteps.js` — props-флаги `step1`, `step2`, `step3`, `step4` (boolean).
- Каждый шаг: если флаг `true` → активная ссылка `<LinkContainer>`, если `false` → disabled `<Nav.Link>`.
- Маппинг:
  - `step1` = Sign In → `/login`
  - `step2` = Shipping → `/shipping`
  - `step3` = Payment → `/payment`
  - `step4` = Place Order → `/placeorder`
- **ShippingScreen:** `<CheckoutSteps step1 step2 />` (шаги 1-2 активны).
- **PaymentScreen:** `<CheckoutSteps step1 step2 step3 />` (шаги 1-3 активны).
- **PlaceOrderScreen:** `<CheckoutSteps step1 step2 step3 step4 />` (все активны).

### Edge cases
- Disabled ссылки не кликабельны (Bootstrap Nav.Link disabled).
- Пользователь может вернуться назад по активным ссылкам — данные сохранены в Redux/localStorage.

### Зависимости
- Зависит от: React Bootstrap Nav, React Router LinkContainer.
- Используется в трёх checkout-экранах.

---

## Feature 2: Shipping Address Entry

### Назначение
Первый содержательный шаг checkout — ввод адреса доставки. Данные сохраняются в Redux store и localStorage. Persona: покупатель, оформляющий первый или повторный заказ.

### User flow
1. После входа в систему и перехода по «Proceed To Checkout» → `/shipping`.
2. Форма предзаполнена из `cart.shippingAddress` (если уже заполнялась ранее).
3. Пользователь заполняет Address, City, Postal Code, Country.
4. Кликает «Continue» → данные сохраняются, редирект на `/payment`.

### Технический impl
- **Screen:** `ShippingScreen.js` — 4 state переменные, инициализированы из `useSelector(state => state.cart.shippingAddress)`.
- **Action:** `saveShippingAddress({ address, city, postalCode, country })`:
  ```js
  dispatch({ type: CART_SAVE_SHIPPING_ADDRESS, payload: data })
  localStorage.setItem('shippingAddress', JSON.stringify(data))
  ```
- **Reducer:** `cartReducer` обрабатывает `CART_SAVE_SHIPPING_ADDRESS` → `{ ...state, shippingAddress: action.payload }`.
- Все поля: `required` attribute в HTML (браузерная валидация).
- **Guard:** нет явного auth-guard в ShippingScreen — перенаправление на shipping происходит через CartScreen.

### API endpoints
- Нет серверных запросов. Только localStorage + Redux.

### Edge cases
- Пользователь открывает `/shipping` напрямую без логина — ShippingScreen не проверяет `userInfo` → нет редиректа (отсутствие guard — учебный артефакт). При попытке checkout всё равно потребуется логин.
- Незаполненные required поля → браузер показывает validation tooltip, форма не сабмитится.
- Длина полей не ограничена — очень длинные строки принимаются.
- PaymentScreen проверяет `!shippingAddress.address` → редирект назад на `/shipping`.

### Зависимости
- Зависит от: Cart state, Auth (косвенно через CartScreen redirect).
- PlaceOrderScreen читает `cart.shippingAddress` для отображения и отправки в API.

---

## Feature 3: Payment Method Selection

### Назначение
Второй шаг checkout — выбор способа оплаты (PayPal или Credit Card через PayPal). Выбор сохраняется в Redux и localStorage. Persona: покупатель перед оплатой.

### User flow
1. После заполнения адреса → `/payment`.
2. Форма с radio-кнопкой «PayPal or Credit Card» (выбрана по умолчанию, `checked` атрибут жёстко задан).
3. Закомментированный вариант «Stripe» — потенциальное расширение.
4. Кликает «Continue» → `savePaymentMethod('PayPal')` + редирект на `/placeorder`.

### Технический impl
- **Screen:** `PaymentScreen.js` — state `paymentMethod = 'PayPal'`.
- **Guard:** `if (!shippingAddress.address) { history.push('/shipping') }` — синхронная проверка без useEffect.
- **Action:** `savePaymentMethod(data)`:
  ```js
  dispatch({ type: CART_SAVE_PAYMENT_METHOD, payload: data })
  localStorage.setItem('paymentMethod', JSON.stringify(data))
  ```
- **Reducer:** `{ ...state, paymentMethod: action.payload }`.
- Radio input `checked` — жёстко задан, не зависит от state. onChange обновляет state, но UI всегда показывает PayPal как выбранный.

### API endpoints
- Нет серверных запросов.

### Edge cases
- `checked` жёстко задан → даже при добавлении Stripe option, UI не переключится корректно без рефакторинга.
- Синхронный guard (вне useEffect): `if (!shippingAddress.address)` выполняется при каждом рендере — это anti-pattern но работает для данного кейса.
- PlaceOrderScreen проверяет `!cart.paymentMethod` → редирект на `/payment`.

### Зависимости
- Зависит от: Cart state (shippingAddress для guard).
- PlaceOrderScreen и OrderScreen используют `paymentMethod` для отображения.

---

## Feature 4: Order Review & Place Order

### Назначение
Финальный шаг checkout — полный обзор заказа: адрес доставки, метод оплаты, список товаров, расчёт всех цен. Кнопка «Place Order» создаёт заказ в базе данных. Persona: покупатель, проверяющий перед оплатой.

### User flow
1. После выбора оплаты → `/placeorder`.
2. Левая колонка: Shipping address, Payment Method, Order Items (список с изображениями).
3. Правая колонка: Order Summary — Items, Shipping, Tax, Total.
4. Кликает «Place Order» → POST на сервер.
5. При успехе → редирект на `/order/:id`, корзина очищается.

### Технический impl
- **Screen:** `PlaceOrderScreen.js` — двойной guard:
  ```js
  if (!cart.shippingAddress.address) { history.push('/shipping') }
  else if (!cart.paymentMethod) { history.push('/payment') }
  ```
- **Цены рассчитываются на фронте:**
  ```js
  cart.itemsPrice = addDecimals(cartItems.reduce((acc, item) => acc + item.price * item.qty, 0))
  cart.shippingPrice = addDecimals(cart.itemsPrice > 100 ? 0 : 100)
  cart.taxPrice = addDecimals(Number((0.15 * cart.itemsPrice).toFixed(2)))
  cart.totalPrice = (Number(cart.itemsPrice) + Number(cart.shippingPrice) + Number(cart.taxPrice)).toFixed(2)
  ```
- **Action:** `createOrder(orderPayload)` → POST `/api/orders`.
- **useEffect:** при `success` → `history.push('/order/${order._id}')` + диспатч `USER_DETAILS_RESET` + `ORDER_CREATE_RESET`.

### API endpoints
- `POST /api/orders` — private (Bearer token), body:
  ```json
  {
    "orderItems": [...],
    "shippingAddress": { "address", "city", "postalCode", "country" },
    "paymentMethod": "PayPal",
    "itemsPrice": "XX.XX",
    "shippingPrice": "0.00",
    "taxPrice": "XX.XX",
    "totalPrice": "XX.XX"
  }
  ```
  Response: созданный order object, HTTP 201.

### Edge cases
- Кнопка `disabled={cart.cartItems === 0}` — тот же баг что в CartScreen: сравнение массива с числом 0 всегда false → кнопка никогда не disabled (учебный артефакт).
- Цены вычисляются на фронте и отправляются на сервер — сервер не валидирует корректность цен (security issue учебного проекта).
- `addDecimals` функция: `(Math.round(num * 100) / 100).toFixed(2)` — корректно обрабатывает floating point.
- После redirect `ORDER_CREATE_RESET` диспатчится для сброса success-флага.
- `USER_DETAILS_RESET` диспатчится — вероятно для сброса кеша профиля после заказа.

### Зависимости
- Зависит от: Cart state (все три части: items + shipping + payment), Auth (token для API).
- После успеха: корзина очищена (`CART_CLEAR_ITEMS`), переход на Order Detail.

---

## Feature 5: Tax Calculation (15%)

### Назначение
Автоматический расчёт налога как 15% от стоимости товаров. Вычисляется на фронте в PlaceOrderScreen и отображается в Order Summary. Persona: покупатель, видящий финальную сумму.

### Технический impl
- `cart.taxPrice = addDecimals(Number((0.15 * cart.itemsPrice).toFixed(2)))`
- Двойное округление: внутри — `.toFixed(2)` перед умножением убирает floating point в `itemsPrice`, снаружи — `addDecimals` = `Math.round * 100 / 100`.
- Хранится в Order model: `taxPrice: { type: Number, default: 0.0 }`.
- Отображается на OrderScreen (страница заказа после создания).

### Edge cases
- Tax rate жёстко задан (15%) — не конфигурируется.
- `cart.itemsPrice` уже строка `.toFixed(2)` → `0.15 * "99.90"` = `0.15 * 99.90` (JS приводит к числу).

### Зависимости
- Зависит от: `cart.itemsPrice`.
- Используется в: PlaceOrderScreen (расчёт), OrderScreen (отображение хранённого значения).

---

## Feature 6: Shipping Cost Calculation

### Назначение
Расчёт стоимости доставки: бесплатно при заказе от $100, $100 при заказе до $100. Persona: покупатель, оптимизирующий сумму заказа.

### Технический impl
- `cart.shippingPrice = addDecimals(cart.itemsPrice > 100 ? 0 : 100)`
- Порог: `> 100` (не `>= 100`) — при ровно $100 доставка платная.
- Хранится в Order model: `shippingPrice: { type: Number, default: 0.0 }`.

### Edge cases
- `cart.itemsPrice` — строка после `addDecimals` → `"100.00" > 100` в JS: строка сравнивается с числом, `"100.00" > 100` → false → доставка $100 при ровно $100 (неочевидное поведение JavaScript).
- Доставка не зависит от страны или веса.

### Зависимости
- Зависит от: `cart.itemsPrice`.
- Итоговая цена: `itemsPrice + shippingPrice + taxPrice`.

---

## Feature 7: Order Confirmation Page (Order Detail for User)

### Назначение
Страница заказа `/order/:id` — детали после создания: итоги, статус оплаты и доставки, PayPal-кнопка для незаоплаченных заказов. Для покупателя + ограниченные admin-функции. Persona: покупатель после оформления.

### User flow
1. После `placeOrder` → редирект на `/order/:id`.
2. Отображение: имя/email покупателя, адрес, метод оплаты, список товаров, суммы.
3. Если не оплачен → PayPal-кнопка.
4. После оплаты → `isPaid: true`, зелёное сообщение `"Paid on [date]"`.
5. Admin видит кнопку «Mark As Delivered» (если оплачен и не доставлен).

### Технический impl
- **Screen:** `OrderScreen.js` — использует `sdkReady` state для отслеживания загрузки PayPal SDK.
- **Action:** `getOrderDetails(orderId)` → GET `/api/orders/:id`.
- **PayPal SDK:** загружается динамически через `addPayPalScript()`:
  ```js
  const { data: clientId } = await axios.get('/api/config/paypal')
  // создаёт <script> тег с PayPal SDK URL
  ```
- **`itemsPrice` вычисляется на фронте** из `order.orderItems` — не хранится в OrderModel напрямую.
- **`useEffect` зависимости:** `orderId, successPay, successDeliver, order` — обновляет данные после каждого изменения статуса.

### API endpoints
- `GET /api/orders/:id` — private, response: полный order object с populate('user', 'name email').
- `GET /api/config/paypal` — public, response: PayPal client ID из env.

### Edge cases
- Пользователь пытается получить чужой заказ по ID — контроллер не проверяет ownership (только `protect` middleware). Security issue учебного проекта.
- PayPal SDK уже загружен (`window.paypal`) → `setSdkReady(true)` без повторной загрузки.
- Оплаченный заказ: PayPal-кнопка скрывается (`{!order.isPaid && ...}`).
- `orderPay.success` или `orderDeliver.success` → dispatch `ORDER_PAY_RESET` / `ORDER_DELIVER_RESET` + `getOrderDetails` для refresh.

### Зависимости
- Зависит от: Auth, createOrder (создаётся перед просмотром), PayPal integration.
- Содержит в себе: Payment flow (PayPal button), Admin Deliver action.

---

## Feature 8: Order History in User Profile

### Назначение
Таблица всех заказов текущего пользователя на странице профиля. Показывает ID, дату, сумму, статус оплаты и доставки, ссылку на детали. Persona: покупатель, отслеживающий свои заказы.

### User flow
1. На `/profile` правая колонка (9/12 ширины) — таблица «My Orders».
2. Строки: ID, DATE, TOTAL, PAID (дата или красный X), DELIVERED (дата или красный X).
3. Кнопка «Details» → `/order/:id`.

### Технический impl
- **Action:** `listMyOrders()` → GET `/api/orders/myorders`.
- **Reducer:** `orderListMyReducer` — `{ orders, loading, error }`.
- **Controller:** `getMyOrders` — `Order.find({ user: req.user._id })`.
- Вызывается в `useEffect` ProfileScreen вместе с `getUserDetails`.
- **Дата:** `order.createdAt.substring(0, 10)` — формат YYYY-MM-DD.
- **Paid date:** `order.paidAt.substring(0, 10)` — если не оплачен, иконка `fa-times` (красная).

### API endpoints
- `GET /api/orders/myorders` — private, response: массив orders текущего пользователя.

### Edge cases
- `order.paidAt.substring(0, 10)` — если `isPaid=false`, `paidAt` undefined → крэш при попытке substring. Предотвращается ternary `order.isPaid ? order.paidAt... : <icon>`.
- Много заказов → бесконечная таблица (пагинация не реализована).
- `errorOrders` → `<Message variant='danger'>{errorOrders}</Message>`.

### Зависимости
- Зависит от: Auth, Profile screen (встроена как sub-feature).
- `ORDER_LIST_MY_RESET` диспатчится при logout.
