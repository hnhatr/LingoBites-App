import {useEffect, useState} from 'react';
import {z} from 'zod';

import {getAppConfig} from '@core/api/appConfig';

import {authenticatedFetch} from './authenticatedFetch';

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
 */
export async function fetchYouTubeCapability(
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const {apiBaseUrl} = getAppConfig();
    const response = await authenticatedFetch(`${apiBaseUrl}/v1/capabilities`, {
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

/**
 * Resolves to `true` only after the server confirms YouTube is enabled.
 * Starts `false` (disabled) while the probe is in flight or fails.
 */
export function useYouTubeServerEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchYouTubeCapability(controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setEnabled(value);
      }
    });
    return () => controller.abort();
  }, []);
  return enabled;
}
