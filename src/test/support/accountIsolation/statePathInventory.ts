/**
 * LING-112 / TASK-006 — inventory of shared and persisted state implicated in
 * account isolation (INV-003) and navigation/provider gating (INV-004).
 *
 * Used by the M4 matrix manifest and characterization tests; not imported by
 * production code.
 */

export type AccountIsolationStateScope =
  | 'sqlite'
  | 'keychain'
  | 'memory'
  | 'filesystem';

export type AccountIsolationStatePath = {
  id: string;
  location: string;
  scope: AccountIsolationStateScope;
  /** AC / INV / TASK rows this path participates in */
  covers: string[];
  /** Notable write sites and await boundaries for interleaving tests */
  interleavingNotes: string;
};

export const ACCOUNT_ISOLATION_STATE_PATHS: readonly AccountIsolationStatePath[] =
  [
    {
      id: 'SP-SQLITE-CURRENT-ACCOUNT',
      location: "sqlite app_settings key 'current_account_id'",
      scope: 'sqlite',
      covers: ['INV-003', 'AC-008', 'AC-014'],
      interleavingNotes:
        'Written during install marker bootstrap and after confirmed switch activation; read on every boot before session restore.',
    },
    {
      id: 'SP-SQLITE-INSTALL-MARKER',
      location: "sqlite app_settings key 'account.install_completed_v1'",
      scope: 'sqlite',
      covers: ['INV-003', 'AC-008'],
      interleavingNotes:
        'Set on first successful bootstrap; gates fresh-install Keychain cleanup ordering in boot recovery.',
    },
    {
      id: 'SP-SQLITE-WEEKLY-GOAL-BADGE-LATCH',
      location: "sqlite app_settings key 'engagement.badge_diligent_earned_at'",
      scope: 'sqlite',
      covers: ['INV-T1', 'INV-002', 'LING-222', 'IMP-003'],
      interleavingNotes:
        'Written once via INSERT OR IGNORE when diligent is first derived; cleared by local-data wipe and account-replacement delete-all-rows.',
    },
    {
      id: 'SP-SQLITE-WEEKLY-GOAL-BADGE-PENDING',
      location:
        "sqlite app_settings key 'engagement.badge_diligent_pending_at'",
      scope: 'sqlite',
      covers: ['INV-002', 'LING-228', 'ADV-002'],
      interleavingNotes:
        'Durable queue when latch INSERT fails; promoted to latch key on next read; cleared on successful latch or with app_settings wipe.',
    },
    {
      id: 'SP-SQLITE-LEARNER-TABLES',
      location:
        'sqlite learner tables (youtube_progress, flashcards, content_lesson_state, audio_assets, …)',
      scope: 'sqlite',
      covers: ['INV-003', 'AC-008', 'AC-014', 'TASK-012', 'TASK-015'],
      interleavingNotes:
        'Wiped only through TASK-020 account-replacement transaction after explicit A→B confirm; logout and same-account login must not touch rows.',
    },
    {
      id: 'SP-SQLITE-SYNC-OUTBOX',
      location: 'sqlite sync_outbox pending events',
      scope: 'sqlite',
      covers: ['INV-002', 'INV-003', 'AC-008'],
      interleavingNotes:
        'Drained under active session pointer; must not replay A events under B after confirm (see INV-002 suites).',
    },
    {
      id: 'SP-KEYCHAIN-SESSIONS',
      location: 'Keychain auth session blobs + active session pointer',
      scope: 'keychain',
      covers: ['INV-003', 'INV-004', 'AC-012', 'AC-015'],
      interleavingNotes:
        'saveSession (candidate) vs setActiveSessionId (activate) split; serialized refresh and pointer lock (LING-109).',
    },
    {
      id: 'SP-KEYCHAIN-SWITCH-JOURNAL',
      location: 'Keychain account-switch journal',
      scope: 'keychain',
      covers: ['INV-001', 'INV-003', 'AC-015'],
      interleavingNotes:
        'Awaiting vs confirmed journal states drive boot recovery and switch-confirmation UI; restart between write and pointer move is a primary interleaving surface.',
    },
    {
      id: 'SP-MEMORY-ACCOUNT-STORE',
      location: 'zustand useAccountStore phase / switchContext',
      scope: 'memory',
      covers: ['INV-004', 'AC-007', 'AC-009'],
      interleavingNotes:
        'boot(), logout(), confirmSwitch() each await bootAccount / server logout; concurrent callers join in-flight guards.',
    },
    {
      id: 'SP-FS-MANAGED-LOCAL',
      location: 'managed local files (explicit deletion / BR-010)',
      scope: 'filesystem',
      covers: ['AC-008', 'AC-016', 'BR-010'],
      interleavingNotes:
        'Separate from A→B switch wipe; device-native evidence deferred per requester R5.',
    },
  ];
