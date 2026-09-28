import {readFileSync} from 'node:fs';
import path from 'node:path';
import {CHARACTERIZATION_INVARIANTS} from '../../../src/test/support/characterization/invariants';

describe(`${CHARACTERIZATION_INVARIANTS.INV_001} toolchain baseline scripts`, () => {
  it('exposes the validation commands recorded at TASK-001 dispatch', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(__dirname, '../../../package.json'), 'utf8'),
    ) as {scripts: Record<string, string>};

    expect(pkg.scripts['format:check']).toBeDefined();
    expect(pkg.scripts.typecheck).toBeDefined();
    expect(pkg.scripts.lint).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts['lint:boundaries']).toBeDefined();
    expect(pkg.scripts['lint:budget']).toBeDefined();
  });
});
