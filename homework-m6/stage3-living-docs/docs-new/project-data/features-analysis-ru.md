> **TODO(audit-2026-05-29):** The M4 Figma/Tailwind redesign referenced as 'planned' has already shipped (Tailwind v4 + shadcn). Treat roadmap notes as partly historical.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# Анализ feature flags ProShop MERN — навигация по M3 → M7

> Этот документ — спутник к `features.json` и `feature-flags-spec.md`. Здесь нет нового контракта MCP; здесь — карта 25 фичей с трудозатратами, ролью в курсе и кандидатами на прототипирование в M4. Использовать как шпаргалку при выборе домашек и при объяснении Часть 1 М3.

---

## TL;DR

- **`features.json` оставляем как есть — все 25 фичей.** Разнообразие статусов, стратегий, зависимостей и сегментов нужно, чтобы MCP-сервер из Части 1 M3 валидировался на реальных кейсах. Урезание до 1 фичи обедняет тестовый материал.
- **Якорная фича курса (M3 → M7): `multi_step_checkout_v2`.** Код базы уже есть (`frontend/src/components/CheckoutSteps.js`), стратегия `ab_test`, трафик 20% — идеальная сцена под весь сквозной сценарий: M3 (MCP флипает флаг), M4 (UI-дашборд + Figma-редизайн), M5 (n8n-агент управляет раскаткой), M6/M7 (Sentry ловит конверсионные регрессии).
- **На M4 Figma-прототип** — топ-4 кандидата: `multi_step_checkout_v2`, `cart_redesign`, `admin_dashboard_v2`, `dark_mode`. У них самый богатый UI-простор и наименьшая зависимость от бэка.
- **Аномалии в данных** (4 шт.) и **рассинхроны «флаг включён, кода нет»** (4 шт.) — это не баги датасета, а реалистичные учебные артефакты. Используем их в M4–M6 как повод поговорить про дисциплину flag hygiene.

---

## 1. Что считать «обязательной» фичей для М3 практика 1

**`multi_step_checkout_v2`.** Это та фича, которую студенты обязаны сохранить в `features.json` и на которой будет демонстрационный прогон MCP-сервера в Части 1.

Почему именно она:

| Критерий | `multi_step_checkout_v2` | Альтернативы |
|---|---|---|
| Код в репо уже есть | ✅ `CheckoutSteps.js` 4-шаговый чекаут готов | `dark_mode` — нет; `cart_redesign` — частично |
| Видимый UX-импакт | ✅ 4 экрана: shipping → payment → review → place | `recently_viewed` — узкая полка |
| Естественный A/B (стратегия `ab_test`) | ✅ 50/50 split на конверсию | `search_v2` — канарейка, не A/B |
| Конверсионная метрика для Sentry M6/M7 | ✅ checkout error rate, drop-off per step | `image_lazy_loading` — невидимая |
| Сценарий «n8n агент крутит % трафика» в M5 | ✅ 0 → 20 → 50 → 100 пошагово | `paypal_express_buttons` — уже 100% |
| Богатый Figma-материал для M4 | ✅ stepper, прогресс-индикатор, инлайн-валидация | большинство мелких фичей не дают |

**Замена в тестовом сценарии Части 1.** Текущий `homework-spec.md` использует `search_v2` в примере промпта — для целей MCP-теста это работает, но `search_v2` плохо ложится на наш бэкенд (нужен MongoDB text index или внешний поисковик; см. таблицу). Рекомендую в демо на занятии вместо `search_v2` показывать `multi_step_checkout_v2` — это та же механика «проверь / переведи / задай трафик», но с фичей, которая поедет в M4–M7.

---

## 2. Глоссарий стратегий раскатки

В `rollout_strategy` три значения. Они НЕ синонимы статуса — это про *как* выкатывают, а не про *включено ли*.

| `rollout_strategy` | По-русски | Что значит | Когда выбирают |
|---|---|---|---|
| `canary` | Канареечная раскатка | Включают на маленькой группе (5–25%), смотрят метрики, расширяют по шагам: 5 → 25 → 50 → 100. Если что-то ломается — мгновенный откат флипом флага, без редеплоя. Аналогия: «канарейка в шахте» — сначала пускают одного, чтобы проверить воздух. | Рискованные изменения: новая логика поиска, новый платёжный провайдер, перформанс-фичи. |
| `ab_test` | A/B-тест | Трафик делится на две группы (часто 50/50), обе группы видят разные версии, сравниваются метрики (конверсия, AOV, time-on-page). Победитель уезжает в `Enabled`, проигравший — в `Disabled`. | Гипотезы про UX: одностраничная корзина vs двухколоночная, степпер vs линейный чекаут, тёмная тема. |
| `full_release` | Полный релиз | Бинарный выключатель: либо включено для всех (100%), либо выключено. Без промежуточных %. Используется для функций, где a/b-тест бессмысленен или раскатка не несёт риска. | Бэйджи, мелкие UI-улучшения, lazy-loading, опциональные поля типа «подарочное сообщение». |

**Важно:** `traffic_percentage` имеет разный смысл при разных стратегиях:
- `canary` — % реальных юзеров, видящих фичу.
- `ab_test` — % юзеров в variant B (остальные в A).
- `full_release` — формально либо 0, либо 100; промежуточные значения — аномалия (см. §4).

---

## 3. Полная таблица 25 фичей

**Колонки:**
- **#** — номер
- **Ключ / Название** — `feature_id` и человекочитаемое имя
- **Статус / %** — `status` + `traffic_percentage`
- **Сегменты** — `targeted_segments`
- **Стратегия** — `rollout_strategy` (русский глоссарий выше)
- **Обновлено** — `last_modified`
- **Зависит от** — `dependencies`
- **Код в репо** — что уже реализовано в `proshop_mern` на момент M3
- **Сложность 1–10** — оценка трудозатрат + токенов AI на полную реализацию (рубрика в конце таблицы)
- **Приоритет** — Must (обязательная якорь) / Core (рекомендуем демонстрировать) / Nice-to-have (опционально для энтузиастов) / Skip (плохо ложится на наш стек)
- **M4 Figma** — кандидат на UI-прототипирование в M4: ⭐⭐⭐ топ / ⭐⭐ хороший / ⭐ слабый / ❌ нет смысла

| # | Ключ / Название | Статус / % | Сегменты | Стратегия | Обновлено | Зависит от | Код в репо | Сложность | Приоритет | M4 Figma |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `search_v2` — Новый алгоритм поиска | 🧪 Testing / 15% | beta_users, internal | Канарейка | 2026-03-10 | — | ⚠️ Сомнительно — `getProducts` использует только `$regex` по `name`. Нужен MongoDB text index или внешний поисковик. | 8 | Skip | ❌ |
| 2 | `semantic_search` — Семантический векторный поиск | 🔴 Disabled / 0% | internal | Канарейка | 2026-02-14 | `search_v2` | 🚫 Заблокирован зависимостью + нет ML-инфраструктуры (vector store, embeddings). | 10 | Skip | ❌ |
| 3 | `search_autosuggest` — Автодополнение в поиске | 🧪 Testing / 25% | all | Канарейка | 2026-03-22 | — | 🟡 С нуля. `SearchBox.js` без dropdown, эндпоинт `/api/products/suggest` отсутствует. | 5 | Core | ⭐⭐ |
| 4 | `cart_redesign` — Редизайн корзины | 🧪 Testing / 10% | beta_users | A/B | 2026-04-01 | — | 🟢 База есть. `CartScreen.js` готов, переработка над живым кодом. | 4 | Core | ⭐⭐⭐ |
| 5 | `save_for_later` — Отложить на потом | 🔴 Disabled / 0% | authenticated | Канарейка | 2026-02-28 | `cart_redesign` | 🟡 С нуля. `userModel` не расширен, нет экшена/UI. | 5 | Nice-to-have | ⭐⭐ |
| 6 | `guest_cart_persistence` — Корзина гостя между сессиями | 🟢 Enabled / 100% | guests | Полный релиз | 2026-01-15 | — | 🟢 База есть. localStorage уже подключён в `store.js`. | 2 | Core | ⭐ |
| 7 | `express_checkout` — Чекаут в один клик | 🔴 Disabled / 0% | returning_customers | Канарейка | 2026-03-05 | `guest_cart_persistence` | 🟡 С нуля. Есть только последовательный 4-шаговый чекаут. | 6 | Nice-to-have | ⭐⭐ |
| 8 | **`multi_step_checkout_v2` — Редизайн многошагового чекаута** | 🧪 Testing / 20% | all | A/B | 2026-04-10 | — | 🟢 База есть. `CheckoutSteps.js` 4-шаговый уже реализован. | 3 | **Must (якорь курса)** | ⭐⭐⭐ |
| 9 | `gift_message` — Сообщение-подарок на чекауте | 🔴 Disabled / 0% | all | Полный релиз | 2026-02-20 | — | 🟡 С нуля. Поля `giftMessage` нет в `orderModel.js`, нет UI. | 3 | Nice-to-have | ⭐ |
| 10 | `paypal_express_buttons` — PayPal Smart Buttons | 🟢 Enabled / 100% | all | Полный релиз | 2026-01-08 | — | 🟢 База есть. `react-paypal-button-v2` подключён в `OrderScreen.js`, можно расширить на cart/product. | 2 | Core | ❌ |
| 11 | `apple_pay` — Apple Pay / Web Payments API | 🔴 Disabled / 0% | safari_users, mobile_ios | Канарейка | 2026-03-18 | — | ⚠️ Сомнительно — нет Payment Request API, нужен Apple Developer account + Stripe-бэкенд + верифицированный домен. | 9 | Skip | ❌ |
| 12 | `stripe_alternative` — Stripe как альтернативная оплата | 🧪 Testing / 5% | beta_users | Канарейка | 2026-04-05 | — | 🟡 С нуля. Radio Stripe закомментирован в `PaymentScreen.js`, бэкенд-SDK отсутствует. | 7 | Skip | ⭐ |
| 13 | `product_recommendations` — Рекомендации товаров | 🧪 Testing / 30% | all | A/B | 2026-04-12 | — | 🟡 С нуля. Секции/модели нет; `getTopProducts` для fallback уже есть. | 6 | Core | ⭐⭐ |
| 14 | `recently_viewed` — Недавно просмотренные | 🟢 Enabled / 100% | all | Полный релиз | 2026-02-01 | — | 🟡 С нуля. **Рассинхрон!** Флаг `Enabled`, но кода нет. | 3 | Nice-to-have | ⭐ |
| 15 | `infinite_scroll` — Бесконечный скролл каталога | 🔴 Disabled / 0% | mobile | Канарейка | 2026-03-28 | — | 🟡 С нуля. Сейчас используется `Paginate.js`, IntersectionObserver отсутствует. | 4 | Nice-to-have | ⭐ |
| 16 | `admin_dashboard_v2` — Редизайн админки | 🔴 Disabled / 0% | admin | Канарейка | 2026-04-08 | — | 🟢 База есть. `OrderListScreen.js`, `ProductListScreen.js` — таблицы, готовы к замене. | 7 | Core | ⭐⭐⭐ |
| 17 | `admin_bulk_actions` — Массовые операции в админке | 🔴 Disabled / 0% | admin | Полный релиз | 2026-03-14 | `admin_dashboard_v2` | 🟡 С нуля. Нет роута и чекбоксов. | 5 | Nice-to-have | ⭐ |
| 18 | `admin_advanced_filters` — Продвинутые фильтры в админке | 🧪 Testing / 100% | admin | Полный релиз | 2026-04-15 | — | 🟡 С нуля. **Рассинхрон!** Флаг 100%, фильтров нет. | 5 | Nice-to-have | ⭐ |
| 19 | `reviews_moderation` — Модерация отзывов | 🔴 Disabled / 0% | admin | Полный релиз | 2026-02-10 | — | 🟡 С нуля. `reviewSchema` без поля `status`, очереди нет. | 5 | Nice-to-have | ⭐⭐ |
| 20 | `photo_reviews` — Фото в отзывах | 🔴 Disabled / 0% | authenticated | Канарейка | 2026-03-02 | `reviews_moderation` | 🚫 Заблокирован зависимостью + с нуля (`images` в `reviewSchema` нет). | 6 | Nice-to-have | ⭐⭐ |
| 21 | `verified_purchase_badge` — Бейдж «Verified Purchase» | 🟢 Enabled / 100% | all | Полный релиз | 2026-01-20 | — | 🟡 С нуля. **Рассинхрон!** Флаг `Enabled`, логики нет. | 3 | Nice-to-have | ⭐ |
| 22 | `image_lazy_loading` — Lazy-loading картинок | 🟢 Enabled / 100% | all | Полный релиз | 2026-01-05 | — | 🟡 С нуля. **Рассинхрон!** Флаг `Enabled`, в `Product.js` обычный `<img>` без `loading="lazy"`. | 2 | Nice-to-have | ❌ |
| 23 | `code_splitting_optimisation` — Code splitting по роутам | 🧪 Testing / 50% | all | Канарейка | 2026-04-18 | — | 🟡 С нуля. `App.js` импортирует все экраны напрямую. | 3 | Nice-to-have | ❌ |
| 24 | `dark_mode` — Тёмная тема | 🧪 Testing / 20% | all | A/B | 2026-04-20 | — | 🟡 С нуля. `Header.js` использует `bg='dark'`, но toggle/темизации нет. | 4 | Core | ⭐⭐⭐ |
| 25 | `guest_checkout` — Гостевой чекаут без регистрации | 🔴 Disabled / 0% | guests | Канарейка | 2026-03-25 | — | 🟡 С нуля. `orderModel` требует `user: ref`, гостевой flow не поддерживается. | 6 | Nice-to-have | ⭐ |

### Рубрика сложности 1–10

Учитывает время разработки, объём AI-токенов на reasoning+генерацию, и сторонние зависимости.

| Балл | Что входит | Примеры |
|---|---|---|
| 1–2 | Тривиальная обёртка флага + расширение существующего кода. 1–2 часа. | `image_lazy_loading`, `paypal_express_buttons`, `guest_cart_persistence` |
| 3–4 | Малое UI-добавление / новое поле модели / replacement-компонент. 0.5–1 день. | `cart_redesign`, `multi_step_checkout_v2`, `recently_viewed`, `gift_message`, `dark_mode` |
| 5–6 | Полнофункциональная фича с моделью + UI + reducer. 1–2 дня. | `save_for_later`, `search_autosuggest`, `product_recommendations`, `photo_reviews`, `guest_checkout` |
| 7–8 | Крупный редизайн или интеграция со внешним сервисом без верификации. 3–5 дней. | `admin_dashboard_v2`, `stripe_alternative`, `search_v2` |
| 9–10 | Внешняя инфраструктура: ML stack, payment provider с Apple-верификацией. 1–2 недели + админ-задачи. | `apple_pay`, `semantic_search` |

---

## 4. Анализ аномалий в данных

В тексте `feature-flags-spec.md` бизнес-правила сформулированы строго: `Disabled → traffic = 0`, `traffic > 0 → status ≠ Disabled`. Но в `features.json` есть несколько мест, где правила нарушены или подвешены. Это не баги — это реалистичные учебные артефакты. Покажите их студентам и обсудите, как MCP-валидация должна на них реагировать.

### Аномалии стратегий

| Фича | Что не так | Как трактовать |
|---|---|---|
| `admin_advanced_filters` | `status=Testing` + `traffic=100%` + `strategy=full_release` | Если 100% и `full_release` — должен быть `Enabled`. Похоже, флаг забыли промоутить. |
| `gift_message` | `strategy=full_release` + `status=Disabled` | Стратегия «полный релиз», но фича выключена. Возможно, готовили к запуску и решили отложить. |
| `admin_bulk_actions` | `strategy=full_release` + `status=Disabled` | То же. |
| `reviews_moderation` | `strategy=full_release` + `status=Disabled` | То же. |

### Рассинхроны «флаг включён, кода нет»

Эти фичи отмечены `Enabled / 100%` в `features.json`, но в кодовой базе `proshop_mern` соответствующая логика отсутствует. Это типичная проблема production-систем: конфиг и код расходятся со временем.

| Фича | Состояние флага | Состояние кода |
|---|---|---|
| `recently_viewed` | Enabled / 100% | Нет ни reducer'а, ни UI |
| `verified_purchase_badge` | Enabled / 100% | Нет проверки delivered-order, нет бейджа |
| `image_lazy_loading` | Enabled / 100% | В `Product.js` обычный `<img>` без `loading="lazy"` |
| `admin_advanced_filters` | Testing / 100% | Фильтров в `OrderListScreen` / `ProductListScreen` нет |

**Учебный материал на M5–M6:** «как агент должен ловить такой дрейф». Темы: автоматическая проверка наличия флаговых веток в коде (статанализ или sentry breadcrumbs), регулярная синхронизация конфига с реальностью.

---

## 5. M4 Figma-прототипирование: кандидаты

В M4 будем делать UI-прототип в Figma (или в любом инструменте на выбор). Ниже — отсортированные кандидаты по силе UI-простора и автономности от бэкенда. Топ-уровень — это то, что хорошо взять в домашку M4.

### ⭐⭐⭐ Топ-уровень — сильно рекомендую для M4 домашки

| Фича | Чем хороша для Figma |
|---|---|
| `multi_step_checkout_v2` | Степпер с прогресс-индикатором, анимированные панели, инлайн-валидация адреса. Современный UX-паттерн, много решений для рисования. |
| `cart_redesign` | Однополосный layout, sticky-сайдбар, анимация удаления, инлайн-редактирование количества. Богатый UI и понятная гипотеза «-40% кликов до checkout». |
| `admin_dashboard_v2` | KPI-карточки, графики, фильтры, единый сайдбар. Целая B2B-плоскость, можно показать system thinking. |
| `dark_mode` | Темизация всего приложения. Учит работе с CSS variables, токенами цвета, дизайн-системой. Хорошая практика для thinking-in-tokens. |

### ⭐⭐ Хорошие кандидаты — если хочется поменьше площадь

| Фича | Чем хороша |
|---|---|
| `search_autosuggest` | Дроп-даун с подсказками, сегментация результатов (queries vs products), keyboard navigation. |
| `product_recommendations` | Секция «Customers also bought», карточки, скролл, fallback-состояние. |
| `save_for_later` | Отдельная секция в корзине, переключение между активной и сохранённой. |
| `photo_reviews` | Multi-file upload, превью, lightbox-галерея. |
| `express_checkout` | Дизайн «один клик» с адрес-плашкой и опцией «изменить». |
| `reviews_moderation` | Админ-очередь модерации, статусы, bulk-actions. |

### ⭐ Слабые кандидаты — мелкая UI-площадь

`gift_message`, `guest_checkout`, `admin_bulk_actions`, `admin_advanced_filters`, `recently_viewed`, `infinite_scroll`, `verified_purchase_badge`, `stripe_alternative`.

### ❌ Не для Figma — невидимые / чисто бэкенд

`search_v2`, `semantic_search`, `paypal_express_buttons` (расширение готового), `apple_pay` (нативная кнопка платформы), `image_lazy_loading`, `code_splitting_optimisation`, `guest_cart_persistence` (фактически только баннер).

---

## 6. Резюме рекомендаций

1. **`features.json` оставить как есть, все 25 фичей.** Не схлопывать. Разнообразие — ценность для тестирования MCP в Части 1 M3 и для разговоров про flag hygiene в M5–M6.
2. **На М3 практика 1 фокусируйтесь на `multi_step_checkout_v2`.** Это якорная фича курса. Замените `search_v2` в тестовом промпте Части 1 на неё — будет честнее по отношению к реальному коду.
3. **На M4 (Figma) дайте студентам выбор из 4 топов.** `multi_step_checkout_v2` — обязательный демонстрационный экран Сергея; студенты выбирают из остальных трёх (`cart_redesign`, `admin_dashboard_v2`, `dark_mode`) себе домашку.
4. **На M5 (n8n агент) — сценарий вокруг `multi_step_checkout_v2`:** 0% → 20% → 50% → 100% по триггерам Sentry-метрик.
5. **На M6/M7 (Sentry / observability) — флаги-«рассинхроны».** Покажите 4 кейса (`recently_viewed`, `verified_purchase_badge`, `image_lazy_loading`, `admin_advanced_filters`) как реальную production-проблему. Учебная цель — научить студентов мониторить дрейф «конфиг vs код».
6. **Skip-фичи (`search_v2`, `semantic_search`, `apple_pay`, `stripe_alternative`)** оставить в `features.json`, но в живом проекте их **не реализовывать**. Они нужны как примеры внешних зависимостей, на которых MCP-валидация показывает «эту фичу нельзя включить, пока не выполнены условия».

---

*Версия 1.0. Дата: 2026-04-30. Автор: Сергей Голубев. Файл — спутник к `features.json` и `feature-flags-spec.md`.*
