## Summary

Describe the problem, technical approach and observable result. Use English and no decorative icons.

## Task and issue references

- Task ID:
- Related issue: Refs #<number>
- Canonical plan section:
- Independent reviewer: @<account>
- Target branch and rationale:

For develop-target PRs, use Refs and close the issue manually only after accepted merge and all task gates. Use closing keywords on main-target PRs only when that merge truly completes the issue. Do not close release/submission issues before delivery evidence exists.

## Scope and ownership

- Changed components and artifacts:
- Shared-file handoffs or approved interface changes:
- Out of scope:

## Verification

| Command or observable check | Result | Evidence |
| --- | --- | --- |
| Replace with an actual command/check | Not run / passed / failed, with reason | Run URL or reproducible output |

Do not report missing CI as a passing check. Explain tests not run and remaining blockers. Preserve failure evidence required by the task.

## Contract, data and security impact

Describe contract/version changes, state/fixture changes, authorization/ownership behavior, secrets/cost impact and any migration or compatibility considerations. State not applicable with a reason where appropriate. Never include credentials or sensitive logs.

## Checklist

- [ ] The PR targets the intended branch and identifies its task, issue and independent reviewer.
- [ ] Changes stay within the executor's agreed scope; shared-file changes follow the documented handoff.
- [ ] Task-specific execution checks and evidence are complete, or the PR remains draft with explicit blockers.
- [ ] Actual verification commands/results and any checks not run are documented.
- [ ] Contract/tests remain aligned; assertions or eval labels were not weakened merely to pass.
- [ ] No credentials, assistant memory, cleanup backups or unrelated artifacts are included.
- [ ] The plan and issue mirror agree on scope, checklist state, dependencies and evidence.
- [ ] Review items remain unconfirmed until the independent reviewer actually verifies them.

## Reviewer record

The requested reviewer records an actual GitHub review from their own account, verifies the task's review checklist and cites defects or acceptance evidence. The author must not approve their own PR. Reviewer approval is not implied by this template.

## Remaining work and issue closure

List any acceptance criteria that remain open after this PR. Identify who may close the issue, and only after which evidence/merge/delivery gates. A merged PR does not automatically complete every task.
