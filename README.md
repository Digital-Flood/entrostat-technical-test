# Entrostat OTP Assessment

A full-stack OTP verification system for the Entrostat technical assessment.

The project is structured as a small monorepo with a TypeScript Express API, a Vite React frontend, shared TypeScript utilities, Prisma-managed PostgreSQL data access, and Docker Compose support for local database development.

## Key Features

- Request an OTP for an email address.
- Resend OTPs within defined resend limits.
- Expire OTPs after a configurable duration.
- Validate only the latest issued OTP.
- Enforce single-use verification.
- Apply request and resend rate limits.
- Provide a frontend testing interface for the OTP flow.
- Provide a demo-mode OTP inbox for local testing.
- Cover core OTP business rules with automated tests.

## Tech Stack

- Monorepo: npm workspaces
- Backend: Node.js, Express, TypeScript
- Frontend: Vite, React, TypeScript
- Styling: Tailwind CSS
- Animation: Framer Motion
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- Testing: Vitest or Jest, with Supertest for API tests
- Local development: Docker Compose
- Deployment: Vercel frontend, Render backend, Neon PostgreSQL database

## Repository Structure

```text
.
├── apps/
│   ├── api/
│   │   └── src/
│   └── web/
│       └── src/
├── packages/
│   └── shared/
│       └── src/
├── prisma/
├── docs/
│   ├── architecture.md
│   ├── project-plan.md
│   └── test-plan.md
├── agent/
│   ├── controller.md
│   ├── operator-rules.md
│   ├── task-board.md
│   └── task-template.md
├── docker-compose.yml
├── package.json
├── .env.example
└── .gitignore
```

## Local Setup

Install dependencies from the repository root:

```sh
npm install
```

Root tooling commands are available from the repository root:

```sh
npm run dev
npm run dev:api
npm run dev:web
npm run build:web
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run typecheck
npm run lint
npm run format:check
npm test
npm test -w @entrostat-otp/api
```

Expected local workflow:

1. Install dependencies.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL with Docker Compose.
4. Run database migrations with `npm run db:migrate`.
5. Start the API and web development servers with `npm run dev:api` and `npm run dev:web`.

## Environment Variables

Environment variables are listed in `.env.example`. Concrete values should be supplied locally and in deployment environments.

The web app calls the API configured by `VITE_API_BASE_URL`. Local API CORS defaults allow localhost Vite dev server origins.

## Deployment

Deployment configuration will be added after the application implementation is in place.

Planned deployment targets:

- Frontend: Vercel
- Backend: Render
- Database: Neon PostgreSQL

## Project Status

Steps 1 through 13 complete: project structure, documentation skeleton, agent orchestration documentation alignment, root tooling foundation, the initial Express API scaffold with a health route, the shared API response contract package, the API route test harness with baseline health/error coverage, the Prisma PostgreSQL persistence foundation for OTP records, the `POST /otp/request` flow with request limits, supersession, expiry metadata, and demo delivery capture, the `POST /otp/resend` flow with resend windows, resend limits, supersession, expiry metadata, and demo delivery capture, the `POST /otp/verify` flow with latest-code-only validation, expiry rejection, single-use enforcement, conditional persistence, focused tests, the cross-flow API test pass for request/resend/verify edge cases, the initial Vite React web scaffold, and the wired frontend OTP verification console with a demo inbox backed by `GET /dev/otp-inbox`.

The next step is deployment configuration, Resend environment setup, and the final documentation pass. Production email delivery remains deferred to that step.
