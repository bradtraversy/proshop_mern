> **TODO(audit-2026-05-29):** Backend behaviour/flows accurate. Frontend screen references use old .js paths and Bootstrap-era UI — screens are now .jsx under good-shop (Tailwind v4 + shadcn).
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Catalog Features — ProShop MERN

Покрывает листинг товаров, детальную страницу, поиск, пагинацию, карусель и систему рейтингов/отзывов.

---

## Feature 1: Product List (Home Page)

### Назначение
Главная страница — отображает все товары в виде адаптивной сетки. Точка входа для всех покупателей. Persona: посетитель, браузит ассортимент.

### User flow
1. Пользователь открывает `/` (HomeScreen).
2. Загружается карусель топ-товаров (только если нет поискового запроса).
3. Ниже — сетка товарных карточек: 1/2/3/4 колонки в зависимости от breakpoint.
4. Если товаров больше pageSize (10) — отображается пагинация.

### Технический impl
- **Screen:** `HomeScreen.js` — читает `match.params.keyword` и `match.params.pageNumber` из React Router.
- **Component:** `Product.js` — карточка с image, name, Rating, price, ссылкой на `/product/:id`.
- **Component:** `ProductCarousel.js` — показывается только при отсутствии keyword.
- **Component:** `Meta.js` — устанавливает SEO-мета через `react-helmet` (title, description, keywords).
- **Action:** `listProducts(keyword, pageNumber)` — GET `/api/products?keyword=...&pageNumber=...`.
- **Reducer:** `productListReducer` — `{ products, page, pages, loading, error }`.
- **Controller:** `getProducts` — MongoDB `.find({ ...keyword })` с `.limit(10).skip(pageSize * (page-1))`.

### API endpoints
- `GET /api/products?keyword=&pageNumber=1` — public, response: `{ products: [...], page: 1, pages: N }`.

### Edge cases
- Пустой каталог → пустая сетка без ошибки.
- MongoDB недоступна → error попадает в reducer, отображается `<Message variant='danger'>`.
- Очень длинное название товара — переполнение карточки без ограничений (CSS overflow не задан явно).

### Зависимости
- Зависит от: Product model, MongoDB.
- От этой фичи зависят: Search (передаёт keyword в ту же action), Pagination (page/pages из response), Carousel (тот же HomeScreen).

---

## Feature 2: Product Search

### Назначение
Полнотекстовый поиск по названию товара через URL-параметр. Persona: покупатель, знает что ищет.

### User flow
1. Пользователь вводит текст в SearchBox в хедере.
2. Нажимает Enter или кликает «Search».
3. Редирект на `/search/:keyword`.
4. HomeScreen получает keyword из `match.params.keyword`, диспатчит `listProducts(keyword, pageNumber)`.
5. Результаты фильтруются на сервере, карусель скрывается, появляется кнопка «Go Back».
6. Пустой запрос → редирект на `/` (весь каталог).

### Технический impl
- **Component:** `SearchBox.js` — локальный state `keyword`, submit handler с `history.push`.
- **Route:** `/search/:keyword` и `/search/:keyword/page/:pageNumber` в `App.js`.
- **Backend filter:** `getProducts` controller использует MongoDB `$regex` с `$options: 'i'` (case-insensitive):
  ```js
  name: { $regex: req.query.keyword, $options: 'i' }
  ```
- Поиск только по полю `name` — другие поля (brand, category, description) не индексируются.

### API endpoints
- `GET /api/products?keyword=iphone&pageNumber=1` — public.

### Edge cases
- Спецсимволы в запросе (`.`, `*`, `(`) — MongoDB $regex не экранируется, возможна regex-инъекция (известный баг учебного проекта).
- Пробелы в keyword → кодируются URL-safe браузером при history.push.
- Пустой trimmed string → `history.push('/')` без запроса.
- Нет результатов → пустая сетка + пагинация не показывается (pages=1 → `Paginate` ничего не рендерит).

### Зависимости
- Зависит от: Product list, Pagination (поисковая пагинация использует `/search/:keyword/page/:n` URL).
- `Paginate` компонент получает `keyword` prop и строит правильные URL.

---

## Feature 3: Pagination

### Назначение
Постраничная навигация по каталогу (и по admin product list). Сервер возвращает данные только текущей страницы (pageSize=10). Persona: покупатель, листает большой каталог.

### User flow
1. Если товаров > 10, под сеткой появляется компонент Pagination.
2. Клик на номер страницы → URL меняется на `/page/:n` или `/search/:keyword/page/:n`.
3. HomeScreen читает `match.params.pageNumber`, диспатчит новый запрос.

### Технический impl
- **Component:** `Paginate.js` — props: `pages`, `page`, `isAdmin`, `keyword`. Рендерится только если `pages > 1`.
- **URL routing:**
  - Каталог без поиска: `/page/:pageNumber`
  - С поиском: `/search/:keyword/page/:pageNumber`
  - Admin product list: `/admin/productlist/:pageNumber`
- **Backend:** `pageSize = 10`, `.limit(pageSize).skip(pageSize * (page - 1))`.
- **Active page:** `Pagination.Item active={x + 1 === page}` — текущая страница подсвечивается.

### API endpoints
- `GET /api/products?pageNumber=2` — возвращает `{ products, page, pages }`.

### Edge cases
- pageNumber=0 или отрицательный → `Number(req.query.pageNumber) || 1` защищает на сервере.
- pageNumber > pages → MongoDB возвращает пустой массив без ошибки.
- Одна страница → `Paginate` ничего не рендерит (условие `pages > 1`).

### Зависимости
- Зависит от: Product List, Search (синхронизированы через URL).
- Admin Product List использует тот же компонент с `isAdmin=true`.

---

## Feature 4: Product Detail Page

### Назначение
Полная карточка товара: изображение, описание, цена, статус наличия, выбор количества, кнопка «Add to Cart», список отзывов, форма написания отзыва. Persona: покупатель, решает купить ли.

### User flow
1. Клик на товар в каталоге → `/product/:id`.
2. Загружается полная информация о товаре.
3. Справа: цена, статус (In Stock / Out Of Stock).
4. Если In Stock — dropdown выбора qty (от 1 до countInStock).
5. Клик «Add To Cart» → редирект на `/cart/:id?qty=N`.
6. Ниже: список существующих отзывов + форма нового (только для залогиненных).

### Технический impl
- **Screen:** `ProductScreen.js` — state: `qty`, `rating`, `comment`.
- **Component:** `Rating.js` — отображает 5 звёзд через FontAwesome (fa-star, fa-star-half-alt, far fa-star) с шагом 0.5.
- **Component:** `Meta.js` — динамический title `product.name` через Helmet.
- **Action:** `listProductDetails(id)` — GET `/api/products/:id`.
- **Reducer:** `productDetailsReducer` — `{ product, loading, error }`.
- **Qty selector:** `[...Array(product.countInStock).keys()].map(x => x+1)` — генерирует options от 1 до countInStock.
- `addToCartHandler` → `history.push('/cart/:id?qty=N')` (не диспатчит action напрямую, делегирует CartScreen).

### API endpoints
- `GET /api/products/:id` — public, response: полный product object включая `reviews[]`.

### Edge cases
- `countInStock === 0` → кнопка «Add To Cart» disabled, qty selector скрыт.
- Товар не найден (невалидный ID) → HTTP 404, `<Message variant='danger'>Product not found</Message>`.
- Невалидный MongoDB ObjectId → Mongoose бросает CastError → errorMiddleware возвращает HTTP 500 без специальной обработки (учебный баг).
- `product.reviews.length === 0` → `<Message>No Reviews</Message>`.
- После сабмита review: `setRating(0)` + `setComment('')` сбрасывают форму; `PRODUCT_CREATE_REVIEW_RESET` диспатчится при следующем открытии страницы.

### Зависимости
- Зависит от: Product model, Rating component.
- От этой фичи зависят: Cart (получает productId + qty через URL), Reviews (встроены в этот же экран).

---

## Feature 5: Top Rated Products Carousel

### Назначение
Визуальный слайдер топ-3 товаров по рейтингу на главной странице. Показывается только без активного поиска. Persona: посетитель, нужен быстрый путь к популярным товарам.

### User flow
1. При загрузке HomeScreen без keyword — рендерится `ProductCarousel`.
2. Компонент самостоятельно диспатчит `listTopProducts()`.
3. Слайдер с тремя товарами, pause on hover.
4. Клик на изображение → переход на `/product/:id`.
5. Caption содержит name + price.

### Технический impl
- **Component:** `ProductCarousel.js` — использует React Bootstrap `Carousel`.
- **Action:** `listTopProducts()` — GET `/api/products/top`.
- **Reducer:** `productTopRatedReducer` — `{ products, loading, error }`.
- **Controller:** `getTopProducts` — `Product.find({}).sort({ rating: -1 }).limit(3)`.
- **Важный порядок роутов:** `router.get('/top', getTopProducts)` должен стоять **до** `router.route('/:id')` в `productRoutes.js`, иначе Express матчит `/top` как `:id`.

### API endpoints
- `GET /api/products/top` — public, response: массив из 3 product objects.

### Edge cases
- Меньше 3 товаров → возвращаются все доступные (`.limit(3)` не кидает ошибку).
- Все товары с rating=0 → возвращаются первые 3 в порядке вставки.
- Нет товаров → пустой массив, Carousel с пустым телом (нет items).

### Зависимости
- Зависит от: Product model, Rating field на товарах.
- Рейтинг обновляется при добавлении/изменении отзывов.

---

## Feature 6: Product Rating Display

### Назначение
Визуальное отображение среднего рейтинга звёздами (1-5, с шагом 0.5) и количеством отзывов. Используется в карточках каталога и на детальной странице. Persona: любой посетитель.

### Технический impl
- **Component:** `Rating.js` — props: `value` (число), `text` (строка), `color` (default `#f8e825`).
- Логика отображения звезды: `value >= N` → полная, `value >= N-0.5` → половинная, иначе → пустая.
- Всего 5 span-элементов, каждый независимо вычисляет свой класс.
- Используется в: `Product.js` (card), `ProductScreen.js` (детальная страница + каждый review).

### Edge cases
- `value=0` → все звёзды пустые (far fa-star).
- `value=5` → все полные.
- `value=2.7` → 2 полных + 1 половинная + 2 пустых.
- `text` prop необязателен — если не передан, span не рендерится (`{text && text}`).

### Зависимости
- Зависит от: FontAwesome CSS (подключён глобально).
- Рейтинг хранится в Product model как `rating` (среднее) + `numReviews` (счётчик).

---

## Feature 7: Product Reviews — Read

### Назначение
Отображение списка отзывов покупателей на детальной странице товара. Каждый отзыв содержит имя автора, звёздный рейтинг, дату и текст комментария. Persona: покупатель, изучает мнения.

### Технический impl
- **Screen:** `ProductScreen.js` — секция `<h2>Reviews</h2>`.
- Данные приходят в составе product object (`product.reviews[]`).
- Каждый review: `{ _id, name, rating, comment, createdAt }`.
- Дата: `review.createdAt.substring(0, 10)` — формат YYYY-MM-DD.
- **Model:** reviewSchema в `productModel.js` — embedded subdocument в массиве `reviews`.

### API endpoints
- `GET /api/products/:id` — отзывы встроены в product object.

### Edge cases
- Пустой массив reviews → `<Message>No Reviews</Message>`.
- Очень длинный comment — не ограничен на фронте и в Schema.
- Дата `createdAt` — MongoDB timestamp, всегда присутствует.

### Зависимости
- Зависит от: Product Detail (reviews embedded), Write Review Feature.

---

## Feature 8: Product Reviews — Write

### Назначение
Форма написания отзыва на детальной странице товара. Только для залогиненных пользователей. Один пользователь — один отзыв на товар. Persona: покупатель, купивший и протестировавший товар.

### User flow
1. Залогиненный пользователь видит форму под списком отзывов.
2. Выбирает рейтинг из dropdown (1 Poor / 2 Fair / 3 Good / 4 Very Good / 5 Excellent).
3. Вводит текст комментария.
4. Кликает «Submit».
5. При успехе — сообщение `"Review submitted successfully"`, форма сбрасывается.
6. Незалогиненный видит: `Please sign in to write a review`.

### Технический impl
- **Action:** `createProductReview(productId, { rating, comment })` — POST `/api/products/:id/reviews`.
- **Reducer:** `productReviewCreateReducer` — `{ loading, error, success }`.
- **Controller:** `createProductReview` — проверяет `alreadyReviewed` (поиск по user._id в reviews), создаёт review object, пересчитывает `product.rating` и `product.numReviews`.
- **Пересчёт рейтинга:**
  ```js
  product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length
  ```
- **`PRODUCT_CREATE_REVIEW_RESET`** диспатчится в `useEffect` при смене productId — сбрасывает success/error.

### API endpoints
- `POST /api/products/:id/reviews` — private (require token), body: `{ rating, comment }`, response HTTP 201 `{ message: 'Review added' }`.

### Edge cases
- Пользователь уже оставлял отзыв → HTTP 400 `"Product already reviewed"`.
- `rating=0` (не выбран из dropdown) — Select по умолчанию имеет value='', что приходит как строка '' → `Number('')=0` → невалидный отзыв без явной валидации.
- Незалогиненный → кнопка Submit вообще не рендерится (блок показывается по `userInfo ?`).

### Зависимости
- Зависит от: Auth (userInfo), Product Detail (productId из match.params.id).
- После сабмита рейтинг товара обновляется на сервере, но `useEffect` делает re-fetch (`successProductReview` → `listProductDetails`).

---

## Feature 9: SEO Meta Tags

### Назначение
Динамические мета-теги для поисковых систем через `react-helmet`. На главной — дефолтные значения, на детальной странице — название товара как title. Persona: поисковые роботы, маркетолог.

### Технический impl
- **Component:** `Meta.js` — оборачивает `<Helmet>` с title, description, keywords.
- Defaults: `title='Welcome To ProShop'`, `description='We sell the best products for cheap'`, `keywords='electronics, buy electronics, cheap electroincs'`.
- В `ProductScreen.js`: `<Meta title={product.name} />` — переопределяет только title.
- В `HomeScreen.js`: `<Meta />` — использует все defaults.

### Edge cases
- SSR не настроен — Helmet работает только на клиенте; краулеры без JS-рендеринга получат дефолтный HTML title.
- Опечатка в keywords: `"electroincs"` (учебный артефакт).

### Зависимости
- Зависит от: `react-helmet` npm package.
