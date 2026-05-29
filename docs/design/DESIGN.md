# DESIGN.md — ProShop MERN

> Design system: Strict Modern (shadcn/ui)
> Format: Tailwind CSS v4 + Radix UI primitives
> Last updated: 2026-05-18

---

## 1. Color Palette

Semantic HSL tokens defined via `@theme` in Tailwind v4 CSS. Use as `text-foreground`, `bg-primary`, etc.

| Role                       | Light mode          | Dark mode           |
|----------------------------|---------------------|---------------------|
| `background`               | hsl(0 0% 100%)      | hsl(240 10% 3.9%)   |
| `foreground`               | hsl(240 10% 3.9%)   | hsl(0 0% 98%)       |
| `card` / `card-foreground` | same as bg/fg       | same as bg/fg       |
| `primary`                  | hsl(240 5.9% 10%)   | hsl(0 0% 98%)       |
| `primary-foreground`       | hsl(0 0% 98%)       | hsl(240 5.9% 10%)   |
| `secondary`                | hsl(240 4.8% 95.9%) | hsl(240 3.7% 15.9%) |
| `muted`                    | hsl(240 4.8% 95.9%) | hsl(240 3.7% 15.9%) |
| `muted-foreground`         | hsl(240 3.8% 46.1%) | hsl(240 5% 64.9%)   |
| `accent`                   | hsl(240 4.8% 95.9%) | hsl(240 3.7% 15.9%) |
| `destructive`              | hsl(0 84.2% 60.2%)  | hsl(0 62.8% 30.6%)  |
| `success`                  | hsl(142 76% 36%)    | hsl(142 76% 36%)    |
| `warning`                  | hsl(38 92% 50%)     | hsl(38 92% 50%)     |
| `border`                   | hsl(240 5.9% 90%)   | hsl(240 3.7% 15.9%) |
| `ring`                     | hsl(240 5.9% 10%)   | hsl(240 4.9% 83.9%) |

Dark mode: `.dark` class on `<html>`.

**Opacity syntax:** Always use Tailwind v4 slash notation — `bg-primary/90`, `text-muted-foreground/50`. Never use deprecated `bg-opacity-*` utilities.

---

## 2. Typography

**Font family:** Geist Sans
**Rationale:** Vercel/shadcn ecosystem font. Geometric, highly legible, embodies strict modern aesthetic.
**Fallback:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

**Mono font:** JetBrains Mono — for IDs, code snippets, technical data.

| Step    | Class           | Size  | Weight | Letter-spacing | Usage            |
|---------|-----------------|-------|--------|----------------|------------------|
| Display | `text-5xl`      | 48px  | 700    | -0.03em        | Hero headline    |
| H1      | `text-4xl`      | 36px  | 700    | -0.025em       | Page title       |
| H2      | `text-2xl`      | 24px  | 700    | -0.02em        | Section heading  |
| H3      | `text-xl`       | 20px  | 600    | -0.01em        | Subsection       |
| Body    | `text-sm`       | 14px  | 400    | 0              | Default text     |
| Caption | `text-xs`       | 12px  | 400    | 0              | Metadata, labels |

---

## 3. Spacing Scale

Only multiples of 8px. Tailwind utilities:

| Token | Value | Tailwind     |
|-------|-------|--------------|
| xs    | 4px   | `p-1`        |
| sm    | 8px   | `p-2`        |
| md    | 16px  | `p-4`        |
| lg    | 24px  | `p-6`        |
| xl    | 32px  | `p-8`        |
| 2xl   | 48px  | `p-12`       |
| 3xl   | 64px  | `p-16`       |

Exception: 4px (`p-1`) allowed for tight optical adjustments.

---

## 4. Border Radius Scale

| Token | Value  | Tailwind         | Usage           |
|-------|--------|------------------|-----------------|
| sm    | 6px    | `rounded-md`     | Buttons, inputs |
| md    | 8px    | `rounded-lg`     | Cards           |
| lg    | 12px   | `rounded-xl`     | Modals, panels  |
| full  | 9999px | `rounded-full`   | Badges, avatars |

---

## 5. Elevation / Shadow Approach

**Primary approach:** Subtle border-based elevation (`border border-border`), not heavy shadows.

| Level | Usage               | Implementation                      |
|-------|---------------------|-------------------------------------|
| 0     | Flat / inline       | No border, no shadow                |
| 1     | Cards, containers   | `border border-border`              |
| 2     | Dropdowns, popovers | `border shadow-md`                  |
| 3     | Modals              | `border shadow-lg`                  |

Never use colored shadows or glow effects.

---

## 6. Component Patterns

All components from `src/components/ui/` follow shadcn/ui conventions:
- `class-variance-authority` (CVA) for variant-based styling
- `cn()` utility (clsx + tailwind-merge) for class composition
- `React.forwardRef` for all primitive components
- Radix UI primitives for accessibility

### Buttons
```jsx
<Button variant="default|destructive|outline|secondary|ghost|link|success|warning" size="default|sm|lg|icon" />
```

### Cards
```jsx
<Card>
  <CardHeader><CardTitle>...</CardTitle></CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### Tables
```jsx
<Table>
  <TableHeader><TableRow><TableHead>...</TableHead></TableRow></TableHeader>
  <TableBody><TableRow><TableCell>...</TableCell></TableRow></TableBody>
</Table>
```

### Badges
```jsx
<Badge variant="default|secondary|destructive|success|warning|outline" />
```

### Alerts
```jsx
<Alert variant="default|destructive|success|warning|info">
  <AlertDescription>...</AlertDescription>
</Alert>
```

### Inputs
```jsx
<Input type="text|email|password" placeholder="..." />
<Select>...</Select>
<Slider min={0} max={100} />
```

---

## 7. Interactive States

For **every** interactive element:

| State    | Implementation                                     |
|----------|----------------------------------------------------|
| Default  | Base variant styles                                |
| Hover    | `hover:bg-primary/90`, `hover:bg-accent`           |
| Focus    | `focus-visible:ring-2 focus-visible:ring-ring`     |
| Active   | `active:scale-[0.98]` (buttons only, optional)     |
| Disabled | `disabled:pointer-events-none disabled:opacity-50` |
| Loading  | Loader2 spinner with `animate-spin`                |
| Empty    | `<Message variant="info">` with helpful text       |
| Error    | `<Message variant="danger">` with error message    |

### Specific elements:
- **Buttons:** 2px ring offset, rounded-md, 150ms color transition
- **Inputs:** 2px ring on focus, placeholder in muted-foreground
- **Links:** `hover:underline` or color transition, never both
- **Table rows:** `hover:bg-muted/50` for row highlight
- **Cards:** `hover:shadow-md` + `transition-all` for product cards

---

## 8. Animation

| Pattern      | Duration | Easing      | Tailwind               |
|--------------|----------|-------------|------------------------|
| Color change | 150ms    | ease        | `transition-colors`    |
| Transform    | 200ms    | ease-out    | `transition-transform` |
| All props    | 200ms    | ease        | `transition-all`       |
| Skeleton     | 1500ms   | ease-in-out | `animate-pulse`        |
| Spinner      | 1000ms   | linear      | `animate-spin`         |

Never animate layout properties (width, height). Use `transform` and `opacity` only.

---

## 9. Accessibility

- All interactive elements are native HTML (`<button>`, `<input>`, `<a>`) — keyboard accessible by default
- `aria-label` on icon-only buttons
- `aria-pressed` on toggle buttons
- `aria-valuemin/max/now` on sliders
- Focus rings visible on keyboard navigation (`focus-visible:`)
- Color contrast: minimum 4.5:1 for text, 3:1 for large text/UI
- Role="alert" on Alert components

---

## 10. Format Declaration

```
Technology: React 18 + Vite + Tailwind CSS v4 + shadcn/ui components
State: Redux + Redux Thunk
Routing: React Router v5
Icons: Lucide React
Class composition: clsx + tailwind-merge (cn utility)
Component primitives: Radix UI
Component styling: class-variance-authority (CVA)
```

---

## 11. Anti-AI-slop Guards

### Never do:
- ❌ Gradients on buttons or cards (flat color only)
- ❌ Box-shadow heavier than `shadow-md` except modals
- ❌ Colored shadows or glow effects
- ❌ Rounded corners > `rounded-xl` (except `rounded-full` for badges)
- ❌ More than 2 font weights on one screen
- ❌ Animated background patterns or blobs
- ❌ Generic "shadcn look" without understanding the token system
- ❌ Using deprecated Tailwind v3 syntax (`bg-opacity-*`, `text-opacity-*`)

### Always do:
- ✅ Use semantic color tokens, never raw hex/hsl in className
- ✅ Use Tailwind v4 slash notation for opacity: `bg-primary/50`
- ✅ Flat, border-based elevation (not shadow-driven)
- ✅ Tight spacing (never more than 32px between related elements)
- ✅ Consistent 8px grid alignment
- ✅ Let whitespace breathe — don't fill every pixel
- ✅ Use `text-muted-foreground` for secondary content (never light gray hardcoded)
- ✅ Limit palette usage: primary for actions, muted for passive, destructive for danger

### Design principles:
1. **Information density over decoration** — every pixel should convey data
2. **Quiet confidence** — the interface shouldn't scream; quality shows in restraint
3. **Systematic, not themed** — tokens and utilities, not one-off custom CSS
4. **UX-first** — interaction clarity beats visual flair
