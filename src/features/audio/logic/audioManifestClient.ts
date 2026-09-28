import {getAppConfig} from '@shared/api/appConfig';
import type {ChapterAudioAsset} from '@shared/db/types';

export type ChapterAudioManifest = {
  chapterId: string;
  assets: ChapterAudioAsset[];
};

export type ChapterAudioManifestResult =
  | {ok: true; manifest: ChapterAudioManifest}
  | {
      ok: false;
      errorCode: 'NETWORK_ERROR' | 'SERVER_ERROR' | 'INVALID_MANIFEST';
      message: string;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseAsset(value: unknown): ChapterAudioAsset | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    !isNonEmptyString(record.id) ||
    !isNonEmptyString(record.url) ||
    !isNonEmptyString(record.checksum) ||
    typeof record.bytes !== 'number' ||
    !Number.isFinite(record.bytes) ||
    record.bytes < 0
  ) {
    return null;
  }
  return {
    id: record.id,
    url: record.url,
    bytes: record.bytes,
    checksum: record.checksum,
  };
}

function parseManifest(
  chapterId: string,
  body: unknown,
): ChapterAudioManifest | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (record.chapter_id !== chapterId || !Array.isArray(record.assets)) {
    return null;
  }
  const assets: ChapterAudioAsset[] = [];
  for (const value of record.assets) {
    const asset = parseAsset(value);
    if (!asset) {
      return null;
    }
    assets.push(asset);
  }
  return {chapterId, assets};
}

export function buildAudioManifestUrl(
  baseUrl: string,
  chapterId: string,
): string {
  return `${baseUrl.replace(/\/+$/, '')}/v1/chapters/${encodeURIComponent(
    chapterId,
  )}/audio-manifest`;
}

/**
 * Fetches the server-delivered per-chapter audio manifest (ADR-3). Audio files
 * themselves are downloaded directly by the client, never through the sync
 * outbox. `fetchFn` is injectable for tests.
 */
export async function fetchChapterAudioManifest(
  chapterId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ChapterAudioManifestResult> {
  const {apiBaseUrl} = getAppConfig();
  const url = buildAudioManifestUrl(apiBaseUrl, chapterId);

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      headers: {Accept: 'application/json'},
    });
  } catch {
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: 'Không thể tải danh sách âm thanh chương học. Vui lòng thử lại.',
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      errorCode: 'INVALID_MANIFEST',
      message: 'Danh sách âm thanh chương học không hợp lệ.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      errorCode: 'SERVER_ERROR',
      message: 'Không thể tải danh sách âm thanh chương học. Vui lòng thử lại.',
    };
  }

  const manifest = parseManifest(chapterId, body);
  if (!manifest) {
    return {
      ok: false,
      errorCode: 'INVALID_MANIFEST',
      message: 'Danh sách âm thanh chương học không hợp lệ.',
    };
  }

  return {ok: true, manifest};
}
