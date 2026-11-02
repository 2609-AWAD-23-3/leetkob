---
name: Work package
about: Track one independently reviewable task with a single executor and full acceptance criteria.
title: "[PAxx][Txx] Technical task title"
labels: "type:task"
assignees: ""
---

## Task metadata

- Milestone and task ID:
- Executor: @<account>
- Independent reviewer: @<different-account>
- Canonical plan section:
- Dependencies: task IDs and issue links, or None

Use English, technical wording and no decorative icons. Create one issue per work package, not per checkbox. The reviewer is not a second executor.

## Description

Describe the complete work package and observable behavior. Do not expand accepted scope silently.

## Execution checklist

- [ ] Replace with every execution checklist item from the accepted plan, in order.

## Review checklist

- [ ] Replace with every independent review checklist item from the accepted plan, in order.

## Expected deliverables and acceptance result

List the artifacts, required behavior and observable acceptance outcome.

## Boundaries and handoffs

Specify file ownership, teammate inputs, shared-file handoffs, account/permission boundaries and excluded work.

## Evidence and actual results

Not updated. Add PR/commit/run links and reproducible results as they become available. Do not invent evidence or mark unobserved work complete.

## Progress and blockers

Not updated. Name missing dependencies, permissions, inputs or capabilities and the responsible resolver.

## Integration and closure

Ordinary task PRs target develop and reference this issue with Refs #N. main remains the default branch, so a develop merge does not automatically close this issue. Close manually only after all task acceptance criteria, independent review and the intended merge are verified. Release tasks retain their tag/ZIP/submission gates. Synchronize checklist state and evidence with the canonical plan; do not maintain conflicting definitions of done.
