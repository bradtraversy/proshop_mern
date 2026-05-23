# Feature Flags API Reference

## Overview

`/api/featureflags` экспонирует чтение и точечное обновление `backend/features.json`. Источник истины — единый JSON-файл; механизм владения описан в **ADR-007**. Спецификация формата файла — в `project-data/feature-flags-spec.md`.

Два writer'а изменяют файл:

- `PATCH /api/featureflags/:key` (этот endpoint, admin-only).
- `mcp-features` MCP-сервер (stdio + HTTP transport — см. `project-data/adrs/adr-008-*` если принят).

Both pathway используют atomic write (Express: tmp + rename; MCP: текущий код direct overwrite — see ARCH-DELTA-01 in Stage3 findings).

---

## Endpoints

### GET /api/featureflags

Получить полный каталог feature flags.

**Auth:** Public. Никаких заголовков не требуется (по умолчанию).
**Cache:** 5s in-process TTL (`backend/utils/featureFlag.js` + `backend/routes/featureFlagRoutes.js` — два независимых кеша, см. Stage3 PERF-D3).

**Request:**

```
GET /api/featureflags
```

**Response 200:**

```json
{
  "dark_mode": {
    "name": "Dark mode",
    "description": "...",
    "status": "Testing",
    "traffic_percentage": 50,
    "last_modified": "2026-05-23",
    "targeted_segments": ["beta_users"],
    "rollout_strategy": "canary",
    "dependencies": []
  },
  "multi_step_checkout_v2": { ... }
}
```

**Errors:**

- `500 Feature flags file contains invalid JSON` — corrupted features.json (e.g. partial write race).
- `503 Feature flags configuration is temporarily unavailable` — файл отсутствует (ENOENT).

---

### PATCH /api/featureflags/:key

Обновить статус и/или traffic_percentage одной feature.

**Auth:** Private (admin only).
**Headers:**

```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**URL params:**

- `key` — feature_id; must match `/^[a-z][a-z0-9_-]{0,63}$/`. Это блокирует `__proto__`, uppercase, spaces.

**Request body (оба поля optional, но хотя бы одно обязано присутствовать):**

```json
{
  "status": "Enabled" | "Testing" | "Disabled",
  "traffic_percentage": 0..100
}
```

**Auto-adjust:**

| Передан `status` без `traffic_percentage` | Действие |
|---|---|
| `Enabled` | `traffic_percentage = 100` |
| `Disabled` | `traffic_percentage = 0` |
| `Testing` | keep если 1..99, иначе 10 |

`last_modified` обновляется на сегодняшний `YYYY-MM-DD`.

**Response 200:**

```json
{
  "key": "dark_mode",
  "name": "Dark mode",
  "status": "Enabled",
  "traffic_percentage": 100,
  "last_modified": "2026-05-23",
  ...
}
```

**Errors:**

- `400 Invalid feature flag key` — key не матчит regex.
- `400 Invalid status. Must be one of: Enabled, Testing, Disabled` — case-sensitive.
- `400 traffic_percentage must be an integer between 0 and 100`.
- `401 Not authorized, no token` / `Not authorized, token failed` — JWT не передан или невалиден.
- `401 Not authorized as an admin` — JWT валиден, но `isAdmin === false`. (Stage1 ARCH-07: должен быть 403.)
- `404 Feature flag '<key>' not found`.
- `500 Feature flags file contains invalid JSON` — внутренний race.

---

## Write semantics

1. PATCH validates input (regex + whitelist + range).
2. `readFlags(res)` — может вернуть из 5s in-process cache.
3. Apply changes в memory object.
4. `writeFile(tmp)` → `rename(tmp, filePath)` — atomic swap.
5. `invalidateCache()` — сбрасывает кеш этого роута. **НЕ сбрасывает кеш `utils/featureFlag.js`** — backend `isFeatureEnabled()` в контроллерах продолжает отдавать stale до 5s. См. ARCH-DELTA-03 / PERF-D3.
6. Response 200 с обновлённым flag.

---

## Frontend consumer

Frontend читает `GET /api/featureflags` один раз на mount (`App.js` → `loadFeatureFlags()`), кладёт в Redux `state.featureFlags.flags`. Хук `useFeatureEnabled(key)` решает on render. Полная схема — `specs/feature-flags-layer-spec.md`.

Admin AutoPilot UI вызывает PATCH через `featureFlagActions.updateFeatureFlag(key, patch)` с optimistic update + rollback на ошибке.

---

## Known issues

- **Multi-writer race** (ARCH-DELTA-01/02, SEC cluster Δ-A): MCP-features пишет тот же файл напрямую. ADR-007 invariants #2/#3 not yet realized in code.
- **Cache coherence gap** (PERF-D3): backend `isFeatureEnabled()` в контроллерах не видит PATCH в течение ≤ 5s.
- **Traffic bucket bypass** (SEC cluster Δ-D): hook доверяет `sessionStorage`/`X-FF-Bucket` header → не использовать для security gating.

---

## Cross-refs

- `project-data/adrs/adr-007-feature-flag-storage-and-ownership.md`
- `project-data/feature-flags-spec.md`
- `homework/M6/stage3-living-docs/specs/feature-flags-layer-spec.md`
- `homework/M6/stage3-living-docs/specs/mcp-features-spec.md`
- `homework/M6/stage2-fix-top3/fix-1-feature-flag-store.md`
