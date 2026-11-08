# AI-log input — T02

This task entry is input for T11's root AI-LOG.md, not a substitute for the milestone report or an independent review.

## 2026-11-09 — T02 model, store, fixtures and verification

Tool: Codex assistant.

Asked for: preserve the existing T02 branch/plan while relocating work to the D: repository, propose a concrete publish data foundation from the brief/FAQ, then implement the accepted plan.

Kept: assistant-proposed TypeScript model, synchronous in-memory store, instance isolation, direct fixture lifecycle, TA-decision-based summary, data tests, documentation and task evidence.

Changed: the requester clarified that Phuc's draft is not binding and T02 supplies the design for T03/T08; the requester chose review-count summary instead of a score snapshot and accepted the proposed storage limits. The assistant developed the existing plan into the implementation specification and used npm.cmd because PowerShell blocks npm.ps1.

Rejected: treating the model verdict as a TA decision, deriving T02 from Phuc's draft, adding a grading pipeline or deferred endpoints, and claiming smoke/data checks establish the complete PA02 quality gate. No such endpoints or pipeline were implemented and then removed.

By hand: the requester supplied scope, ownership and design direction and authorized implementation. Implementation/tests/docs were authored by the assistant; there is no evidence here of student-authored code or Vy's independent review. The executor remains responsible for understanding and explaining the result.

Verification and environment limitations are recorded in [the evidence record](README.md). No real user data, provider calls, model keys or assistant transcripts are included.
