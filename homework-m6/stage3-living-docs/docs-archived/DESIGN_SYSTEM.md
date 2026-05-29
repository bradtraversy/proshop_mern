# DESIGN_SYSTEM.md

> Design system: [название / название эстетики]
> Format: shadcn/ui + Tailwind CSS 4 + CSS variables
> Last updated: [YYYY-MM-DD]

---

## Как пользоваться этим шаблоном

Заполни каждую секцию конкретными значениями для своего проекта.
Не оставляй плейсхолдеры в готовом файле — AI-агент воспринимает `[...]` буквально.
После заполнения помести файл в корень репо рядом с `CLAUDE.md` и добавь
в `CLAUDE.md` ссылку: `## Design rules: see ./DESIGN_SYSTEM.md`.

Для быстрого старта — извлеки значения из скриншота референса через промпт:
`../prompts/reverse-design-extract.md`

---

## 1. Color Palette

<!-- Семантические роли обязательны. AI работает с именами переменных, а не hex.
     Заполни оба столбца (light + dark) или укажи "dark only / light only".
     Пример hex: #0f172a. Пример oklch (Tailwind 4): oklch(0.12 0.02 250). -->

Semantic roles (используй эти имена в коде, не сырой hex):

| Role             | Light mode              | Dark mode               | Hex / OKLCH           |
|------------------|-------------------------|-------------------------|-----------------------|
| `--background`   | [описание роли]         | [описание роли]         | `[укажи hex / oklch]` |
| `--foreground`   | [primary text]          | [primary text]          | `[укажи hex / oklch]` |
| `--card`         | [card surface]          | [card surface]          | `[укажи hex / oklch]` |
| `--card-alt`     | [elevated card]         | [elevated card]         | `[укажи hex / oklch]` |
| `--primary`      | [primary action color]  | [primary action color]  | `[укажи hex / oklch]` |
| `--primary-fg`   | [text on primary bg]    | [text on primary bg]    | `[укажи hex / oklch]` |
| `--muted`        | [muted text, hints]     | [muted text, hints]     | `[укажи hex / oklch]` |
| `--accent`       | [accent / highlight]    | [accent / highlight]    | `[укажи hex / oklch]` |
| `--destructive`  | [error, danger]         | [error, danger]         | `[укажи hex / oklch]` |
| `--border`       | [borders, dividers]     | [borders, dividers]     | `[укажи hex / oklch]` |
| `--ring`         | [focus ring]            | [focus ring]            | `[укажи hex / oklch]` |

Dark mode strategy: [CSS variables only / prefers-color-scheme / .dark class]
<!-- Рекомендация: НЕ использовать `dark:bg-gray-900` хардкодом.
     Все цвета — через CSS-переменные, переключаются на :root и .dark. -->

---

## 2. Typography

<!-- Выбери шрифт, отличный от Inter — Inter перегружен до невидимости.
     Хорошие альтернативы для tech: Manrope, Geist, Space Grotesk.
     Для luxury/editorial: Playfair Display, Fraunces, Cormorant. -->

Font family: **[выбери font — НЕ Inter]**
Fallback: `[system-ui / -apple-system / sans-serif]`
Import: `[URL Google Fonts или @font-face]`

Mono font: **[JetBrains Mono / IBM Plex Mono / Fira Code]** — для кода и данных

Scale:

| Step    | Size    | Line-height | Letter-spacing  | Weight | Usage                 |
|---------|---------|-------------|-----------------|--------|-----------------------|
| Display | [px]    | [1.0–1.2]   | [-0.03em]       | [700]  | Hero headline         |
| H1      | [px]    | [1.1–1.2]   | [-0.02em]       | [700]  | Page title            |
| H2      | [px]    | [1.2–1.3]   | [-0.015em]      | [600]  | Section header        |
| H3      | [px]    | [1.3–1.4]   | [-0.01em]       | [600]  | Card header           |
| H4      | [px]    | [1.35–1.4]  | [-0.005em]      | [600]  | Subhead               |
| Body    | [16px]  | [1.5–1.7]   | [0]             | [400]  | Main content          |
| Small   | [14px]  | [1.4–1.5]   | [0]             | [400]  | Secondary text        |
| Caption | [12px]  | [1.3–1.4]   | [0.01em]        | [500]  | Labels, metadata      |
| Mono    | [14px]  | [1.6]       | [0]             | [400]  | Code, data            |

---

## 3. Spacing Scale

<!-- Используй кратные 8px. Запрети произвольные значения (14px, 22px, 18px).
     Tailwind config: spacing: { 1: '4px', 2: '8px', 3: '16px', ... } -->

Strict multiples of 8px only. No arbitrary values.

```
4px  — micro (icon + label gap)
8px  — xs  (tight padding)
16px — sm  (component inner padding)
24px — md  (card padding, section gaps)
32px — lg  (section padding)
48px — xl  (between major sections)
64px — 2xl (page-level spacing)
96px — 3xl (hero sections)
```

<!-- Если проект luxury/editorial — сдвинь шкалу вверх: 24 / 48 / 72 / 96 -->

---

## 4. Border Radius Scale

<!-- Укажи конкретные значения px для каждого уровня.
     Пример minimal-tech: sm=4px, md=8px, lg=12px.
     Пример luxury: sm=8px, md=16px, lg=24px, full=9999px. -->

```
none: 0px      — [таблицы, data grids, жёсткий brutalist стиль]
sm:   [px]     — [badges, chips, code blocks]
md:   [px]     — [buttons, inputs (default)]
lg:   [px]     — [cards (default)]
xl:   [px]     — [modals, popovers, bottom sheets]
full: 9999px   — [pills, avatars, toggle switches]
```

---

## 5. Elevation / Shadow Approach

<!-- Выбери одну из двух стратегий:
     А) NO shadows — глубина через контраст фонов (рекомендация для dark/tech).
     Б) Subtle shadows — для light/luxury тем (soft box-shadow, не shadow-lg рефлекторно).
     НИКОГДА не используй shadow-lg везде без причины. -->

**Philosophy:** [NO box shadows — depth from background contrast / subtle layered shadows]

<!-- Если выбрал вариант А (no shadows): -->
3-level elevation system:
- **Level 0 (page):** `--background` (`[hex]`)
- **Level 1 (card):** `--card` (`[hex]`) — subtle lift via background color
- **Level 2 (card-alt / modal):** `--card-alt` (`[hex]`) — floating elements

<!-- Если нужны тени для исключений (dropdowns, tooltips): -->
```css
--shadow-sm: [значение];
--shadow-md: [значение];
```

---

## 6. Component Patterns

<!-- Опиши каждый тип компонента один раз.
     AI применит эти паттерны везде, не выдумывая на ходу. -->

### Cards
```
Background:    var(--card)
Padding:       [px] (из spacing scale)
Border radius: [px] (из radius scale)
Border:        [1px solid var(--border) / none]
Hover:         [border-color → var(--primary), transition 150ms ease / subtle bg shift]
```

### Buttons
```
Primary:   bg var(--primary), text var(--primary-fg), radius [px], px-[val] py-[val]
           Hover: [scale(1.02) + brightness / bg shift], transition 150ms
Secondary: bg transparent, border 1px var(--border), text var(--foreground)
           Hover: bg var(--card), transition 150ms
Danger:    bg var(--destructive), text white
Ghost:     bg transparent, no border, text var(--muted)
           Hover: text var(--foreground), bg var(--card)
Disabled:  opacity 0.4, cursor not-allowed
```

### Inputs
```
Background:    var(--background)
Border:        [1px solid var(--border) / underline only]
Border radius: [px]
Padding:       [px]
Focus:         border-color var(--ring), box-shadow 0 0 0 2px var(--ring)/20%
Placeholder:   var(--muted)
```

### Badges / Chips
```
Padding:       2px 8px
Border radius: 9999px (full)
Font:          12px, weight 500
Background:    var(--primary)/15%, text var(--primary)
```

<!-- Добавь другие компоненты, специфичные для проекта: modals, tabs, tables, toasts -->

---

## 7. Interactive States

<!-- Это критично. AI не описывает states сам, если их нет в DESIGN_SYSTEM.md.
     Результат без этого раздела — приложение-заготовка без hover/focus/loading. -->

**EVERY interactive element MUST have ALL of these states defined:**

| Element  | Default | Hover                   | Focus                     | Active        | Loading                 | Empty / Disabled        |
|----------|---------|-------------------------|---------------------------|---------------|-------------------------|-------------------------|
| Button   | normal  | [scale / bg shift]      | ring 2px var(--ring)      | scale(0.98)   | spinner + opacity .7    | opacity .4, no-ptr      |
| Input    | normal  | [border brighter]       | ring 2px, border primary  | —             | —                       | bg muted, read-only     |
| Card     | normal  | [border / bg shift]     | outline ring              | —             | skeleton shimmer        | empty state + CTA       |
| Link     | normal  | underline               | outline ring              | color primary | —                       | —                       |

Empty states: every list/table/feed MUST have a designed empty state (icon + message + optional CTA).
Loading states: use skeleton shimmer, NOT spinner unless action-triggered.

---

## 8. Animation / Transitions

<!-- Каждая анимация должна объяснять состояние, а не украшать.
     Запрети random animations и aggressive transitions > 300ms. -->

Philosophy: purposeful, not decorative.

```
Base transition: [150ms ease / 200ms ease-out]
Hover effects:   [scale(1.02) + brightness / subtle bg / underline]
Fade in:         opacity 0 → 1, 200ms ease-out (page elements, modals)
Slide up:        translateY(8px) → 0, 200ms ease-out (toasts, drawers)
Skeleton:        shimmer [1.5s] infinite linear (loading states)
Sequence:        stagger [50ms] between list items
```

NEVER: random animations, decorative parallax, transitions > 300ms.

```css
/* Обязательно — уважай reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; }
}
```

---

## 9. Accessibility

<!-- Этот раздел обязателен. AI пропускает a11y без явного указания. -->

Contrast requirements:
- Body text on background: ≥ 4.5:1 (WCAG AA)
- Large text (18px+ / 14px+ bold): ≥ 3:1
- UI components, graphical objects: ≥ 3:1
- Проверяй: https://webaim.org/resources/contrastchecker/

Keyboard navigation:
- ALL interactive elements reachable via Tab
- Focus ring visible: 2px solid var(--ring), offset 2px
- Skip-to-content link as first element in `<body>`

ARIA:
- Icons, conveying meaning: `aria-label` or `aria-labelledby`
- Decorative icons: `aria-hidden="true"`
- Form inputs: `<label>` or `aria-label`
- Dynamic content: `aria-live="polite"` or `"assertive"`
- Modals: `role="dialog"`, `aria-modal="true"`, focus trap

Touch targets: minimum 44×44px on mobile.

---

## 10. Format Declaration

<!-- Укажи стек. AI использует эту информацию для генерации правильного кода. -->

```
Component library: shadcn/ui (copy-paste, owned by the project)
CSS framework:     Tailwind CSS 4 (CSS variables, NOT Tailwind v3 patterns)
Token system:      CSS custom properties on :root and .dark
Icon set:          [Lucide Icons / Heroicons / Phosphor]
```

CSS variables setup in `src/globals.css`:
```css
:root {
  --background:   [R G B as space-separated values for Tailwind];
  --foreground:   [R G B];
  --card:         [R G B];
  --primary:      [R G B];
  --primary-fg:   [R G B];
  --muted:        [R G B];
  --accent:       [R G B];
  --destructive:  [R G B];
  --border:       [R G B];
  --ring:         [R G B];
}

.dark {
  --background:   [R G B];
  --foreground:   [R G B];
  --card:         [R G B];
  --primary:      [R G B];
  --muted:        [R G B];
  --border:       [R G B];
}
```

---

<!-- Финальная инструкция для AI-агента (оставь в заполненном файле): -->

> Be a human designer so it doesn't look like AI. With design taste.
