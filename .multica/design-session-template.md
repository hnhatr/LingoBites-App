# Design Session: [Feature Name]

## Lane Selection

**Lane:** [Full / Fast]

**Rationale:** [Explain why this lane was chosen based on criteria: number of screens, shared components, theme changes, data sensitivity, or TranHoangNha request]

## Stage Plan

### Full Lane (9 stages, 3 gates)

| Stage | Work                                                                            | Assignee                  | Status  |
| ----- | ------------------------------------------------------------------------------- | ------------------------- | ------- |
| 1     | Design brief, scope, screen inventory, clarification log, traceability register | Design Lead               | todo    |
| 2     | **Human Gate 1** — user flow approval                                           | TranHoangNha              | backlog |
| 3     | IA, task/user/screen flows, states, exception/recovery paths                    | UX Flow & IA Designer     | backlog |
| 4a    | Wireframe + state matrix + responsive                                           | UI & Wireframe Designer   | backlog |
| 4b    | Content copy deck + error matrix                                                | Content Designer          | backlog |
| 5     | **Human Gate 2** — wireframe business/usability approval                        | TranHoangNha              | backlog |
| 6     | UI spec, design-system gap list, HTML handoff, motion spec                      | UI & Wireframe Designer   | backlog |
| 7     | Heuristic review, contrast check, a11y checklist, issue log                     | UX & Accessibility Critic | backlog |
| 8     | Synthesis: final handoff package, traceability matrix, logs                     | Design Lead               | backlog |
| 9     | **Human Gate 3** — final handoff approval                                       | TranHoangNha              | backlog |

### Fast Lane (5 stages, 1 gate)

| Stage | Work                               | Assignee                  | Status  |
| ----- | ---------------------------------- | ------------------------- | ------- |
| 1     | Brief + flow                       | Design Lead               | todo    |
| 2     | Wireframe + UI spec + HTML handoff | UI & Wireframe Designer   | backlog |
| 3     | Heuristic + accessibility review   | UX & Accessibility Critic | backlog |
| 4     | Synthesize final package           | Design Lead               | backlog |
| 5     | **Human Gate 3** (only 1 gate)     | TranHoangNha              | backlog |

## Screen Inventory

[List screens affected by this design session]

| Screen ID | Screen Name | Type                         | Notes |
| --------- | ----------- | ---------------------------- | ----- |
|           |             | [New / Modified / Reference] |       |

## State Matrix

[Track states for each screen - to be filled during design]

| Screen | Normal | Loading | Empty | Error | Success | Disabled | Permission Denied | Other |
| ------ | ------ | ------- | ----- | ----- | ------- | -------- | ----------------- | ----- |
|        | ☐      | ☐       | ☐     | ☐     | ☐       | ☐        | ☐                 |       |

## Input Package from BA Team

**Source Issue:** [VIB-XXX or reference]

**Included:**

- [ ] Problem statement and scope
- [ ] Personas or user groups
- [ ] User goals / JTBD
- [ ] Prioritized user stories or use cases
- [ ] Main, alternative, exception, edge-case flows
- [ ] Business rules
- [ ] Data and validation rules
- [ ] Roles and permissions
- [ ] Acceptance criteria
- [ ] Non-functional requirements
- [ ] Technical constraints
- [ ] Assumption, question, risk, decision logs

**Missing or Unclear:** [List anything missing from the BA package that needs clarification]

## Design Logs

### Assumptions

| ID  | Assumption | Validation Status                   | Owner |
| --- | ---------- | ----------------------------------- | ----- |
|     |            | [Pending / Validated / Invalidated] |       |

### Questions

| ID  | Question | Target                                 | Answer | Status            |
| --- | -------- | -------------------------------------- | ------ | ----------------- |
|     |          | [BA Team / TranHoangNha / Design Team] |        | [Open / Answered] |

**Q8 from VIB-115 (inherited):** Entry point của flashcard — có cần tab thứ tư trong navigation không? Design Lead phải đưa lên Gate 1 kèm phương án và khuyến nghị, không tự chọn.

### Risks

| ID  | Risk | Likelihood            | Impact                | Mitigation | Owner |
| --- | ---- | --------------------- | --------------------- | ---------- | ----- |
|     |      | [Low / Medium / High] | [Low / Medium / High] |            |       |

### Decisions

| ID  | Decision | Rationale | Date | Decider |
| --- | -------- | --------- | ---- | ------- |
|     |          |           |      |         |

### Conflicts

| ID  | Conflict | Parties | Resolution | Status                        |
| --- | -------- | ------- | ---------- | ----------------------------- |
|     |          |         |            | [Open / Resolved / Escalated] |

## Traceability Matrix

[To be maintained by Design Lead]

| Requirement ID | User Story / Use Case | Flow Step | Screen | Component | State | Acceptance Criteria | Status                   |
| -------------- | --------------------- | --------- | ------ | --------- | ----- | ------------------- | ------------------------ |
|                |                       |           |        |           |       |                     | [Mapped / Pending / N/A] |

## Design System Changes

**Tokens Modified:** [None / List]

**New Components:** [None / List with justification]

**Component Modifications:** [None / List with justification]

**Design System Gaps Identified:** [To be filled during Stage 6 or 2]

## Handoff Artifacts

[List of deliverables - populated as work progresses]

- [ ] User flows (Mermaid diagrams)
- [ ] Wireframes
- [ ] UI specifications
- [ ] HTML handoff files (with header: date, issue, "artifact trung gian")
- [ ] Content copy deck
- [ ] Error message matrix
- [ ] Motion specifications
- [ ] Accessibility checklist
- [ ] Review findings log
- [ ] Traceability matrix
- [ ] Final synthesis document

## Completion Checklist

Per Design Team Completion Rule:

- [ ] User flow passed Human Gate 1
- [ ] Wireframes passed Human Gate 2
- [ ] Every critical requirement and state represented in design or documented as non-visual
- [ ] No critical usability/accessibility/traceability issues remain unresolved
- [ ] All open risks and questions have owners
- [ ] Final handoff package passed Human Gate 3

---

**Instructions for Design Lead:**

1. Fill in lane selection and rationale
2. Create sub-issues for each stage according to the selected lane
3. Stage 1 sub-issue is `todo`, all others start as `backlog`
4. Human gate sub-issues use `--status in_review`
5. Promote next stage from `backlog` to `todo` only after current stage completes
6. Update this parent issue's logs throughout the session
7. Self-close stage sub-issues to `done` after submitting work (only gates use `in_review`)
