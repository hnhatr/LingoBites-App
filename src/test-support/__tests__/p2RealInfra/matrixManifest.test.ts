import {P2_REAL_INFRA_MATRIX} from '@/test-support/p2RealInfra/matrixManifest';

describe('P2 real-infra matrix manifest (LING-110)', () => {
  it('lists every authoritative row with a unique id and test prefix', () => {
    const authoritative = P2_REAL_INFRA_MATRIX.filter(
      row => row.authority === 'authoritative',
    );
    const ids = authoritative.map(row => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of authoritative) {
      expect(row.command).toContain('p2-real-infra');
      expect(row.testNamePrefix.length).toBeGreaterThan(3);
    }
  });

  it('marks native device evidence as deferred (R5)', () => {
    const deferred = P2_REAL_INFRA_MATRIX.filter(
      row => row.environment === 'device-native',
    );
    expect(deferred.length).toBeGreaterThan(0);
    expect(deferred.every(row => row.authority === 'deferred')).toBe(true);
  });
});
