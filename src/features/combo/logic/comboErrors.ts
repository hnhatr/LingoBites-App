/**
 * Vocab path P5: what a combo screen says when the Server opens or continues
 * no set. Each known Server code has its own message; the request id goes
 * under it so a tester can hand it over and it can be found in the Server log.
 */
import type {ApiFailure} from '@core/api/jsonRequest';
import {reportError} from '@core/errors';

export type ComboErrorNotice = {
  /** An i18n key. */
  key: string;
  requestId?: string;
};

const CODE_KEYS: Record<string, string> = {
  SITUATION_NOT_ENABLED: 'combo.errors.situation_not_enabled',
  SITUATION_NOT_SUITABLE: 'combo.errors.situation_not_suitable',
  SITUATION_NOT_FOUND: 'combo.errors.not_found',
  ITEM_NOT_FOUND: 'combo.errors.not_found',
  GRAMMAR_NOT_FOUND: 'combo.errors.not_found',
  GRAMMAR_REQUIRED: 'combo.errors.invalid_choice',
  POLARITY_NOT_ALLOWED: 'combo.errors.invalid_choice',
  COUNT_NOT_ALLOWED: 'combo.errors.invalid_choice',
  NO_SUBJECT_GROUPS: 'combo.errors.no_subject_groups',
  DAILY_SETS_USED: 'combo.errors.daily_sets_used',
  SET_FULL: 'combo.errors.set_full',
  SET_NOT_FOUND: 'combo.errors.not_found',
};

/** The message for a failed call; anything unexpected is also reported. */
export function comboFailureNotice(
  failure: ApiFailure,
  action: 'open' | 'more',
): ComboErrorNotice {
  const known = failure.code ? CODE_KEYS[failure.code] : undefined;
  const key =
    known ??
    (failure.kind === 'network-error'
      ? 'combo.errors.network'
      : 'combo.errors.unknown');
  if (!known && failure.kind !== 'network-error') {
    reportError(new Error(`combo ${action} failed: ${failure.message}`), {
      scope: 'combo',
      action,
      kind: failure.kind,
      code: failure.code,
      request_id: failure.requestId,
    });
  }
  return {key, ...(failure.requestId ? {requestId: failure.requestId} : {})};
}

/** The message for a set that came back with no sentences, by the Server's reason. */
export function comboEmptyNotice(
  reason: string | null | undefined,
  requestId: string,
): ComboErrorNotice {
  if (reason === 'AI_DAILY_LIMIT')
    return {key: 'combo.setup.empty_ai_limit', requestId};
  if (reason === 'MINOR_POOL_ONLY')
    return {key: 'combo.setup.empty_pool_only', requestId};
  reportError(new Error('combo set came back empty'), {
    scope: 'combo',
    reason: reason ?? undefined,
    request_id: requestId,
  });
  return {key: 'combo.setup.empty_failed', requestId};
}
