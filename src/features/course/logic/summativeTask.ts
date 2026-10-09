import {useCallback, useEffect, useRef, useState} from 'react';

import {getDatabase} from '@core/db/database';
import {
  type UnitSummativeTask,
  UnitSummativeTaskSchema,
} from '@core/schemas/lesson';

import {fetchUnitSummativeTask} from './courseClient';

/**
 * PR 16 (G3): a unit's summative task, kept in `app_settings` so the screen
 * opens offline after one visit.
 */
const CACHE_PREFIX = 'summative_task.';

export function readCachedSummativeTask(
  unitId: string,
): UnitSummativeTask | null {
  try {
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
        `${CACHE_PREFIX}${unitId}`,
      ])
      .rows?.item(0) as {value?: string} | undefined;
    if (!row?.value) return null;
    const parsed = UnitSummativeTaskSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function cacheSummativeTask(unitId: string, task: UnitSummativeTask | null) {
  try {
    const db = getDatabase();
    if (!task) {
      db.execute('DELETE FROM app_settings WHERE key = ?;', [
        `${CACHE_PREFIX}${unitId}`,
      ]);
      return;
    }
    db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      [
        `${CACHE_PREFIX}${unitId}`,
        JSON.stringify(task),
        new Date().toISOString(),
      ],
    );
  } catch {
    // Only the offline copy is lost.
  }
}

export type SummativeTaskState =
  | {status: 'loading'}
  | {status: 'ready'; task: UnitSummativeTask}
  | {status: 'none'}
  | {status: 'error'};

/** Loads the task: the cached copy at once, the Server's answer after. */
export function useSummativeTask(unitId: string, fetchImpl?: typeof fetch) {
  const [state, setState] = useState<SummativeTaskState>(() => {
    const cached = readCachedSummativeTask(unitId);
    return cached ? {status: 'ready', task: cached} : {status: 'loading'};
  });
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    fetchUnitSummativeTask(unitId, {signal: next.signal, fetchImpl})
      .then(result => {
        if (next.signal.aborted) return;
        if (result.ok) {
          cacheSummativeTask(unitId, result.value);
          setState(
            result.value
              ? {status: 'ready', task: result.value}
              : {status: 'none'},
          );
          return;
        }
        setState(current =>
          current.status === 'ready' ? current : {status: 'error'},
        );
      })
      .catch(() => {
        setState(current =>
          current.status === 'ready' ? current : {status: 'error'},
        );
      });
  }, [unitId, fetchImpl]);

  useEffect(() => {
    refresh();
    return () => controller.current?.abort();
  }, [refresh]);

  return {state, refresh};
}
