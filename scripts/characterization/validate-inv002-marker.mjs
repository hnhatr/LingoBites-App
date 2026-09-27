#!/usr/bin/env node
/**
 * Validates a single [LING93_INV002] log line (used by run-ios-inv002.sh and harness tests).
 */
import {fileURLToPath} from 'node:url';

export const INV002_REQUIRED_ASSERTIONS = [
  'practicePendingAfterEvents',
  'reviewPendingAfterEvents',
  'firstDrainFailed',
  'pendingAfterAmbiguousDrain',
  'pendingSurvivesRestart',
  'retryDrainSynced',
  'pendingAfterRetry',
  'duplicateDrainSynced',
  'pendingAfterDuplicateDrain',
  'onePracticeServerEffect',
  'oneReviewServerEffect',
  'practicePostsIncludeRetry',
  'reviewPostsIncludeRetry',
];

/**
 * @param {string} line
 * @param {string} expectedRunId
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function validateInv002MarkerLine(line, expectedRunId) {
  if (!line || !line.trim()) {
    return {ok: false, reason: 'empty marker line'};
  }
  if (!expectedRunId || !String(expectedRunId).trim()) {
    return {ok: false, reason: 'missing expected RUN_ID'};
  }
  const jsonText = line.replace(/^.*\[LING93_INV002\]\s*/, '');
  let result;
  try {
    result = JSON.parse(jsonText);
  } catch (error) {
    return {
      ok: false,
      reason: `invalid JSON: ${error instanceof Error ? error.message : error}`,
    };
  }
  if (result.status !== 'pass') {
    return {ok: false, reason: 'status is not pass'};
  }
  if (!result.assertions || typeof result.assertions !== 'object') {
    return {ok: false, reason: 'missing assertions object'};
  }
  for (const key of INV002_REQUIRED_ASSERTIONS) {
    if (result.assertions[key] !== true) {
      return {ok: false, reason: `assertion ${key} is not true`};
    }
  }
  if (result.runId !== expectedRunId) {
    return {ok: false, reason: 'runId missing or mismatched'};
  }
  return {ok: true};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const line = process.argv[2];
  const expectedRunId = process.argv[3];
  const outcome = validateInv002MarkerLine(line, expectedRunId);
  if (!outcome.ok) {
    console.error(outcome.reason);
    process.exit(1);
  }
  process.exit(0);
}
