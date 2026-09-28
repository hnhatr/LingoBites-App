import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {CHARACTERIZATION_INVARIANTS} from '../../../src/test/support/characterization/invariants';

describe(`${CHARACTERIZATION_INVARIANTS.INV_002} real SQLite commit (HC-001)`, () => {
  it('runs the node:sqlite outbox commit script successfully', () => {
    const script = path.join(
      __dirname,
      '../../characterization/inv002-sqlite-outbox-commit.mjs',
    );
    const result = spawnSync(process.execPath, ['--no-warnings', script], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"status":"pass"');
    const cleanStderr = result.stderr
      .split('\n')
      .filter(line => !line.includes('ExperimentalWarning'))
      .join('\n')
      .trim();
    expect(cleanStderr).toBe('');
  });
});
