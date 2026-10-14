import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {syncDownloadedPacks} from '../syncDownloadedPacks';
import {listDownloadedPacks, saveWordPack} from '../wordPackRepository';
import type {WordPath} from '../wordPathClient';
import {fetchWordPath} from '../wordPathClient';

/** Vocab path P5: packs the Server rebuilt away leave the device; offline nothing changes. */

jest.mock('../wordPathClient', () => ({fetchWordPath: jest.fn()}));
const mockFetch = fetchWordPath as jest.MockedFunction<typeof fetchWordPath>;

const NOW = new Date('2026-10-14T08:00:00.000Z');
const KEPT = '0b1f6c1e-2d3a-4b5c-8d9e-111111111111';
const GONE = '0b1f6c1e-2d3a-4b5c-8d9e-222222222222';

function save(packId: string) {
  saveWordPack(
    {
      request_id: 'r',
      status: 'success',
      pack: {
        id: packId,
        cefr_level: 'A1',
        topic_code: null,
        position: 1,
        title_vi: 'Gói A1 1',
      },
      items: [],
    },
    NOW,
  );
}

function pathWith(packIds: string[]): WordPath {
  return {
    request_id: 'r',
    status: 'success',
    levels: [
      {
        cefr_level: 'A1',
        topics: [
          {
            topic_code: null,
            title_vi: 'Tổng hợp',
            packs: packIds.map((id, index) => ({
              id,
              position: index + 1,
              title_vi: `Gói ${index + 1}`,
              item_count: 12,
            })),
          },
        ],
      },
    ],
  } as WordPath;
}

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  mockFetch.mockReset();
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('drops the packs the Server no longer has', async () => {
  save(KEPT);
  save(GONE);
  mockFetch.mockResolvedValue({ok: true, value: pathWith([KEPT, 'new'])});
  await expect(syncDownloadedPacks()).resolves.toBe(1);
  expect(listDownloadedPacks().map(pack => pack.packId)).toEqual([KEPT]);
});

it('changes nothing offline', async () => {
  save(GONE);
  mockFetch.mockResolvedValue({
    ok: false,
    kind: 'network-error',
    message: 'offline',
  });
  await expect(syncDownloadedPacks()).resolves.toBe(0);
  expect(listDownloadedPacks()).toHaveLength(1);
});

it('does not ask the Server when no pack is on the device', async () => {
  await expect(syncDownloadedPacks()).resolves.toBe(0);
  expect(mockFetch).not.toHaveBeenCalled();
});
