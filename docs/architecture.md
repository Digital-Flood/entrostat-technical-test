# Architecture

## System Overview

The system consists of a React frontend, an Express API, and a PostgreSQL database. The frontend is used to exercise the OTP flow. The backend owns all OTP rules, validation, persistence, and response handling. PostgreSQL stores OTP state and related request metadata.

```text
React web app -> Express API -> Prisma -> PostgreSQL
```

## Boundaries

### Frontend

- Collects user input for OTP request, resend, and verification flows.
- Calls the backend API.
- Displays success, error, loading, and verification states.
- Does not implement OTP business rules locally.

### Backend

- Validates all incoming request payloads.
- Generates and stores OTPs.
- Enforces expiry, resend, rate-limit, latest-code-only, and single-use rules.
- Returns structured API responses to the frontend.

### Database

- Persists OTP records and related metadata.
- Supports checking the latest OTP state for a user identifier.
- Stores enough information to enforce expiry, resend limits, request limits, and verification state.

## Backend Layering

```text
routes -> validators -> controllers -> services -> repositories -> Prisma
```

- Routes define HTTP paths and middleware.
- Validators parse and validate request payloads with Zod.
- Controllers translate HTTP requests into service calls.
- Services contain OTP business rules.
- Repositories isolate database reads and writes.
- Prisma manages typed database access.

## Expected API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Confirm that the API is running. |
| `POST` | `/otp/request` | Request a new OTP for a user identifier. |
| `POST` | `/otp/resend` | Resend or reissue an OTP within configured limits. |
| `POST` | `/otp/verify` | Verify a submitted OTP. |

Endpoint names may be adjusted during implementation if the route structure needs clearer grouping.

## Planned Data Flow

1. The user enters an identifier in the frontend.
2. The frontend sends an OTP request to the API.
3. The API validates the payload and checks request limits.
4. The API creates a new OTP record with expiry metadata.
5. The frontend displays the request result and prompts for the OTP.
6. If the user requests a resend, the API checks resend limits and creates or updates the latest OTP state.
7. When the user submits an OTP, the API validates the submitted code against the latest active record.
8. The API rejects expired, superseded, already-used, or incorrect codes.
9. On successful verification, the API marks the OTP as used and returns a success response.
