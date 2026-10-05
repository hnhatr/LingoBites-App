# Điều hướng (navigation) — kiến trúc

> Thay thế cách cũ: màn của tab này được mở trong stack của tab khác
> (`getParent().navigate('Lessons', {screen: 'LessonCreation'})`), màn bị
> đăng ký trùng ở nhiều stack, và TabBar phải vá bằng cờ `fromHome`.

## 1. Bố cục navigator

Mỗi màn chỉ được đăng ký **một lần**.

```text
RootStack
├─ Tabs                    mỗi tab chỉ giữ màn "sảnh" của nó
│  ├─ Home     HomeMain
│  ├─ Create   CreateMain
│  ├─ Lessons  LessonsList
│  └─ Profile  ProfileMain, PrivacyNote, ProgressReport (+ màn dev)
└─ Luồng công việc         phủ lên tab bar; Back quay về tab đã mở luồng
   ├─ Tạo bài  PasteText, ImageCapture, OCRReview, LessonCreation
   ├─ Bài học  CanonicalCatalog, CanonicalLessonPlayer
   └─ Luyện    DailyReview, Today, SpeakingRoom,
               ShadowingLessonPicker, ShadowingSession, ShadowingSummary
```

- Code: `src/app/navigation/AppNavigator.tsx`, kiểu route ở
  `src/app/navigation/types.ts`, danh sách route ở `rootStackRoutes.ts`.
- Màn trên root stack tự che tab bar, nên không cần danh sách "immersive"
  gõ tay. Tab bar chỉ gọi `navigate(tab)`, không có logic reset riêng.

## 2. Feature điều hướng bằng intent: `useAppNavigation()`

Feature không được import `app` (luật phân tầng), nên điều hướng đi qua một
port ở `core` và adapter ở `app`:

```text
core/navigation        AppNavigation (interface) + useAppNavigation()
        ▲ implements
app/navigation         appNavigationAdapter.ts — nơi DUY NHẤT biết tên route
        ▲ dùng
features/*             const nav = useAppNavigation(); nav.openLesson(id)
```

| Intent | Đi tới |
|---|---|
| `openLesson(id)` | `CanonicalLessonPlayer` |
| `openCatalog()` | `CanonicalCatalog` |
| `startCreate({kind: 'paste' \| 'camera' \| 'gallery' \| 'youtube'})` | `PasteText` / `ImageCapture` / `LessonCreation` |
| `startCreate({kind: 'text' \| 'ocr', text})` | `LessonCreation` (gửi luôn text đã xác nhận) |
| `finishCreate(lessonId)` | Xoá các màn tạo bài khỏi lịch sử rồi mở bài |
| `openReview()` · `openToday()` · `openSpeakingRoom()` | màn tương ứng |
| `openShadowing(target?)` | `ShadowingSession` nếu có bài, không thì `ShadowingLessonPicker` |
| `goToTab(tab)` · `goBack()` | đổi tab · lùi một màn |

Hook theo luồng: `useCreateFlow()` (`features/lesson/player`) gói `back` và
`openCreatedLesson` cho màn tạo bài.

Điều hướng **bên trong cùng một luồng** (ví dụ `ImageCapture → OCRReview`,
`SpeakingRoom → ShadowingSession`) vẫn dùng `navigation` của màn đó, vì các
màn trong luồng nằm cùng root stack.

## 3. Hành vi mong đợi

| Tình huống | Kết quả |
|---|---|
| Tab Tạo bài → YouTube → Back | Về tab Tạo bài |
| Đang tạo bài | Tab bar bị che; muốn rời thì Back |
| Tạo xong → mở bài → Back | Về tab đã bắt đầu tạo (không về màn "đã tạo xong") |
| Mở bài từ Home hay từ Thư viện | Cùng một màn; Back về đúng tab |
| Bấm sang tab khác rồi quay lại | Tab luôn ở màn sảnh |

## 4. Luật tự động

`yarn lint:boundaries` (`scripts/check-module-boundaries.js`) chặn:

- `feature-navigation-get-parent`: gọi `.getParent(...)` trong `src/features`.
- `navigation-untyped-route`: `navigate('X' as any, ...)` trong code production.

## 5. Test

- `useAppNavigation()` ngoài `<AppNavigationProvider>` sẽ throw. Trong jest,
  `jest.setup.js` trả về double dùng chung `mockAppNavigation`
  (`@test/support`) để assert intent:
  `expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('lesson-1')`.
- Adapter: `src/app/navigation/__tests__/appNavigationAdapter.test.ts`.
- Bố cục: `src/app/navigation/__tests__/RootStack.test.tsx` kiểm tra mỗi
  luồng chỉ đăng ký một lần, trên root stack.
