<!-- code-review-graph MCP tools -->

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool                        | Use when                                               |
| --------------------------- | ------------------------------------------------------ |
| `detect_changes`            | Reviewing code changes — gives risk-scored analysis    |
| `get_review_context`        | Need source snippets for review — token-efficient      |
| `get_impact_radius`         | Understanding blast radius of a change                 |
| `get_affected_flows`        | Finding which execution paths are impacted             |
| `query_graph`               | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes`     | Finding functions/classes by name or keyword           |
| `get_architecture_overview` | Understanding high-level codebase structure            |
| `refactor_tool`             | Planning renames, finding dead code                    |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

# AI Working Rules (VibeGuard)

You (the AI) MUST follow these rules throughout this repository.

## 1. Process before coding

- For complex requests (multiple files, new features, refactors, database/authitecture changes):
  CREATE A PLAN FIRST—list files to create, edit, or delete; implementation steps; and new dependencies—then WAIT for user approval before coding.
- If the request is unclear, ASK CLARIFYING QUESTIONS before acting; do not guess.

## 2. Scope of changes

- ONLY edit files directly related to the request.
- DO NOT refactor, rename, or reformat unrelated code opportunistically.
- DO NOT delete code or files without explicitly identifying them and receiving approval.

## 3. Dependencies

- DO NOT add libraries or packages without permission. State their names and reasons, then ask first.
- Prefer what is already available in the project.

## 4. Git

- Work in small steps. After each complete, runnable step, propose a commit with a clear message (for example, `feat|fix|refactor: short description`).
- Use a separate branch for large features; do not commit directly to main.

## 5. Reporting

- At the end of every session that changes files, write a report to `.ai-logs/reports/<session_id>.md` (the hook will remind you): summarize the work, changed files and reasons, new dependencies, and items the user should review carefully.

## 6. Quality

- New code must be consistent with the project's existing style.
- Do not hardcode secrets or API keys. Do not log sensitive data.
- Clearly warn about risky changes (migrations, data deletion, or public API changes).
