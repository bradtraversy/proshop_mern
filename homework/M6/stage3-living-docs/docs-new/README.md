# docs-new — Stage3 Living Documentation (hybrid mode)

**Status:** delta-only. Не дублирует `project-data/`. Существующие ✅/🔄 файлы остаются в `project-data/` как RAG source of truth.

**Что здесь:**

- `api/featureflags.md` — спецификация `/api/featureflags` (отсутствовала в `project-data/api/`).
- `api/autopilot.md` — спецификация `/api/autopilot/feature-control` (отсутствовала в `project-data/api/`).
- `architecture-m3-m5-addendum.md` — секции §9-12 для будущего merge в `project-data/architecture.md` (M3-M5 layers).

**Specs (вне docs-new, в родительском stage3-living-docs/):**

- `../specs/backend-controllers-spec.md`
- `../specs/backend-middleware-spec.md`
- `../specs/mcp-features-spec.md`
- `../specs/mcp-rag-spec.md`
- `../specs/feature-flags-layer-spec.md`
- `../specs/autopilot-integration-spec.md`

**Reviews + synthesis:**

- `../security-review.md` + `../security-findings.jsonl`
- `../performance-review.md` + `../performance-findings.jsonl`
- `../architecture-review.md` + `../architecture-findings.jsonl`
- `../synthesis.md`
- `../proposed-adrs/adr-008-mcp-features-dual-transport.md`

**Audit reference:**

- `../docs-audit.md` — Phase 1.5 verdicts на все существующие docs.
- `../00-plan.md` — план Stage3.

---

## Merge path (опционально, ручной)

Если решено перенести материалы в `project-data/`:

```bash
# 1. Новые api docs
cp homework/M6/stage3-living-docs/docs-new/api/featureflags.md project-data/api/
cp homework/M6/stage3-living-docs/docs-new/api/autopilot.md project-data/api/

# 2. Architecture addendum (merge в существующий architecture.md как § 9-12)
#    — manual merge required, см. addendum-файл

# 3. Promote ADR-008
cp homework/M6/stage3-living-docs/proposed-adrs/adr-008-mcp-features-dual-transport.md project-data/adrs/

# 4. Reindex RAG
cd mcp-rag && node ingest.js
```

После любого изменения `project-data/` — reindex обязателен (см. `CLAUDE.md` секция «Living docs hook»).
