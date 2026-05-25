# Entrostat OTP Assessment

A full-stack OTP verification system for the Entrostat technical assessment.

The project is structured as a small monorepo with a TypeScript Express API, a Vite React frontend, shared TypeScript utilities, Prisma-managed PostgreSQL data access, and Docker Compose support for local database development.

## Key Features

- Request an OTP for an email address.
- Resend OTPs within defined resend limits.
- Expire OTPs after a runtime-configurable duration.
- Validate only the latest issued OTP.
- Enforce single-use verification.
- Apply runtime-configurable request and resend limits.
- Provide a frontend testing interface for the OTP flow.
- Provide a settings modal for adjusting OTP rule values while using the site.
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

Create a local environment file:

```sh
cp .env.example .env
```

Start PostgreSQL:

```sh
docker compose up -d postgres
```

Apply the Prisma migration and generate the client:

```sh
npm run db:generate
npm run db:migrate
```

Run the API and web app in separate terminals:

```sh
npm run dev:api
npm run dev:web
```

With the default `.env`, the API runs in demo delivery mode. Request or resend an OTP from the web app, then use the demo inbox panel to read the captured code. Normal request, resend, and verify API responses do not include OTP codes.

OTP rule settings are edited from the web app while it is running. Defaults are 3 requests per hour, 30 seconds expiry, a 5 minute resend window, and 3 resends. OTP length is fixed at 6 digits.

Run checks from the repository root:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm test -w @entrostat-otp/api
npm run build -w @entrostat-otp/web
npm run build -w @entrostat-otp/api
```

## Environment Variables

Environment variables are listed in `.env.example`. Concrete values should be supplied locally and in deployment environments.

| Variable            | Required       | Use                                                                                                                         |
| ------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | API            | PostgreSQL connection string for Prisma. Use the Neon pooled connection string in deployment.                               |
| `API_PORT`          | Local API      | Local API port. Render supplies `PORT`, which the API also honours.                                                         |
| `WEB_PORT`          | Local web      | Vite dev server port.                                                                                                       |
| `VITE_API_BASE_URL` | Web            | Browser-facing API base URL. Set this to the Render service URL in Vercel.                                                  |
| `WEB_ORIGIN`        | API deployment | Allowed deployed frontend origin for CORS, for example the Vercel URL. Localhost origins are allowed for local development. |
| `OTP_DELIVERY_MODE` | API            | `demo` for local inbox capture, `production` for Resend email sending.                                                      |
| `RESEND_API_KEY`    | Production API | Resend API key when `OTP_DELIVERY_MODE=production`.                                                                         |
| `OTP_EMAIL_FROM`    | Production API | Verified Resend sender address.                                                                                             |
| `NODE_ENV`          | API            | Runtime environment.                                                                                                        |

The web app calls the API configured by `VITE_API_BASE_URL`. Local API CORS defaults allow localhost Vite dev server origins.

OTP rule values are not deployment environment variables. The API keeps them in memory for this assessment and exposes `GET /settings/otp` and `PUT /settings/otp` for the frontend settings modal.

## Deployment

Deployment configuration is included for the planned targets:

- `apps/web/vercel.json` for the Vercel frontend.
- `render.yaml` for the Render backend.
- Neon PostgreSQL through `DATABASE_URL`.

Vercel setup:

1. Create a Vercel project with root directory `apps/web`.
2. Set `VITE_API_BASE_URL` to the Render API URL.
3. Deploy using the committed `apps/web/vercel.json`.

Render setup:

1. Create a Render Blueprint from `render.yaml`, or mirror its build and start commands in a web service.
2. Keep the Render build command as `npm ci --include=dev && npm run build -w @entrostat-otp/api`; the API build needs workspace build tooling.
3. Set `OTP_DELIVERY_MODE=production`, `RESEND_API_KEY`, and `OTP_EMAIL_FROM`.
4. Set `DATABASE_URL` to the Neon PostgreSQL connection string.
5. Set `WEB_ORIGIN` to the deployed Vercel origin.
6. Render supplies `PORT`; `API_PORT` is only needed locally.

Neon setup:

1. Create a PostgreSQL database.
2. Use the Neon connection string as `DATABASE_URL` on Render.
3. The Render start command runs `npm run db:migrate:deploy` before starting the API. The Prisma CLI is a runtime dependency so migration deploy remains available when `NODE_ENV=production`.

## Project Status

Steps 1 through 14 are complete. The app includes the OTP API, Prisma persistence, demo and production delivery adapters, the React verification console with demo inbox support, deployment configuration, and final setup documentation.
