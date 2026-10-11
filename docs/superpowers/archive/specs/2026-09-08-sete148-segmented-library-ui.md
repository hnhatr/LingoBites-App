# SETE-148: Segmented Library UI and Bookmark UX — Design Specification

**Date:** 2026-09-08  
**Task:** TASK-04 (Segmented Library UI and bookmark UX)  
**Issue:** SETE-148  
**Status:** Design approved, ready for implementation planning

---

## 1. Overview

Build the three-segment Library (Thư viện) UI with independent search/filter per segment and explicit save/unsave controls for vocabulary and grammar items. The implementation leverages repositories from TASK-03 (persistence) and navigation from TASK-02.

**Key Design Decisions:**

- Segmented tabs (Bài học | Từ vựng | Ngữ pháp) instead of stacked sections
- Independent search/filter per segment
- Optimistic update pattern for save/unsave actions
- Separate sub-lists within Bài học tab ("Bài học cá nhân" / "Bài học theo lộ trình")

---

## 2. Acceptance Criteria (from SETE-148)

- ✓ Library has three segments: `Bài học`, `Từ vựng`, and `Ngữ pháp`
- ✓ Each segment has its own empty state
- ✓ Search is case-insensitive over title/front/content where applicable
- ✓ Source filters support `offline`, `image_ocr`, and `paste`
- ✓ Rows retain source metadata and open detail screens through repository lookup parameters so details survive restart
- ✓ Vocabulary and grammar surfaces expose explicit save/unsave controls
- ✓ Repeated save/unsave actions are safe from rapid taps and remain idempotent (database handles this)
- ✓ Saving a lesson does not implicitly save its vocabulary or grammar
- ✓ Missing-record, DB, and navigation errors show retry/back behavior and do not crash

---

## 3. Architecture & Layout

### 3.1 Screen Structure

```
LessonsHistoryScreen (main container)
├── Header (Thư viện icon + settings icon)
├── SegmentedTabs (3 tabs: Bài học | Từ vựng | Ngữ pháp)
├── SearchAndFilterBar (per-tab)
│   ├── SearchTextField (search query)
│   └── SourceFilterChips (all / offline / image_ocr / paste)
├── TabContent (dynamic based on activeTab)
│   ├── LessonsTabContent
│   ├── VocabularyTabContent
│   └── GrammarTabContent
└── EmptyState (per tab)
```

### 3.2 Tab Specifications

#### **Tab 1: Bài học (Lessons)**

- **Data Sources:**
  - Personal generated lessons (from existing `useLibraryStore`)
  - Packaged/curriculum lessons: saved OR started (from `ContentLessonStateRepository`)
- **Sub-sections:**
  1. "Bài học cá nhân" — personal generated lessons only
  2. "Bài học theo lộ trình" — packaged lessons
- **Search:** Case-insensitive over lesson title/summary
- **Filters:** By source type (offline, image_ocr, paste)
- **Detail Navigation:** Open via `SavedLessonDetail` or `ContentLessonRuntime` (repository lookup)
- **Empty States:**
  - No data at all: "Chưa có bài học nào"
  - Search yielded nothing: "Không tìm thấy kết quả"

#### **Tab 2: Từ vựng (Vocabulary)**

- **Data Source:** `FlashcardRepository.listFlashcards({includeUnsaved: false})`
- **Content per Row:**
  - Word + pronunciation guide
  - Meaning (Vietnamese)
  - Save/unsave heart button (optimistic update)
  - Optional SRS due indicator (if applicable)
- **Search:** Case-insensitive over word, meaning, example
- **Filters:** By source type (applicable only if flashcard tracks source)
- **Detail Navigation:** Open `FlashcardDetail` with repository lookup by `vocabularyId`
- **Empty States:**
  - No saved flashcards: "Chưa lưu từ vựng nào"
  - Search yielded nothing: "Không tìm thấy kết quả"

#### **Tab 3: Ngữ pháp (Grammar)**

- **Data Source:** `GrammarBookmarkRepository.listAllBookmarkedGrammar()`
- **Content per Row:**
  - Grammar rule title
  - Example sentence
  - Save/unsave heart button (optimistic update)
- **Search:** Case-insensitive over grammar title, content
- **Filters:** By source type (applicable if grammar tracks source)
- **Detail Navigation:** Open `GrammarDetail` with repository lookup by `grammarId`
- **Empty States:**
  - No saved grammar bookmarks: "Chưa lưu ngữ pháp nào"
  - Search yielded nothing: "Không tìm thấy kết quả"

---

## 4. State Management

### 4.1 Tab State

```typescript
interface LibrarySegmentState {
  activeTab: 'lessons' | 'vocabulary' | 'grammar';
  setActiveTab: (tab: LibrarySegmentState['activeTab']) => void;
}
```

### 4.2 Per-Tab Search & Filter State

```typescript
interface SegmentFilterState {
  searchQuery: string;
  sourceFilter: 'all' | 'offline' | 'image_ocr' | 'paste';
  setSearchQuery: (query: string) => void;
  setSourceFilter: (filter: SegmentFilterState['sourceFilter']) => void;
}

// Maintained separately for each tab
const [lessonsFilter, setLessonsFilter] = useState<SegmentFilterState>(...);
const [vocabularyFilter, setVocabularyFilter] = useState<SegmentFilterState>(...);
const [grammarFilter, setGrammarFilter] = useState<SegmentFilterState>(...);
```

### 4.3 Optimistic Save/Unsave State

```typescript
// Local optimistic state for vocabulary bookmarks
const [vocabularySaveState, setVocabularySaveState] = useState<
  Map<string, boolean>
>(new Map());

// Local optimistic state for grammar bookmarks
const [grammarSaveState, setGrammarSaveState] = useState<Map<string, boolean>>(
  new Map(),
);
```

---

## 5. Data Flow

### 5.1 Lessons Tab Data Flow

```
Query ContentLessonStateRepository (listSavedLessons + listStartedLessons)
  ↓ (enrich with ContentLessonListItem metadata)
  ↓ (filter by searchQuery + sourceFilter)
  ↓ (split into two sub-lists: personal vs packaged)
Render FlatList with two sections
```

### 5.2 Vocabulary Tab Data Flow

```
Query FlashcardRepository.listFlashcards({includeUnsaved: false})
  ↓ (filter by searchQuery: case-insensitive word/meaning/example)
  ↓ (filter by sourceFilter if applicable)
  ↓ (merge with optimistic save state)
Render FlatList of VocabularyRowCards with heart buttons
```

### 5.3 Grammar Tab Data Flow

```
Query GrammarBookmarkRepository.listAllBookmarkedGrammar()
  ↓ (enrich with grammar content from lesson package)
  ↓ (filter by searchQuery: case-insensitive title/content)
  ↓ (filter by sourceFilter if applicable)
  ↓ (merge with optimistic save state)
Render FlatList of GrammarRowCards with heart buttons
```

---

## 6. Bookmark Save/Unsave Behavior

### 6.1 Optimistic Update Pattern

**On Save (heart ♡ → ❤️):**

1. User taps heart button
2. [Optimistic] Update local state immediately: `Map.set(itemId, true)`
3. [UI Update] Heart icon fills (visual feedback)
4. [Async] Fire `saveFlashcard()` or `saveGrammarBookmark()` in background
5. [Result] If error, revert local state + show toast: "Lỗi lưu. Vui lòng thử lại."

**On Unsave (❤️ → ♡):**

1. User taps filled heart button
2. [Optimistic] Update local state immediately: `Map.set(itemId, false)`
3. [UI Update] Heart icon empties (visual feedback)
4. [Async] Fire `unsaveFlashcard()` or `unsaveGrammarBookmark()` in background
5. [Result] If error, revert local state + show toast

### 6.2 Rapid-Tap Safety

- Debounce/coalesce rapid taps on the same item to prevent duplicate DB calls
- Alternative: lock the button during the async operation (loading state)
- Recommendation: Use debounce (coalescence) to allow UI feedback before DB operation

---

## 7. Error Handling

### 7.1 DB Errors

- **Catch:** `LOCAL_DB_ERROR` from repository methods
- **Action:** Revert optimistic state update
- **UI:** Show error toast: "Lỗi lưu. Vui lòng thử lại."
- **Recovery:** User can retry by tapping the button again

### 7.2 Missing Record Errors

- **Scenario:** Detail navigation tries to open a record that doesn't exist
- **Action:** Catch in detail screen
- **UI:** Show error screen with "Bản ghi không tìm thấy" + back button
- **Note:** Already handled by existing detail screen logic

### 7.3 Navigation Errors

- **Scenario:** Navigation fails (bad lessonId, route not found, etc.)
- **Action:** Catch and log
- **UI:** Show toast: "Không thể mở bài học. Vui lòng thử lại."

### 7.4 Empty States

- **No data:** Show segment-specific message + icon
- **No search results:** Show "Không tìm thấy kết quả"

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Hooks & Utilities:**

1. `useLibrarySegments` hook — verify fetch, filter, and state management for each tab
2. Search filtering — case-insensitive across all searchable fields
3. Source filter logic — verify `camera`/`gallery` maps to `image_ocr`
4. Optimistic update logic — state changes before/after async

### 8.2 Component Tests

**Rendering & Interaction:**

1. Segment tabs render correctly; switching tabs works
2. Search input updates items in current tab only (not other tabs)
3. Source filter updates items in current tab only
4. Bookmark button: tap → optimistic state change → visual update
5. Rapid bookmark taps don't cause duplicate DB calls
6. Empty state displays when no data for current tab
7. Detail navigation opens correct screen with correct parameters

### 8.3 Integration Tests

**End-to-End Flows:**

1. Save vocabulary → verify appears in Vocabulary tab
2. Unsave vocabulary → verify disappears from Vocabulary tab
3. Save grammar → verify appears in Grammar tab
4. DB error during save → state reverts + error toast shows
5. Scroll/pagination works with large lists (100+ items)
6. Restart app → saved/unsaved state persists

**Test Data Fixture:**

- 10+ saved lessons (mix of personal and packaged)
- 20+ saved flashcards (mix of sources: offline, image_ocr, paste)
- 5+ saved grammar bookmarks
- Multiple search queries to verify filtering

---

## 9. Files to Create/Modify

### 9.1 New/Modified Components

- `src/modules/lesson/LessonsHistoryScreen.tsx` — refactor to support segments
- `src/modules/lesson/components/LessonsTabContent.tsx` — new (lessons tab)
- `src/modules/lesson/components/VocabularyTabContent.tsx` — new (vocabulary tab)
- `src/modules/lesson/components/GrammarTabContent.tsx` — new (grammar tab)
- `src/modules/lesson/components/SegmentedTabBar.tsx` — new (tab switcher)
- `src/modules/lesson/components/SearchAndFilterBar.tsx` — new (search + filter)
- `src/modules/lesson/components/VocabularyRowCard.tsx` — new (vocabulary row)
- `src/modules/lesson/components/GrammarRowCard.tsx` — new (grammar row)

### 9.2 New/Modified Hooks

- `src/modules/lesson/useLibrarySegments.ts` — new (unified segment data hook)
- `src/modules/lesson/useLessonLibrary.ts` — potentially refactor to fit new pattern

### 9.3 New Tests

- `src/modules/lesson/__tests__/useLibrarySegments.test.ts`
- `src/modules/lesson/__tests__/LessonsHistoryScreen.test.tsx`
- `src/modules/lesson/__tests__/VocabularyTabContent.test.tsx`
- `src/modules/lesson/__tests__/GrammarTabContent.test.tsx`
- `src/modules/lesson/__tests__/LessonsTabContent.test.tsx`

---

## 10. Dependencies & Assumptions

### 10.1 Dependencies (from TASK-02 & TASK-03)

- ✓ `ContentLessonStateRepository` — listSavedLessons, listStartedLessons
- ✓ `GrammarBookmarkRepository` — listAllBookmarkedGrammar, saveGrammarBookmark, unsaveGrammarBookmark
- ✓ `FlashcardRepository` — listFlashcards, saveFlashcard, unsaveFlashcard
- ✓ `useContentLibrary()` — for packaged lesson enrichment
- ✓ Navigation routes — SavedLessonDetail, ContentLessonRuntime, FlashcardDetail, GrammarDetail

### 10.2 Assumptions

- All detail screens already exist and can accept repository lookup parameters
- Source type normalization (camera/gallery → image_ocr) happens at the query boundary
- Database idempotency handles rapid-tap safety at the storage layer

---

## 11. Known Limitations & Out of Scope

- **Grammar SRS:** Grammar bookmarks do NOT enter SRS (out of scope for TASK-04)
- **Backend sync:** No backend sync for bookmarks in this task
- **Module boundaries:** New cross-module imports must use `@modules/*` barrels per architecture rules
- **Accessibility:** FlipCard accessibility (SETE-122) verified separately

---

## 12. Success Criteria (Implementation Verification)

- [ ] Three tabs render and switch correctly
- [ ] Each tab has independent search/filter
- [ ] Bookmark save/unsave uses optimistic update pattern
- [ ] Rapid taps on bookmark buttons are safe (no duplicate saves)
- [ ] All error scenarios show actionable feedback
- [ ] All four acceptance criteria pass
- [ ] All tests pass (`yarn test --runInBand`)
- [ ] `yarn typecheck` and `yarn lint` exit 0
