# Architecture

## System Overview

The system consists of a React frontend, an Express API, a PostgreSQL database, and an OTP delivery boundary. The frontend is used to exercise the OTP flow. The backend owns all OTP rules, validation, persistence, delivery orchestration, and response handling. PostgreSQL stores OTP state and related request metadata.

```text
React web app -> Express API -> Prisma -> PostgreSQL
                         |
                         -> OTP delivery adapter
```

## Boundaries

### Frontend

- Collects user input for OTP request, resend, and verification flows.
- Calls the backend API.
- Displays success, error, loading, and verification states.
- Displays a demo-mode dev inbox panel for recent OTP deliveries when demo delivery is active.
- Does not implement OTP business rules locally.

### Backend

- Validates all incoming request payloads.
- Generates and stores OTPs.
- Delivers OTPs through the configured delivery adapter.
- Enforces expiry, resend, rate-limit, latest-code-only, and single-use rules.
- Returns structured API responses to the frontend.
- Owns response status mapping for validation errors, rate limits, incorrect codes, expired codes, superseded codes, reused codes, and successful verification.

### Database

- Persists OTP records and related metadata.
- Supports checking the latest OTP state for a user identifier.
- Stores enough information to enforce expiry, resend limits, request limits, and verification state.
- Preserves enough OTP history to identify superseded codes.
- Uses transactional or conditional writes where needed to prevent double verification under concurrent requests.

### OTP Delivery

- Uses `OTP_DELIVERY_MODE=demo|production` to select delivery behaviour.
- Demo mode captures OTP deliveries in an ephemeral backend-held inbox for local testing.
- Production mode sends OTP emails through Resend using `RESEND_API_KEY` and `OTP_EMAIL_FROM`.
- Normal OTP request and resend responses should not include the generated code.

## Backend Layering

```text
routes -> validators -> controllers -> services -> repositories -> Prisma
                                      -> delivery adapters
```

- Routes define HTTP paths and middleware.
- Validators parse and validate request payloads with Zod.
- Controllers translate HTTP requests into service calls.
- Services contain OTP business rules.
- Repositories isolate database reads and writes.
- Delivery adapters isolate demo inbox capture and Resend email sending.
- Prisma manages typed database access.

## Expected API Endpoints

| Method | Endpoint         | Purpose                                            |
| ------ | ---------------- | -------------------------------------------------- |
| `GET`  | `/health`        | Confirm that the API is running.                   |
| `POST` | `/otp/request`   | Request a new OTP for an email address.            |
| `POST` | `/otp/resend`    | Resend or reissue an OTP within configured limits. |
| `POST` | `/otp/verify`    | Verify a submitted OTP.                            |
| `GET`  | `/dev/otp-inbox` | Return recent demo OTP deliveries in demo mode.    |

Endpoint names may be adjusted during implementation if the route structure needs clearer grouping.

## API Response Shape

API responses should use one consistent envelope so the frontend and tests can handle outcomes predictably.

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

Planned error codes should cover validation failures, rate limits, resend limits, expired OTPs, superseded OTPs, reused OTPs, incorrect OTPs, missing records, and unexpected server errors.

## Planned Data Flow

1. The user enters an email address in the frontend.
2. The frontend sends an OTP request to the API.
3. The API validates the payload and checks request limits.
4. The API creates a new OTP record with expiry metadata and supersedes previous active records for that email address.
5. The API delivers the OTP through the active delivery adapter.
6. In demo mode, the frontend can read recent deliveries from the dev inbox endpoint.
7. The frontend displays the request result and prompts for the OTP.
8. If the user requests a resend, the API checks resend limits, creates the next latest OTP state, and delivers the new OTP.
9. When the user submits an OTP, the API validates the submitted code against the latest active record.
10. The API rejects expired, superseded, already-used, or incorrect codes.
11. On successful verification, the API marks the OTP as used with a conditional or transactional write and returns a success response.
