import {open as opSqliteOpen} from '@op-engineering/op-sqlite';
import {Platform} from 'react-native';

import {openDatabase} from '../sqlite';

jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(),
  IOS_DOCUMENT_PATH: '/var/mobile/App/Documents',
  ANDROID_FILES_PATH: '/data/user/0/app/files',
}));

const mockedOpen = opSqliteOpen as jest.Mock;

describe('openDatabase', () => {
  const originalOS = Platform.OS;
  const executeSync = jest.fn();

  beforeEach(() => {
    executeSync.mockReset();
    mockedOpen.mockReset().mockReturnValue({executeSync});
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {value: originalOS});
  });

  it.each([
    ['ios', '/var/mobile/App/Documents'],
    ['android', '/data/user/0/app/files'],
  ])(
    'opens the file where quick-sqlite kept it on %s',
    (os, expectedLocation) => {
      Object.defineProperty(Platform, 'OS', {value: os});
      openDatabase({name: 'lingobites.db'});
      expect(mockedOpen).toHaveBeenCalledWith({
        name: 'lingobites.db',
        location: expectedLocation,
      });
    },
  );

  it('returns rows with length, item() and _array', () => {
    const rows = [{id: 'a'}, {id: 'b'}];
    executeSync.mockReturnValue({rows, rowsAffected: 0});

    const result = openDatabase({name: 'x.db'}).execute(
      'SELECT id FROM t WHERE k = ?',
      ['v'],
    );

    expect(executeSync).toHaveBeenCalledWith('SELECT id FROM t WHERE k = ?', [
      'v',
    ]);
    expect(result.rows?.length).toBe(2);
    expect(result.rows?.item(1)).toEqual({id: 'b'});
    expect(result.rows?._array).toBe(rows);
  });

  it('passes through rowsAffected and insertId for writes', () => {
    executeSync.mockReturnValue({rows: [], rowsAffected: 1, insertId: 7});

    const result = openDatabase({name: 'x.db'}).execute(
      'INSERT INTO t (k) VALUES (?)',
      ['v'],
    );

    expect(result).toMatchObject({rowsAffected: 1, insertId: 7});
    expect(result.rows?.length).toBe(0);
  });

  it('surfaces SQLite errors as thrown errors', () => {
    executeSync.mockImplementation(() => {
      throw new Error('UNIQUE constraint failed: t.k');
    });

    expect(() =>
      openDatabase({name: 'x.db'}).execute('INSERT INTO t (k) VALUES (1)'),
    ).toThrow('UNIQUE constraint failed');
  });
});
