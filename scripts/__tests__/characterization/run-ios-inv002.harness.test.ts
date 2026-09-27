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
const RUNNER = path.join(ROOT, 'scripts/characterization/run-ios-inv002.sh');
const VALIDATOR = path.join(
  ROOT,
  'scripts/characterization/validate-inv002-marker.mjs',
);

const REQUIRED_ASSERTIONS: Record<string, true> = {
  practicePendingAfterEvents: true,
  reviewPendingAfterEvents: true,
  firstDrainFailed: true,
  pendingAfterAmbiguousDrain: true,
  pendingSurvivesRestart: true,
  retryDrainSynced: true,
  pendingAfterRetry: true,
  duplicateDrainSynced: true,
  pendingAfterDuplicateDrain: true,
  onePracticeServerEffect: true,
  oneReviewServerEffect: true,
  practicePostsIncludeRetry: true,
  reviewPostsIncludeRetry: true,
};

function fullPassMarker(runId: string): string {
  return `[LING93_INV002] ${JSON.stringify({
    status: 'pass',
    runId,
    runtime: 'react-native-quick-sqlite-jsi',
    assertions: REQUIRED_ASSERTIONS,
  })}`;
}

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

function runValidator(
  line: string,
  runId: string,
): {status: number | null; stderr: string} {
  const result = spawnSync('node', [VALIDATOR, line, runId], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return {status: result.status, stderr: result.stderr ?? ''};
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

describe('run-ios-inv002 harness (CR-001 / CR-004 cycle 3)', () => {
  const envPath = path.join(ROOT, '.env');
  const envCharPath = path.join(ROOT, '.env.characterization');
  const pathsCreatedByTest: string[] = [];
  let hadEnv = false;
  let priorEnv: string | null = null;
  let hadEnvChar = false;
  let priorEnvChar: string | null = null;

  beforeEach(() => {
    if (existsSync(envPath)) {
      hadEnv = true;
      priorEnv = readFileSync(envPath, 'utf8');
    }
    if (existsSync(envCharPath)) {
      hadEnvChar = true;
      priorEnvChar = readFileSync(envCharPath, 'utf8');
    }
  });

  afterEach(() => {
    if (hadEnv && priorEnv !== null) {
      writeFileSync(envPath, priorEnv);
    } else if (existsSync(envPath)) {
      rmSync(envPath);
    }
    if (hadEnvChar && priorEnvChar !== null) {
      writeFileSync(envCharPath, priorEnvChar);
    } else if (existsSync(envCharPath)) {
      rmSync(envCharPath);
    }
    for (const created of pathsCreatedByTest) {
      rmSync(created, {recursive: true, force: true});
    }
    pathsCreatedByTest.length = 0;
    hadEnv = false;
    priorEnv = null;
    hadEnvChar = false;
    priorEnvChar = null;
  });

  it('accepts a complete pass marker with matching RUN_ID', () => {
    const runId = 'ling93-test-run-1';
    const result = runValidator(fullPassMarker(runId), runId);
    expect(result.status).toBe(0);
  });

  const negativeValidatorCases: Array<{
    name: string;
    line: string;
    runId: string;
  }> = [
    {
      name: 'status fail',
      line:
        '[LING93_INV002] {"status":"fail","runId":"ling93-test-run-1","assertions":{}}',
      runId: 'ling93-test-run-1',
    },
    {
      name: 'empty assertions',
      line:
        '[LING93_INV002] {"status":"pass","runId":"ling93-test-run-1","assertions":{}}',
      runId: 'ling93-test-run-1',
    },
    {
      name: 'missing assertions',
      line: '[LING93_INV002] {"status":"pass","runId":"ling93-test-run-1"}',
      runId: 'ling93-test-run-1',
    },
    {
      name: 'false onePracticeServerEffect',
      line: `[LING93_INV002] ${JSON.stringify({
        status: 'pass',
        runId: 'ling93-test-run-1',
        assertions: {
          ...REQUIRED_ASSERTIONS,
          onePracticeServerEffect: false,
        },
      })}`,
      runId: 'ling93-test-run-1',
    },
    {
      name: 'wrong RUN_ID',
      line: fullPassMarker('ling93-other'),
      runId: 'ling93-test-run-1',
    },
    {
      name: 'missing RUN_ID in marker',
      line: `[LING93_INV002] ${JSON.stringify({
        status: 'pass',
        assertions: REQUIRED_ASSERTIONS,
      })}`,
      runId: 'ling93-test-run-1',
    },
    {
      name: 'malformed JSON',
      line: '[LING93_INV002] {not-json',
      runId: 'ling93-test-run-1',
    },
    {
      name: 'missing expected RUN_ID argument',
      line: fullPassMarker('ling93-test-run-1'),
      runId: '',
    },
  ];

  it.each(negativeValidatorCases)(
    'rejects marker: $name',
    ({line, runId}) => {
      const result = runValidator(line, runId);
      expect(result.status).not.toBe(0);
    },
  );

  it('exits before snapshot when CHAR_PORT is occupied and leaves .env untouched', async () => {
    const marker = `LING93_PORT_TEST_${Date.now()}`;
    writeFileSync(envPath, `${marker}=1\n`);
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
      expect(readFileSync(envPath, 'utf8')).toContain(marker);
    } finally {
      server.close();
    }
  });

  it('preserves preexisting .ling93-env-backup on port failure', async () => {
    const staleDir = path.join(ROOT, '.ling93-env-backup');
    mkdirSync(staleDir, {recursive: true});
    pathsCreatedByTest.push(staleDir);
    writeFileSync(path.join(staleDir, '.env'), 'STALE=1\n');
    writeFileSync(envPath, 'CURRENT=1\n');
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
      expect(readFileSync(envPath, 'utf8')).toContain('CURRENT=1');
      expect(readFileSync(path.join(staleDir, '.env'), 'utf8')).toContain(
        'STALE=1',
      );
    } finally {
      server.close();
    }
  });

  it('restore-check selftest restores .env and preexisting .env.characterization', async () => {
    const ports = await freePortPair();
    writeFileSync(envPath, 'restore-marker=before\n');
    writeFileSync(envCharPath, 'CHAR_MARKER=keep\n');
    hadEnvChar = true;
    priorEnvChar = 'CHAR_MARKER=keep\n';
    runRunner(
      {
        CHAR_SELFTEST: 'restore-check',
        CHAR_PORT: ports.charPort,
        CHAR_METRO_PORT: ports.metroPort,
      },
      0,
    );
    expect(readFileSync(envPath, 'utf8')).toContain('restore-marker=before');
    expect(readFileSync(envCharPath, 'utf8')).toContain('CHAR_MARKER=keep');
  });

  it('fail-marker selftest exits non-zero on status:fail', async () => {
    const ports = await freePortPair();
    writeFileSync(envPath, 'selftest=1\n');
    runRunner(
      {
        CHAR_SELFTEST: 'fail-marker',
        CHAR_PORT: ports.charPort,
        CHAR_METRO_PORT: ports.metroPort,
      },
      1,
    );
    expect(readFileSync(envPath, 'utf8')).toContain('selftest=1');
  });

  it('missing-marker selftest exits 1 without a pass marker', async () => {
    const ports = await freePortPair();
    writeFileSync(envPath, 'selftest=2\n');
    runRunner(
      {
        CHAR_SELFTEST: 'missing-marker',
        CHAR_PORT: ports.charPort,
        CHAR_METRO_PORT: ports.metroPort,
      },
      1,
    );
    expect(readFileSync(envPath, 'utf8')).toContain('selftest=2');
  });

  it('stale-marker selftest rejects wrong RUN_ID', async () => {
    const ports = await freePortPair();
    runRunner(
      {
        CHAR_SELFTEST: 'stale-marker',
        CHAR_PORT: ports.charPort,
        CHAR_METRO_PORT: ports.metroPort,
      },
      1,
    );
  });
});
