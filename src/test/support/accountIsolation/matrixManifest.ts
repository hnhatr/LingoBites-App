/**
 * LING-112 / TASK-006 — post-M3 account-isolation and navigation regression matrix.
 *
 * Authoritative rows run under `real-sqlite+keychain-vault` (same harness as
 * LING-110 TASK-023) unless labelled `deterministic-unit`. Native Android/iOS
 * rows stay deferred per requester R5.
 */

export type M4MatrixEnvironment =
  | 'real-sqlite+keychain-vault'
  | 'deterministic-unit'
  | 'device-native';

export type M4MatrixAuthority = 'authoritative' | 'deferred' | 'quarantined';

export type M4MatrixRow = {
  id: string;
  ac: string[];
  trigger: string;
  environment: M4MatrixEnvironment;
  command: string;
  authority: M4MatrixAuthority;
  testNamePrefix: string;
};

export const M4_ACCOUNT_ISOLATION_MATRIX: readonly M4MatrixRow[] = [
  {
    id: 'M4-M-INV004-TABS-GATE',
    ac: ['AC-007', 'INV-004'],
    trigger: 'Tabs gate mounts only for authenticated phase',
    environment: 'deterministic-unit',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-INV004-TABS-GATE',
  },
  {
    id: 'M4-M-INV004-SWITCH-ROUTES',
    ac: ['AC-007', 'INV-004'],
    trigger:
      'switch-confirmation/switching/switch-failed → AccountSwitch route',
    environment: 'deterministic-unit',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-INV004-SWITCH-ROUTES',
  },
  {
    id: 'CR-001-M4-M-BOOT-LOGOUT-AF002',
    ac: ['INV-003', 'AC-008', 'AF-002'],
    trigger:
      'concurrent boot vs explicit logout — logout must win (signed-out, cleared pointer)',
    environment: 'real-sqlite+keychain-vault',
    command:
      'M4_RUN_CR001=1 yarn jest m4-cr001-af002.quarantined.characterization.test.ts',
    authority: 'quarantined',
    testNamePrefix: 'CR-001-M4-M-BOOT-LOGOUT-AF002',
  },
  {
    id: 'M4-M-BOOT-SESSION-RESTORE',
    ac: ['INV-003', 'AC-015'],
    trigger: 'authenticated boot restores persisted session via /v1/me',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-BOOT-SESSION-RESTORE',
  },
  {
    id: 'M4-M-RESTART-AWAITING',
    ac: ['AC-015', 'INV-003'],
    trigger: 'process restart while switch awaiting → prompt, A rows intact',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-RESTART-AWAITING',
  },
  {
    id: 'M4-M-REFRESH-EXPIRED-AWAITING',
    ac: ['INV-003'],
    trigger:
      'expired access token refresh while switch awaiting; B not activated',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-REFRESH-EXPIRED-AWAITING',
  },
  {
    id: 'M4-M-REFRESH-CONFIRM-INTERLEAVE',
    ac: ['INV-003', 'AC-014'],
    trigger: 'concurrent refresh and confirmSwitch while awaiting A→B',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-REFRESH-CONFIRM-INTERLEAVE',
  },
  {
    id: 'M4-M-DOMAIN-AUDIO',
    ac: ['INV-003', 'TASK-012'],
    trigger: 'relocated audio_assets rows wiped on confirmed A→B',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-DOMAIN-AUDIO',
  },
  {
    id: 'M4-M-DOMAIN-YOUTUBE',
    ac: ['INV-003', 'TASK-015'],
    trigger: 'relocated youtube_progress rows wiped on confirmed A→B',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-DOMAIN-YOUTUBE',
  },
  {
    id: 'M4-M-P2-REGRESSION-SMOKE',
    ac: ['AC-008', 'INV-003'],
    trigger: 'post-M3 smoke: P2 confirm path still clears cross-account leak',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-P2-REGRESSION-SMOKE',
  },
  {
    id: 'M4-M-NATIVE-AUDIO-SPEAKING',
    ac: ['AC-009', 'TASK-012'],
    trigger: 'native audio/speaking capture + playback on device',
    environment: 'device-native',
    command: 'M4 milestone QA (deferred)',
    authority: 'deferred',
    testNamePrefix: 'N/A — device QA',
  },
  {
    id: 'M4-M-NATIVE-YOUTUBE-OCR',
    ac: ['AC-009', 'TASK-015'],
    trigger: 'native YouTube/OCR/camera seams on device',
    environment: 'device-native',
    command: 'M4 milestone QA (deferred)',
    authority: 'deferred',
    testNamePrefix: 'N/A — device QA',
  },
] as const;
