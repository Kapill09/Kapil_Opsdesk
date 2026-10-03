# OpsDesk — Interview Notes

These notes provide concise explanations of the core architectural decisions made for OpsDesk during the Newtonite assessment.

### 1. Why PostgreSQL?
We use PostgreSQL as the central system of record because operational workflows require strong ACID guarantees, relational integrity, and the ability to atomically commit side-effect intent (the transactional outbox pattern). It natively supports JSONB, row-level locking (`FOR UPDATE SKIP LOCKED`), and full-text search, making it perfectly suited to handle our CRUD, outbox, and RAG retrieval requirements without managing extra infrastructure like NoSQL or Redis.

### 2. Why Next.js?
Next.js provides a streamlined, modular monolith architecture via the App Router. We can co-locate our frontend (React/Tailwind) and backend (Route Handlers/Server Actions) in a single repository without maintaining a separate API server, perfectly fitting a rapid prototyping assessment.

### 3. Why Drizzle?
Drizzle ORM is lightweight, type-safe, and generates very predictable SQL. Unlike heavy ORMs, Drizzle operates close to SQL, which is vital when explicitly defining our concurrency logic (e.g., conditional atomic updates) and worker locking (`SKIP LOCKED`).

### 4. How does authorization work?
Authorization is centralized on the backend via a resource-level check (`can(user, action, resource)`). API endpoints fetch the resource directly from the database and verify the current user is a member of the corresponding `teamId` before committing any mutation or returning data. The UI masks unavailable actions, but the API remains the authoritative boundary.

### 5. How do you prevent two users claiming the same item?
We use a conditional atomic SQL mutation: `UPDATE work_items SET assignee_id = user.id WHERE id = ? AND assignee_id IS NULL`. This pushes the serialization responsibility to the PostgreSQL locking engine, guaranteeing that exactly one concurrent transaction succeeds.

### 6. How does optimistic concurrency work?
We maintain a `version` integer column on work items. When updating, the client passes its known version, and the server runs: `UPDATE work_items SET ... version = version + 1 WHERE id = ? AND version = ?`. If zero rows are returned, it means the item changed concurrently.

### 7. What happens on a stale update?
If the optimistic concurrency check fails, the server throws a `409 Conflict`. The Next.js frontend (via TanStack Query) catches this specific error, displays an inline alert to the user, and automatically invalidates the query to fetch the freshest state from the server.

### 8. Why idempotency keys?
To safely handle network retries, clients generate a UUID `Idempotency-Key` and pass it in the headers. We store these keys in a database table with a unique constraint. If a client retries a `claim` or `create` mutation, the server finds the existing key in the same transaction and returns the previously processed result without re-executing the side effects.

### 9. Why transactional outbox?
Instead of sending events directly to a queue (like Kafka or RabbitMQ) from the API, we insert an `outbox` record inside the exact same PostgreSQL transaction as the core business mutation. This guarantees 100% atomicity—we never end up with a state where the work item is updated but the event failed to publish.

### 10. What happens if the worker crashes?
The worker pulls jobs using `FOR UPDATE SKIP LOCKED`, which places a row-level lock bound to the worker's transaction. If the worker crashes mid-processing, the transaction rolls back, releasing the lock. The outbox record remains in the database in a `pending` state, allowing another worker (or a restarted worker) to safely pick it up on the next poll.

### 11. Why PostgreSQL retrieval instead of a vector DB?
For a single work item context (metadata, recent comments, audit history), the data is bounded, highly structured, and fits within the LLM context limit. Pulling exactly what is needed via deterministic SQL queries is far simpler, avoids duplicating RBAC policies into an external vector index, and is natively explainable.

### 12. How does Ops AI prevent unauthorized retrieval?
The `OpsAiService` executes the exact same authorization check as a human viewer. It loads the requested work item by ID and passes it to the `authorize(user, 'view', { teamId: item.teamId })` function. If the user lacks access, the retrieval fails immediately.

### 13. How do you handle prompt injection?
Work-item content (descriptions, comments) is explicitly formatted in the system prompt under a "CONTEXT" block and labelled as untrusted data. The LLM is instructed to treat it purely as reference material and to ignore any embedded directives. While prompting alone cannot achieve perfect security against all injections, separating system instructions from retrieved data heavily mitigates the risk.

### 14. How would you scale to much larger workloads?
- **Read Scalability:** Introduce read replicas and scale the API horizontally.
- **Worker Scalability:** Deploy more standalone worker processes; the `SKIP LOCKED` pattern naturally allows horizontal scaling of workers against a single table.
- **Queueing:** Replace the polling outbox worker with Logical Replication (e.g., Debezium) feeding Kafka, though this adds significant operational overhead.
- **RAG:** If cross-organization semantic search becomes necessary, deploy a vector store synced via CDC from Postgres.

### 15. What would you improve next week?
Implement true Single Sign-On (SSO/OIDC) to replace the mocked `getCurrentUser()`. Expand the RAG assistant into a multi-turn chat instead of a single question/answer flow. Finally, implement WebSockets or SSE for real-time dashboard and work-item status updates.
