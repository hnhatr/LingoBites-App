import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {getDatabase, withTransaction} from '@core/db/database';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import type {SpeakingMode} from '@core/db/types';
import {
  SPEAKING_ATTEMPTS_EVENT_TYPE,
  speakingAttemptEntityId,
} from '@core/sync/speakingAttempts';
import {isAccountStillOwner} from '@core/sync/syncDrainOwnership';

import {listAllSpeakingAttempts} from '../data/SpeakingAttemptRepository';

type UploadDrainScheduler = () => void;

let uploadDrainScheduler: UploadDrainScheduler = () => {};

export function setServerRecordingDeletionDrainScheduler(
  scheduler: UploadDrainScheduler,
): void {
  uploadDrainScheduler = scheduler;
}

function signalUploadDrainRequested(): void {
  uploadDrainScheduler();
}

export const PENDING_SERVER_DELETE_KEY = 'speaking.pending_server_delete';

export type PendingServerDeleteMarker = {
  ownerUserId: string;
  requestedAt: string;
};

export type ServerRecordingDeletionDeps = {
  now?: () => Date;
  deleteAll?: (
    ownerUserId: string,
  ) => Promise<
    | {ok: true; purgedAt: string}
    | {ok: false; errorCode: string; retryable: boolean}
  >;
  isOwner?: typeof isAccountStillOwner;
};

let deps: ServerRecordingDeletionDeps = {};

export function configureServerRecordingDeletion(
  overrides: ServerRecordingDeletionDeps,
): void {
  deps = {...deps, ...overrides};
}

export function resetServerRecordingDeletionForTests(): void {
  deps = {};
}

function nowIso(): string {
  return (deps.now ?? (() => new Date()))().toISOString();
}

function parseMarker(raw: string): PendingServerDeleteMarker | null {
  try {
    const parsed = JSON.parse(raw) as {
      owner_user_id?: string;
      requested_at?: string;
    };
    if (
      typeof parsed.owner_user_id === 'string' &&
      parsed.owner_user_id.length > 0 &&
      typeof parsed.requested_at === 'string' &&
      parsed.requested_at.length > 0
    ) {
      return {
        ownerUserId: parsed.owner_user_id,
        requestedAt: parsed.requested_at,
      };
    }
  } catch {
    // Invalid marker payload — treat as absent.
  }
  return null;
}

export function readPendingServerDeleteMarker(): PendingServerDeleteMarker | null {
  const db = getDatabase();
  const row = db
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      PENDING_SERVER_DELETE_KEY,
    ])
    .rows?.item(0) as {value?: string} | undefined;
  if (!row?.value) {
    return null;
  }
  return parseMarker(row.value);
}

function writePendingServerDeleteMarker(
  marker: PendingServerDeleteMarker,
): void {
  const db = getDatabase();
  const now = nowIso();
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [
      PENDING_SERVER_DELETE_KEY,
      JSON.stringify({
        owner_user_id: marker.ownerUserId,
        requested_at: marker.requestedAt,
      }),
      now,
    ],
  );
}

function clearPendingServerDeleteMarker(): void {
  getDatabase().execute('DELETE FROM app_settings WHERE key = ?;', [
    PENDING_SERVER_DELETE_KEY,
  ]);
}

/** Marks the owner's non-`local_only` rows as local-only (AD-006 / H4). */
export function flipNonLocalOnlyRecordingsToLocalOnly(
  ownerUserId: string,
): void {
  const db = getDatabase();
  db.execute(
    `UPDATE speaking_recordings
     SET upload_state = 'local_only',
         upload_next_at = NULL,
         upload_error = NULL,
         server_recording_id = NULL
     WHERE upload_state != 'local_only' AND owner_user_id = ?;`,
    [ownerUserId],
  );
}

export type SpeakingAttemptTombstoneSource = {
  id: string;
  mode: SpeakingMode;
  sentenceId: string;
};

export function enqueueSpeakingAttemptTombstones(
  attempts: SpeakingAttemptTombstoneSource[],
  createdAt: string,
): void {
  for (const attempt of attempts) {
    enqueueSyncOutboxEvent({
      id: `tombstone-${attempt.id}-${createdAt}`,
      eventType: SPEAKING_ATTEMPTS_EVENT_TYPE,
      entityId: speakingAttemptEntityId(attempt.mode, attempt.sentenceId),
      payload: {tombstone: true},
      createdAt,
    });
  }
}

export type QueueServerRecordingDeleteInput = {
  ownerUserId: string;
  /** When true, tombstone every current speaking attempt (full / speaking wipe). */
  enqueueAttemptTombstones: boolean;
  requestedAt?: string;
};

/**
 * Persists the durable Server delete marker and optional attempt tombstones in
 * the current SQLite transaction (AD-006 / FR-027).
 */
export function queueDurableServerRecordingDelete(
  input: QueueServerRecordingDeleteInput,
): PendingServerDeleteMarker {
  const requestedAt = input.requestedAt ?? nowIso();
  const marker: PendingServerDeleteMarker = {
    ownerUserId: input.ownerUserId,
    requestedAt,
  };
  if (input.enqueueAttemptTombstones) {
    const attempts = listAllSpeakingAttempts();
    enqueueSpeakingAttemptTombstones(attempts, requestedAt);
  }
  writePendingServerDeleteMarker(marker);
  flipNonLocalOnlyRecordingsToLocalOnly(input.ownerUserId);
  signalUploadDrainRequested();
  return marker;
}

/** Account-only delete: queue Server wipe without tombstones (BR-010). */
export function queueAccountOnlyServerRecordingDelete(
  ownerUserId: string,
): PendingServerDeleteMarker {
  return withTransaction(getDatabase(), () =>
    queueDurableServerRecordingDelete({
      ownerUserId,
      enqueueAttemptTombstones: false,
    }),
  );
}

async function defaultDeleteAllOnServer(
  ownerUserId: string,
): Promise<
  | {ok: true; purgedAt: string}
  | {ok: false; errorCode: string; retryable: boolean}
> {
  const {apiBaseUrl} = getAppConfig();
  try {
    const response = await authenticatedFetch(
      `${apiBaseUrl.replace(/\/+$/, '')}/v1/recordings`,
      {method: 'DELETE', headers: {Accept: 'application/json'}},
      undefined,
      {expectedUserId: ownerUserId},
    );
    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 429;
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        retryable,
      };
    }
    const body = (await response.json()) as {
      purged_at?: string;
      status?: string;
    };
    if (typeof body.purged_at !== 'string' || body.purged_at.length === 0) {
      return {
        ok: false,
        errorCode: 'INVALID_DELETE_ALL_RESPONSE',
        retryable: false,
      };
    }
    return {ok: true, purgedAt: body.purged_at};
  } catch (error) {
    return {
      ok: false,
      errorCode: error instanceof Error ? error.message : 'NETWORK_ERROR',
      retryable: true,
    };
  }
}

/**
 * Sends `DELETE /v1/recordings` when a marker exists. Clears the marker only on
 * success with the same `requested_at` (AD-006). No-op when offline / retryable.
 */
export async function processPendingServerRecordingDeletion(): Promise<void> {
  const marker = readPendingServerDeleteMarker();
  if (!marker) {
    return;
  }

  const ownerOk = await (deps.isOwner ?? isAccountStillOwner)(
    marker.ownerUserId,
  );
  if (!ownerOk) {
    return;
  }

  const result = await (deps.deleteAll ?? defaultDeleteAllOnServer)(
    marker.ownerUserId,
  );
  if (!result.ok) {
    if (result.retryable) {
      signalUploadDrainRequested();
    }
    return;
  }

  const stillCurrent = readPendingServerDeleteMarker();
  if (
    stillCurrent &&
    stillCurrent.requestedAt === marker.requestedAt &&
    stillCurrent.ownerUserId === marker.ownerUserId
  ) {
    clearPendingServerDeleteMarker();
  }
}
