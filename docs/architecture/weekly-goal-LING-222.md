# Weekly goal and diligent badge (LING-222)

## Summary

The Home weekly-goal card and Profile badge count read engagement state from
`getGamificationSnapshot()`, which merges event-derived gamification with
`getWeeklyGoalState()`.

## Data sources

| Concern | Source | Notes |
| --- | --- | --- |
| Completed lessons | `lesson_progress` via `listCompletedLessons()` | One row per lesson; `completed_at` is authoritative after local complete (AD-001 pull skip). |
| Weekly count | Pure policy `weeklyGoalPolicy.ts` | Derived on every read; local Monday-start week, half-open `[start, start+7d)`. |
| Diligent badge latch | `app_settings` key `engagement.badge_diligent_earned_at` | ISO timestamp; `INSERT OR IGNORE`; not synced. |

## Badge rule (AD-002)

`badgeEarned = latch ∨ anyWeekReachesTarget(rows)`. The first read that derives
true writes the latch in the same synchronous call so time-zone re-bucketing
cannot remove an observed badge (INV-002).

## Reset paths (AD-005)

Local-data wipe and account-replacement both delete all `app_settings` rows
(including the latch) and all `lesson_progress` rows. After reset, counts show
0/6 and the badge is absent until completions are present again (BR-006).

## Module map

- `weeklyGoalPolicy.ts` — pure week math (no I/O).
- `WeeklyGoalBadgeRepository.ts` — latch read/write.
- `weeklyGoal.ts` — `getWeeklyGoalState(now)`.
- `gamification.ts` — snapshot merge and `{id: 'diligent'}` badge append.
