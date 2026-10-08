# Schema v5: flashcard theo lemma, `activity_attempts`, `core/learning`

> **Đã thay thế (PR 5, 2026-10-08):** chuỗi migration v1–v6 được gộp thành schema baseline v7 (`src/core/db/migrations.ts`). Máy có DB cũ bị reset thay vì nâng cấp, flashcard định danh theo mã item và không còn gộp thẻ theo lemma. Tài liệu dưới đây chỉ còn giá trị lịch sử.

> Trạng thái: thiết kế cho PR-6 của `docs/superpowers/plans/2026-10-06-learning-items-architecture.md`.
> Đây là **migration dữ liệu trên máy người dùng**: đọc kỹ mục 5 (rollback) và 6 (rủi ro).

## 1. Mục tiêu

1. Một từ/cụm từ chỉ có **một thẻ flashcard**, dù xuất hiện ở nhiều bài. Bài chỉ là "nguồn" của thẻ.
2. Danh tính của thẻ là `item_key = "<kind>:<lemma chuẩn hoá>"` (vd `word:coffee`, `phrase:wake up`), cùng quy tắc chuẩn hoá với server (`normalizeItemKey`, kiểm chứng bằng fixture chung).
3. Có bảng `activity_attempts` (SQLite + outbox) để Quiz/Game/Ôn tập ghi kết quả; sync lên collection cùng tên của server (PR-5).
4. Không mất tiến độ ôn của người dùng; có đường quay lại.

## 2. Khác với kế hoạch gốc (có chủ ý)

Kế hoạch gốc nói "tạo bảng `flashcards` mới, copy, đổi tên". Bản này **không dựng lại bảng**:

- SQLite không đổi được ràng buộc `UNIQUE (lesson_id, vocabulary_id)` tại chỗ, nên phải dựng lại bảng. Đó là thao tác rủi ro nhất (mất cột/khoá nếu sai, khoá bảng lâu trên máy yếu).
- Thay vào đó: `ALTER TABLE ... ADD COLUMN item_key` (an toàn, idempotent) + **partial unique index** `UNIQUE(item_key) WHERE item_key IS NOT NULL AND tombstone = 0`. Ràng buộc cũ `(lesson_id, vocabulary_id)` giữ nguyên và vẫn đúng (mỗi bài vẫn không có hai dòng trùng).

## 3. Thay đổi schema (`user_version` 4 → 5)

```sql
ALTER TABLE flashcards        ADD COLUMN item_key TEXT;   -- NULL = chưa suy ra được khoá
ALTER TABLE grammar_bookmarks ADD COLUMN item_key TEXT;   -- chỉ cột; dữ liệu cũ không có tên ngữ pháp để suy ra

CREATE TABLE flashcard_sources (          -- thẻ xuất hiện ở những bài nào
  card_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  source_sentence TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (card_id, lesson_id)
);

CREATE TABLE activity_attempts (          -- khớp payload server `activity_attempts`
  id TEXT PRIMARY KEY NOT NULL,           -- uuid, cũng là entity_id khi sync
  kind TEXT NOT NULL,                     -- review | practice | game
  activity TEXT NOT NULL,
  lesson_id TEXT, item_key TEXT, session_id TEXT,
  result TEXT NOT NULL,                   -- correct | incorrect | skipped
  score REAL, duration_ms INTEGER NOT NULL,
  occurred_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0, tombstone INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX idx_flashcards_item_key_live
  ON flashcards (item_key) WHERE item_key IS NOT NULL AND tombstone = 0;
CREATE INDEX idx_flashcard_sources_lesson ON flashcard_sources (lesson_id);
CREATE INDEX idx_activity_attempts_lesson ON activity_attempts (lesson_id, occurred_at DESC);

-- Sao lưu trước khi gộp (giữ một bản phát hành, xoá ở PR sau):
CREATE TABLE flashcards_v4_backup        AS SELECT * FROM flashcards;
CREATE TABLE review_schedule_v4_backup   AS SELECT * FROM review_schedule;
```

Mọi bảng mới (kể cả `*_backup`) được thêm vào `localDataWipe.ts` (chúng chứa dữ liệu người học).

## 4. Thuật toán migration (một transaction duy nhất)

Chạy khi `user_version = 4` và chỉ khi đó (như v4).

1. `ALTER` hai bảng (bỏ qua lỗi `duplicate column name`), tạo bảng/ index phụ **trừ** unique index.
2. Sao lưu `flashcards`, `review_schedule` vào bảng `*_v4_backup`.
3. Với mỗi dòng `flashcards` chưa tombstone: `item_key = kindOf(key) + ":" + key` với `key = normalizeItemKey(word)`; `kind = phrase` nếu `key` có khoảng trắng, ngược lại `word`. Key rỗng → để `NULL` (không dedupe).
4. Gom theo `item_key`. Nhóm có > 1 dòng → chọn **thẻ thắng** theo thứ tự ưu tiên:
   1. `is_saved = 1` hơn `is_saved = 0`;
   2. `interval_days` trong `review_schedule` lớn hơn (giữ tiến độ ôn xa nhất);
   3. `created_at` sớm hơn;
   4. `id` nhỏ hơn (tất định).
5. Thẻ thắng: `is_saved = 1` nếu **bất kỳ** thẻ trong nhóm đang lưu. Giữ nguyên `review_schedule` và `review_sessions` của nó.
6. Thẻ thua: `tombstone = 1`, `is_saved = 0`. **Không xoá** dòng, không sửa `review_sessions` (lịch sử vẫn trỏ về thẻ cũ). `review_schedule` của thẻ thua giữ nguyên (mọi truy vấn đều join `flashcards.is_saved = 1` nên không hiện).
7. Với **mọi** thẻ trong nhóm (kể cả thắng): thêm `flashcard_sources(card_id = thẻ thắng, lesson_id, source_sentence, created_at)` (`INSERT OR IGNORE`).
8. Tạo `idx_flashcards_item_key_live` **sau** bước 4–6 (lúc đó không còn trùng).
9. `PRAGMA user_version = 5`, `COMMIT`. Mọi lỗi → `ROLLBACK`, `user_version` vẫn 4, app chạy tiếp với schema cũ.

Idempotent: bước 1–2 bỏ qua nếu đã có; bước 3–7 chỉ chạm dòng có `item_key IS NULL` hoặc nhóm còn trùng; chạy lại không đổi kết quả.

## 5. Rollback / khôi phục

- Migration lỗi: `ROLLBACK` tự động, không đổi gì.
- Cần quay lại dữ liệu cũ: `flashcards_v4_backup` / `review_schedule_v4_backup` giữ nguyên trạng thái trước gộp. `SCHEMA_V5_DOWN_STATEMENTS` (xuất ra cho test và hỗ trợ) bỏ index/bảng mới và đặt `user_version = 4`; cột `item_key` được để lại (vô hại, SQLite cũ không cho `DROP COLUMN`). Khôi phục thẻ từ backup là thao tác thủ công qua bản vá, không tự động.
- Bảng backup xoá ở một phát hành sau khi xác nhận không có sự cố.

## 6. Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
|---|---|
| Gộp nhầm hai từ khác nhau có cùng khoá | Khoá chỉ gồm chữ/số/`'`/`-` và khoảng trắng đã chuẩn hoá; `read` ≠ `read` khác POS vẫn cùng khoá (chấp nhận: thẻ theo lemma). Thẻ thua không bị xoá nên khôi phục được |
| Mất tiến độ ôn | Thắng theo `interval_days` cao nhất; backup; test với dữ liệu giả lập nhiều thẻ trùng |
| `saveFlashcard` đua nhau tạo trùng | Lookup + insert trong một transaction; partial unique index chặn ở mức DB |
| Pull ghi đè (INSERT OR REPLACE) xoá thẻ cục bộ cùng `item_key` | Bản ghi từ server không có `item_key` (cột NULL, nằm ngoài partial index) nên không va chạm; flashcards hiện chưa được push lên server |
| Dữ liệu lẫn giữa tài khoản | Bảng mới nằm trong `localDataWipe` và luồng đổi tài khoản (có test) |
| Máy chậm với nhiều thẻ | Một transaction, vòng lặp theo dòng; cỡ dữ liệu thẻ cá nhân nhỏ (hàng trăm) |

## 7. Ngoài phạm vi PR-6

- Không đổi giao diện (PR-7). Chỉ `listFlashcards({lessonId})` bao gồm thẻ có nguồn ở bài đó để trạng thái "Đã lưu" đúng xuyên bài.
- Không dựng generator/quiz (PR-8) và không gửi `activity_attempts` từ màn hình nào (chỉ repository + bảng + outbox sẵn).
- `grammar_bookmarks`: chỉ thêm cột `item_key`; chưa gộp xuyên bài.
