// `@op-engineering/op-sqlite` under Jest: the string-matching database from
// `sqliteMock`, reshaped to op-sqlite's `executeSync` result (rows as a plain
// array). `src/core/db/sqlite.ts` turns it back into the app's connection.
const sqliteMock = require('./sqliteMock');

function open(options) {
  const inner = sqliteMock.open(options);
  return {
    executeSync(sql, params) {
      const result = inner.execute(sql, params);
      return {
        insertId: result.insertId,
        rowsAffected: result.rowsAffected ?? 0,
        rows: result.rows?._array ?? [],
      };
    },
  };
}

module.exports = {
  open,
  IOS_DOCUMENT_PATH: '/mock/Documents',
  ANDROID_FILES_PATH: '/mock/files',
};
