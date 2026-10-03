# Engineering Decisions

This document captures the architectural decisions made for OpsDesk to ensure correctness and maintainability.

## 1. PostgreSQL as the system of record
- **Decision:** Use PostgreSQL as the single source of truth and system of record for all data.
- **Context:** We need a reliable relational database that supports ACID transactions, complex queries, and JSON storage for payloads.
- **Reasoning:** PostgreSQL provides robust relational integrity, JSONB support for our event payloads and outbox, and excellent concurrency control mechanisms (like row locking).
- **Trade-offs:** Managing migrations and schemas can be more rigid compared to NoSQL, but the guarantee of data integrity is essential.
- **Alternative considered:** NoSQL databases (e.g., MongoDB), but they lack strong relational guarantees and transactional outbox patterns are harder to implement.

## 2. Optimistic concurrency + atomic claim
- **Decision:** Implement a `version` field for optimistic concurrency control on work items, and use atomic updates to claim unassigned work.
- **Context:** Multiple users may attempt to update or claim a work item simultaneously. We need to prevent silent overwrites and duplicate assignments.
- **Reasoning:** By including a `version` field, updates will fail if the client's state is stale, allowing the user to handle the conflict. Atomic claims ensure only one user can become the assignee.
- **Trade-offs:** Clients must handle conflict responses (409 Conflict) and potentially retry or merge changes.
- **Alternative considered:** Pessimistic locking, but it can lead to deadlocks and poorer UX in web applications.

## 3. Idempotency keys
- **Decision:** Use an `Idempotency-Key` mechanism for important mutations.
- **Context:** Network failures can cause clients to retry requests that have already been processed, leading to duplicate operations.
- **Reasoning:** Storing the idempotency key along with the response ensures that subsequent requests with the same key return the original response without re-executing the logic.
- **Trade-offs:** Requires an additional table (`idempotency_keys`) and logic in the request lifecycle.
- **Alternative considered:** Relying on clients not to double-click, which is unreliable.

## 4. PostgreSQL outbox instead of Redis/Kafka
- **Decision:** Use a PostgreSQL table (`outbox`) for asynchronous task processing instead of a dedicated message broker.
- **Context:** We need to execute side effects (like sending notifications or updating RAG data) reliably after a transaction commits.
- **Reasoning:** Storing the event in an outbox table within the same transaction as the primary mutation guarantees atomicity. A worker can then poll or listen for these events. This reduces infrastructure complexity by avoiding Redis or Kafka.
- **Trade-offs:** Polling or using `SKIP LOCKED` on PostgreSQL can add some database load, but is perfectly sufficient for expected scale.
- **Alternative considered:** Apache Kafka or RabbitMQ, but they introduce significant operational overhead and complex two-phase commit scenarios.

## 5. Resource-level server-side authorization
- **Decision:** Enforce permissions at the resource level on the server, rather than trusting client-provided context.
- **Context:** Users belong to teams with different roles (member, lead, admin).
- **Reasoning:** The server must independently fetch the resource (e.g., work item) and verify the user's role in the associated team before permitting an action (e.g., resolving the item).
- **Trade-offs:** Requires more database queries during authorization, but caching or optimized queries can mitigate performance impact.
- **Alternative considered:** Trusting the frontend to send a valid role token, which is a massive security vulnerability.

## 6. Authorization Model & Identity Abstraction
- **Decision:** Implemented a replaceable identity abstraction (`getCurrentUser()`) and centralized RBAC (`can()`, `authorize()`).
- **Context:** Authentication infrastructure (SSO/NextAuth) is out of scope, but robust authorization is critical.
- **Reasoning:**
  - **Server-Side Authorization:** It guarantees the API acts as an authoritative boundary. Malicious clients cannot bypass rules by crafting HTTP requests.
  - **Database-Driven Resource `team_id`:** We must derive the resource's `team_id` directly from the database row (e.g. `workItems.teamId`) rather than trusting a client-supplied property which could be tampered with.
  - **Centralized Permissions:** Having a single `can(user, action, resource)` prevents fragmented and inconsistent permission checks scattered across routes.
  - **UI Permissive Masking:** UI hides actions (like editing unowned items) for UX, but is never relied upon as a security measure.
  - **Replaceable Identity:** `getCurrentUser()` simply mocks the first deterministic database user. It's built cleanly so a real OIDC/SSO provider can drop in without refactoring business logic.

## 7. Optimistic Concurrency
- **Decision:** Version-based optimistic concurrency was implemented.
- **Reasoning:** Rather than querying data and evaluating version mismatch in application code (which creates a race condition), we use atomic conditional SQL updates (`WHERE id = ? AND version = ?`). If 0 rows are affected, we know the resource changed concurrently.

## 8. Atomic Concurrent Claim
- **Decision:** Use conditional database update (`WHERE assignee_id IS NULL`).
- **Reasoning:** Implementing a read-then-write mechanism is fundamentally vulnerable to race conditions between two concurrent requests. Updating conditionally enforces the database to serialize the claims correctly, ensuring exactly one winner.

## 9. Idempotency & Outbox Worker Pattern
- **Decision:** Added `idempotency_keys` check for mutations and `outbox` table for reliable asynchronous side effects (like notifications).
- **Reasoning:**
  - **Idempotency:** Re-executing mutations across network retries safely produces the exact same observable outcome without repeating side effects.
  - **PostgreSQL Outbox vs Redis/Kafka:** We avoided Redis and Kafka because introducing new infrastructure layers for queues breaks the transactional boundary. A PostgreSQL `outbox` guarantees that the mutation and the side-effect intent are written atomically in the same transaction.
  - **Worker Retry Strategy:** The standalone script (`scripts/worker.ts`) implements retry polling utilizing `FOR UPDATE SKIP LOCKED`. If processing fails, it increments `attempts`. Once attempts exhaust, it safely stops retrying the task.

## 10. Deterministic Compound Cursor
- **Decision:** Implemented compound pagination cursor (`createdAt + id`).
- **Reasoning:** Simple single-column `createdAt` cursors result in skipped records or infinite loops when multiple records share exactly the same timestamp. By chaining `id`, ties are predictably broken without data loss.
