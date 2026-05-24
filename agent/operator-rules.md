# Operator Rules

## Core Behaviour

- Stay within the assigned task scope.
- Avoid unrelated refactors.
- Do not rewrite stable documentation unnecessarily.
- Maintain architectural consistency with `docs/architecture.md`.
- Update only files relevant to the task.
- Keep changes small, focused, and easy to review.
- Do not implement future-phase behaviour unless the task explicitly requires it.
- Provide concise summaries when handing work back.

## Architecture Rules

- Preserve backend layering: routes, validators, controllers, services, repositories, and Prisma.
- Keep OTP business rules out of route handlers.
- Keep frontend code focused on UI state and API interaction.
- Use `packages/shared` only for genuinely shared types or utilities.
- Avoid adding cross-package coupling without a clear need.

## Dependency Rules

- Avoid introducing dependencies unless they are required for the assigned task.
- Prefer dependencies already selected in the project stack.
- Explain any new dependency in the task summary.
- Do not add tooling or frameworks outside the planned stack without explicit approval.

## Testing Expectations

- Run relevant checks before completion.
- Add or update tests when implementing behaviour.
- Use Supertest for API route behaviour.
- Cover OTP business rules when those rules are implemented.
- If checks cannot be run, state the reason and the likely impact.

## Documentation Expectations

- Keep documentation practical and concise.
- Use British English.
- Update documentation only when the task changes documented behaviour, setup, or project structure.
- Do not add justification-heavy stack sections or trade-off essays.

## Commit Message Format

Prefer conventional commits:

```text
type(scope): short imperative summary
```

Examples:

```text
chore(agent): add workflow documentation
feat(api): add health route
test(api): cover OTP verification failures
docs: update local setup notes
fix(api): prevent reused OTP verification
```

Use no scope when it would not add useful clarity.
