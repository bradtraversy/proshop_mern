# No Database Migration Tooling — Schema via Mongoose Models Only

## Status

Accepted

## Context and Problem Statement

The application uses MongoDB with Mongoose as the ODM. As the data model evolves (new fields, renamed properties, changed types, index additions), the team needs a strategy for propagating schema changes to existing databases. The question is whether schema evolution is managed explicitly through versioned migration scripts or implicitly through Mongoose model definitions deployed with the application code.

## Considered Options

1. **No migration tooling — schema defined solely in Mongoose models** — deploy updated model files; Mongoose applies the new schema at runtime; existing documents retain their old shape until individually updated.
2. **`migrate-mongo`** — versioned JavaScript migration scripts tracked in a `changelog` collection; run `migrate-mongo up` before deployment to transform existing data.
3. **Custom seeder-based approach** — extend the existing `seeder.js` to handle data transformations alongside seed operations.
4. **MongoDB native `$set`/`$rename` scripts** — ad-hoc shell scripts run manually against the database during deployment.

## Decision Outcome

Option 1 — no migration tooling.

Schema changes are made by editing the Mongoose model files (`userModel.js`, `productModel.js`, `orderModel.js`) and deploying the updated application. Mongoose's schema enforcement applies to new documents and to documents loaded and re-saved through the application. Existing documents in the database are not proactively migrated — they retain their old shape until the application touches them. The `seeder.js` script handles initial data loading (import/destroy) but has no migration capabilities.

This works because MongoDB is schema-flexible by nature: adding a field to a Mongoose schema simply means old documents return `undefined` for that field (or get the schema default). The application relies on this flexibility rather than enforcing strict schema versioning.

## Consequences

**Positive:**
- Zero migration infrastructure — no migration runner, no changelog collection, no deployment step before app start.
- Fast development iteration — change the model, restart the server, done.
- Mongoose `default` values and `required` constraints handle most forward-compatible changes gracefully.

**Negative:**
- **No rollback path** — if a schema change breaks the application, there is no automated way to revert the data to a previous shape.
- **Stale documents** — existing documents retain their old shape indefinitely. A query expecting a new field may get `undefined` for documents that were never re-saved. This is particularly risky for `required: true` fields added after initial deployment.
- **No audit trail** — there is no record of when schema changes were applied or what the previous schema looked like.
- **Destructive changes are dangerous** — renaming or removing a field requires manually updating all existing documents. Without migration scripts, this is error-prone.
- **Seeder is all-or-nothing** — `data:import` wipes and re-inserts; it cannot selectively transform existing data.

## Confidence

**HIGH** — There is no `migrations/` directory, no migration dependency in `package.json`, and the Mongoose models are the sole source of schema truth. The `seeder.js` script only supports full import/destroy, confirming no incremental migration capability.

## Evidence

- `backend/models/userModel.js` — schema defined inline with Mongoose; fields have `required` and `default` but no version tracking
- `backend/models/productModel.js` — nested `reviewSchema` embedded directly; schema changes would affect new documents only
- `backend/models/orderModel.js` — complex nested schema with `paymentResult`, `shippingAddress` sub-documents; no migration for shape changes
- `backend/seeder.js` — `importData` deletes all documents then re-inserts from seed files; `destroyData` wipes everything; no selective migration
- `backend/config/db.js` — `mongoose.connect()` with no migration runner or pre-start hook
- `package.json` — no `migrate-mongo`, `db-migrate`, `knex`, or similar migration tool
