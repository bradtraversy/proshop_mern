> **TODO(audit-2026-05-29):** Backend behaviour/flows accurate. Frontend screen references use old .js paths and Bootstrap-era UI — screens are now .jsx under good-shop (Tailwind v4 + shadcn).
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Admin Features — ProShop MERN

Покрывает управление товарами, пользователями и заказами в административной панели. Все admin-маршруты защищены двойным middleware: `protect` + `admin`.

---

## Feature 1: Admin Navigation & Role Gating

### Назначение
Условное отображение admin-меню в хедере и защита всех admin-маршрутов от обычных пользователей. Persona: системный администратор магазина.

### Технический impl
- **Component:** `Header.js` — условный рендер:
  ```jsx
  {userInfo && userInfo.isAdmin && (
    <NavDropdown title='Admin' id='adminmenu'>
      <LinkContainer to='/admin/userlist'><NavDropdown.Item>Users</NavDropdown.Item></LinkContainer>
      <LinkContainer to='/admin/productlist'><NavDropdown.Item>Products</NavDropdown.Item></LinkContainer>
      <LinkContainer to='/admin/orderlist'><NavDropdown.Item>Orders</NavDropdown.Item></LinkContainer>
    </NavDropdown>
  )}
  ```
- **Backend guard:** middleware chain `protect, admin` на всех admin-роутах:
  - `admin` middleware: `if (req.user && req.user.isAdmin) { next() } else { res.status(401) throw new Error('Not authorized as an admin') }`
- **Frontend guard:** каждый admin screen в `useEffect`:
  ```js
  if (!userInfo || !userInfo.isAdmin) { history.push('/login') }
  ```
- **`isAdmin` поле:** хранится в User model (default: `false`), возвращается в JWT payload как часть userInfo.

### API endpoints
- Admin-меню не делает API-запросов. Видимость определяется `userInfo.isAdmin` из Redux state.

### Edge cases
- Пользователь знает URL admin-страницы → frontend guard редиректит на `/login`.
- Прямой API-запрос с токеном не-admin пользователя → `admin` middleware возвращает HTTP 401.
- `userInfo.isAdmin` в Redux может быть устаревшим если admin-статус изменили другим сессией → решается logout/login.

### Зависимости
- Зависит от: Auth (JWT, `isAdmin` поле), User model.
- Все admin features зависят от этого гейтинга.

---

## Feature 2: Admin Product List

### Назначение
Таблица всех товаров с возможностью редактирования и удаления каждого, а также кнопка создания нового товара. Persona: контент-менеджер, управляющий ассортиментом.

### User flow
1. Admin открывает `/admin/productlist` (из меню Admin → Products).
2. Таблица: ID, NAME, PRICE, CATEGORY, BRAND, кнопки Edit/Delete.
3. Клик «Edit» → `/admin/product/:id/edit`.
4. Клик «Delete» → `window.confirm('Are you sure')` → удаление.
5. Клик «Create Product» → создаётся product с дефолтными значениями → редирект на форму редактирования.
6. Пагинация по страницам.

### Технический impl
- **Screen:** `ProductListScreen.js` — читает `match.params.pageNumber`.
- **Actions:**
  - `listProducts('', pageNumber)` — GET `/api/products?pageNumber=N` (пустой keyword — все товары).
  - `deleteProduct(id)` — DELETE `/api/products/:id`.
  - `createProduct()` — POST `/api/products` (без body).
- **Reducers:** `productListReducer`, `productDeleteReducer`, `productCreateReducer`.
- **`useEffect` зависимости:** `successDelete`, `successCreate` — обновляет список после операций.
- После `successCreate` → `history.push('/admin/product/${createdProduct._id}/edit')`.
- `PRODUCT_CREATE_RESET` диспатчится при входе на страницу.

### API endpoints
- `GET /api/products?pageNumber=N` — public (используется без auth).
- `DELETE /api/products/:id` — private + admin, response: `{ message: 'Product removed' }`.
- `POST /api/products` — private + admin, response: созданный product, HTTP 201.

### Edge cases
- Удаление с `window.confirm` — нет undo. После `successDelete` список автоматически обновляется.
- Ошибка удаления (`errorDelete`) → `<Message variant='danger'>` над таблицей.
- Создание товара при ошибке (`errorCreate`) → `<Message variant='danger'>`.
- `listProducts` без keyword использует ту же функцию что и публичный каталог — admin видит все товары.
- Пагинация admin использует URL `/admin/productlist/:pageNumber` (отличается от user URL).

### Зависимости
- Зависит от: Product model, Auth + admin middleware, Paginate component.
- От этой фичи зависят: Product Edit (переход через Edit button), Product Create (переход после создания).

---

## Feature 3: Admin Product Create (Sample Product)

### Назначение
Быстрое создание товара-заглушки с дефолтными значениями. Сразу открывается форма редактирования для заполнения реальными данными. Persona: контент-менеджер, добавляющий новый товар.

### Технический impl
- **Action:** `createProduct()` — POST `/api/products` с пустым body `{}`.
- **Controller:** создаёт фиксированный объект:
  ```js
  const product = new Product({
    name: 'Sample name',
    price: 0,
    user: req.user._id,
    image: '/images/sample.jpg',
    brand: 'Sample brand',
    category: 'Sample category',
    countInStock: 0,
    numReviews: 0,
    description: 'Sample description',
  })
  ```
- `user` поле → ID текущего admin-пользователя.
- После создания → автоматический переход на `ProductEditScreen` для заполнения.

### API endpoints
- `POST /api/products` — private + admin, body: `{}`, response: product с дефолтными значениями, HTTP 201.

### Edge cases
- Если admin не завершает редактирование → в БД остаётся "Sample" товар с нулевой ценой.
- Нет валидации на уникальность имени — можно создать несколько одинаковых "Sample name".
- `countInStock: 0` → товар сразу "Out Of Stock" в публичном каталоге.

### Зависимости
- Зависит от: Product model, admin auth.
- Немедленно запускает: Product Edit flow (Feature 4).

---

## Feature 4: Admin Product Edit

### Назначение
Форма редактирования существующего товара: имя, цена, изображение (URL или upload), brand, category, countInStock, description. Persona: контент-менеджер.

### User flow
1. Открывает `/admin/product/:id/edit`.
2. Форма предзаполнена текущими данными товара.
3. Меняет поля.
4. Загружает изображение через file picker (или вводит URL вручную).
5. Кликает «Update».
6. При успехе → редирект на `/admin/productlist`.

### Технический impl
- **Screen:** `ProductEditScreen.js` — 7 state переменных + `uploading`.
- **Actions:**
  - `listProductDetails(productId)` — GET `/api/products/:id` для предзаполнения.
  - `updateProduct({ _id, name, price, image, brand, category, description, countInStock })` — PUT `/api/products/:id`.
- **File Upload:** `uploadFileHandler` — прямой `axios.post('/api/upload', formData)` (не через Redux action):
  ```js
  const config = {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: userInfo ? `Bearer ${userInfo.token}` : undefined
    }
  }
  const { data } = await axios.post('/api/upload', formData, config)
  setImage(data) // сервер возвращает путь к файлу
  ```
- **Важно:** токен берётся напрямую из `store.getState()` внутри handler (не из useSelector) — нестандартный паттерн.
- После `successUpdate` → `PRODUCT_UPDATE_RESET` + redirect.

### API endpoints
- `GET /api/products/:id` — public.
- `PUT /api/products/:id` — private + admin, body: все поля товара, response: обновлённый product.
- `POST /api/upload` — private + admin, multipart/form-data, response: путь к файлу (строка).

### Edge cases
- Поля формы не имеют min/max валидации — price может быть отрицательным, countInStock отрицательным.
- `setImage(data)` после upload устанавливает путь к загруженному файлу; при сабмите формы используется этот путь.
- Если изменить URL вручную и также загрузить файл → победит последнее действие.
- `uploading=true` показывает Loader, блокирует UX во время upload.
- `PRODUCT_UPDATE_RESET` диспатчится при входе на страницу для сброса старого success-флага.

### Зависимости
- Зависит от: Product Detail action, Image Upload (Feature 7), Auth + admin.
- От изменений зависят: каталог, детальная страница, карусель (если обновился рейтинг).

---

## Feature 5: Admin Product Delete

### Назначение
Безвозвратное удаление товара из базы данных. Требует подтверждения через браузерный диалог. Persona: администратор, убирающий устаревший товар.

### User flow
1. В `ProductListScreen` → клик кнопки Delete (иконка мусорки).
2. Браузерный `window.confirm('Are you sure')`.
3. При подтверждении → `dispatch(deleteProduct(id))`.
4. После успеха список автоматически обновляется.

### Технический impl
- **Action:** `deleteProduct(id)` — DELETE `/api/products/:id` с Bearer token.
- **Controller:** `Product.findById(req.params.id)` → `product.remove()`.
- **`successDelete`** → в useEffect ProductListScreen тригерит `listProducts` повторно.

### API endpoints
- `DELETE /api/products/:id` — private + admin, response: `{ message: 'Product removed' }`.

### Edge cases
- Товар удалён, но он ещё в чьей-то корзине (localStorage) → при checkout создание заказа с несуществующим product ID → Order сохранится в БД (FK constraint отсутствует в MongoDB по умолчанию).
- Товар удалён, но существуют заказы с ним → заказы не ломаются (orderItems хранит snapshot данных).
- `window.confirm` не может быть стилизован и блокирует JS thread.

### Зависимости
- Зависит от: Product model, Admin auth.
- Не удаляет связанные изображения из `/uploads/` папки.

---

## Feature 6: Admin User List

### Назначение
Таблица всех пользователей системы с отображением admin-статуса, кнопками редактирования и удаления. Persona: super-admin, управляющий доступами.

### User flow
1. Admin открывает `/admin/userlist` (Admin → Users).
2. Таблица: ID, NAME, EMAIL (кликабельный mailto), ADMIN (чекмарк или X), кнопки Edit/Delete.
3. Клик «Edit» → `/admin/user/:id/edit`.
4. Клик «Delete» → `window.confirm` → удаление.

### Технический impl
- **Screen:** `UserListScreen.js` — guard `userInfo.isAdmin`.
- **Actions:**
  - `listUsers()` → GET `/api/users` (all users).
  - `deleteUser(id)` → DELETE `/api/users/:id`.
- **Reducers:** `userListReducer`, `userDeleteReducer`.
- **`successDelete`** в useEffect зависимостях → автообновление после удаления.
- Admin-статус: иконка `fa-check` зелёная если isAdmin, `fa-times` красная если нет.

### API endpoints
- `GET /api/users` — private + admin, response: массив всех users (включая password hash! — security issue).
- `DELETE /api/users/:id` — private + admin, response: `{ message: 'User removed' }`.

### Edge cases
- `GET /api/users` возвращает password hash в ответе (контроллер использует `User.find({})` без `.select('-password')`) — security issue учебного проекта.
- Admin может удалить самого себя → потеря доступа к системе.
- Нет подтверждения email при удалении.
- После удаления `listUsers()` вызывается повторно через useEffect dependency.

### Зависимости
- Зависит от: User model, Admin auth.
- От этой фичи зависит: User Edit (переход через Edit button).

---

## Feature 7: Admin User Edit

### Назначение
Форма редактирования данных пользователя: имя, email, admin-статус (checkbox). Позволяет выдавать и отзывать admin-права. Persona: super-admin.

### User flow
1. Открывает `/admin/user/:id/edit`.
2. Форма предзаполнена: name, email, isAdmin checkbox.
3. Меняет данные.
4. Кликает «Update».
5. При успехе → редирект на `/admin/userlist`.

### Технический impl
- **Screen:** `UserEditScreen.js` — 3 state переменных: name, email, isAdmin.
- **Actions:**
  - `getUserDetails(userId)` → GET `/api/users/:id` (admin endpoint, не `/profile`).
  - `updateUser({ _id, name, email, isAdmin })` → PUT `/api/users/:id`.
- **Reducer:** `userUpdateReducer` — `{ loading, error, success }`.
- После `successUpdate` → `USER_UPDATE_RESET` + redirect на `/admin/userlist`.
- **Двойной диспатч в action:** `USER_UPDATE_SUCCESS` + `USER_DETAILS_SUCCESS` (обновляет кешированные данные) + `USER_DETAILS_RESET`.

### API endpoints
- `GET /api/users/:id` — private + admin, response: user без пароля (`.select('-password')`).
- `PUT /api/users/:id` — private + admin, body: `{ name, email, isAdmin }`, response: `{ _id, name, email, isAdmin }`.

### Edge cases
- Email можно изменить на уже существующий → MongoDB unique index вернёт ошибку → HTTP 500 (не обработано как 400).
- `isAdmin` можно установить через UI — нет дополнительной верификации.
- Нет смены пароля через admin-редактирование (поле password отсутствует в форме).

### Зависимости
- Зависит от: User model, Admin auth.
- Изменение `isAdmin` влияет на: доступ к admin-панели через Header, API middleware `admin`.

---

## Feature 8: Admin User Delete

### Назначение
Удаление аккаунта пользователя из системы. Все заказы пользователя остаются в БД (нет cascade delete). Persona: администратор.

### Технический impl
- **Action:** `deleteUser(id)` → DELETE `/api/users/:id` с Bearer token.
- **Controller:** `User.findById(req.params.id)` → `user.remove()`.

### API endpoints
- `DELETE /api/users/:id` — private + admin, response: `{ message: 'User removed' }`.

### Edge cases
- Удалённый пользователь: его заказы остаются (FK не каскадируется). В OrderScreen populate(`'user', 'name email'`) вернёт null → `order.user && order.user.name` в OrderListScreen защищает от краша.
- Admin удаляет себя → следующий запрос с его токеном вернёт 401 (User не найден в protect middleware).

### Зависимости
- Зависит от: User model, Admin auth.
- Связанные Orders: не удаляются, могут показывать null для user.

---

## Feature 9: Admin Order List

### Назначение
Таблица всех заказов в системе с информацией о пользователе, дате, сумме, статусе оплаты и доставки. Persona: администратор, отслеживающий все транзакции.

### User flow
1. Admin → `/admin/orderlist` (Admin → Orders).
2. Таблица: ID, USER (имя), DATE, TOTAL, PAID, DELIVERED, кнопка Details.
3. Клик «Details» → `/order/:id`.
4. На странице заказа admin видит кнопку «Mark As Delivered».

### Технический impl
- **Screen:** `OrderListScreen.js` — guard `userInfo.isAdmin`.
- **Action:** `listOrders()` → GET `/api/orders`.
- **Reducer:** `orderListReducer` — `{ orders, loading, error }`.
- **Controller:** `getOrders` — `Order.find({}).populate('user', 'id name')`.
- PAID column: дата если оплачен, иначе `fa-times` красная.
- DELIVERED column: аналогично.
- `order.user && order.user.name` — null-safe для удалённых пользователей.

### API endpoints
- `GET /api/orders` — private + admin, response: массив всех заказов с populated user (id + name).

### Edge cases
- Очень много заказов → бесконечная таблица (нет пагинации в admin order list — в отличие от product list).
- `order.paidAt.substring(0, 10)` — вызывается только при `order.isPaid` (ternary защищает).
- `order.user` может быть null если пользователь удалён → `order.user && order.user.name` отображает undefined (пустая ячейка).

### Зависимости
- Зависит от: Order model, Auth + admin, User model (через populate).
- Ссылается на: Order Detail (Feature 10).

---

## Feature 10: Mark Order as Delivered

### Назначение
Администратор помечает заказ доставленным — устанавливает `isDelivered=true` и `deliveredAt=Date.now()`. Кнопка видна только для оплаченных и ещё не доставленных заказов. Persona: администратор, обрабатывающий выполненные заказы.

### User flow
1. Admin открывает OrderScreen для оплаченного заказа.
2. Внизу summary card — кнопка «Mark As Delivered».
3. Клик → `dispatch(deliverOrder(order))`.
4. После успеха → страница обновляется с `"Delivered on [date]"`.

### Технический impl
- **Условие рендера кнопки:**
  ```jsx
  {userInfo && userInfo.isAdmin && order.isPaid && !order.isDelivered && (
    <Button onClick={deliverHandler}>Mark As Delivered</Button>
  )}
  ```
- **Action:** `deliverOrder(order)` → PUT `/api/orders/:id/deliver` (пустой body `{}`).
- **Reducer:** `orderDeliverReducer` — `{ loading: loadingDeliver, success: successDeliver }`.
- **Controller:** `updateOrderToDelivered`:
  ```js
  order.isDelivered = true
  order.deliveredAt = Date.now()
  const updatedOrder = await order.save()
  ```
- После `successDeliver` → `useEffect` сбрасывает `ORDER_DELIVER_RESET` + `getOrderDetails`.

### API endpoints
- `PUT /api/orders/:id/deliver` — private + admin, body: `{}`, response: обновлённый order.

### Edge cases
- Нет undo — доставку нельзя отменить через UI.
- Кнопка скрыта при `!order.isPaid` — нельзя пометить как доставлено до оплаты.
- `loadingDeliver && <Loader />` показывается пока запрос в процессе.
- Route типизирован как GET в контроллере-комментарии (`@route GET`), но в роутере — `PUT` (несоответствие в документации кода).

### Зависимости
- Зависит от: Order model, Admin auth, Payment (isPaid должен быть true).
- Влияет на: Order History (deliveredAt показывается в профиле), Admin Order List.

---

## Feature 11: Image Upload for Products

### Назначение
Загрузка изображения товара через форму на клиенте — сохраняется в папку `uploads/` на сервере. Возвращает путь к файлу, который записывается в поле `image`. Persona: контент-менеджер, добавляющий фото товара.

### User flow
1. На странице редактирования товара — поле Image: текстовый input + file picker.
2. Admin кликает «Choose File», выбирает JPG/JPEG/PNG.
3. Немедленно (onChange) → `uploadFileHandler` отправляет файл.
4. Показывается Loader (`uploading=true`).
5. Сервер возвращает путь `/uploads/image-1234567890.jpg`.
6. `setImage(data)` — обновляет input поля Image.
7. Admin видит путь в поле, может продолжить редактирование.

### Технический impl
- **Handler в ProductEditScreen:**
  ```js
  const uploadFileHandler = async (e) => {
    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('image', file)
    setUploading(true)
    const { data } = await axios.post('/api/upload', formData, config)
    setImage(data)
    setUploading(false)
  }
  ```
- **Route:** `uploadRoutes.js` — `POST /api/upload` — `protect, admin, multer.single('image')`.
- **Multer config:**
  - `destination`: `uploads/` папка.
  - `filename`: `${file.fieldname}-${Date.now()}${ext}` (например `image-1714211234567.jpg`).
  - `fileFilter`: проверяет расширение (`.jpg`, `.jpeg`, `.png`) И MIME-тип (`image/jpeg`, `image/png`).
  - `limits.fileSize`: 2MB (2 * 1024 * 1024 bytes).
- **Response:** строка-путь `/${req.file.path}` (например `/uploads/image-123.jpg`).
- **Static serving:** `server.js` — `app.use('/uploads', express.static(path.join(__dirname, '/uploads')))`.

### API endpoints
- `POST /api/upload` — private + admin, Content-Type: multipart/form-data, field name: `image`, response: строка пути, HTTP 200.

### Edge cases
- Файл > 2MB → multer возвращает ошибку → `uploadFileHandler` catch → `setUploading(false)`, ошибка только в console (нет UI-отображения upload error).
- Неподдерживаемый тип (GIF, WebP) → `fileFilter` возвращает ошибку `"Images only (jpg, jpeg, png)"` → то же поведение.
- Двойная проверка: расширение + MIME — защищает от переименования файла с подменой расширения.
- Файлы не удаляются при удалении товара — накапливаются в `uploads/`.
- В `uploadFileHandler` токен получается из `store.getState()` напрямую — нестандартный паттерн (обычно через useSelector).
- `Form.File` (Bootstrap 4 API) — устаревший компонент в React Bootstrap v2.

### Зависимости
- Зависит от: `multer` npm package, `uploads/` папка на сервере, Admin auth.
- Результат используется в: Product model `image` field, публичный каталог, детальная страница.
