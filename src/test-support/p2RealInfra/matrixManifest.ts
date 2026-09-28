/**
 * LING-110 / TASK-023 — deterministic P2 validation matrix registry.
 *
 * Each row maps an AC/oracle branch to a Jest test name prefix. Environment
 * `real-sqlite+keychain-vault` uses production code paths with `node:sqlite`
 * and the in-memory Keychain vault (authoritative for SQLite/JS ordering).
 * Native Android/iOS Keychain/Hermes/filesystem rows remain explicitly deferred
 * per requester R5 and are listed with environment `device-native` (NOT VERIFIED).
 */

export type P2MatrixEnvironment =
  | 'real-sqlite+keychain-vault'
  | 'device-native';

export type P2MatrixAuthority = 'authoritative' | 'deferred';

export type P2MatrixRow = {
  id: string;
  ac: string[];
  trigger: string;
  environment: P2MatrixEnvironment;
  command: string;
  authority: P2MatrixAuthority;
  testNamePrefix: string;
};

export const P2_REAL_INFRA_MATRIX: readonly P2MatrixRow[] = [
  {
    id: 'P2-M-008-LOGOUT',
    ac: ['AC-008', 'AC-016', 'INV-003'],
    trigger: 'logout retains A rows and pending outbox',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-008-LOGOUT',
  },
  {
    id: 'P2-M-008-SAME-ACCOUNT',
    ac: ['AC-008', 'AC-016', 'INV-001'],
    trigger: 'same-account re-login does not wipe or stage switch',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-008-SAME-ACCOUNT',
  },
  {
    id: 'P2-M-008-EXPLICIT-DELETE',
    ac: ['AC-008', 'AC-016', 'BR-010'],
    trigger: 'explicit local-data deletion (separate scope from A→B)',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-008-EXPLICIT-DELETE',
  },
  {
    id: 'P2-M-012-PROMPT',
    ac: ['AC-012', 'INV-001'],
    trigger: 'A→B stages confirmation before any delete',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-012-PROMPT',
  },
  {
    id: 'P2-M-013-CANCEL',
    ac: ['AC-013', 'INV-001', 'INV-002', 'INV-003'],
    trigger: 'cancel / not confirmed leaves A intact',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-013-CANCEL',
  },
  {
    id: 'P2-M-014-CONFIRM',
    ac: ['AC-014', 'INV-001', 'INV-002', 'INV-003'],
    trigger: 'confirmed A→B wipes SQLite+outbox, B active after commit',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-014-CONFIRM',
  },
  {
    id: 'P2-M-015-RECOVERY',
    ac: ['AC-015', 'INV-001', 'INV-002', 'INV-003'],
    trigger: 'restart/recovery while awaiting or confirmed',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-015-RECOVERY',
  },
  {
    id: 'P2-M-015-OFFLINE-CONFIRM',
    ac: ['AC-015', 'NFR-006'],
    trigger: 'offline explicit confirm completes locally',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-015-OFFLINE-CONFIRM',
  },
  {
    id: 'P2-M-FAIL-JOURNAL',
    ac: ['AC-015', 'INV-001'],
    trigger: 'journal confirm write failure leaves A unchanged',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-FAIL-JOURNAL',
  },
  {
    id: 'P2-M-FAIL-DB',
    ac: ['AC-015', 'INV-001', 'INV-002'],
    trigger: 'DB replacement failure leaves A active',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-FAIL-DB',
  },
  {
    id: 'P2-M-FAIL-POINTER',
    ac: ['AC-015', 'INV-003'],
    trigger: 'session activation failure after DB commit is observable',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-FAIL-POINTER',
  },
  {
    id: 'P2-M-BTOB-REPLAY',
    ac: ['AC-008', 'AC-014', 'INV-002', 'INV-003'],
    trigger: 'zero A-event replay under B after confirm',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-BTOB-REPLAY',
  },
  {
    id: 'P2-M-BTOC-TARGET',
    ac: ['AC-012', 'INV-001'],
    trigger: 'B→C target change mid-awaiting requires fresh confirmation',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-BTOC-TARGET',
  },
  {
    id: 'P2-M-DUP-ATTEMPT',
    ac: ['AC-015', 'BR-009'],
    trigger: 'duplicate/concurrent stage attempts are serialized',
    environment: 'real-sqlite+keychain-vault',
    command: 'yarn test:characterization:p2-real-infra',
    authority: 'authoritative',
    testNamePrefix: 'P2-M-DUP-ATTEMPT',
  },
  {
    id: 'P2-M-NATIVE-KEYCHAIN',
    ac: ['AC-012', 'AC-015'],
    trigger: 'real Android/iOS Keychain journal durability',
    environment: 'device-native',
    command: 'M4 milestone QA (deferred)',
    authority: 'deferred',
    testNamePrefix: 'N/A — device QA',
  },
  {
    id: 'P2-M-NATIVE-FS',
    ac: ['AC-016', 'BR-010'],
    trigger: 'managed filesystem on device during explicit deletion',
    environment: 'device-native',
    command: 'M4 milestone QA (deferred)',
    authority: 'deferred',
    testNamePrefix: 'N/A — device QA',
  },
] as const;
