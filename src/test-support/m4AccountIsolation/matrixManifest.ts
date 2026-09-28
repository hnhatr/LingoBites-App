/**
 * LING-112 / TASK-006 — post-M3 account-isolation and navigation regression matrix.
 *
 * Authoritative rows run under `real-sqlite+keychain-vault` (same harness as
 * LING-110 TASK-023). Native Android/iOS Keychain/camera/filesystem rows stay
 * deferred per requester R5.
 */

export type M4MatrixEnvironment =
  | 'real-sqlite+keychain-vault'
  | 'device-native';

export type M4MatrixAuthority = 'authoritative' | 'deferred';

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
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-INV004-TABS-GATE',
  },
  {
    id: 'M4-M-INV004-SWITCH-ROUTES',
    ac: ['AC-007', 'INV-004'],
    trigger:
      'switch-confirmation/switching/switch-failed → AccountSwitch route',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-INV004-SWITCH-ROUTES',
  },
  {
    id: 'M4-M-BOOT-LOGOUT-RACE',
    ac: ['INV-003', 'AC-008'],
    trigger: 'concurrent store boot + logout after authenticated session',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-BOOT-LOGOUT-RACE',
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
    id: 'M4-M-REFRESH-AWAITING',
    ac: ['INV-003', 'AC-009'],
    trigger: 'session refresh while switch awaiting does not activate B',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:m4-account-isolation',
    authority: 'authoritative',
    testNamePrefix: 'M4-M-REFRESH-AWAITING',
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
    ac: ['AC-007', 'AC-009', 'TASK-012'],
    trigger: 'native audio/speaking capture + playback on device',
    environment: 'device-native',
    command: 'M4 milestone QA (deferred)',
    authority: 'deferred',
    testNamePrefix: 'N/A — device QA',
  },
  {
    id: 'M4-M-NATIVE-YOUTUBE-OCR',
    ac: ['AC-007', 'AC-009', 'TASK-015'],
    trigger: 'native YouTube/OCR/camera seams on device',
    environment: 'device-native',
    command: 'M4 milestone QA (deferred)',
    authority: 'deferred',
    testNamePrefix: 'N/A — device QA',
  },
] as const;
