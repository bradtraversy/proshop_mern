# Anti-AI-slop Supplement к DESIGN.md

> Дополнительный набор правил, которые НЕ закрываются стандартным `DESIGN.md`
> (даже хорошо заполненным). Эти правила нужно либо встроить в свой `DESIGN.md`
> отдельной секцией, либо положить рядом и сослаться из `CLAUDE.md` /
> `AGENTS.md` / `.cursor/rules`.
>
> Источник 12-ти признаков: cheatsheet `cheatsheets/12-signs-of-ai-look.md`.
> Источник шаблона DESIGN_SYSTEM.md: `templates/DESIGN_SYSTEM.md`.

---

## Зачем этот файл

`DESIGN.md` хорош тем, что задаёт **визуальный язык**: цвета, шрифты, отступы,
радиусы, состояния. Из 12-ти признаков AI-slop примерно половина закрывается
сама, если ты честно заполнил DESIGN.md.

Но часть признаков лежит в другой плоскости:

- **Композиционные anti-patterns** (2-колоночные сравнения, generic shadcn-сетки) — это про layout, а не про токены.
- **Явные запреты** (gradients, default fonts, blue-600 как accent) — DESIGN.md задаёт что выбрать, но не всегда явно запрещает дефолты.
- **UX-принципы** (CTA-приоритеты, user journey first) — это вообще не про дизайн-систему, это про продуктовое мышление.

Этот файл — **минимальный пакет дополнительных guard-rails**, который AI читает
параллельно с DESIGN.md и который реально предотвращает «AI-look».

---

## Часть 1 — Что покрывает DESIGN.md (не дублируй)

| # | Признак AI-slop | Покрытие | Где в DESIGN.md |
|---|-----------------|----------|-----------------|
| 3 | Inter везде | ✅ полное | Section 2 «Typography» — требует выбрать НЕ-Inter, перечисляет альтернативы |
| 6 | shadow-lg рефлекторно | ✅ полное | Section 5 «Elevation» — NO box-shadows, depth from background contrast |
| 7 | dark:bg-gray-900 как dark mode | ✅ полное | Section 1 «Color Palette» — dark mode через CSS variables на `:root` / `.dark` |
| 8 | Случайные анимации | ✅ полное | Section 8 «Animation» — purposeful only, prefers-reduced-motion |
| 10 | AI забывает hover/focus/loading/empty | ✅ полное | Section 7 «Interactive States» — таблица всех states обязательна |
| 12 | text-blue-600 как accent | ✅ полное | Section 1 + Section 10 «Format Declaration» — semantic tokens (`--accent`, `--primary`), CSS variables, never hardcode |

Эти 6 пунктов **не нужно** дублировать в supplement — DESIGN.md сам с ними
справляется при честном заполнении.

---

## Часть 2 — Что DESIGN.md закрывает частично

| # | Признак | Что покрыто | Что НЕ покрыто |
|---|---------|-------------|----------------|
| 4 | Cramped layouts | ✅ 8px grid в Section 3 «Spacing Scale» | ❌ Verbal-правило «generous spacing» — какие именно отступы между секциями (32px? 64px? 96px?) |
| 5 | Heavy borders | ✅ Component patterns у Cards упоминают `1px solid var(--border) / none` | ❌ Явного запрета на border 2px+ нет — AI всё равно может вставить тяжёлую границу |

Для этих двух — **добавь по одной строке guard-rail** ниже (см. Часть 4).

---

## Часть 3 — Что DESIGN.md НЕ покрывает (закрывай этим supplement)

| # | Признак | Почему DESIGN.md не справляется |
|---|---------|--------------------------------|
| 1 | Кринжовые градиенты | DESIGN.md задаёт цвета, но не запрещает градиентные комбинации |
| 2 | 2-колоночные comparison-блоки | DESIGN.md описывает токены, не layout patterns / композицию страниц |
| 9 | Generic shadcn из коробки | DESIGN.md может упоминать shadcn, но не enforce'ит TweakCN-кастомизацию |
| 11 | UX страдает ради красивой картинки | DESIGN.md про визуал, не про user journey и приоритезацию CTA |

Эти 4 пункта **обязательно** добавляй из supplement — без них AI вернётся к
дефолтному поведению даже при идеальном DESIGN.md.

---

## Часть 4 — Anti-slop block (готовый текст в DESIGN.md)

Скопируй этот блок в свой `DESIGN.md` отдельной секцией (например, в самом
конце как «### 11. Anti-AI-slop Guards») или вставь в системный промпт
агенту. Каждое правило закрывает один из непокрытых признаков.

```markdown
## Anti-AI-slop Guards (mandatory)

### Layout & composition
- **NO 2-column comparison blocks.** Forbidden patterns: «Without us / With us»,
  «Before / After», «Old way / New way» side-by-side. Use single-column
  storytelling or 3-card grid instead. If comparison is unavoidable —
  use a table, not two columns.
- **ASCII wireframe first.** Before generating UI code: produce an ASCII
  wireframe of the page layout (HERO / sections / cards / footer).
  Then generate code that matches the wireframe EXACTLY. Do not invent
  additional sections.
- **Generous spacing between sections.** Padding between major sections:
  minimum 48px on desktop, 32px on mobile. Section internal padding:
  minimum 24px. Never 12-16px between sections.

### Visual style
- **NO gradients on backgrounds, buttons, or hero blocks.** Use solid
  colors only — clean white / gray / black / metallic palette from
  DESIGN.md tokens. Single exception: skeleton loader shimmer animation.
- **Cards: subtle elevation, NEVER heavy borders.** Use 1px border at
  10% opacity (`border: 1px solid color-mix(in srgb, var(--border) 10%, transparent)`)
  or no border with background contrast. Forbidden: `border: 2px+`,
  `border: 3px solid black`, double borders.
- **shadcn/ui MUST be customized.** Do not ship default shadcn theme
  (slate / zinc / gray out-of-box). Use TweakCN.com to generate
  brand-aligned theme, export as CSS variables, paste into globals.css.

### UX-first thinking
- **User journey before visual style.** Before generating any page —
  answer: (1) Who is on this page? (2) What are they trying to do?
  (3) Where is the primary CTA? (4) What is the next logical step?
  Visual decisions follow user journey, not the other way around.
- **Primary CTA must be above the fold.** Hero with full-screen height
  pushing content below fold = anti-pattern. Hero takes max 60vh,
  primary CTA visible without scroll on 1366×768 desktop.
- **Contrast ≥ 4.5:1 for body text always.** No light-gray text on
  white because «it looks aesthetic in screenshots». UX > screenshot
  beauty.

### Magic phrase (put first in system prompt)
> «Be a human designer so it doesn't look like AI. With design taste.»
```

---

## Как использовать этот supplement

**Вариант A — встроить в DESIGN.md (рекомендуется).**
Добавь в свой `DESIGN.md` новую секцию «Anti-AI-slop Guards» с текстом из
Части 4 выше. Один файл — одна точка истины.

**Вариант B — отдельный файл рядом с DESIGN.md.**
Положи `ANTI_SLOP.md` в корень репо рядом с `DESIGN.md`. В `CLAUDE.md` /
`AGENTS.md` добавь две ссылки:
```markdown
## Design rules: see ./DESIGN.md
## Anti-slop rules: see ./ANTI_SLOP.md
```

**Вариант C — в промпт агенту.**
Скопируй блок из Части 4 в начало system prompt'а Cursor / Claude Code /
Bolt / Lovable. Работает как разовый guard-rail, без файла в репо. Минус —
правило не версионируется, легко потерять.

---

## Связанные материалы

- `cheatsheets/12-signs-of-ai-look.md` — полная диагностика 12 признаков AI-look
- `templates/DESIGN_SYSTEM.md` — шаблон базового DESIGN.md
- `design-system-pack-example/` — рабочий пример пакета JSON+CSS+MD
- `prompts/anti-ai-slop-guards.md` — расширенный промпт-блок (если присутствует)

---

*M4 — HSS AI-dev L1. Этот файл — supplement к DESIGN.md, не замена.*
