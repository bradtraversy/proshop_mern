> **TODO(audit-2026-05-29):** Backend behaviour/flows accurate. Frontend screen references use old .js paths and Bootstrap-era UI — screens are now .jsx under good-shop (Tailwind v4 + shadcn).
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Payments Features — ProShop MERN

Покрывает PayPal sandbox-интеграцию, обработку результата платежа, обновление статуса заказа и трекинг состояния оплаты.

---

## Feature 1: PayPal SDK Dynamic Loading

### Назначение
Динамическая загрузка PayPal JavaScript SDK при открытии страницы незаоплаченного заказа. Client ID берётся с сервера, не хардкодится в клиентском коде. Persona: покупатель, готовый оплатить заказ.

### User flow
1. Пользователь открывает `/order/:id` для неоплаченного заказа.
2. Приложение запрашивает PayPal Client ID с сервера.
3. Создаётся `<script>` тег с PayPal SDK URL, добавляется в `document.body`.
4. После загрузки SDK (`script.onload`) → `setSdkReady(true)`.
5. Показывается PayPal-кнопка.
6. Пока SDK грузится → `<Loader />`.

### Технический impl
- **Screen:** `OrderScreen.js` — state `sdkReady = false`.
- **`addPayPalScript` async функция:**
  ```js
  const { data: clientId } = await axios.get('/api/config/paypal')
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}`
  script.async = true
  script.onload = () => setSdkReady(true)
  document.body.appendChild(script)
  ```
- **Условие вызова:** `!order.isPaid && !window.paypal` → только для неоплаченных заказов и только если SDK ещё не загружен.
- **Если `window.paypal` уже существует** (при re-render) → `setSdkReady(true)` без повторной загрузки скрипта.
- **Backend endpoint:** `server.js` возвращает `process.env.PAYPAL_CLIENT_ID` или строку `'sb'` (sandbox).

### API endpoints
- `GET /api/config/paypal` — public (в коде используется без auth header), response: строка с client ID.

### Edge cases
- PayPal SDK уже загружен в `window` → повторный `<script>` не создаётся, `sdkReady=true` немедленно.
- Сеть недоступна → `axios.get('/api/config/paypal')` выбрасывает ошибку → `addPayPalScript` завершается с исключением → `sdkReady` остаётся false → пользователь видит бесконечный Loader.
- `PAYPAL_CLIENT_ID` не задан в `.env` → сервер возвращает `'sb'` (тестовый sandbox ID по умолчанию).
- Script загружается асинхронно — между созданием тега и `onload` может пройти несколько секунд при медленном соединении.

### Зависимости
- Зависит от: `PAYPAL_CLIENT_ID` env var на сервере, сетевого доступа к PayPal CDN.
- От этой фичи зависит: PayPal Button render (Feature 2).

---

## Feature 2: PayPal Payment Button & Transaction Processing

### Назначение
Кнопка PayPal на странице заказа позволяет провести оплату через PayPal sandbox. После подтверждения пользователем — результат транзакции отправляется на сервер. Persona: покупатель, оплачивающий заказ.

### User flow
1. SDK загружен (`sdkReady=true`) → рендерится `<PayPalButton>`.
2. Пользователь кликает кнопку PayPal.
3. Открывается PayPal popup/redirect.
4. Пользователь логинится в PayPal sandbox и подтверждает платёж.
5. PayPal возвращает `paymentResult` в `onSuccess` callback.
6. Вызывается `successPaymentHandler(paymentResult)`.
7. Диспатчится `payOrder(orderId, paymentResult)`.
8. Страница обновляется с новым статусом оплаты.

### Технический impl
- **Компонент:** `react-paypal-button-v2` — `<PayPalButton amount={order.totalPrice} onSuccess={successPaymentHandler} />`.
- **`successPaymentHandler`:**
  ```js
  const successPaymentHandler = (paymentResult) => {
    dispatch(payOrder(orderId, paymentResult))
  }
  ```
- **Action `payOrder(orderId, paymentResult)`:**
  - Диспатчит `ORDER_PAY_REQUEST`.
  - PUT `/api/orders/:id/pay` с `paymentResult` в body.
  - При успехе: `ORDER_PAY_SUCCESS`.
- **Reducer:** `orderPayReducer` — `{ loading: loadingPay, success: successPay }`.
- **Видимость кнопки:** `{!order.isPaid && (!sdkReady ? <Loader/> : <PayPalButton .../>)}`.

### API endpoints
- `PUT /api/orders/:id/pay` — private (Bearer token), body: PayPal `paymentResult` object:
  ```json
  {
    "id": "PAY-...",
    "status": "COMPLETED",
    "update_time": "2026-...",
    "payer": { "email_address": "buyer@example.com" }
  }
  ```
  Response: обновлённый order object.

### Edge cases
- Пользователь закрывает PayPal popup без оплаты → `onSuccess` не вызывается, `onError` не обрабатывается явно (только `console.log` в `successPaymentHandler`).
- Дублирование платежа: если `PUT /pay` упал после успешной транзакции PayPal → заказ не помечен как оплаченный, но деньги списаны. Backend идемпотентности не реализован.
- `order.totalPrice` передаётся в PayPal — но PayPal не верифицирует сумму заказа на стороне сервера (accept any amount).
- После `successPay` → `useEffect` диспатчит `ORDER_PAY_RESET` + `getOrderDetails` для обновления данных.

### Зависимости
- Зависит от: PayPal SDK (Feature 1), Auth (token для PUT), Order state.
- Запускает: Feature 3 (Mark as Paid server update).

---

## Feature 3: Mark Order as Paid (Server Update)

### Назначение
Сохранение результата PayPal-транзакции в MongoDB: `isPaid=true`, `paidAt=Date.now()`, полный `paymentResult` объект от PayPal. Persona: система после подтверждения оплаты.

### User flow
(автоматический, не требует действий пользователя)
1. `payOrder` action отправляет PUT запрос с paymentResult.
2. Контроллер обновляет заказ в MongoDB.
3. Обновлённый заказ возвращается на фронт.
4. Redux state `orderPay.success = true`.
5. `useEffect` в OrderScreen делает re-fetch и обновляет UI.

### Технический impl
- **Controller:** `updateOrderToPaid`:
  ```js
  order.isPaid = true
  order.paidAt = Date.now()
  order.paymentResult = {
    id: req.body.id,
    status: req.body.status,
    update_time: req.body.update_time,
    email_address: req.body.payer.email_address
  }
  const updatedOrder = await order.save()
  res.json(updatedOrder)
  ```
- **Model fields:**
  ```
  isPaid: Boolean (default: false)
  paidAt: Date
  paymentResult: { id, status, update_time, email_address }
  ```
- Route: `PUT /api/orders/:id/pay` — защищён только `protect`, не `admin` — любой залогиненный пользователь технически может отметить любой заказ оплаченным (security issue учебного проекта).

### API endpoints
- `PUT /api/orders/:id/pay` — private, response: полный обновлённый order.

### Edge cases
- `req.body.payer.email_address` — если PayPal вернул нестандартный формат без `payer.email_address` → TypeError: Cannot read property 'email_address' of undefined → HTTP 500.
- Повторный вызов (если `isPaid` уже true) → MongoDB перезаписывает `paidAt` и `paymentResult` новыми значениями (нет idempotency check).
- OrderScreen не проверяет ownership — чужой order ID в PUT → обновляет чужой заказ (auth issue).

### Зависимости
- Зависит от: Order model, Auth middleware (`protect`).
- Результат виден в: Order Detail page, Profile Order History, Admin Order List.

---

## Feature 4: Payment Status Display

### Назначение
Визуальное отображение статуса оплаты заказа в нескольких местах UI. Persona: покупатель, отслеживающий статус; администратор, управляющий заказами.

### Технический impl
- **OrderScreen — Payment Method секция:**
  ```jsx
  {order.isPaid
    ? <Message variant='success'>Paid on {order.paidAt}</Message>
    : <Message variant='danger'>Not Paid</Message>}
  ```
- **OrderScreen — Shipping секция:**
  ```jsx
  {order.isDelivered
    ? <Message variant='success'>Delivered on {order.deliveredAt}</Message>
    : <Message variant='danger'>Not Delivered</Message>}
  ```
- **ProfileScreen — Orders table:**
  - PAID column: `order.isPaid ? order.paidAt.substring(0,10) : <fa-times red>`
  - DELIVERED column: аналогично.
- **OrderListScreen (admin):**
  - Аналогичная таблица со статусами для всех заказов.
- **Component:** `Message.js` — Bootstrap Alert с variant (danger/success).

### Edge cases
- `order.paidAt` возвращается как ISO-строка из MongoDB → без `.substring(0,10)` показывается полная дата с временем.
- `order.paidAt` в OrderScreen не обрезается — показывается полная ISO строка (minor UI inconsistency с ProfileScreen).

### Зависимости
- Зависит от: Order model fields `isPaid`, `paidAt`, `paymentResult`.
- Используется в четырёх разных местах UI.

---

## Feature 5: PayPal Configuration Endpoint

### Назначение
Безопасная передача PayPal Client ID на фронтенд без хардкодинга в клиентском бандле. Позволяет менять ключ через env без пересборки фронта. Persona: разработчик, деплоящий проект.

### Технический impl
- **Route:** в `server.js` (не в отдельном роутере):
  ```js
  app.get('/api/config/paypal', (req, res) =>
    res.send(process.env.PAYPAL_CLIENT_ID || 'sb')
  )
  ```
- Default значение `'sb'` — строка sandbox, позволяет работать без настройки `.env` в dev.
- Маршрут не защищён — `protect` middleware не применяется.

### Edge cases
- Эндпоинт public — любой может получить Client ID. Для PayPal это приемлемо (Client ID не секрет, используется только для инициализации виджета).
- В production нужно задать реальный `PAYPAL_CLIENT_ID` в `.env` → иначе sandbox ID попадёт в прод.

### Зависимости
- Зависит от: `PAYPAL_CLIENT_ID` в `.env` / `process.env`.
- Вызывается из: OrderScreen `addPayPalScript` function.

---

## Feature 6: Payment Result Storage

### Назначение
Сохранение полных данных PayPal-транзакции (`paymentResult`) в MongoDB для аудита и reconciliation. Persona: администратор, проверяющий транзакции.

### Технический impl
- **Order model field:**
  ```js
  paymentResult: {
    id: { type: String },
    status: { type: String },
    update_time: { type: String },
    email_address: { type: String }
  }
  ```
- Все поля опциональны (нет `required: true`).
- Хранится payload PayPal-ответа как есть.
- Не отображается в UI (нет экрана для просмотра деталей транзакции).

### Edge cases
- Данные хранятся, но нет UI для их просмотра — только через MongoDB напрямую.
- Нет верификации подписи PayPal webhook — приложение принимает любой `paymentResult` объект.

### Зависимости
- Зависит от: Order model, `updateOrderToPaid` controller.
- Потенциальное расширение: вебхуки PayPal для автоматического обновления статуса.
