# Development workflow

## Branch model

| Branch | Purpose | Changes enter through |
| --- | --- | --- |
| main | Stable milestone/release history and the default branch | Reviewed promotion PRs, plus the documented T10 controlled experiment |
| develop | Integration of accepted task changes | Reviewed task PRs |
| feat/tXX-short-description, fix/tXX-short-description, test/tXX-short-description, docs/tXX-short-description | One focused work package or correction | Commits from the responsible executor |

Do not direct-push or force-push main/develop. These are team rules; enforcement is configured and proven in T09. Do not claim that a proposed rule is already enforced. Keep the default branch as main unless the team explicitly changes this decision.

Before starting a task, fetch origin and branch from its current develop commit. For a dependent task, wait until prerequisite interfaces and accepted artifacts are available; a draft contract may be prepared earlier when the plan permits it.

## Issue structure and synchronization

PA02 uses exactly twelve task issues, T01-T12, grouped under the PA02 milestone. Every issue contains the full English description, all execution and review checklist items, expected deliverables, dependencies, boundaries and evidence/blocker sections from the accepted plan. The reviewer is recorded separately from the single assignee.

The plan is the canonical scope/acceptance record; the issue is its English operational mirror and discussion record. Preserve task IDs and checklist-item ordering. When scope, ownership, dependencies or completion states change, update the plan and issue together, reference the PR and leave unverified items unchecked. Do not maintain two independently evolving definitions of done. A reviewer confirms their own review items; the executor must not manufacture reviewer acceptance.

Use these observable states without inventing completed work:

- Ready: prerequisite handoffs are satisfied and the executor can begin.
- In progress: the executor has started; include the task branch or draft PR.
- In review: the PR is ready and an independent reviewer has been requested.
- Done: every task acceptance criterion is evidenced, independent review is accepted and the intended integration/release actions have occurred.
- Blocked: name the missing input, permission, capability or dependency and who can resolve it.

The issue remains open until its own definition of done is satisfied. T05 and T11 may be maintained throughout PA02; their dependencies gate final acceptance rather than the start of record-keeping. T12 additionally requires the accepted ZIP, tag-run and submission confirmation.

## Pull request lifecycle

1. Start a focused task branch from develop and retain the stable task ID in its name.
2. Open a PR into develop with an English technical title, Refs #N, task scope, evidence and an independent reviewer from the issue.
3. Keep contract review ahead of final endpoint implementation. Submit full source/tests/contracts together when the work package requires them; do not split ownership implicitly.
4. Run the actual documented local checks and include commands/results. CI must use the same commands once T09 is implemented. Do not weaken tests, skip suites, call a real model in unit tests or hide failed exits.
5. Apply feedback as the executor. The reviewer verifies, records a GitHub review and updates their review checklist; they do not become a second implementer.
6. Merge only when applicable checks are green, independent approval is present and evidence supports acceptance. Do not bypass an active rule or treat missing CI as a pass.
7. Record the merged PR and synchronize plan/issue completion. Close the issue only if all task-specific gates are satisfied.

Use merge commits for milestone promotions and the T10 experiment so required history remains reachable. Do not squash or delete the break/fix evidence history. Other task PRs may be squashed only when intermediate history is not required as evidence. Never rewrite published main/develop history.

## Issue references and closure

GitHub interprets PR closing keywords only when a PR targets the repository's default branch. main remains the default, so a develop-target PR must use Refs #N and an ordinary issue link; writing a closing keyword does not close the issue on integration merge.

For a develop-target task PR, after merge and complete acceptance the executor or authorized maintainer manually closes the issue with a comment linking the merged PR, verification evidence and reviewer confirmation. A reviewer may verify/close only after those facts exist. If gates remain pending, keep the issue open and state them explicitly. No automatic issue-closing action is installed by this setup.

A main-target promotion may use Closes #N only for issues whose complete acceptance criteria are actually satisfied by that merge. Never blanket-close all PA02 issues during a promotion, and never close T12 before its accepted ZIP and actual submission confirmation. Commit-message closing keywords also take effect when the commit reaches the default branch, so avoid them for work whose completion is still pending.

Reference: [GitHub issue and PR linking semantics](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue).

## Promotion and release

Promote an accepted develop baseline into main through a reviewed PR. Run the applicable local/CI checks on the promotion itself, preserve stable required-check names and verify the resulting main commit. Tag pa2 only on the frozen accepted main commit under T12; verify remote tag SHA and a green tag-event run. Never use a PR run as a substitute for the required tag run or silently force-retag.

T09 must implement CI for PRs targeting both develop and main and for the pa2 tag. It must establish and independently verify required checks/protection on both branches, while retaining the rubric's main-specific evidence. Check repository-plan support and source-sharing rights before changing visibility/settings. Do not buy a plan, expose restricted course material, bypass requirements or claim enforcement from documentation alone.

## T10 controlled experiment

The deliberate contract-break experiment targets protected main, not only develop. First promote a reviewed green baseline containing the endpoint to main. The executor creates a dedicated branch from that main commit, opens the main-target PR and changes implementation only. The contract and tests remain unchanged.

Retain the failing assertion, red run, actual blocked-merge state, break SHA, fix SHA and subsequent green run. The independent reviewer verifies the red/blocked state before the fix. Merge only after the fixed implementation passes and review is accepted; preserve the experiment history and then synchronize the accepted main change back into develop through a reviewed PR. Do not merge a broken implementation or use bypass as experimental evidence.

## Template availability

GitHub issue templates are discovered from the default branch. After this documentation setup is independently reviewed and merged into develop, promote it to main through a PR to make the repository's templates available from the default branch. Templates present only on a feature branch are reviewable artifacts, not an already-active repository policy. No application CI, protection or task completion is implied by installing templates.

See [Contributing](../CONTRIBUTING.md), the [PA02 plan](plans/PA02.md) and the [reference index](reference/README.md).
