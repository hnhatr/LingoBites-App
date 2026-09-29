import fs from 'node:fs';
import path from 'node:path';
import {featureRegistry} from '../feature-registry';

// `FeatureStatusScreen` casts registry entries with `as unknown as`, so a typo
// in a `module` value would never fail typecheck. This test resolves each value
// against the repository tree instead (LING-127 AC-002).
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');

describe('featureRegistry module values (LING-127 AC-002)', () => {
  it('uses repository-relative src/ paths', () => {
    const invalid = featureRegistry
      .filter(entry => !entry.module.startsWith('src/'))
      .map(entry => `${entry.key}: ${entry.module}`);

    expect(invalid).toEqual([]);
  });

  it('points every module value at an existing repository directory', () => {
    const missing = featureRegistry
      .filter(entry => {
        const target = path.join(repoRoot, entry.module);
        return !fs.existsSync(target) || !fs.statSync(target).isDirectory();
      })
      .map(entry => `${entry.key}: ${entry.module}`);

    expect(missing).toEqual([]);
  });
});
