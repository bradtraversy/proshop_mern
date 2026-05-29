# Design System Implementation Guide
> Minimal Tech v1.0.0 — для AI-агентов и разработчиков

## Файлы дизайн-системы

- [`design-system.json`](./design-system.json) — design tokens (для programmatic-доступа, Tailwind config, скриптов)
- [`design-system.css`](./design-system.css) — готовые CSS-стили с переменными и классами компонентов

Оба файла находятся в этой же папке. Все ссылки — относительные.

---

## Дизайн-философия

Этот дизайн построен на принципе, что великие технические интерфейсы завоёвывают доверие сдержанностью. Щедрый whitespace сигнализирует уверенность: интерфейс, который не борется за внимание, позволяет данным говорить самим за себя.

Глубина создаётся через три уровня фоновых цветов — page (`#0f172a`) → card (`#1e293b`) → card-alt (`#263347`). Никаких box-shadow. Единственный акцент — индиго (`#6366f1`). Шрифт Manrope вместо Inter: избегаем узнаваемый «AI-look». Все отступы — кратны 8px, исключений нет.

Это система для продуктов, которые хотят выглядеть как инструменты, а не как маркетинг. Вдохновение: Linear, Vercel, Stripe Atlas, Raycast.

---

## Что внутри файлов

### design-system.json

Полный дамп всех дизайн-токенов в JSON-формате: `metadata`, `design_philosophy`, `design_principles`, `ux_principles`, `color_system` (включая dark/light mode), `spacing_system`, `typography`, `border_radius`, `transitions`, `states`, `components` (buttons, cards, inputs, badges), `interactive_components` (modals, tabs, dropdowns, tooltips, selects), `animations`. Используй для programmatic-доступа, генерации Tailwind config, или как reference при интерпретации значений.

### design-system.css

Валидный CSS (~800 строк). Структура: `@import` Google Fonts → `:root` токены (типографика, spacing, radius, transitions) → `:root` цвета (dark mode) → light mode override → base reset → typography classes → components (`.btn`, `.card`, `.input`, `.select`, `.badge`) → interactive components (`.tabs`, `.modal`, `.dropdown`, `.tooltip`) → states (`.skeleton`, `.spinner`, `.empty-state`) → layout utilities → animations → accessibility + `prefers-reduced-motion`. Можно импортировать напрямую или использовать как reference.

---

## Implementation Guide

1. **Понимание дизайн-философии.** Прочитай секцию выше прежде чем генерировать UI. Каждое решение должно отражать три принципа: restraint, depth-from-contrast, semantic tokens. Не генерируй элементы, которые нарушают философию — даже если просят «сделать красиво».

2. **Используй файлы как референсы, не как готовый код.** Адаптируй под фреймворк проекта — Tailwind / styled-components / vanilla CSS / shadcn/ui. Не копируй CSS-классы как есть в React-компоненты. Извлекай значения переменных и применяй в нужном синтаксисе.

3. **Только CSS-переменные, никаких hardcode hex.** Все цвета — через `var(--color-*)`. Все отступы — через `var(--space-*)`. Правило без исключений. Причина: один токен можно изменить в `:root` и изменение распространится на весь интерфейс.

4. **Все четыре state обязательны.** Каждый интерактивный элемент должен иметь: `hover` (цветовой сдвиг + лёгкая трансформация), `focus` (outline 2px var(--color-ring), offset 2px), `loading` (skeleton или spinner + opacity 0.7 + cursor not-allowed), `empty` (иконка 48px + title + description + опциональный CTA). Это не опционально — это baseline качества.

5. **Глубина через background, не через тени.** Если нужна иерархия элементов — используй три уровня фона: `--color-bg` → `--color-card` → `--color-card-alt`. Никакого `box-shadow`. Единственное исключение — focus ring (`box-shadow: 0 0 0 2px var(--color-ring-alpha)`).

6. **Типографическая иерархия через размер и вес, не через цвет.** Primary text: `--color-fg`. Secondary: `--color-fg-secondary`. Muted: `--color-fg-muted`. Использовать `--color-primary` для текста — только для ссылок и акцентных элементов.

7. **8px grid строго.** Любые padding, margin, gap — только из `--space-*` токенов. Нет 6px, нет 12px, нет 20px. Если дизайн требует другое значение — округли к ближайшему кратному 8.

---

## Готовый промпт для AI-агента

Вставь этот промпт в начало любой задачи по генерации UI — в Cursor, Claude Code, Bolt, Lovable или любой другой инструмент. Заменяй `[COMPONENT]` на конкретный компонент.

---

```
You are implementing UI components for a Minimal Tech design system.

DESIGN PHILOSOPHY:
Technical clarity over visual flair. Depth from background contrast, never from
box-shadow. Three elevation levels: page (#0f172a) → card (#1e293b) → card-alt (#263347).
Single accent color: indigo (#6366f1). Font: Manrope (not Inter). 8px spacing grid,
no exceptions. Generous whitespace signals quality.

ALWAYS USE CSS VARIABLES — never hardcode hex values:
- Colors: var(--color-bg), var(--color-card), var(--color-fg), var(--color-primary), etc.
- Spacing: var(--space-1) = 8px, var(--space-2) = 16px, var(--space-3) = 24px, etc.
- Radius: var(--radius-md) = 8px, var(--radius-lg) = 12px
- Transitions: var(--transition-fast) = 150ms ease

MANDATORY STATES — every interactive element must have:
- hover: color shift + transform scale(1.01) for buttons
- focus: outline 2px solid var(--color-ring), outline-offset 2px
- loading: opacity 0.7, cursor not-allowed, spinner or skeleton
- empty: 48px icon (muted) + title (fg-secondary) + description (fg-muted) + optional CTA

FORBIDDEN:
- box-shadow (except focus ring)
- Inter font
- Hardcoded hex values
- Gradients (except skeleton animation)
- Generic AI look (cramped layouts, heavy borders, random animations)

REFERENCE FILES in the same directory:
- design-system.json — all token values in structured JSON
- design-system.css — ready CSS classes to reference

Now implement: [COMPONENT]

Requirements:
- Dark mode first (light mode via [data-theme="light"])
- shadcn/ui + Tailwind CSS 4 with CSS variables
- Accessible: ARIA labels, keyboard navigation, color contrast ≥ 4.5:1
- All four states (hover, focus, loading, empty)
```

---

## Идея паттерна

Ключевая идея ZIP-package: дизайн-система как версионируемая структура данных, экспортируемая в три формата (JSON + CSS + MD) и упакованная вместе для AI-агента. Файлы при этом — в первую очередь референсы, по которым модель должна работать, а не готовый production-код. Но как референс они должны быть достаточно полными, чтобы агенту не пришлось додумывать.
