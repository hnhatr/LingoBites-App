# Device Integrations: Golden Hour Notifications & Offline Audio (SETE-90)

Stage 3 (SETE-89) left `ReminderScheduler` as a port with a no-op default and the
chapter-audio cache working against injected test ports. This slice wires the
real on-device implementations and documents what still needs a physical build.

## What changed

### Native local notifications (`@notifee/react-native`)

- `src/modules/engagement/nativeReminderScheduler.ts`
  - `createNativeReminderScheduler(api)` — a `ReminderScheduler` whose pending
    state is mirrored in memory and reconciled against the OS. Each native call
    is fire-and-forget with a shadow rollback on failure, so a revoked
    permission or missing native module can never throw into the review flow.
  - `permissionStatusFromSettings`, `shouldRequestReminderPermission` — pure
    permission mapping / decision helpers (unit-tested).
  - `configureNativeReminderNotifications(api, opts)` — the bootstrap:
    - OS already granted → create Android channel, install adapter, refresh
      pending, run reconcile;
    - not granted and ≥1 card is due in the future → ask once, then install on
      grant;
    - denied / unavailable / nothing due → stay on the no-op scheduler
      (`noopReminderScheduler` remains the test/dev fallback).
  - `bootstrapGoldenHourReminders()` — wired default used by
    `EngagementBootstrap` (fires on app start when the `reviewSystem` feature is
    enabled).
- The existing reconciliation logic (schedule from `next_review_at`, cancel /
  reschedule stale reminders after a review moves the due time) is unchanged:
  `DailyReviewScreen.finalizeSession` already calls `reconcileReminders()` after
  a session, and the bootstrap reconciles on every launch.

### Offline chapter audio playback

- `src/modules/audio/deviceChapterAudio.ts`
  - `deviceChapterAudioDownloader` — real downloader (fetch → `Uint8Array` →
    SHA-256 over the bytes) fitting the existing `ChapterAudioDownloader` port,
    so a checksum mismatch never touches disk.
  - `deviceChapterAudioFileStore` — real file store writing under
    `Documents/LingoBitesAudio/<chapter>/<asset><ext>` and removing files on
    eviction, fitting `ChapterAudioFileStore`.
  - `ensureChapterAudioOnDevice(chapterId)` — `ensureChapterAudio` wired to the
    real ports (manifest client + downloader + file store).
  - `playReadyChapterAudio(assetId)` / `stopChapterAudioPlayback()` — offline
    playback from the cached file path via `react-native-sound`.
  - `readyAudioPathOnDevice(assetId)` — resolves a cached path only when the
    file still exists.
- `bytesToBase64.ts`, `sha256HexBytes` — Hermes-safe helpers used by the store /
  downloader (unit-tested).

## Platform setup still required for a real device build

> None of this is verified by CI. After the changes below, rebuild the app and
> run the manual QA in the next section on a device/simulator.

### Dependency installation

```bash
yarn add @notifee/react-native @dr.pogodin/react-native-fs react-native-sound
# iOS only:
cd ios && bundle exec pod install
```

### iOS

1. `@notifee/react-native` requires no `Info.plist` entry for local scheduled
   notifications. iOS shows the system permission prompt from
   `requestPermission()` the first time it is called (our bootstrap only asks
   when at least one card is actually due in the future).
2. `react-native-sound`: set the AVAudioSession category in code
   (`Sound.setCategory('Playback')` — done once in `playReadyChapterAudio`) so
   clips play with the silent switch on.
3. **Simulator**: local notifications work on the iOS simulator for foreground
   display; background delivery and exact behavior are best verified on a
   physical device. `requestPermission()` on a simulator behaves normally.

### Android

1. `AndroidManifest.xml` (`android/app/src/main/AndroidManifest.xml`):
   - Android 13+ runtime notification permission (`POST_NOTIFICATIONS`) is
     requested by `requestPermission()`; no manifest entry is required for
     Notifee, but if you later want **exact** Golden Hour timing add
     `<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />`
     (Notifee schedules with WorkManager by default, which is inexact but needs
     no special permission — recommended for an MVP reminder).
2. Notifee auto-configures its receivers via manifest merge; no manual receiver
   is required for trigger notifications.
3. `@dr.pogodin/react-native-fs` writes under the app Documents directory
   (`DocumentDirectoryPath`); no storage permission is needed for app-private
   storage on modern Android.
4. **Emulator**: background delivery of scheduled notifications can be
   unreliable on heavily-restricted OEM builds (Xiaomi/Huawei battery
   optimizations). Verify the Golden Hour notification on a plain AOSP emulator
   or a physical device.

## Manual QA

### VC-5 — due review produces a local notification; completing the review cancels/reschedules

1. Build & install a Development build with the deps above.
2. Add a few flashcards (`react-native` dev build → save/scan a lesson or use an
   existing saved lesson), open Daily Review and rate a card so its `next_review_at`
   lands in the future.
3. Relaunch the app (or just open it with the review feature on). If permission
   is not yet granted and a card is due in the future, the OS permission prompt
   appears → **Allow**.
4. Background the app until the due instant (or temporarily lower the interval /
   seed a near-future due time) → a local notification "Đến giờ ôn tập"
   appears.
5. Open the app and finish the review for that card; relaunch. The stale
   notification must not fire again (reconcile cancels it). Reviewing early and
   relaunching reschedules to the new due time.

### VC-4 — downloaded chapter audio plays in airplane mode

1. Make sure a chapter's audio is cached on the device. The manifest
   (`GET /v1/chapters/{chapterId}/audio-manifest`) is served by the backend;
   call `ensureChapterAudioOnDevice(chapterId)` once while online (the in-app
   download trigger is the open content decision — see _Left open_ below), then
   confirm `getAudioCacheStats()` shows ready bytes.
2. Enable **Airplane mode** (no Wi-Fi).
3. Open **Hồ sơ → Âm thanh chương học** (tap the row) — it plays the first
   downloaded clip via `playReadyChapterAudio` from
   `Documents/LingoBitesAudio/...` with no network involved. Any clip that is
   not `ready` resolves `NOT_READY` and shows an explanatory alert instead of
   throwing.

## Left open (product/content decisions)

- Mapping a "chapter" to an on-device lesson/content source and the UI trigger
  that calls `ensureChapterAudioOnDevice` — the local lessons are user-authored
  text lessons; curated chapter audio needs the content/manifest source and a
  product call on where the download/play affordance lives.
- Home-screen widget remains deferred (notification path satisfies the parent
  requirement; see SETE-89 note).
