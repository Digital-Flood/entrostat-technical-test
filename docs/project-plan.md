# Project Plan

## Project Goals

- Build a small OTP verification service with clear backend rules and a polished frontend testing interface.
- Keep OTP business behaviour deterministic and covered by automated tests.
- Provide a local development setup that can run against PostgreSQL.
- Prepare the project for separate frontend, backend, and database deployment.

## Planned Implementation Phases

1. Project scaffold and documentation.
2. Backend foundation: Express app, TypeScript configuration, validation, error handling, and health route.
3. API contract foundation: shared response shapes, validation error format, and route-level test setup.
4. Database foundation: Prisma schema, migrations, repository layer, and transactional update patterns for OTP state.
5. OTP request flow with expiry metadata, request limits, latest-code supersession, delivery through the configured adapter, and focused tests.
6. OTP resend flow with resend windows, maximum resend counts, latest-code supersession, delivery through the configured adapter, and focused tests.
7. OTP verification flow with latest-code-only validation, expiry rejection, single-use enforcement, and focused tests.
8. Full API test pass for cross-flow behaviour, delivery modes, and edge cases.
9. Frontend testing interface with a demo-mode OTP inbox panel.
10. Deployment configuration and final documentation updates.

## Planned Features

- Request an OTP for an email address.
- Resend an OTP while respecting resend windows and maximum resend counts.
- Deliver requested and resent OTPs through the configured delivery mode.
- Verify an OTP against the latest active code only.
- Reject expired, superseded, already-used, or incorrect OTPs.
- Enforce configurable request limits.
- Return structured API responses for success, validation failures, rate limits, expired codes, superseded codes, reused codes, and incorrect codes.
- Provide a frontend interface for exercising the full OTP flow.
- Provide a demo-mode dev inbox panel that shows recent OTP deliveries without exposing OTPs in normal request or resend responses.

## Frontend Scope

- Build a Vite React TypeScript application.
- Provide forms for requesting, resending, and verifying OTPs.
- Display request status, validation errors, expiry state, and verification results.
- Display a dev inbox panel in demo mode with recent OTP deliveries, including recipient, code, expiry, and created time.
- Use Tailwind CSS for styling.
- Use Framer Motion sparingly for focused interface transitions.
- Keep the frontend as a testing interface rather than a full production account system.

## Backend Scope

- Build a TypeScript Express API.
- Define request and response validation with Zod.
- Implement OTP generation, persistence, resend handling, verification, and invalidation rules.
- Implement OTP delivery behind a service abstraction selected by `OTP_DELIVERY_MODE`.
- In demo mode, capture OTP deliveries in an ephemeral backend-held inbox exposed by a demo-only API route.
- In production mode, send OTP emails through Resend using `RESEND_API_KEY` and `OTP_EMAIL_FROM`.
- Add API tests alongside each route and business rule as it is implemented.
- Keep route handlers thin by separating routing, validation, service logic, and database access.

## Database Scope

- Use PostgreSQL for local and deployed persistence.
- Use Prisma for schema management and database access.
- Store OTP request records, status, expiry, verification state, resend metadata, and rate-limit data as required.
- Use database constraints or transactional updates where needed so concurrent verification attempts cannot both succeed.
- Preserve enough historical OTP state to reject superseded codes deterministically.
- Add migrations once the schema is defined.

## Deployment Scope

- Deploy the frontend to Vercel.
- Deploy the backend to Render.
- Use Neon PostgreSQL for the hosted database.
- Configure environment variables separately for local development and deployed environments.
- Default local development to `OTP_DELIVERY_MODE=demo`.
- Require `OTP_DELIVERY_MODE=production`, `RESEND_API_KEY`, and `OTP_EMAIL_FROM` for production email delivery.
