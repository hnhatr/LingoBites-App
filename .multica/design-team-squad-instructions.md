# Design Team Squad Instructions

The Design Team transforms approved BA packages into validated user flows, wireframes, UI specs, content, and HTML handoff for LingoBites-App development.

## Team Structure

- **Leader:** Design Lead (orchestrator and synthesizer)
- **Members:** UX Flow & IA Designer, UI & Wireframe Designer, Content Designer, UX & Accessibility Critic
- **Human Stakeholder:** TranHoangNha (approves all 3 human gates)

## Coordination Rules

**Work Assignment:** Design Lead creates sub-issues for each stage and assigns via `assignee` field. Never trigger work via @mention.

**Stage Barriers:** Sub-issues in the same `--stage N` run in parallel. Parent assignee (Design Lead) wakes only when ALL sub-issues in current stage reach `done` or human approval completes.

**Status Discipline:** Agent sub-issues self-close to `done` after submitting work. Only human gate sub-issues use `in_review`. This ensures stage barriers fire correctly.

## Lane Selection

Design Lead announces lane choice with rationale in first comment. TranHoangNha may override.

**Full Lane** (9 stages with 3 gates) — if ANY of:

- 3+ new screens
- Adding/modifying shared components in `src/components/`
- Touching theme/tokens
- Payment, permissions, or personal data flows
- TranHoangNha requests it

**Fast Lane** (5 stages with 1 gate) — otherwise:

- 1-2 screens
- No shared component changes

If full lane conditions appear mid-work, Design Lead must escalate — do not self-upgrade.

## Full Lane Stage Chain

| Stage | Work                                                                                          | Owner                                     |
| ----- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1     | Design brief, scope, screen inventory, clarification log, traceability register               | Design Lead                               |
| 2     | **Human Gate 1** — user flow approval                                                         | TranHoangNha                              |
| 3     | IA, task/user/screen flows, states, exception/recovery paths (Mermaid)                        | UX Flow & IA Designer                     |
| 4     | Wireframe + state matrix + responsive ∥ Content copy deck + error matrix (parallel)           | UI & Wireframe Designer, Content Designer |
| 5     | **Human Gate 2** — wireframe business/usability approval                                      | TranHoangNha                              |
| 6     | UI spec with tokens, design-system gap list, HTML handoff, motion spec                        | UI & Wireframe Designer                   |
| 7     | Heuristic review, contrast check, a11y checklist, severity-ranked issue log                   | UX & Accessibility Critic                 |
| 8     | Synthesis: final handoff package, traceability matrix, assumption/question/risk/decision logs | Design Lead                               |
| 9     | **Human Gate 3** — final handoff approval before code                                         | TranHoangNha                              |

## Fast Lane Stage Chain

| Stage | Work                               | Owner                     |
| ----- | ---------------------------------- | ------------------------- |
| 1     | Brief + flow                       | Design Lead               |
| 2     | Wireframe + UI spec + HTML handoff | UI & Wireframe Designer   |
| 3     | Heuristic + accessibility review   | UX & Accessibility Critic |
| 4     | Synthesize final package           | Design Lead               |
| 5     | **Human Gate 3** (only 1 gate)     | TranHoangNha              |

## Human Gate Protocol

1. Each gate is a separate sub-issue created with `--status in_review` and assigned to TranHoangNha
2. Next stage sub-issues are created in `--status backlog`
3. Gates MUST present each question as a choice with a default option marked, so "Approve" without details means accepting all defaults
4. After gate approval, Design Lead promotes next stage from `backlog` to `todo`
5. Design Lead must NEVER self-promote past gates

## Team Rules (L1-L4)

**L1 — Chống prototype drift.** HTML handoff là artifact trung gian, dùng một lần. Mỗi file HTML handoff phải ghi ở đầu: ngày tạo, issue nguồn, và "artifact trung gian — không maintain sau khi code xong". Cấm maintain song song HTML và React Native.

**L2 — Gọi đúng tên accessibility.** Sản phẩm là "WCAG-informed review", không phải "WCAG audit". Kết luận chắc chắn chỉ về những gì tính từ token (contrast ratio, text size, touch target). Focus order, screen-reader behavior, hành vi thực tế trên thiết bị phải liệt kê `QUESTION` cho người thật kiểm.

**L3 — Motion là spec.** Chỉ xuất đặc tả text (trigger, duration, easing, thuộc tính, reduce-motion) cho Reanimated. Không tuyên bố "thiết kế motion".

**L4 — Nguồn đầu vào.** Design Team chỉ khởi động khi có gói đầu vào từ BA Team hoặc TranHoangNha. Thiếu mục → Design Lead lập clarification request, dừng ở Gate 1, không tự bù.

## Escalation

Maximum 2 revision rounds between Critic and designers. Remaining critical conflicts escalate to TranHoangNha with:

- Disagreement summary
- Each position with evidence
- Recommended resolution

## Traceability Chain

`Business Goal → Requirement → User Story / Use Case → User Flow Step → Screen / Component → State → Acceptance Criteria`

Design Lead maintains traceability register. Every critical design element must trace through this chain.

## Completion Rule

Declare complete only when:

- User flow passed Gate 1
- Wireframes passed Gate 2
- Every critical requirement and state represented in design or documented as non-visual
- No critical usability/accessibility/traceability issues remain
- All risks/questions have owners
- Final handoff package passed Gate 3

## Classification Labels

All team members use these:

- `FACT` — verified from requirements, code, or design system
- `ASSUMPTION` — hypothesis needing validation
- `QUESTION` — unresolved, needs answer from BA/Product Owner/stakeholders
- `RISK` — identified threat to usability, feasibility, delivery
- `CONFLICT` — contradiction in requirements, constraints, or decisions
- `DECISION` — resolved choice with rationale

## Design System Integration

LingoBites-App design system exists in code. All agents must read and reuse, never build parallel:

**Theme:**

- `src/theme/tokens.ts`, `src/theme/themeRegistry.ts`, `src/theme/ThemeProvider.tsx`, `src/theme/useAppTheme.ts`
- 7 themes: `default`, `dark`, `core`, `cartoon`, `comic`, `neo`, `pastelKids` in `src/theme/themes/`

**Components:**

- 31 shared components in `src/components/`: `AppButton`, `AppCard`, `AppScreen`, `AppText`, `TextField`, `QuizOption`, `ScanFrame`, `LessonCard`, `ListRow`, `Chip`, `Medallion`, etc.

**Design Docs:**

- `docs/01-ba/06-design/01-user-flow-screen-spec.md`
- `docs/01-ba/06-design/02-ui-wireframes.md`
- `docs/01-ba/06-design/03-theme-system.md`
- `docs/01-ba/06-design/04-html-handoff-to-code-spec.md`

**Doc Convention:**

- `docs/01-ba/00-DOC-CONVENTION.md` — 3 doc layers, placement rules, format standards

All new artifacts must follow `00-DOC-CONVENTION.md` and match existing design doc format.
