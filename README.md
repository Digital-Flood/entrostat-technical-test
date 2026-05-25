# Entrostat OTP Assessment

Hello Entrotat!

The project is structured as a small monorepo with a TypeScript Express API, a Vite React frontend, shared TypeScript utilities, Prisma-managed PostgreSQL data access, and Docker Compose support for local database development.

## Important To Know For Testing

The system has separate development and production environments:

- Production: emails are sent only from the deployed production site at https://entrostat-technical-test-web.vercel.app/.
- Development: OTP requests are captured in the local demo inbox instead of being sent by email. Open the demo drawer from the button in the top-right of the screen to view the captured OTP messages.
- The production API runs on Render's free tier, so it may sleep after inactivity. The frontend calls `/health` when it loads and may briefly show an API wake-up state while Render starts the service. If a request is made while the API is cold, the frontend waits for `/health` to respond and retries the action instead of treating Render gateway delays as application errors.

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

Docker Compose is used to run the local PostgreSQL database. Application code still runs on the host through the npm workspace scripts.

Prerequisites:

- Node.js and npm.
- Docker Desktop or a compatible Docker Compose runtime.

Install dependencies from the repository root:

```sh
npm install
```

Create a local environment file:

```sh
cp .env.example .env
```

Start the PostgreSQL container with Docker:

```sh
docker compose up -d postgres
```

This starts a local database using the credentials from `docker-compose.yml` and the default `.env.example` connection string:

```text
postgresql://postgres:postgres@127.0.0.1:5433/entrostat_otp?schema=public
```

Apply the Prisma migration and generate the client:

```sh
npm run db:migrate
npm run db:generate
```

Run the API and web app in separate terminals:

```sh
npm run dev:api
npm run dev:web
```

By default, the API is available at `http://localhost:4000` and the web app is available at `http://localhost:5175`.

With the default `.env`, the API runs in demo delivery mode. Request or resend an OTP from the web app, then use the demo inbox panel to read the captured code. Normal request, resend, and verify API responses do not include OTP codes.

OTP rule settings are edited from the web app while it is running. Defaults are 3 requests per hour, 30 seconds expiry, a 5 minute resend window, and 3 resends. OTP length is fixed at 6 digits.

Stop the local database when you are done:

```sh
docker compose down
```

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
3. Keep the Render start command as `npm run start -w @entrostat-otp/api` so the Express process starts directly. The `/health` endpoint is registered during API boot and is available as soon as the process is listening.
4. Set `OTP_DELIVERY_MODE=production`, `RESEND_API_KEY`, and `OTP_EMAIL_FROM`.
5. Set `DATABASE_URL` to the Neon PostgreSQL connection string.
6. Set `WEB_ORIGIN` to the deployed Vercel origin.
7. Render supplies `PORT`; `API_PORT` is only needed locally.

Neon setup:

1. Create a PostgreSQL database.
2. Use the Neon connection string as `DATABASE_URL` on Render.
3. Run production migrations manually before deployment, or as an explicit deploy-time step, with `npm run db:migrate:deploy`. Do not run migrations from the normal Render start command because free-tier services may wake frequently and every wake should start the API directly.

## Project Status

Steps 1 through 14 are complete. The app includes the OTP API, Prisma persistence, demo and production delivery adapters, the React verification console with demo inbox support, deployment configuration, and final setup documentation.
