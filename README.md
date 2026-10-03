# OpsFlow AI

OpsFlow AI is an internal operational-work management application for the Newtonite Software Engineering Challenge. It provides a robust and reliable platform to track customer issues, engineering problems, production incidents, and operational tasks.

## Current Architecture
The system is built as a modular monolith. It uses a server-driven architecture where the database is the source of truth, avoiding unnecessary microservices. It features:
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Backend API**: Next.js Route Handlers
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Testing**: Vitest, React Testing Library

## Planned Feature Areas
- **Authentication & Authorization**: Resource-level permissions (Member, Lead, Admin).
- **Optimistic Concurrency**: Stale data protection using versioning.
- **Idempotency**: Preventing duplicate operations using Idempotency Keys.
- **Outbox Pattern Worker**: Reliable background processing without Kafka/Redis.
- **AI/RAG Layer**: Contextual AI assistance for operations using LangChain/vector databases.

## Local Setup

### Prerequisites
- Node.js (v20+)
- Docker & Docker Compose

### Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
(No real secrets are needed for initial local setup).

### Starting the Database
Start the PostgreSQL instance:
```bash
docker compose up -d
```

### Development Commands
Install dependencies:
```bash
npm install
```

Run database migrations/push schema:
```bash
npx drizzle-kit push
```

Start the development server:
```bash
npm run dev
```

Run tests:
```bash
npm run test
```
