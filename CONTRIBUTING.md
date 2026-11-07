# Contributing

This repository uses one accepted PA02 work package per issue and independently reviewed pull requests. Technical issue descriptions, pull requests, templates and workflow documentation are written in English without decorative icons. The accepted Vietnamese plan and original course references retain their source language.

## Start here

- Read the [development workflow](docs/workflow.md).
- Read the [PA02 plan](docs/plans/PA02.md) and the assigned task issue.
- Use the [PA02 milestone](https://github.com/2609-AWAD-23-3/leetkob/milestones) to find task ownership and dependencies.

Do not begin an implementation merely because an issue has been assigned. Check its handoff dependencies first; draft contracts and submission records may be prepared earlier as specified in the task.

## Ownership and review

| Role | Executor account | Name |
| --- | --- | --- |
| A | @vinny2707 | Nguyen Khac Vuong |
| B | @tranquocvy | Tran Quoc Vy |
| C | @BHVPhuc | Buu Huynh Vinh Phuc |

Each task has exactly one hands-on executor and a different reviewer, as recorded in the plan and issue. Inputs from teammates do not change file ownership. Request shared-file changes from their executor instead of silently editing another package. An author must not approve their own PR, and a reviewer must not implement or repackage the artifact they are verifying.

## Pull requests

1. Create a short-lived task branch from an up-to-date develop branch. Use names such as feat/t01-project-skeleton, test/t04-quality-harness or docs/t11-submission-records.
2. Keep commits focused and use a technical title such as feat: add TA review queue. Never commit secrets, assistant memory, cleanup backups or unrelated coursework.
3. Open a draft PR early if useful. Ordinary task PRs target develop; milestone promotions target main. The controlled T10 experiment is the documented main-target exception.
4. Include the task ID, an explicit Refs #N issue reference, scope, actual verification commands/results, limitations and the requested independent reviewer. Complete the PR template honestly.
5. Update your execution checklist and evidence in the plan and its issue mirror. The reviewer updates the review checklist and records an actual GitHub review from their own account. Leave unverified boxes unchecked.
6. Merge only after the task-specific gates, independent approval and all applicable checks pass. Until executable CI is implemented, record the checks actually available and any missing gate; absence of CI is not a green check.
7. Close the issue only when its full acceptance criteria are satisfied and the corresponding PR has been merged. Release/submission tasks also require their delivery evidence, not merely a merge.

See the workflow for default-branch issue-closing behavior, main/develop promotion and T10 evidence preservation.

## Current implementation boundary

This candidate includes the runnable T01 application foundation and README setup procedure. T04 still owns the complete quality commands/harness; T09 owns CI and protections. Neither smoke tests nor workflow templates establish those later tasks as complete. PA02 requires only publish; existing empty submissions/review-queue plugins do not require implementation for PA02. The full scope synchronization remains in PR #16 until reviewed and integrated.
