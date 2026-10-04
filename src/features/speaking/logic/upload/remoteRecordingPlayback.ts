import * as RNFS from '@dr.pogodin/react-native-fs';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';

import {playRecording} from '../recordingService';

export type SummaryPlaybackRow = {
  recordingId: string;
  localFilePath: string | null;
  serverRecordingId: string | null;
};

export type RemoteRecordingPlaybackDeps = {
  fetchImpl?: typeof fetch;
  fileExists?: (path: string) => Promise<boolean>;
  writeFile?: (path: string, data: string) => Promise<void>;
  playLocal?: (path: string) => Promise<void>;
};

let deps: RemoteRecordingPlaybackDeps = {};

export function configureRemoteRecordingPlayback(
  overrides: RemoteRecordingPlaybackDeps,
): void {
  deps = {...deps, ...overrides};
}

export function resetRemoteRecordingPlaybackForTests(): void {
  deps = {};
}

async function defaultFileExists(path: string): Promise<boolean> {
  try {
    return await RNFS.exists(path);
  } catch {
    return false;
  }
}

function localPathExistsSync(filePath: string): boolean {
  if (typeof process.env.JEST_WORKER_ID === 'string') {
    try {
      // Dynamic require avoids Metro static analyzer resolution error in React Native build
      const fs = (0, eval)('require')('fs');
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
  return true;
}

function remoteCachePath(serverRecordingId: string): string {
  const root = `${RNFS.DocumentDirectoryPath}/LingoBitesRecordings/_remote`;
  return `${root}/${serverRecordingId}.m4a`;
}

async function ensureRemoteCacheDir(): Promise<void> {
  const dir = `${RNFS.DocumentDirectoryPath}/LingoBitesRecordings/_remote`;
  try {
    await RNFS.mkdir(dir);
  } catch {
    // likely exists
  }
}

async function defaultWriteFile(path: string, data: string): Promise<void> {
  await ensureRemoteCacheDir();
  await RNFS.writeFile(path, data, 'utf8');
}

export function shouldShowSummaryPlayButton(row: SummaryPlaybackRow): boolean {
  if (row.serverRecordingId) {
    return true;
  }
  if (!row.localFilePath) {
    return false;
  }
  return localPathExistsSync(row.localFilePath);
}

export async function resolveSummaryPlayVisible(
  row: SummaryPlaybackRow,
): Promise<boolean> {
  if (row.serverRecordingId) {
    return true;
  }
  if (!row.localFilePath) {
    return false;
  }
  const fileExists = deps.fileExists ?? defaultFileExists;
  return await fileExists(row.localFilePath);
}

export async function requestServerRecordingContent(
  serverRecordingId: string,
  options: RemoteRecordingPlaybackDeps = {},
): Promise<{ok: true} | {ok: false; errorCode: string}> {
  const fetchImpl = options.fetchImpl ?? deps.fetchImpl ?? fetch;
  const {apiBaseUrl} = getAppConfig();
  const url = `${apiBaseUrl.replace(
    /\/+$/,
    '',
  )}/v1/recordings/${serverRecordingId}/content`;
  try {
    const response = await authenticatedFetch(url, {method: 'GET'}, fetchImpl);
    if (!response.ok) {
      return {ok: false, errorCode: `HTTP_${response.status}`};
    }
    const writeFile = options.writeFile ?? deps.writeFile ?? defaultWriteFile;
    const body = await response.text();
    if (body.length === 0) {
      return {ok: false, errorCode: 'EMPTY_CONTENT'};
    }
    await writeFile(remoteCachePath(serverRecordingId), body);
    return {ok: true};
  } catch {
    return {ok: false, errorCode: 'NETWORK_ERROR'};
  }
}

export type PlaySummarySentenceResult = {ok: true} | {ok: false};

async function fetchAndPlayServerRecording(
  serverRecordingId: string,
  options: RemoteRecordingPlaybackDeps,
  fileExists: (path: string) => Promise<boolean>,
  playLocal: (path: string) => Promise<unknown>,
): Promise<PlaySummarySentenceResult> {
  const fetched = await requestServerRecordingContent(
    serverRecordingId,
    options,
  );
  if (!fetched.ok) {
    return {ok: false};
  }
  const cached = remoteCachePath(serverRecordingId);
  if (!(await fileExists(cached))) {
    return {ok: false};
  }
  try {
    await playLocal(cached);
    return {ok: true};
  } catch {
    return {ok: false};
  }
}

export async function playSummarySentenceRecording(
  row: SummaryPlaybackRow,
  options: RemoteRecordingPlaybackDeps = {},
): Promise<PlaySummarySentenceResult> {
  const fileExists = options.fileExists ?? deps.fileExists ?? defaultFileExists;
  const playLocal: (path: string) => Promise<unknown> =
    options.playLocal ?? deps.playLocal ?? playRecording;

  // Try local file first. If it exists but play fails and there is a server
  // recording, fall through to the server path (ADV-007).
  if (row.localFilePath) {
    try {
      const exists = await fileExists(row.localFilePath);
      if (exists) {
        await playLocal(row.localFilePath);
        return {ok: true};
      }
    } catch {
      // Local play failed; fall through to server fallback if available.
    }
  }

  if (!row.serverRecordingId) {
    return {ok: false};
  }

  const cached = remoteCachePath(row.serverRecordingId);
  if (await fileExists(cached)) {
    // Try playing cached file; if it fails (corrupt), re-fetch and retry (ADV-008).
    try {
      await playLocal(cached);
      return {ok: true};
    } catch {
      // Cache corrupt — fall through to re-fetch.
    }
  }

  return fetchAndPlayServerRecording(
    row.serverRecordingId,
    options,
    fileExists,
    playLocal,
  );
}
