> **TODO(audit-2026-05-29):** Status DEVIATED: persistence is now polyglot — MongoDB + backend/features.json (feature flags) + Postgres/pgvector (RAG). The 'sole database' claim no longer holds; cross-link ADR-0003 and the new architecture overview.
>
> _Marker added during M6 Stage 3 living-docs audit. Behavioural content below verified accurate; only the noted parts are stale._

# ADR-001: Use MongoDB (via Mongoose) as the Primary Database

**Status:** Accepted
**Date:** 2023-01-10
**Decision Makers:** Engineering team (initial project setup)

---

## Context

Before the first commit, the team needed to select a database for the ProShop e-commerce application. The two primary candidates were MongoDB and PostgreSQL. The team had more prior experience with PostgreSQL from a previous internal project, but MongoDB had been discussed as a learning goal for this project cycle.

The domain under consideration: a product catalog, user accounts, shopping cart state, and orders. The data relationships are relatively straightforward, but the product entity was anticipated to have variable attributes — electronics might have wattage and connectivity specs, clothing might have size and material, books might have ISBN and page count. This variability was the central argument for a document store.

The team had two engineers. Both had worked with SQL databases. One had prior Mongoose experience on a side project. Timeline pressure was low — this was not a business-critical deployment with a hard launch date.

---

## Decision

Use **MongoDB** via the **Mongoose** ODM as the sole database for the application.

The connection is managed through a `connectDB()` utility (`backend/config/db.js`) called at server startup. Mongoose schemas define the structure for `User`, `Product`, and `Order` collections. The Order document embeds order items (product reference + quantity + price at time of order) rather than using a separate collection, reflecting MongoDB's document-oriented modeling preference for data that is read together.

---

## Consequences

### Positive

- **Schema flexibility for product attributes.** Adding a new product attribute (e.g., `weight`, `dimensions`, `material`) requires no migration — just add the field to the schema or write it to the document. This proved useful when the electronics category was added with variant specs.
- **Embedded documents for order items.** Order items (product snapshot at purchase time) are embedded in the Order document. This means a full order read is a single document fetch — no joins required, and historical pricing is preserved even if the product price changes later.
- **Mongoose ODM is well-documented and beginner-friendly.** The API (`Model.find()`, `Model.findById()`, `Model.findByIdAndUpdate()`) maps naturally to Express controller patterns. The team reached full productivity quickly.
- **MongoDB Atlas free tier.** The M0 cluster was sufficient for development and initial staging, reducing infrastructure cost to zero for the first six months.
- **Aggregation pipeline for reviews.** Computing average rating and review count via MongoDB's aggregation pipeline (`$group`, `$avg`) worked well for this read pattern.

### Negative

- **No ACID transactions by default.** Mongoose operations on single documents are atomic, but multi-document operations (e.g., updating an order AND decrementing product stock in the same logical transaction) are not atomic without explicit use of MongoDB transactions (added in MongoDB 4.0). The initial implementation did not use transactions, leading to the inconsistency exposed in Incident i-001 (partial update scenario).
- **Schema flexibility was largely theoretical.** The product schema stabilized within two months of development. The "variable attributes" use case never materialized in a form that PostgreSQL's JSONB column type could not have handled equally well.
- **Joins are explicit and verbose.** Queries that span collections (e.g., "get all orders with user details populated") require explicit `.populate()` calls. In a relational database, a JOIN expresses this naturally. The Mongoose approach works, but it requires the developer to think carefully about query composition.
- **Weaker consistency guarantees for financial operations.** The order creation path (create order document + decrement product `countInStock`) is logically one operation but two DB writes. Without a transaction wrapping them, a server crash between the two writes leaves the data inconsistent. This is solvable with MongoDB multi-document transactions but was not implemented until v2.7.

---

## Alternatives Considered

### PostgreSQL (with Sequelize or Prisma ORM)

PostgreSQL was the team's existing experience base. It would have provided:
- Full ACID compliance, including multi-table transactions for order+inventory operations
- Mature query planner and index types (GIN for JSONB, full-text search)
- Strong tooling (pgAdmin, psql, DBeaver)
- JSONB columns for variable product attributes without EAV complexity

**Reason not chosen:** The team wanted to build MongoDB experience. The "variable product attributes" use case seemed to favor a document store at decision time. In retrospect, PostgreSQL + JSONB would have handled the actual attribute variability adequately, and the ACID guarantees would have eliminated the multi-document consistency issues encountered in production.

### SQLite (via Sequelize)

Considered briefly for its zero-infrastructure simplicity (file-based, no server). Rejected because: SQLite is not appropriate for a multi-connection production deployment, and Atlas's free tier removed the infrastructure argument.

---

## Current Assessment (April 2026)

For the actual workload this application handles — a product catalog with fixed schema, standard user/order relationships, and modest traffic — PostgreSQL would have been an equally valid (and arguably better) choice. The document-model benefits were smaller than anticipated. However, MongoDB has not caused serious problems, the Mongoose integration is stable, and the cost of migration now exceeds the benefit. The decision is maintained as-is.
