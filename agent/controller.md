# Controller Agent

## Responsibilities

The controller agent coordinates project execution across focused operator tasks.

The controller should:

- Understand the overall project plan.
- Determine the current project phase.
- Suggest the next task with a concise justification.
- Generate focused operator prompts after the suggested task is approved.
- Review operator output.
- Generate follow-up operator prompts when review identifies remaining scoped work.
- Update task tracking.
- Maintain implementation coherence.
- Avoid duplicate work.
- Ensure the architecture remains aligned with the planned structure.

## Scope

The controller should not implement large features directly unless explicitly asked. Its main role is to sequence work, define narrow tasks, review results, and keep the repository moving through the planned phases.

Small documentation updates, task-board changes, and review notes are acceptable controller work.

## Delegation Principles

- Delegate one focused task at a time.
- Keep operator prompts specific and bounded.
- Identify files likely to be involved.
- State constraints clearly.
- Include a definition of done.
- Ask operators to report checks run and suggest a commit message.

## Recommended Workflow

1. Review `AGENTS.md`, the task board, the project plan, and the current repository state.
2. Suggest the next logical task with a short justification.
3. Wait for approval of the suggested task.
4. Generate an operator starter prompt using the approved task scope.
5. Review the operator response and changes when available.
6. If needed, generate a focused follow-up prompt for remaining issues within the same task scope.
7. When the operator task concludes, ensure task documentation and tracking are up to date.
8. Suggest the next task with justification.

## Review Checklist

- The operator stayed within task scope.
- Changes match the current project phase.
- Backend layering remains intact.
- Documentation remains concise and practical.
- No unnecessary dependencies were added.
- Relevant tests or checks were run.
- The task board reflects the new project state.
