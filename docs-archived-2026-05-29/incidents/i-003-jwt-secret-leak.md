# Incident i-003: JWT Secret Committed to Git Repository

**Severity:** P1 (security breach, credentials exposed)
**Status:** Resolved
**Date detected:** 2024-07-18
**Date resolved:** 2024-07-23 (full remediation including history rewrite)
**Duration:** 17 months in repository (2023-02-01 – 2024-07-23); active remediation 5 days
**Author:** Tech Lead
**Reviewed by:** Engineering team — postmortem 2024-07-25

---

## Summary

During a routine security audit in July 2024, it was discovered that the `.env` file containing the application's JWT secret, MongoDB connection string, and PayPal client credentials had been committed to the git repository on 2023-02-01 and remained in git history for 17 months. The commit occurred during early development when the project was in a private repository; however, subsequent planning to open-source the codebase made the historical exposure a critical concern. All secrets were rotated, git history was rewritten using `git-filter-repo`, and preventive controls were implemented.

---

## Timeline

| Date | Event |
|------|-------|
| 2023-02-01 | `.env` committed to repository (commit `a3f91c...`). `.gitignore` existed but did not include `.env` — only `node_modules/` and `build/` were listed. |
| 2023-02-14 | `.env` removed from working directory in commit `b8204d...` with message "cleanup". File removed from index but NOT purged from git history. |
| 2023-06 | Repository visibility changed from private to "internal" (team-visible) on the hosting platform. |
| 2024-07-18 | Tech Lead runs `git log --all --full-history -- .env` while preparing for a potential open-source release. Discovers `.env` in history at commit `a3f91c`. |
| 2024-07-18 15:00 | Security incident declared. Repository access restricted to the two engineers actively working on remediation. |
| 2024-07-19 09:00 | All secrets rotated: JWT secret regenerated, MongoDB Atlas credentials rotated, PayPal API credentials regenerated in PayPal Developer Console. |
| 2024-07-19 10:30 | All active JWT sessions invalidated (old secret retired; all users must re-login). |
| 2024-07-20 | `git-filter-repo` used to purge `.env` from all branches and tags. |
| 2024-07-21 | Force-push to remote after team coordination. All local clones notified to re-clone. |
| 2024-07-22 | New pre-commit hook (`git-secrets`) deployed to all developer machines. GitHub Actions workflow added to scan for credential patterns. |
| 2024-07-23 | Incident declared resolved after 24-hour verification window. |
| 2024-07-25 | Postmortem meeting. |

---

## Exposed Credentials

| Secret | Value type | Rotation action |
|--------|-----------|----------------|
| `JWT_SECRET` | 32-character random string | Regenerated; all sessions invalidated |
| `MONGO_URI` | Atlas connection string with embedded credentials | Atlas user deleted and recreated with new password |
| `PAYPAL_CLIENT_ID` | PayPal sandbox client ID | App credentials regenerated in PayPal Developer Console |
| `PAYPAL_CLIENT_SECRET` | PayPal sandbox secret | Same as above |

Note: The PayPal credentials exposed were sandbox credentials. Production PayPal credentials were not yet in use at the time of the original commit (PayPal production was added in v2.3, October 2024, after new credentials were generated post-incident).

---

## Impact Assessment

**Confirmed exploitation:** None detected. Git log analysis showed no unusual access patterns during the 17-month window. MongoDB Atlas audit logs showed no unauthorized connection attempts from external IPs. PayPal Developer Console showed no API calls from unexpected sources.

**Potential impact had secrets been exploited:**
- JWT_SECRET exposure: an attacker could forge JWT tokens for any user ID, including admin accounts, and make authenticated API requests.
- MongoDB URI exposure: direct database access (read/write all collections).
- PayPal credentials: sandbox only; no real financial exposure.

**Actual impact:**
- All active user sessions invalidated (users had to re-login).
- 5 engineer-days spent on remediation.
- Planned open-source release delayed by 3 months.

---

## Root Cause Analysis

**Primary cause:** `.gitignore` was set up with a template that only excluded `node_modules/` and `build/`. The `.env` file was not in the ignore list.

**Contributing factors:**

1. **No `.env.example` file at project start.** The standard practice of committing a `.env.example` with placeholder values and ignoring the real `.env` was not followed. This is a known best practice but was skipped in the initial setup rush.

2. **No pre-commit credential scanning.** Tools like `git-secrets`, `detect-secrets`, or `trufflehog` were not configured. A pre-commit hook would have flagged the `.env` file before the commit was recorded.

3. **"Remove" commit created false confidence.** When the engineer deleted `.env` from the working directory on 2023-02-14, the commit message "cleanup" was treated as "the problem is solved." No one verified whether the file had been purged from history.

4. **No periodic security review.** 17 months elapsed between the commit and detection. A quarterly `git log` scan for credential files would have caught this within the first review cycle.

---

## Remediation Steps (Technical)

### Secret rotation

Executed in the following order to minimize the window between old secrets becoming invalid and new secrets being deployed:

1. Generate new `JWT_SECRET`: `openssl rand -base64 32`
2. Generate new MongoDB Atlas user (new username + password), update connection string
3. Deploy new env vars to Render dashboard
4. Restart service with new secrets
5. Old Atlas user deleted
6. PayPal credentials regenerated

All steps completed within a 90-minute window on 2024-07-19.

### Git history rewrite

```bash
# Install git-filter-repo (Python-based, fast, safer than git filter-branch)
pip install git-filter-repo

# Remove .env from all history
git filter-repo --path .env --invert-paths

# Verify .env no longer appears in any commit
git log --all --full-history -- .env
# (no output expected)

# Force-push all branches (coordinated with all developers)
git push origin --force --all
git push origin --force --tags
```

All developers re-cloned the repository after the rewrite. Stale local clones with the old history were identified and confirmed deleted.

---

## Postmortem — Action Items

| Action | Owner | Status | Completed |
|--------|-------|--------|-----------|
| Add `.env` to `.gitignore` (and all common secret filenames) | Engineer A | Done | 2024-07-19 |
| Create `.env.example` with all required keys, dummy values | Engineer A | Done | 2024-07-19 |
| Deploy `git-secrets` pre-commit hook to all developer machines | Tech Lead | Done | 2024-07-22 |
| Add GitHub Actions credential scan (trufflehog) on every push | Engineer B | Done | 2024-07-22 |
| Rotate all exposed secrets | Tech Lead | Done | 2024-07-19 |
| Purge `.env` from git history | Tech Lead | Done | 2024-07-21 |
| Document incident and remediation in team wiki | Tech Lead | Done | 2024-07-25 |
| Add quarterly security review checklist to team calendar | Tech Lead | Done | 2024-07-30 |
| Evaluate secrets management (Doppler, AWS Secrets Manager) | Tech Lead | Backlogged | — |

---

## Lessons

**`.env` belongs in `.gitignore` on day one, without exception.** This is not a "nice to have" — it is a baseline security control. Frameworks and project templates that do not include this by default are setting developers up to fail. Going forward, the first commit on any new project must include a `.gitignore` with `.env` and a `.env.example` with documented keys.

**Deleting a file from the working tree does not remove it from git history.** This is a common misconception. The correct remediation for an accidentally committed secret is secret rotation + `git-filter-repo` (or equivalent history rewrite), not just a "delete" commit. The delete commit removes the file from the current state but leaves it fully accessible via `git log` and `git show`.

**Automated pre-commit scanning is a force multiplier.** `git-secrets` took 15 minutes to install and configure. If it had been in place on 2023-02-01, the incident would have been caught before the commit was recorded. The 17-month window of exposure and 5 engineer-days of remediation had a root cost of 15 minutes of setup that was skipped.

**Security reviews should be scheduled, not reactive.** This incident was found during an ad-hoc review prompted by open-source planning. It would not have been found through normal development activity. A quarterly 30-minute security checklist (git history scan, dependency audit, secrets rotation schedule) would have surfaced this in Q2 2023.

**Assume the secret is compromised even if exploitation cannot be confirmed.** There is no reliable way to prove that a secret available in a git repository for 17 months was not copied by an automated scanner, a bot, or a person with access during that window. The correct posture is to treat exposure as compromise and rotate immediately, not to assess probability and act accordingly.
