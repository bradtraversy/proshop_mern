# Existing docs audit — &lt;repo-name&gt;

> Заполняется `legacy-auditor-mate` в Phase 1.5. Цель — НЕ выкинуть валидную документацию.
> Каждое существующее `docs/<folder>` и каждый top-level doc-file получает свой verdict.

**Auditor:** `legacy-auditor-mate` (Opus 4.7)
**Audit date:** &lt;YYYY-MM-DD&gt;
**Repo:** &lt;repo-name + 1-line description&gt;
**Existing docs scanned:** &lt;N files / M subfolders&gt;

---

## Verdict legend

| Symbol | Verdict | Action in Phase 4 |
|---|---|---|
| ✅ | **ACCURATE** — matches code, well-maintained | Keep as-is in new docs structure |
| 🔄 | **PARTIALLY ACCURATE** — mostly right, has stale sections | Copy + add `TODO(audit-YYYY-MM-DD): <what>` markers in stale parts |
| 📦 | **HISTORICAL** — old but worth preserving (dev-history, past ADRs, post-mortems) | Move to `docs-archived-YYYY-MM-DD/`, **never `rm`**; link from new arch overview |
| ❌ | **STALE / REDUNDANT** — outdated and superseded | Archive first (never delete), then ignore going forward |

---

## Inventory

| Path | Type | Verdict | Reasoning (1-3 lines) | Action |
|---|---|---|---|---|
| &lt;docs/adr/&gt; | folder (N files) | ✅ ACCURATE | ADRs reflect current architecture decisions; numbering coherent | Keep, copy to new docs/adr/ |
| &lt;docs/dev-history.md&gt; | file (NK) | 📦 HISTORICAL | Covers &lt;date range&gt;, irreplaceable institutional context | Archive, link from new architecture/README.md |
| &lt;docs/architecture.md&gt; | file (NK) | 🔄 PARTIALLY ACCURATE | Pre-&lt;recent change&gt;; missing &lt;new module&gt; | Update affected sections, then copy |
| &lt;docs/api/&gt; | folder (N files) | 🔄 PARTIALLY ACCURATE | API surface changed in &lt;version&gt;, N endpoints stale | Copy with TODO markers per stale endpoint |
| &lt;docs/best-practices.md&gt; | file (NK) | ✅ ACCURATE | Engineering guidance, generic & still valid | Keep |
| &lt;docs/glossary.md&gt; | file (NK) | 🔄 PARTIALLY ACCURATE | Missing terms introduced in &lt;module&gt; | Update with new terms, then copy |
| &lt;docs/runbooks/&gt; | folder (N files) | 🔄 PARTIALLY ACCURATE | Some procedures outdated | Audit each runbook individually |
| &lt;docs/features/&gt; | folder (N files) | ❌ STALE | Replaced by &lt;new docs&gt;; describes removed feature | Archive |
| &lt;docs/pages/&gt; | folder (N files) | ❌ STALE | Pre-&lt;redesign&gt; page docs, irrelevant after &lt;event&gt; | Archive |
| &lt;docs/design/&gt; | folder (N files) | ✅ ACCURATE | Design system current as of &lt;date&gt; | Keep |
| &lt;docs/incidents/&gt; | folder (N files) | 📦 HISTORICAL | Past incidents, valuable for runbooks reference | Archive but reference from runbooks |
| &lt;loose-root-file.md&gt; | file (NK) | &lt;verdict&gt; | &lt;reasoning&gt; | &lt;action&gt; |

> Add / remove rows to match what was actually found in the repo. Do not pad with imagined entries.

---

## Summary

- ✅ Keep as-is: &lt;N&gt; items
- 🔄 Update + keep: &lt;N&gt; items (TODO markers added)
- 📦 Archive (historical): &lt;N&gt; items
- ❌ Archive (stale): &lt;N&gt; items

**Total:** &lt;N&gt; items reviewed.

---

## Cross-references to preserve

Things that **must not get lost** in the swap:

- `dev-history.md` → mentioned from `docs-new/architecture/README.md`.
- Past ADRs → preserve numbering in `docs-new/adr/` (do **not** restart from 1).
- &lt;module&gt;-spec.md → primary source for the corresponding section in the new structure.
- &lt;link / file&gt; → &lt;target / mention&gt;.

---

## Notes for Phase 2 planning

- &lt;observation that should influence the plan, e.g. "incidents/ should NOT be archived blindly — runbooks reference it"&gt;
- &lt;observation 2&gt;
