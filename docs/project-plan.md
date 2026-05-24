# Project Plan

## Project Goals

- Build a small OTP verification service with clear backend rules and a polished frontend testing interface.
- Keep OTP business behaviour deterministic and covered by automated tests.
- Provide a local development setup that can run against PostgreSQL.
- Prepare the project for separate frontend, backend, and database deployment.

## Planned Implementation Phases

1. Project scaffold and documentation.
2. Backend foundation: Express app, TypeScript configuration, validation, error handling, and health route.
3. Database foundation: Prisma schema, migrations, and database access layer.
4. OTP request and resend flow.
5. OTP verification flow.
6. Rate limiting, expiry, latest-code-only validation, and single-use enforcement.
7. Frontend testing interface.
8. Automated tests for API behaviour and OTP business rules.
9. Deployment configuration and final documentation updates.

## Planned Features

- Request an OTP for a user identifier.
- Resend an OTP while respecting resend windows and maximum resend counts.
- Verify an OTP against the latest active code only.
- Reject expired, superseded, already-used, or incorrect OTPs.
- Enforce configurable request limits.
- Return clear API responses for success and validation failures.
- Provide a frontend interface for exercising the full OTP flow.

## Frontend Scope

- Build a Vite React TypeScript application.
- Provide forms for requesting, resending, and verifying OTPs.
- Display request status, validation errors, expiry state, and verification results.
- Use Tailwind CSS for styling.
- Use Framer Motion sparingly for focused interface transitions.
- Keep the frontend as a testing interface rather than a full production account system.

## Backend Scope

- Build a TypeScript Express API.
- Define request and response validation with Zod.
- Implement OTP generation, persistence, resend handling, verification, and invalidation rules.
- Add API tests for core routes and business rules.
- Keep route handlers thin by separating routing, validation, service logic, and database access.

## Database Scope

- Use PostgreSQL for local and deployed persistence.
- Use Prisma for schema management and database access.
- Store OTP request records, status, expiry, verification state, resend metadata, and rate-limit data as required.
- Add migrations once the schema is defined.

## Deployment Scope

- Deploy the frontend to Vercel.
- Deploy the backend to Render.
- Use Neon PostgreSQL for the hosted database.
- Configure environment variables separately for local development and deployed environments.
