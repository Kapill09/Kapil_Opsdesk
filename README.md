# OpsDesk

OpsDesk is an internal operational-work management application for the Newtonite Software Engineering Challenge. It provides a robust and reliable platform to track customer issues, engineering problems, production incidents, and operational tasks.

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

### Environment Variables
1. Ensure you have your Neon PostgreSQL connection string.
2. Add it to a `.env.local` (and optionally `.env`) file in the root:
```env
DATABASE_URL="postgresql://user:password@host/dbname"
```

### Installation
Install all dependencies:
```bash
npm install
```

### Database Migration & Seeding
Push the Drizzle schema directly to Neon:
```bash
npx drizzle-kit push
```

Seed the database with deterministic test data:
```bash
npm run db:seed
```

### Development
Start the local server:
```bash
npm run dev
```

### Testing
Run unit and integration tests via Vitest:
```bash
npm run test
```
