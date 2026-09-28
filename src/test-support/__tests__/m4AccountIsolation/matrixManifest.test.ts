import {M4_ACCOUNT_ISOLATION_MATRIX} from '@/test-support/m4AccountIsolation/matrixManifest';
import {ACCOUNT_ISOLATION_STATE_PATHS} from '@/test-support/m4AccountIsolation/statePathInventory';

describe('M4 account-isolation matrix manifest (LING-112)', () => {
  it('lists every authoritative row with a unique id and test prefix', () => {
    const authoritative = M4_ACCOUNT_ISOLATION_MATRIX.filter(
      row => row.authority === 'authoritative',
    );
    const ids = authoritative.map(row => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of authoritative) {
      expect(row.command).toContain('m4-account-isolation');
      expect(row.testNamePrefix.length).toBeGreaterThan(3);
    }
  });

  it('marks native device evidence as deferred (R5)', () => {
    const deferred = M4_ACCOUNT_ISOLATION_MATRIX.filter(
      row => row.environment === 'device-native',
    );
    expect(deferred.length).toBeGreaterThan(0);
    expect(deferred.every(row => row.authority === 'deferred')).toBe(true);
  });

  it('inventory documents every shared state path with covers metadata', () => {
    expect(ACCOUNT_ISOLATION_STATE_PATHS.length).toBeGreaterThanOrEqual(6);
    for (const path of ACCOUNT_ISOLATION_STATE_PATHS) {
      expect(path.covers.length).toBeGreaterThan(0);
      expect(path.interleavingNotes.length).toBeGreaterThan(10);
    }
  });
});
