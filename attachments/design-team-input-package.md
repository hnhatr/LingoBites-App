# Design Team Input Package — P1 Flashcards / SRS / Daily Review

> Chuẩn bị cho [VIB-114](mention://issue/6edf1ca8-c90d-4dec-a9d9-57ab1811e412) (Design Team). Theo 13 mục yêu cầu của "Required Input Package". BA không thiết kế UI — mọi mô tả màn hình bên dưới chỉ nêu yêu cầu, tham chiếu component có sẵn (`src/components/`, 31 component, `src/theme/tokens.ts`, 7 theme) thay vì phát minh mới.

## 1. Problem Statement (đã duyệt Gate 1)

LingoBites P0 có core loop ổn định nhưng chưa có cơ chế đưa user quay lại ôn tập nội dung đã lưu. P1 lát cắt lõi: Flashcards + SRS cơ bản + Daily Review, đủ chi tiết để implement mà không block P0 closed beta. Đầy đủ tại Stage 1 comment trên [VIB-115](mention://issue/6edf1ca8-c90d-4dec-a9d9-57ab1811e412).

## 2. Scope đã duyệt (Gate 1)

In-scope: Flashcards (lưu/xem/lật/unsave), SRS cơ bản, Daily Review. Out-of-scope: streak, quiz history, favorite lessons, search, level setting, thiết kế UI (việc của Design Team), sync đa thiết bị.

## 3. Persona / Nhóm người dùng

3 persona hiện có (`02-personas-journey.md`), cả 3 đều dùng lát cắt lõi P1:

- **Minh** (A0–A1) — cần lưu từ riêng, không muốn mở lại cả lesson.
- **An** (A1–B1, học sinh) — cần quản lý danh sách từ để ôn trước giờ học, dễ bị "quá tải" nếu queue không kiểm soát.
- **Lan** (A1–B1, văn phòng) — cần ôn nhanh lúc rảnh; **LƯU Ý**: nhu cầu chính của Lan là "reusable sentence patterns", KHÔNG được lát cắt lõi P1 đáp ứng đầy đủ (chỉ vocabulary) — xem PRD §12 Limitations.

## 4. User Goal / JTBD (theo persona, từ Stage 3)

- Minh: "Khi gặp 1 từ không hiểu, tôi muốn lưu riêng để ôn lại sau mà không cần mở lại cả bài học."
- An: "Khi đọc 1 đoạn có nhiều từ mới, tôi muốn chỉ lưu từ chưa biết vào 1 danh sách ôn tập, tập trung đúng lỗ hổng trước giờ học."
- Lan: "Khi gặp 1 cụm từ trong công việc, tôi muốn lưu riêng để ôn nhanh lúc rảnh mà không mở lại cả email/lesson."

## 5. User Story / Use Case đã ưu tiên (Epic 7 — Flashcards & Daily Review)

Must: US-016 (save vocab as flashcard), US-017 (view saved list), US-018 (flip card), US-019 (complete daily review session), US-021 (unsave flashcard). Should: US-020 (due count badge). Đầy đủ Gherkin tại [VIB-117](mention://issue/145c78cd-5490-4670-bb22-aee8761ff6b6) §6 và [VIB-120](mention://issue/828cbf7c-f084-455a-a867-8f43cdfd9445) US-021.

## 6. Luồng chính / thay thế / ngoại lệ / edge case

**Luồng chính:** xem PRD §6.

**Luồng thay thế:**

- User mở Daily Review khi không có thẻ nào due → empty state "đã ôn hết hôm nay" (khác với "chưa từng lưu thẻ nào").
- User skip 1 thẻ thay vì rating → thẻ tính là đã xử lý, `due_at` không đổi.

**Ngoại lệ / Edge case (E1–E7, đầy đủ tại VIB-117 §11 + VIB-120 CRIT-003):**

| #           | Edge case                                            | Yêu cầu UI liên quan                                                                                                         |
| ----------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| E1/CRIT-002 | Lesson gốc bị xóa còn flashcard active               | Tùy phương án Gate (§9.1 PRD) — nếu Option A: cần màn hình lỗi/hướng dẫn unsave trước khi xóa                                |
| E2          | Cùng 1 từ ở 2 lesson khác nhau                       | Hiển thị như 2 card riêng biệt trong list, có thể cần chỉ báo ngữ cảnh/nguồn khác nhau                                       |
| E3          | Queue tích lũy lớn sau nhiều ngày không mở app       | Tùy phương án §9.3 — nếu cap: cần UI thể hiện "còn N thẻ chưa ôn, sẽ tiếp tục ngày mai"                                      |
| E4          | 2 empty state khác nhau (chưa từng lưu vs đã ôn hết) | 2 màn/message riêng biệt, không dùng chung 1 empty state                                                                     |
| E5          | App crash giữa phiên review                          | Resume đúng vị trí thẻ đang ôn, không mất tiến độ — yêu cầu kỹ thuật, không cần UI riêng nhưng cần loading/resume state mượt |
| E6          | Unsave đúng thẻ cuối đang ôn dở                      | Session tự động chuyển sang màn hoàn thành ngay                                                                              |
| E7          | Unsave rồi re-save nhanh                             | Không cần UI đặc biệt — hành vi ngầm khôi phục đúng schedule cũ                                                              |

## 7. Business Rules

Xem PRD §8 (đầy đủ) — quan trọng nhất cho Design: BR-REVIEW-002 (completion rule không có ngưỡng %), BR-FLASH-004 (unsave gỡ khỏi session đang mở ngay lập tức, cần UI cập nhật counter tức thời).

## 8. Data & Validation Rules

Xem PRD §10. Với Design: card content lấy từ `VocabularyItem` (word, meaning_vi, pronunciation_guide_vi, example, source_sentence) — dùng đúng field có sẵn trong schema, không cần trường mới cho hiển thị front/back cơ bản.

## 9. Role & Permission

Không có role/permission mới — P1 kế thừa mô hình P0 (`anonymous_user_id`, không login). Mọi flashcard/schedule scope theo user hiện tại trên thiết bị.

## 10. Acceptance Criteria

Đầy đủ ~30 AC Given-When-Then tại [VIB-122](mention://issue/190d0509-731b-4875-a49d-6bc3b2fda582) §2. Design nên đọc trực tiếp AC-FLASH-001..012, AC-SRS-\*, AC-REV-001..008 để hiểu chính xác trạng thái/tương tác cần thiết kế (vd. AC-REV-007 — 2 empty state; AC-FLASH-009 — cập nhật counter tức thời khi unsave giữa session).

## 11. NFR liên quan đến Design

- NFR-USE-004 (kế thừa P0): tránh quá tải — đặc biệt quan trọng cho §6 E3 (queue tích lũy) và danh sách flashcard dài.
- NFR-ACC-\* (kế thừa P0): flip card, rating buttons cần đủ tap area + accessible label (đặc biệt 4 nút rating nếu chọn SM-2 §9.2 Option 1).
- Local-only, offline-first — không có loading state chờ network cho các thao tác flashcard/review (khác biệt so với AI-analysis flow ở P0).

## 12. Ràng buộc kỹ thuật

- 3-tab hiện tại `Home | Lessons | Profile` — **Q8 (entry point) CHƯA được TranHoangNha chốt** (PRD §9.4). Design Team KHÔNG tự quyết định thêm tab thứ 4 — cần escalate và chờ quyết định trước khi thiết kế navigation.
- Component có sẵn cần tái sử dụng thay vì tạo mới: `LessonCard.tsx`, `WordCard.tsx`, `QuizOption.tsx`, `Chip.tsx`, `SectionHeader.tsx`, `BottomActionBar.tsx` — có thể là điểm khởi đầu phù hợp cho card list / flip card / rating buttons.
- Feature flag `reviewSystem` — mọi màn hình P1 phải render có điều kiện qua `isFeatureEnabled('reviewSystem')`.
- SRS algorithm rating buttons (nếu Option 1 SM-2 4 mức được chọn) — cần thiết kế 4 nút rõ ràng, phân biệt bằng màu VÀ label/icon (NFR-ACC-004, không chỉ dùng màu).

## 13. 4 Logs

### Assumption Log (còn mở, cần theo dõi)

| #                     | Assumption                                                                                                                                | Owner                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| A1 (Gate 1)           | Local-first, không backend mới                                                                                                            | Technical & Risk Analyst — đã xác nhận Stage 3 |
| A-QA-01..05 (Stage 5) | Thẻ mới due ngay; unsave loại khỏi session ngay; re-save khôi phục schedule; local-only có giới hạn tường minh; SRS không phụ thuộc level | Xem VIB-122 §8, đa số đã hội tụ thành DECISION |

### Question Log (mở, owner TranHoangNha — xem PRD §9 đầy đủ)

Q-GATE-01 (CRIT-002 survival policy), Q-GATE-02 (Q1 thuật toán SRS), Q-GATE-03 (MED-006 daily cap), **Q-GATE-04 (Q8 entry point UI — BLOCKING cho Design Team, cần trả lời sớm nhất)**, Q-GATE-05 (MED-004 PRD limitation confirm), Q5 (push notification, kế thừa Gate 1).

### Risk Register (còn mở)

| ID                            | Risk                                                                                                         | Owner            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------- |
| R2                            | Migration mới chạm vào lớp migration P0 vừa sửa lỗi cú pháp — cần version ledger/transaction, chưa implement | Mobile Tech Lead |
| R4 (persona)                  | Nhu cầu sentence pattern của Lan không được đáp ứng (nếu §9.5 xác nhận)                                      | Product Owner    |
| Benchmark 10k cards (LOW-001) | Target p95 chưa có baseline thật, chỉ là đề xuất                                                             | Mobile Tech Lead |

### Decision Log (đã chốt qua Stage 3–6)

| Quyết định                                                 | Decision-maker                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Full Lane (Gate 1)                                         | TranHoangNha (approve)                                             |
| Completion rule hợp nhất (CRIT-001)                        | Requirements + Technical & Risk Analyst, hội tụ Stage 4            |
| `reviewSystem` là feature key đúng, không tạo key mới (Q9) | Technical & Risk Analyst                                           |
| R3 đóng — SRS không dùng user level                        | Technical & Risk Analyst                                           |
| Session phải persist qua crash (A-03)                      | Technical & Risk Analyst                                           |
| FR/AC package (Gate 2)                                     | TranHoangNha (approve, không chọn từng option cụ thể — xem PRD §9) |
