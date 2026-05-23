# AutoPilot API Reference

## Overview

`/api/autopilot/feature-control` — серверный прокси от browser к n8n webhook `WF1 — Feature Control`. Цель: скрыть `N8N_API_KEY` от browser bundle. Frontend идёт на свой origin, backend форвардит запрос на n8n с `X-API-Key` header.

ADR: `project-data/adrs/adr-006-n8n-autopilot-integration.md`.
Spec: `homework/M6/stage3-living-docs/specs/autopilot-integration-spec.md`.

---

## Endpoints

### POST /api/autopilot/feature-control

Прокси-вызов n8n workflow.

**Auth:** Private (admin only). Stage2 fix-3 добавил `protect` + `admin`.

**Headers:**

```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Body limit:** 16 KB (`express.json({limit:'16kb'})`).

**Body:** произвольный JSON. Бэкенд не валидирует shape — передаёт as-is в n8n. (ADR-006 invariant #3 рекомендует Zod schema; не реализовано.)

**Response:**

- `<upstream.status>` + JSON (или wrapped не-JSON) — passthrough от n8n.
- `502 {success:false, message:"Upstream error: ..."}` — network failure (DNS, refused, generic fetch error).
- `504 {success:false, message:"Upstream error: ..."}` — n8n не ответил за 5 секунд (AbortSignal.timeout).
- `500 N8N_WEBHOOK_URL is not configured on the server` — env mis-config.
- `401` — JWT отсутствует/невалиден/non-admin.
- `413` — body превышает 16 KB.

---

## Server-side configuration

```
N8N_WEBHOOK_URL=https://your-n8n.example.com/webhook
N8N_API_KEY=secret-value
```

- `N8N_WEBHOOK_URL` — base URL n8n инстанса. Endpoint склеивает `${URL}/feature-control`.
- `N8N_API_KEY` — значение `X-API-Key` header. Если пуст — header не отправляется (n8n может отказать).
- В Docker Compose `mcp-tunnel` сервис создаёт эфемерный Cloudflare URL для n8n side; **URL меняется при каждом рестарте**, n8n credentials обновляются вручную.

---

## Security boundary

Browser ↔ backend идёт по same-origin. `N8N_API_KEY` НЕ попадает в browser bundle.

**Known issues (Stage3 findings):**

- **ARCH-DELTA-04 (MED):** integration logic в роутере; ADR-006 invariant #6 требует extract `backend/services/n8nClient.js`.
- **PERF-D10 (MED, NEW):** fresh TCP+TLS на каждый клик (нет undici Agent keep-alive). Нет cap на `upstream.text()` — large body буферизуется до response → self-DoS surface.
- **SEC-MED:** SSRF host allowlist на `N8N_WEBHOOK_URL` отложен Stage2 fix-3; admin user, имеющий доступ к env, может направить backend на internal IPs. Дефенс-in-depth gap.
- **SEC-MED:** `e.message` в 502/504 response утекает host/IP/internals.

---

## Operational notes

- Restart backend после ротации `N8N_API_KEY` или `N8N_WEBHOOK_URL` — нет hot reload env.
- Concurrent admin calls не rate-limited; admin может DoS-нуть n8n.
- Если n8n запускает long-running workflow (>5s), браузер видит 504, но workflow продолжает в n8n. UI должно опросом проверять статус — этого нет.

---

## Cross-refs

- `project-data/adrs/adr-006-n8n-autopilot-integration.md`
- `project-data/runbooks/feature-flag-toggle.md` — операционная сторона.
- `homework/M6/stage3-living-docs/specs/autopilot-integration-spec.md`
- `homework/M6/stage2-fix-top3/fix-3-auth-and-integration-routes.md`
