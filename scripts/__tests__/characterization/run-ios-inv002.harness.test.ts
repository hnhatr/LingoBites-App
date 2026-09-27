import {spawnSync} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.join(__dirname, '../../..');
const RUNNER = path.join(
  ROOT,
  'scripts/characterization/run-ios-inv002.sh',
);
const VALIDATOR = path.join(
  ROOT,
  'scripts/characterization/validate-inv002-marker.mjs',
);

function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('no address'));
        return;
      }
      const port = addr.port;
      server.close(err => {
        if (err) {
          reject(err);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function freePortPair(): Promise<{charPort: string; metroPort: string}> {
  const charPort = String(await pickFreePort());
  const metroPort = String(await pickFreePort());
  return {charPort, metroPort};
}

function runRunner(
  env: Record<string, string>,
  expectStatus: number,
): {status: number; stderr: string; stdout: string} {
  const result = spawnSync('bash', [RUNNER], {
    cwd: ROOT,
    env: {...process.env, ...env},
    encoding: 'utf8',
  });
  expect(result.status).toBe(expectStatus);
  return {
    status: result.status ?? -1,
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? '',
  };
}

describe('run-ios-inv002 harness (CR-001 / CR-004)', () => {
  const envBackup = path.join(ROOT, '.env');
  let hadEnv = false;
  let priorEnv: string | null = null;

  beforeEach(() => {
    if (existsSync(envBackup)) {
      hadEnv = true;
      priorEnv = readFileSync(envBackup, 'utf8');
    }
  });

  afterEach(() => {
    if (hadEnv && priorEnv !== null) {
      writeFileSync(envBackup, priorEnv);
    } else if (existsSync(envBackup)) {
      rmSync(envBackup);
    }
    const legacyBackup = path.join(ROOT, '.ling93-env-backup');
    if (existsSync(legacyBackup)) {
      rmSync(legacyBackup, {recursive: true, force: true});
    }
  });

  it('rejects status:fail marker lines', () => {
    const failLine =
      '[LING93_INV002] {"status":"fail","runtime":"react-native-quick-sqlite-jsi"}';
    const result = spawnSync(
      'node',
      [VALIDATOR, failLine],
      {cwd: ROOT, encoding: 'utf8'},
    );
    expect(result.status).toBe(1);
  });

  it('accepts status:pass marker with assertions', () => {
    const passLine =
      '[LING93_INV002] {"status":"pass","assertions":{"onePracticeServerEffect":true}}';
    const result = spawnSync(
      'node',
      [VALIDATOR, passLine],
      {cwd: ROOT, encoding: 'utf8'},
    );
    expect(result.status).toBe(0);
  });

  it('exits before snapshot when CHAR_PORT is occupied and leaves .env untouched', async () => {
    const marker = `LING93_PORT_TEST_${Date.now()}`;
    writeFileSync(envBackup, `${marker}=1\n`);
    const server = http.createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('no port');
    }
    const occupiedPort = String(addr.port);
    const freeMetro = String(addr.port + 1);
    try {
      runRunner(
        {
          CHAR_PORT: occupiedPort,
          CHAR_METRO_PORT: freeMetro,
        },
        1,
      );
      expect(readFileSync(envBackup, 'utf8')).toContain(marker);
    } finally {
      server.close();
    }
  });

  it('ignores stale .ling93-env-backup in repo on port failure', async () => {
    const staleDir = path.join(ROOT, '.ling93-env-backup');
    mkdirSync(staleDir, {recursive: true});
    writeFileSync(path.join(staleDir, '.env'), 'STALE=1\n');
    writeFileSync(envBackup, 'CURRENT=1\n');
    const server = http.createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('no port');
    }
    try {
      runRunner(
        {
          CHAR_PORT: String(addr.port),
          CHAR_METRO_PORT: String(addr.port + 1),
        },
        1,
      );
      expect(readFileSync(envBackup, 'utf8')).toContain('CURRENT=1');
    } finally {
      server.close();
    }
  });

  it('restore-check selftest restores .env via EXIT cleanup', async () => {
    const ports = await freePortPair();
    writeFileSync(envBackup, 'restore-marker=before\n');
    runRunner(
      {
        CHAR_SELFTEST: 'restore-check',
        CHAR_PORT: ports.charPort,
        CHAR_METRO_PORT: ports.metroPort,
      },
      0,
    );
    expect(readFileSync(envBackup, 'utf8')).toContain('restore-marker=before');
    expect(existsSync(path.join(ROOT, '.ling93-env-backup'))).toBe(false);
  });

  it('fail-marker selftest exits non-zero on status:fail', async () => {
    const ports = await freePortPair();
    writeFileSync(envBackup, 'selftest=1\n');
    runRunner(
      {
        CHAR_SELFTEST: 'fail-marker',
        CHAR_PORT: ports.charPort,
        CHAR_METRO_PORT: ports.metroPort,
      },
      1,
    );
    expect(readFileSync(envBackup, 'utf8')).toContain('selftest=1');
  });

  it('missing-marker selftest exits 1 without a pass marker', async () => {
    const ports = await freePortPair();
    writeFileSync(envBackup, 'selftest=2\n');
    runRunner(
      {
        CHAR_SELFTEST: 'missing-marker',
        CHAR_PORT: ports.charPort,
        CHAR_METRO_PORT: ports.metroPort,
      },
      1,
    );
    expect(readFileSync(envBackup, 'utf8')).toContain('selftest=2');
  });
});
