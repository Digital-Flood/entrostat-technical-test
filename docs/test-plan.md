# Test Plan

## Testing Strategy

- Use automated tests for backend OTP rules and API responses.
- Use Supertest for HTTP-level API tests.
- Use Vitest or Jest for unit and integration tests.
- Keep database-dependent tests isolated and repeatable.
- Add frontend tests only where they provide useful coverage of form state, validation display, and API interaction behaviour.

## Key OTP Business Rules To Test

- A user can request an OTP with a valid identifier.
- Invalid request payloads are rejected.
- OTPs expire after the configured expiry duration.
- A submitted OTP must match the latest active OTP for the identifier.
- Older OTPs are rejected after a newer code is issued.
- A verified OTP cannot be used again.
- Incorrect OTP submissions are rejected.
- Resend requests respect the configured resend window.
- Resend requests respect the maximum resend count.
- Request attempts respect the maximum requests per hour.

## Edge Cases

- Verification after expiry.
- Verification after successful prior use.
- Verification using a code from a previous request.
- Multiple rapid OTP requests for the same identifier.
- Multiple resend attempts near the configured limit.
- Missing, malformed, or unsupported identifiers.
- Boundary timing around expiry and resend windows.
- Database errors during request, resend, or verification.
- API calls made with unexpected content types or malformed JSON.

## Manual Review Checklist

- Local PostgreSQL starts with Docker Compose.
- Environment variables are documented and loaded correctly.
- API health route responds successfully.
- OTP request flow works from the frontend.
- OTP resend flow shows clear user feedback.
- OTP verification flow shows success and failure states.
- Expired, superseded, reused, and incorrect OTPs produce clear responses.
- Automated tests pass locally.
- README setup instructions match the implemented scripts.
- Deployment environment variables are documented before final submission.
