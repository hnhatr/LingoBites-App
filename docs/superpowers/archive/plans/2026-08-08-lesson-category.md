# Lesson Category Classification Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake `index % 4` subject-rotation used to color/label/filter lessons on the "Bài học" screen with a real `category` derived from each lesson's actual content and persisted in SQLite, so the Ngữ pháp/Từ vựng/Thành ngữ filter tabs return correct (not arbitrary) results.

**Architecture:** Add a `category` column to the `lessons` table. `LessonRepository.saveLesson()` derives the category once, at save time, by comparing `grammar_points.length` vs `vocabulary.length` in the validated `AIOutput` (ties/zero → `'vocabulary'`). The value is persisted and read back through `listLessons()`/`getLessonById()`. `useLibraryStore` stops synthesizing a subject from list position and instead filters/labels directly from `item.category`.

**Tech Stack:** React Native, TypeScript, `react-native-quick-sqlite`, Zustand, Jest.

## Global Constraints

- Only `'grammar'` and `'vocabulary'` will ever be auto-assigned — there is no data in `AIOutput` to reliably detect idioms or conversation content. The `'Thành ngữ'` filter chip stays in the UI but will legitimately show the empty state until a future feature adds real idiom detection. **Do not** remove the chip or touch `LessonsHistoryScreen.tsx` filter chip list — out of scope for this fix (per user decision).
- Do not add a manual category picker UI — auto-derivation only (per user decision).
- Follow the existing migration pattern in `src/shared/db/migrations.ts`: append-only array of idempotent SQL strings, never edit an already-shipped `CREATE TABLE` statement.
- `runMigrations()` re-executes every string on **every app launch** (see `src/shared/db/database.ts`), so the new migration statement must be safe to run repeatedly — use `ADD COLUMN IF NOT EXISTS` (supported by SQLite ≥ 3.35, which `react-native-quick-sqlite` bundles).
- Keep changes minimal and localized to the files listed below — no unrelated refactors.

---

## File List

- Modify: `src/shared/db/migrations.ts` — new migration entry adding the `category` column.
- Modify: `src/shared/db/types.ts` — add `category: LessonSubjectKey` to `SavedLessonRecord` and `LessonListItem`.
- Modify: `src/shared/db/LessonRepository.ts` — derive category on save, persist it, read it back.
- Modify: `src/shared/db/__tests__/LessonRepository.test.ts` — regression tests for category derivation/persistence.
- Modify: `test-utils/sqliteMock.js` — mock DB insert handler needs to store the new `category` param.
- Modify: `src/store/useLibraryStore.ts` — drop `SUBJECT_ROTATION`/index-based logic, filter/label from real `item.category`.
- Create: `src/store/__tests__/useLibraryStore.test.ts` — regression tests proving filter tabs now reflect real category, not list position.

---

### Task 1: Add `category` column via migration + extend DB types

**Files:**

- Modify: `src/shared/db/migrations.ts`
- Modify: `src/shared/db/types.ts`

**Interfaces:**

- Produces: `SavedLessonRecord.category: LessonSubjectKey`, `LessonListItem.category: LessonSubjectKey` — consumed by Task 2 (repository) and Task 3 (store).

- [ ] **Step 1: Add the migration entry**

Edit `src/shared/db/migrations.ts`, add a new element to the `MIGRATIONS` array (after the existing `app_settings` table entry, i.e. as the new last entry):

```ts
const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY NOT NULL,
    anonymous_user_id TEXT NOT NULL,
    lesson_input_hash TEXT NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    ocr_raw_text TEXT,
    confirmed_text TEXT NOT NULL,
    vietnamese_translation TEXT NOT NULL,
    summary TEXT,
    level TEXT NOT NULL,
    ai_output_json TEXT NOT NULL,
    is_saved INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_lessons_input_hash ON lessons (lesson_input_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON lessons (created_at DESC);`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'vocabulary';`,
];
```

- [ ] **Step 2: Extend the DB-facing types**

Edit `src/shared/db/types.ts`. Add the import and the `category` field to both types:

```ts
import type {AIOutput} from '../schemas/ai-output-v1';
import type {LessonSubjectKey} from '../../types/lesson';

export type LessonSourceType = 'camera' | 'gallery' | 'paste_text';

export type SavedLessonRecord = {
  id: string;
  anonymousUserId: string;
  lessonInputHash: string;
  title: string;
  sourceType: LessonSourceType;
  ocrRawText: string | null;
  confirmedText: string;
  vietnameseTranslation: string;
  summary: string | null;
  level: string;
  aiOutput: AIOutput;
  category: LessonSubjectKey;
  isSaved: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LessonListItem = {
  id: string;
  title: string;
  summary: string | null;
  previewText: string;
  vocabularyCount: number;
  category: LessonSubjectKey;
  createdAt: string;
};

export type SaveLessonInput = {
  confirmedText: string;
  sourceType: LessonSourceType;
  ocrRawText?: string;
  lesson: AIOutput;
  promptVersion?: string;
};

export type SaveLessonResult =
  | {ok: true; lessonId: string; duplicate: boolean}
  | {
      ok: false;
      errorCode: 'LOCAL_DB_ERROR' | 'AI_INVALID_OUTPUT';
      message: string;
    };
```

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit`
Expected: New errors in `LessonRepository.ts` only (`category` missing when constructing `SavedLessonRecord`/`LessonListItem`) — that's expected, fixed in Task 2. No errors anywhere else.

- [ ] **Step 4: Commit**

```bash
git add src/shared/db/migrations.ts src/shared/db/types.ts
git commit -m "feat: add category column to lessons table"
```

---

### Task 2: Derive and persist real lesson category in `LessonRepository`

**Files:**

- Modify: `src/shared/db/LessonRepository.ts`
- Modify: `test-utils/sqliteMock.js`
- Test: `src/shared/db/__tests__/LessonRepository.test.ts`

**Interfaces:**

- Consumes: `SavedLessonRecord.category`, `LessonListItem.category` (Task 1).
- Produces: `saveLesson()` now persists a real category; `getLessonById()`/`listLessons()` return it. `LibraryLessonCardView.subjectKey` values in the store (Task 3) will come from this real field.

- [ ] **Step 1: Update the sqlite test mock to carry the new column**

The mock in `test-utils/sqliteMock.js` maps `INSERT INTO lessons` params positionally into a plain object — it does not parse real SQL. Edit the `insert into lessons` branch to add the 15th param:

```js
if (normalized.startsWith('insert into lessons')) {
  lessons.push({
    id: params[0],
    anonymous_user_id: params[1],
    lesson_input_hash: params[2],
    title: params[3],
    source_type: params[4],
    ocr_raw_text: params[5],
    confirmed_text: params[6],
    vietnamese_translation: params[7],
    summary: params[8],
    level: params[9],
    ai_output_json: params[10],
    is_saved: params[11],
    created_at: params[12],
    updated_at: params[13],
    category: params[14],
  });
  return {rowsAffected: 1, insertId: lessons.length};
}
```

- [ ] **Step 2: Write the failing tests**

Add to `src/shared/db/__tests__/LessonRepository.test.ts`, inside the existing `describe('LessonRepository', ...)` block (after the "saves lesson and reloads from SQLite" test):

```ts
it('derives vocabulary category when vocabulary count >= grammar count', () => {
  const result = saveLesson({
    confirmedText: validFullOutput.original_text,
    sourceType: 'paste_text',
    lesson: validFullOutput,
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }

  const loaded = getLessonById(result.lessonId);
  expect(loaded?.category).toBe('vocabulary');
});

it('derives grammar category when grammar_points outnumber vocabulary', () => {
  const grammarHeavy = {
    ...validFullOutput,
    grammar_points: [
      ...validFullOutput.grammar_points,
      ...validFullOutput.grammar_points,
      ...validFullOutput.grammar_points,
    ],
  };

  const result = saveLesson({
    confirmedText: grammarHeavy.original_text,
    sourceType: 'paste_text',
    lesson: grammarHeavy,
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }

  const loaded = getLessonById(result.lessonId);
  expect(loaded?.category).toBe('grammar');
});

it('exposes category on listLessons() items', () => {
  saveLesson({
    confirmedText: validFullOutput.original_text,
    sourceType: 'paste_text',
    lesson: validFullOutput,
  });

  const items = listLessons();
  expect(items).toHaveLength(1);
  expect(items[0].category).toBe('vocabulary');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn jest src/shared/db/__tests__/LessonRepository.test.ts`
Expected: FAIL — `loaded?.category` is `undefined`, not `'vocabulary'`/`'grammar'` (the repository doesn't compute or persist it yet).

- [ ] **Step 4: Implement in `LessonRepository.ts`**

Add the import and a private derivation helper near the top of the file (after the existing imports):

```ts
import {validateAIOutput} from '../schemas/ai-output-v1';
import type {AIOutput} from '../schemas/ai-output-v1';
import {createRequestId} from '../api/requestId';
import {getOrCreateAnonymousUserId} from './anonymousUserId';
import {getDatabase} from './database';
import {computeLessonInputHash} from './lessonInputHash';
import type {LessonSubjectKey} from '../../types/lesson';
import type {
  LessonListItem,
  SaveLessonInput,
  SaveLessonResult,
  SavedLessonRecord,
} from './types';

type LessonRow = {
  id: string;
  anonymous_user_id: string;
  lesson_input_hash: string;
  title: string;
  source_type: string;
  ocr_raw_text: string | null;
  confirmed_text: string;
  vietnamese_translation: string;
  summary: string | null;
  level: string;
  ai_output_json: string;
  category: string;
  is_saved: number;
  created_at: string;
  updated_at: string;
};

function deriveLessonCategory(lesson: AIOutput): LessonSubjectKey {
  return lesson.grammar_points.length > lesson.vocabulary.length
    ? 'grammar'
    : 'vocabulary';
}
```

Update `mapRowToRecord` to include `category`:

```ts
return {
  id: row.id,
  anonymousUserId: row.anonymous_user_id,
  lessonInputHash: row.lesson_input_hash,
  title: row.title,
  sourceType: row.source_type as SavedLessonRecord['sourceType'],
  ocrRawText: row.ocr_raw_text,
  confirmedText: row.confirmed_text,
  vietnameseTranslation: row.vietnamese_translation,
  summary: row.summary,
  level: row.level,
  aiOutput: validation.data,
  category: row.category as LessonSubjectKey,
  isSaved: row.is_saved === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};
```

Update `saveLesson` to compute and persist the category:

```ts
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    const lessonId = createRequestId();
    const anonymousUserId = getOrCreateAnonymousUserId();
    const category = deriveLessonCategory(lesson);

    db.execute(
      `INSERT INTO lessons (
        id, anonymous_user_id, lesson_input_hash, title, source_type,
        ocr_raw_text, confirmed_text, vietnamese_translation, summary, level,
        ai_output_json, is_saved, created_at, updated_at, category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        lessonId,
        anonymousUserId,
        lessonInputHash,
        lesson.title,
        input.sourceType,
        input.ocrRawText ?? null,
        input.confirmedText.trim(),
        lesson.vietnamese_translation,
        lesson.summary ?? null,
        lesson.level,
        JSON.stringify(lesson),
        1,
        now,
        now,
        category,
      ],
    );

    return {ok: true, lessonId, duplicate: false};
  } catch {
```

Update `listLessons` to include `category` in the pushed item:

```ts
items.push({
  id: record.id,
  title: record.title,
  summary: record.summary,
  previewText: previewText(record.confirmedText),
  vocabularyCount: record.aiOutput.vocabulary?.length ?? 0,
  category: record.category,
  createdAt: record.createdAt,
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn jest src/shared/db/__tests__/LessonRepository.test.ts`
Expected: PASS — all 7 tests (4 existing + 3 new) green.

- [ ] **Step 6: Typecheck**

Run: `yarn tsc --noEmit`
Expected: No errors in `LessonRepository.ts`. Errors may remain in `useLibraryStore.ts` (fixed in Task 3).

- [ ] **Step 7: Commit**

```bash
git add src/shared/db/LessonRepository.ts src/shared/db/__tests__/LessonRepository.test.ts test-utils/sqliteMock.js
git commit -m "feat: derive and persist real lesson category on save"
```

---

### Task 3: Filter/label lessons by real category in `useLibraryStore`

**Files:**

- Modify: `src/store/useLibraryStore.ts`
- Test: `src/store/__tests__/useLibraryStore.test.ts` (new)

**Interfaces:**

- Consumes: `LessonListItem.category: LessonSubjectKey` (Task 1/2), `listLessons` from `LessonRepository`.
- Produces: no change to `LibraryLessonCardView` shape or `useLibraryStore` public API (`getLibraryCards`, `getHomeCards`, `getSummary`, `setSubjectFilter`, `setQuery`) — only the internal derivation logic changes, so `LessonsHistoryScreen.tsx` needs no edits.

- [ ] **Step 1: Write the failing tests**

Create `src/store/__tests__/useLibraryStore.test.ts`:

```ts
import {useLibraryStore} from '../useLibraryStore';
import type {LessonListItem} from '../../shared/db/types';

jest.mock('../../shared/db/LessonRepository', () => ({
  listLessons: jest.fn(),
}));

import {listLessons} from '../../shared/db/LessonRepository';
const mockListLessons = listLessons as jest.Mock;

function makeItem(overrides: Partial<LessonListItem>): LessonListItem {
  return {
    id: 'lesson-1',
    title: 'Lesson',
    summary: null,
    previewText: 'preview',
    vocabularyCount: 5,
    category: 'vocabulary',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useLibraryStore', () => {
  beforeEach(() => {
    mockListLessons.mockReset();
    useLibraryStore.setState({query: '', subjectFilter: 'all'});
  });

  it('filters by real category, not list position, with a single lesson', () => {
    mockListLessons.mockReturnValue([makeItem({id: '1', category: 'grammar'})]);

    useLibraryStore.getState().setSubjectFilter('vocabulary');
    expect(useLibraryStore.getState().getLibraryCards()).toHaveLength(0);

    useLibraryStore.getState().setSubjectFilter('grammar');
    expect(useLibraryStore.getState().getLibraryCards()).toHaveLength(1);
  });

  it('returns only vocabulary-category lessons under the Từ vựng filter', () => {
    mockListLessons.mockReturnValue([
      makeItem({id: '1', category: 'vocabulary'}),
      makeItem({id: '2', category: 'grammar'}),
      makeItem({id: '3', category: 'vocabulary'}),
    ]);

    useLibraryStore.getState().setSubjectFilter('vocabulary');
    const cards = useLibraryStore.getState().getLibraryCards();

    expect(cards.map(c => c.id)).toEqual(['1', '3']);
    expect(cards.every(c => c.subjectKey === 'vocabulary')).toBe(true);
  });

  it('returns all lessons regardless of category under "all"', () => {
    mockListLessons.mockReturnValue([
      makeItem({id: '1', category: 'vocabulary'}),
      makeItem({id: '2', category: 'grammar'}),
    ]);

    useLibraryStore.getState().setSubjectFilter('all');
    expect(useLibraryStore.getState().getLibraryCards()).toHaveLength(2);
  });

  it('assigns the correct label/tone for the grammar category', () => {
    mockListLessons.mockReturnValue([makeItem({id: '1', category: 'grammar'})]);

    const [card] = useLibraryStore.getState().getLibraryCards();
    expect(card.subjectLabel).toBe('Ngữ pháp');
    expect(card.subjectKey).toBe('grammar');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn jest src/store/__tests__/useLibraryStore.test.ts`
Expected: FAIL — with 1 lesson of `category: 'grammar'`, the current `index % 4` logic assigns `SUBJECT_ROTATION[0]` = `'grammar'` regardless, so filtering by `'vocabulary'` incorrectly matches nothing (that part passes by luck) but filtering the 3-lesson case by `'vocabulary'` returns wrong ids (position-based, not category-based) — assertion on `cards.map(c => c.id)` fails.

- [ ] **Step 3: Implement in `useLibraryStore.ts`**

Replace the whole file content with:

```ts
import {create} from 'zustand';
import {listLessons} from '../shared/db/LessonRepository';
import type {LessonListItem} from '../shared/db/types';
import type {ChipTone} from '../components/Chip';
import type {
  LessonCardView,
  LessonSubjectKey,
  LibraryLessonCardView,
} from '../types/lesson';

const CATEGORY_META: Record<LessonSubjectKey, {label: string; tone: ChipTone}> =
  {
    grammar: {label: 'Ngữ pháp', tone: 'accentSoft'},
    vocabulary: {label: 'Từ vựng', tone: 'gold'},
    idioms: {label: 'Thành ngữ', tone: 'coralSoft'},
    conversation: {label: 'Hội thoại', tone: 'accentSoft'},
  };

export type LibrarySubjectFilter = 'all' | LessonSubjectKey;

function formatLessonDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'short',
  });
}

function estimateDurationMin(vocabularyCount: number): number {
  return Math.max(5, Math.ceil(vocabularyCount / 8));
}

function toCardView(item: LessonListItem): LibraryLessonCardView {
  const subject = CATEGORY_META[item.category];
  return {
    id: item.id,
    title: item.title,
    blurb: item.summary || item.previewText,
    dateLabel: formatLessonDate(item.createdAt),
    vocabularyCount: item.vocabularyCount,
    durationMin: estimateDurationMin(item.vocabularyCount),
    subjectLabel: subject.label,
    subjectTone: subject.tone,
    subjectKey: item.category,
  };
}

function toHomeCardView(item: LessonListItem): LessonCardView {
  return {
    id: item.id,
    title: item.title,
    meta: `${item.vocabularyCount} từ vựng`,
    blurb: item.summary || item.previewText,
  };
}

type LibraryStore = {
  query: string;
  subjectFilter: LibrarySubjectFilter;
  setQuery: (query: string) => void;
  setSubjectFilter: (filter: LibrarySubjectFilter) => void;
  getLibraryCards: () => LibraryLessonCardView[];
  getHomeCards: (limit?: number) => LessonCardView[];
  getSummary: () => {lessonCount: number; wordCount: number};
};

function listFilteredItems(
  query: string,
  subjectFilter: LibrarySubjectFilter,
): LessonListItem[] {
  const q = query.trim().toLowerCase();
  const items = listLessons();
  return items.filter(item => {
    if (subjectFilter !== 'all' && item.category !== subjectFilter) {
      return false;
    }
    if (!q) {
      return true;
    }
    return (
      item.title.toLowerCase().includes(q) ||
      item.previewText.toLowerCase().includes(q) ||
      (item.summary?.toLowerCase().includes(q) ?? false)
    );
  });
}

// UI search/filter layer; persistence via LessonRepository (M4).
export const useLibraryStore = create<LibraryStore>((set, get) => ({
  query: '',
  subjectFilter: 'all',

  setQuery(query: string) {
    set({query});
  },

  setSubjectFilter(subjectFilter: LibrarySubjectFilter) {
    set({subjectFilter});
  },

  getLibraryCards() {
    const {query, subjectFilter} = get();
    return listFilteredItems(query, subjectFilter).map(toCardView);
  },

  getHomeCards(limit?: number) {
    const items = limit && limit > 0 ? listLessons(limit) : listLessons();
    return items.map(toHomeCardView);
  },

  getSummary() {
    const items = listLessons();
    return {
      lessonCount: items.length,
      wordCount: items.reduce((sum, item) => sum + item.vocabularyCount, 0),
    };
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn jest src/store/__tests__/useLibraryStore.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Typecheck**

Run: `yarn tsc --noEmit`
Expected: No errors anywhere.

- [ ] **Step 6: Commit**

```bash
git add src/store/useLibraryStore.ts src/store/__tests__/useLibraryStore.test.ts
git commit -m "fix: filter lesson library by real category instead of list position"
```

---

### Task 4: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `yarn test`
Expected: All suites pass, including the modified `LessonRepository.test.ts` and new `useLibraryStore.test.ts`.

- [ ] **Step 2: Run typecheck and lint**

Run: `yarn tsc --noEmit && yarn lint`
Expected: No errors.

- [ ] **Step 3: Manual smoke test on simulator**

Run: `yarn ios:dev` (or the project's existing dev run command), then:

1. Create/save a lesson whose content has more `grammar_points` than `vocabulary` items (or vice versa) via the paste-text flow.
2. Open "Bài học" tab, tap "Ngữ pháp" — confirm the grammar-heavy lesson appears.
3. Tap "Từ vựng" — confirm the vocabulary-heavy lesson appears there instead.
4. Tap "Thành ngữ" — confirm it correctly shows the empty state (expected: no lessons are ever auto-classified as idioms yet — this is the documented, known limitation, not a regression).

Record the result in the session report (`.ai-logs/reports/<session_id>.md` per repo convention) along with a note that idiom/conversation auto-classification is out of scope for this fix.

- [ ] **Step 4: Commit** (only if smoke test uncovers no further changes — otherwise fix and re-run Steps 1–3 first)

No commit needed if Task 1–3 commits already cover everything; this task is verification-only.

---

## Self-Review Notes

- **Spec coverage:** DB migration (Task 1), repository derivation/persistence (Task 2), store filter/label fix (Task 3), full verification incl. manual smoke test (Task 4) — covers the root cause identified during investigation (fake `index % 4` rotation) end to end.
- **Known, accepted limitation (not a task):** `'idioms'` and `'conversation'` are never auto-assigned because `AIOutput` has no data to detect them; the `'Thành ngữ'` chip will keep showing the empty state until a future feature adds real detection. This was an explicit user decision, not an oversight.
- **Type consistency:** `LessonSubjectKey` (from `src/types/lesson.ts`) is reused everywhere — `SavedLessonRecord.category`, `LessonListItem.category`, `CATEGORY_META` keys, `deriveLessonCategory()` return type — no new enum introduced.
