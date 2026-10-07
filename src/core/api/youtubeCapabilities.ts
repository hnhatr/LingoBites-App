import {useCallback, useEffect, useRef, useState} from 'react';
import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';

export const CapabilitiesResponseSchema = z.object({
  capabilities: z.object({
    youtube: z.object({
      enabled: z.boolean(),
    }),
  }),
});

export type CapabilitiesResponse = z.infer<typeof CapabilitiesResponseSchema>;

/**
 * SETE-290 (DEV-1): server capability probe. The "Học qua video" entry is
 * enabled only when both the app feature flag and the backend agree —
 * when the backend is unavailable the entry stays disabled and no
 * transcript request is ever sent. Fail-closed: any network, parse, or
 * config problem resolves to `false`.
 *
 * The endpoint is public, so the probe is a plain `fetch`: through
 * `authenticatedFetch` it could fail while a fresh account's session or
 * first sync was still settling, leaving the entry disabled until restart.
 */
export async function fetchYouTubeCapability(
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const {apiBaseUrl} = getAppConfig();
    const response = await fetch(`${apiBaseUrl}/v1/capabilities`, {
      headers: {Accept: 'application/json'},
      signal,
    });
    if (!response.ok) {
      return false;
    }
    const body: unknown = await response.json();
    const parsed = CapabilitiesResponseSchema.safeParse(body);
    return parsed.success ? parsed.data.capabilities.youtube.enabled : false;
  } catch {
    return false;
  }
}

export type YouTubeCapabilityStatus = 'checking' | 'enabled' | 'disabled';

export type YouTubeCapability = {
  status: YouTubeCapabilityStatus;
  /** Probes the server again; call it when the screen regains focus. */
  refresh: () => void;
};

/**
 * Server YouTube capability. `enabled` only after the server confirms it;
 * `checking` while the first probe is in flight. A failed probe is not
 * final: `refresh()` asks again, and an `enabled` answer is never
 * downgraded by a later failed probe (e.g. a brief network drop).
 */
export function useYouTubeCapability(): YouTubeCapability {
  const [status, setStatus] = useState<YouTubeCapabilityStatus>('checking');
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    fetchYouTubeCapability(controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setStatus(previous =>
          value ? 'enabled' : previous === 'enabled' ? previous : 'disabled',
        );
      }
    });
  }, []);

  useEffect(() => {
    refresh();
    return () => controllerRef.current?.abort();
  }, [refresh]);

  return {status, refresh};
}
