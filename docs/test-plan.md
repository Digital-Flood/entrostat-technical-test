# Test Plan

## Testing Strategy

- Use automated tests for backend OTP rules and API responses.
- Use Supertest for HTTP-level API tests.
- Use Vitest or Jest for unit and integration tests.
- Keep database-dependent tests isolated and repeatable.
- Add focused tests alongside each OTP route or service rule as it is implemented.
- Add delivery-mode tests alongside OTP request and resend behaviour.
- Add settings API tests when runtime OTP rule settings change.
- Add frontend tests only where they provide useful coverage of form state, validation display, and API interaction behaviour.

## Key OTP Business Rules To Test

- A user can request an OTP with a valid email address.
- Invalid request payloads are rejected.
- Requested and resent OTPs are delivered through the configured delivery adapter.
- Demo-mode OTP deliveries are captured for the dev inbox without appearing in normal request or resend responses.
- Production-mode OTP deliveries are sent through the Resend email client without appearing in normal request or resend responses.
- Runtime settings can be read and updated through the settings API.
- OTPs expire after the configured expiry duration.
- OTP defaults are 3 requests per hour, 30 seconds expiry, a 5 minute resend window, 3 resends, and fixed 6 digit codes.
- A submitted OTP must match the latest active OTP for the email address.
- Older OTPs are rejected after a newer code is issued.
- A verified OTP cannot be used again.
- Incorrect OTP submissions are rejected.
- Resend requests respect the configured resend window.
- Resends within the window deliver the original OTP code and update expiry.
- Resend windows are currently measured from the latest OTP record in the request group, and the exact boundary remains valid.
- Resend requests respect the maximum resend count.
- Request attempts respect the maximum requests per hour.
- New OTP requests silently retry if generation produces a code already issued to that user in the previous 24 hours.

## Edge Cases

- Verification after expiry.
- Verification after successful prior use.
- Verification using a code from a previous request.
- Multiple rapid OTP requests for the same email address.
- Multiple resend attempts near the configured limit.
- Duplicate generated OTP codes for the same email within 24 hours.
- Settings updates followed by request and resend operations without a page reload.
- Missing, malformed, or unsupported email addresses.
- Boundary timing around expiry and resend windows.
- Database errors during request, resend, or verification.
- Resend delivery failures during production-mode request or resend.
- Missing Resend configuration when production delivery mode is enabled.
- Resend API rejection when production delivery is enabled.
- Dev inbox endpoint access while production delivery mode is enabled.
- API calls made with unexpected content types or malformed JSON.

## Manual Review Checklist

- Local PostgreSQL starts with Docker Compose.
- Environment variables are documented and loaded correctly.
- API health route responds successfully.
- API success and error responses use the documented response envelope.
- OTP request flow works from the frontend.
- OTP resend flow shows clear user feedback.
- Demo-mode dev inbox shows recent OTP deliveries after request and resend.
- Production mode hides or disables the dev inbox.
- OTP verification flow shows success and failure states.
- Settings modal opens from the OTP Guard header, saves new rule values, and affects the next request or resend without reload.
- Expired, superseded, reused, and incorrect OTPs produce clear responses.
- Automated tests pass locally.
- README setup instructions match the implemented scripts.
- Deployment environment variables, including Resend delivery configuration, are documented.
- Vercel, Render, and Neon setup notes match the committed configuration files.
