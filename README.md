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

## Available Pages & Routes
- `/`: Dashboard showing system-wide operational metrics
- `/work-items`: Filterable, paginated, and authorized list of work items
- `/work-items/new`: Create a new work item for your team
- `/work-items/[id]`: Detailed view of an item including comments and activity timeline

## Identity & Authorization Model
- **Authentication**: **Development identity is used for the assessment; production authentication/SSO is not implemented.** The application automatically selects the first seeded user from the database (`getCurrentUser()` mock) for development simplicity.
- **Authorization**: Role-Based Access Control (RBAC) is implemented **server-side**.
  - Users can only access resources belonging to teams they are members of.
  - UI strictly hides actions unavailable to users (e.g. Lead/Admin only actions), but **API endpoints are the authoritative security layer**.
  - Missing or unauthorized identity will gracefully return 401 or 403 respectively, with UI appropriately masking `404` for secure unpermitted resource hiding.
