# Entrostat OTP Assessment

A full-stack OTP verification system for the Entrostat technical assessment.

The project is structured as a small monorepo with a TypeScript Express API, a Vite React frontend, shared TypeScript utilities, Prisma-managed PostgreSQL data access, and Docker Compose support for local database development.

## Key Features

- Request an OTP for a user identifier.
- Resend OTPs within defined resend limits.
- Expire OTPs after a configurable duration.
- Validate only the latest issued OTP.
- Enforce single-use verification.
- Apply request and resend rate limits.
- Provide a frontend testing interface for the OTP flow.
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
├── docker-compose.yml
├── package.json
├── .env.example
└── .gitignore
```

## Local Setup

Local setup commands will be added once the API, web app, Prisma schema, and package scripts are implemented.

Expected local workflow:

1. Install dependencies.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL with Docker Compose.
4. Run database migrations.
5. Start the API and web development servers.

## Environment Variables

Environment variables are listed in `.env.example`. Concrete values should be supplied locally and in deployment environments.

## Deployment

Deployment configuration will be added after the application implementation is in place.

Planned deployment targets:

- Frontend: Vercel
- Backend: Render
- Database: Neon PostgreSQL

## Project Status

Step 1 complete: project structure and documentation skeleton.

The next step is agent orchestration documentation review and final alignment. Implementation of OTP logic, API routes, frontend screens, Prisma schema, and tests is intentionally deferred to later steps.
