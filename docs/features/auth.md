> **TODO(audit-2026-05-29):** Backend behaviour/flows accurate. Frontend screen references use old .js paths and Bootstrap-era UI — screens are now .jsx under good-shop (Tailwind v4 + shadcn).
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Auth Features — ProShop MERN

Покрывает аутентификацию, регистрацию, управление профилем и механику JWT-сессий.

---

## Feature 1: User Login (Sign In)

### Назначение
Аутентификация существующего пользователя по email + password. Точка входа для всех защищённых маршрутов. Persona: покупатель, вернувшийся на сайт.

### User flow
1. Пользователь открывает `/login` (или его редиректит с защищённого маршрута).
2. Вводит email и password в форму.
3. Кликает «Sign In».
4. При успехе — редирект на `redirect` query-параметр (если есть) или на `/`.
5. При ошибке — отображается `<Message variant='danger'>` с текстом ошибки.

### Технический impl
- **Screen:** `LoginScreen.js` — локальный state `email`, `password`; читает `location.search` для redirect-параметра.
- **Action:** `userActions.login(email, password)` — POST `/api/users/login`, при успехе сохраняет `userInfo` в `localStorage`.
- **Reducer:** `userLoginReducer` — состояния `USER_LOGIN_REQUEST`, `USER_LOGIN_SUCCESS`, `USER_LOGIN_FAIL`.
- **Redux state:** `state.userLogin.userInfo` — объект `{ _id, name, email, isAdmin, token }`.
- **Route:** `POST /api/users/login` → `authUser` controller.
- **Controller:** `authUser` — `User.findOne({ email })`, `user.matchPassword(password)` (bcrypt.compare), генерирует JWT через `generateToken`.

### API endpoints
- `POST /api/users/login` — body: `{ email, password }`, response: `{ _id, name, email, isAdmin, token }`.

### Edge cases
- Неверный email или password → HTTP 401 + `"Invalid email or password"`.
- Пользователь не найден в MongoDB → та же ошибка (не разглашается, какого поля нет).
- Форма без email-формата — браузерная валидация (type='email').
- Уже залогинен (`userInfo` в state) — `useEffect` сразу делает `history.push(redirect)`, форма не показывается.
- Сеть недоступна — action ловит `error.message` и диспатчит `USER_LOGIN_FAIL`.

### Зависимости
- Зависит от: User model (MongoDB), bcrypt hashing при создании пользователя, `JWT_SECRET` env var.
- От этой фичи зависят: Cart checkout (редирект `/login?redirect=shipping`), Profile, все Admin-экраны.

---

## Feature 2: User Registration (Sign Up)

### Назначение
Создание нового аккаунта. После успешной регистрации пользователь автоматически залогинен — не нужно делать отдельный login-запрос. Persona: новый покупатель.

### User flow
1. Открывает `/register` (или по ссылке «New Customer? Register» со страницы логина).
2. Заполняет: Name, Email Address, Password, Confirm Password.
3. Кликает «Register».
4. Если passwords не совпадают — локальная ошибка `"Passwords do not match"` без обращения к API.
5. При успехе — JWT получен, `userInfo` записан в localStorage, редирект на `redirect` или `/`.

### Технический impl
- **Screen:** `RegisterScreen.js` — 4 поля state + `message` для локальной валидации паролей.
- **Action:** `userActions.register(name, email, password)` — POST `/api/users`, при успехе диспатчит `USER_REGISTER_SUCCESS` + `USER_LOGIN_SUCCESS` (двойной диспатч = auto-login).
- **Reducer:** `userRegisterReducer` — `USER_REGISTER_REQUEST/SUCCESS/FAIL`.
- **Controller:** `registerUser` — проверяет `User.findOne({ email })`, создаёт через `User.create({ name, email, password })`, хеширует пароль через Mongoose pre-save hook.
- **Model pre-save hook:** `bcrypt.genSalt(10)` + `bcrypt.hash`.

### API endpoints
- `POST /api/users` — body: `{ name, email, password }`, response: `{ _id, name, email, isAdmin, token }`, HTTP 201.

### Edge cases
- Email уже занят → HTTP 400 + `"User already exists"`.
- Passwords не совпадают → только фронтовая ошибка, запрос не отправляется.
- Пустые поля — браузерная валидация HTML required-атрибутов отсутствует (поля без required); MongoDB Schema `required: true` вернёт 400.
- Пароль не хешируется повторно: pre-save hook проверяет `this.isModified('password')`.

### Зависимости
- Зависит от: User model, bcrypt, `generateToken`.
- После регистрации пользователь имеет `isAdmin: false` по умолчанию.

---

## Feature 3: User Logout

### Назначение
Полное завершение сессии — очистка всех данных пользователя из localStorage и Redux store. Persona: любой залогиненный пользователь.

### User flow
1. В хедере: кликает на имя пользователя → NavDropdown.
2. Выбирает «Logout».
3. Все данные очищены, редирект на `/login`.

### Технический impl
- **Component:** `Header.js` — `logoutHandler` диспатчит `logout()` action.
- **Action:** `userActions.logout()` — синхронный thunk:
  - `localStorage.removeItem('userInfo')`
  - `localStorage.removeItem('cartItems')`
  - `localStorage.removeItem('shippingAddress')`
  - `localStorage.removeItem('paymentMethod')`
  - Диспатчит `USER_LOGOUT`, `USER_DETAILS_RESET`, `ORDER_LIST_MY_RESET`, `USER_LIST_RESET`.
  - `document.location.href = '/login'` — hard redirect (не `history.push`).

### API endpoints
- Нет серверного запроса. JWT-инвалидация на сервере не реализована (stateless JWT).

### Edge cases
- JWT на сервере не инвалидируется — токен остаётся валидным 30 дней после logout. Если токен перехвачен — пользователь уязвим до истечения срока.
- Hard redirect через `document.location.href` сбрасывает весь React state, что гарантирует очистку in-memory данных.
- Корзина очищается при logout (cart items в localStorage удаляются).

### Зависимости
- Зависит от: `userLogin` Redux slice, всех `localStorage` ключей.
- Затрагивает: cart state, orderListMy state, userList state.

---

## Feature 4: Profile View & Update

### Назначение
Просмотр и редактирование данных своего аккаунта: имя, email, пароль. Только для залогиненных пользователей. Persona: покупатель, который хочет обновить данные.

### User flow
1. Открывает `/profile` (из NavDropdown хедера).
2. Форма предзаполнена текущими name и email.
3. Меняет нужные поля, вводит новый пароль (опционально).
4. Кликает «Update».
5. При успехе — зелёное сообщение `"Profile Updated"`, `userInfo` в Redux и localStorage обновляется (включая новый JWT).

### Технический impl
- **Screen:** `ProfileScreen.js` — два колонки: форма профиля (3/12) + таблица заказов (9/12).
- **Actions:**
  - `getUserDetails('profile')` — GET `/api/users/profile` (special case: передаёт строку 'profile' вместо ID).
  - `updateUserProfile({ id, name, email, password })` — PUT `/api/users/profile`.
  - `listMyOrders()` — GET `/api/orders/myorders` (для таблицы справа).
- **Reducers:** `userDetailsReducer`, `userUpdateProfileReducer`, `orderListMyReducer`.
- **Controller:** `getUserProfile` — `User.findById(req.user._id)` (из JWT); `updateUserProfile` — патч полей + новый JWT в ответе.
- **Ключевой момент:** после успешного обновления диспатчится `USER_LOGIN_SUCCESS` с новым токеном → localStorage перезаписывается.

### API endpoints
- `GET /api/users/profile` — private, header `Authorization: Bearer <token>`, response: `{ _id, name, email, isAdmin }`.
- `PUT /api/users/profile` — private, body: `{ name, email, password }` (password опционально), response: `{ _id, name, email, isAdmin, token }`.

### Edge cases
- Пароль не передаётся → поле password не обновляется (controller: `if (req.body.password) { user.password = ... }`).
- Пароль не совпадает с confirmPassword → фронтовая ошибка, запрос не отправляется.
- Незалогиненный пользователь → `useEffect` редиректит на `/login`.
- `USER_UPDATE_PROFILE_RESET` диспатчится при входе на страницу, чтобы сбросить флаг `success` от предыдущего обновления.
- Ошибка токена (`"Not authorized, token failed"`) → автологаут через `dispatch(logout())` в action.

### Зависимости
- Зависит от: Auth (login/register), orderListMy, userDetails state.
- Этот же экран отображает историю заказов пользователя (Feature: Order History).

---

## Feature 5: JWT Token Generation & Validation

### Назначение
Механика аутентификации запросов к защищённым API-маршрутам. Не является отдельным UI-экраном — это инфраструктурный слой, пронизывающий все features.

### Технический impl
- **Генерация:** `backend/utils/generateToken.js` — `jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' })`.
- **Middleware `protect`:** `backend/middleware/authMiddleware.js` — извлекает токен из `Authorization: Bearer <token>`, верифицирует через `jwt.verify`, загружает `User.findById(decoded.id).select('-password')` → кладёт в `req.user`.
- **Middleware `admin`:** проверяет `req.user.isAdmin === true`, HTTP 401 если нет.
- **Фронтенд:** все защищённые actions добавляют `Authorization: Bearer ${userInfo.token}` в axios config header.
- **Хранение:** `userInfo` (включая token) в `localStorage['userInfo']`; `store.js` инициализирует Redux state из localStorage при загрузке приложения.

### API endpoints
- Применяется ко всем `protect`-маршрутам:
  - `GET /api/users/profile`, `PUT /api/users/profile`
  - `GET /api/orders/myorders`, `POST /api/orders`, `GET /api/orders/:id`, `PUT /api/orders/:id/pay`
  - `GET /api/users`, `DELETE /api/users/:id`, `GET /api/users/:id`, `PUT /api/users/:id` (+ admin)
  - `POST /api/products`, `DELETE /api/products/:id`, `PUT /api/products/:id` (+ admin)
  - `POST /api/upload` (+ admin)

### Edge cases
- JWT secret отсутствует в `.env` → `jwt.sign` бросает ошибку, сервер не запускается корректно.
- Токен истёк (через 30 дней) → `jwt.verify` бросает `TokenExpiredError`, middleware отвечает HTTP 401 `"Not authorized, token failed"` → фронтенд-actions перехватывают эту строку и диспатчат `logout()`.
- Токен подделан → `jwt.verify` бросает `JsonWebTokenError` → та же цепочка.
- Параллельные запросы при инвалидном токене — каждый action независимо проверяет ошибку и вызывает logout.

### Зависимости
- Зависит от: `JWT_SECRET` env var, User model.
- Все защищённые features зависят от этого механизма.

---

## Feature 6: Password Hashing

### Назначение
Безопасное хранение паролей пользователей в MongoDB с использованием bcrypt. Работает автоматически через Mongoose middleware — не требует явного вызова в контроллерах.

### Технический impl
- **Model:** `backend/models/userModel.js` — pre-save hook:
  ```js
  userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) { next() }
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
  })
  ```
- **Верификация:** `userSchema.methods.matchPassword` — `bcrypt.compare(enteredPassword, this.password)`.
- Хук срабатывает при `User.create()` (регистрация) и при `user.save()` после изменения password (обновление профиля).
- Соль: 10 раундов генерируются каждый раз — каждый хеш уникален.

### Edge cases
- `!this.isModified('password')` — если сохраняется только name/email, пароль не перехешируется.
- При обновлении профиля без нового пароля: контроллер не присваивает `user.password` → `isModified` = false → хук пропускается.
- Длинный пароль (>72 bytes) — bcrypt обрезает до 72 bytes без ошибки (bcryptjs behaviour).

### Зависимости
- Зависит от: `bcryptjs` npm package.
- Используется в: Login (matchPassword), Register (pre-save), Profile Update (pre-save).

---

## Feature 7: Auto-Login After Registration

### Назначение
После успешной регистрации пользователь немедленно аутентифицирован без повторного ввода credentials. Улучшает UX onboarding-потока. Persona: новый пользователь.

### User flow
1. Пользователь заполняет форму регистрации и кликает «Register».
2. Сервер возвращает `{ _id, name, email, isAdmin, token }`.
3. Action диспатчит `USER_REGISTER_SUCCESS` + `USER_LOGIN_SUCCESS` одновременно.
4. `userInfo` записывается в localStorage.
5. `useEffect` в RegisterScreen видит `userInfo` и делает `history.push(redirect)`.
6. Пользователь оказывается на целевой странице уже залогиненным.

### Технический impl
- **Action:** `userActions.register` — двойной dispatch после успешного POST:
  ```js
  dispatch({ type: USER_REGISTER_SUCCESS, payload: data })
  dispatch({ type: USER_LOGIN_SUCCESS, payload: data })
  localStorage.setItem('userInfo', JSON.stringify(data))
  ```
- **Redirect logic:** аналогична LoginScreen — `location.search.split('=')[1]` для redirect query param.

### Edge cases
- Если пользователь пришёл с `/cart` → `/login?redirect=shipping` → `/register?redirect=shipping` — после регистрации оказывается на `/shipping`.
- Регистрация с уже существующим email → `USER_REGISTER_FAIL`, `USER_LOGIN_SUCCESS` не диспатчится.

### Зависимости
- Зависит от: `userLoginReducer` (именно его state проверяет useEffect).
- Позволяет checkout-flow работать без явного login-шага.

---

## Feature 8: Redirect Guard (Protected Route Behavior)

### Назначение
Перенаправление неаутентифицированных пользователей на страницу логина с сохранением целевого URL. Применяется на всех защищённых экранах через одинаковый паттерн.

### Технический impl
Паттерн в каждом защищённом screen:
```js
useEffect(() => {
  if (!userInfo) { history.push('/login') }
}, [history, userInfo])
```

- **Экраны с guard:** ProfileScreen, OrderScreen, ProductListScreen (admin), ProductEditScreen (admin), UserListScreen (admin), UserEditScreen (admin), OrderListScreen (admin).
- **Admin guard:** дополнительная проверка `!userInfo.isAdmin` → redirect на `/login`.
- **Checkout guard:** ShippingScreen проверяет `shippingAddress`, PaymentScreen — аналогично, PlaceOrderScreen — оба условия.

### API endpoints
- Нет. Работает на фронте через Redux state.

### Edge cases
- Race condition: `userInfo` в localStorage есть, но Redux state ещё не инициализирован → brief flash пустого экрана до redirect. Решение: store.js инициализирует state из localStorage синхронно.
- Прямой переход по URL к admin-странице обычным пользователем → redirect на `/login`.

### Зависимости
- Зависит от: `userLogin` Redux state, `localStorage['userInfo']`.
- Все защищённые features зависят от этого паттерна.
