import type {PracticeEventPayload} from '@core/db/types';
import i18n from '@core/i18n';

import {pushPracticeEvents} from '../practiceEventsClient';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const payload: PracticeEventPayload = {
  event_id: 'ev-1',
  contract_version: 1,
  session_id: 'sess-1',
  question_id: 'q-1',
  sequence: 1,
  selected_option_id: 'opt-1',
  is_correct: true,
  answered_at: '2026-09-10T00:06:00.000Z',
  duration_ms: 1200,
  try_index: 1,
  grading: {mode: 'device_deterministic', grader_version: 'grader-v1'},
};

const events = [
  {
    event_id: 'ev-1',
    event_type: 'practice_answered' as const,
    session_id: 'sess-1',
    sequence: 1,
    occurred_at: '2026-09-10T00:06:00.000Z',
    payload,
  },
];

const response = (
  body: unknown,
  options: {ok?: boolean; status?: number} = {},
) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: jest.fn().mockResolvedValue(body),
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe('pushPracticeEvents', () => {
  it('POSTs the batch to /v1/practice-events:batch with contract_version', async () => {
    mockFetch.mockResolvedValueOnce(
      response({accepted_ids: ['ev-1'], duplicate_ids: [], rejected: []}),
    );

    const result = await pushPracticeEvents(events);

    expect(result).toEqual({
      ok: true,
      acceptedIds: ['ev-1'],
      duplicateIds: [],
      rejected: [],
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/practice-events:batch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({contract_version: 1, events}),
      }),
    );
  });

  it('maps accepted + duplicate + rejected per-event results', async () => {
    mockFetch.mockResolvedValueOnce(
      response({
        accepted_ids: ['ev-1'],
        duplicate_ids: ['ev-0'],
        rejected: [
          {event_id: 'ev-2', code: 'PAYLOAD_CONFLICT', retryable: false},
        ],
      }),
    );

    await expect(pushPracticeEvents(events)).resolves.toEqual({
      ok: true,
      acceptedIds: ['ev-1'],
      duplicateIds: ['ev-0'],
      rejected: [
        {event_id: 'ev-2', code: 'PAYLOAD_CONFLICT', retryable: false},
      ],
    });
  });

  it('maps a fetch rejection to retryable NETWORK_ERROR', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    await expect(pushPracticeEvents(events)).resolves.toEqual({
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: i18n.t('errors.network_lost'),
      retryable: true,
    });
  });

  it('maps HTTP 500 to retryable and 400 to non-retryable', async () => {
    mockFetch.mockResolvedValueOnce(
      response(
        {status: 'failed', error: {code: 'INTERNAL', message: 'boom'}},
        {ok: false, status: 500},
      ),
    );
    await expect(pushPracticeEvents(events)).resolves.toMatchObject({
      ok: false,
      retryable: true,
    });

    mockFetch.mockResolvedValueOnce(
      response(
        {status: 'failed', error: {code: 'INVALID_PAYLOAD', message: 'bad'}},
        {ok: false, status: 400},
      ),
    );
    await expect(pushPracticeEvents(events)).resolves.toMatchObject({
      ok: false,
      errorCode: 'INVALID_PAYLOAD',
      retryable: false,
    });
  });

  it('maps an unreadable response body to retryable NETWORK_ERROR', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    });
    await expect(pushPracticeEvents(events)).resolves.toMatchObject({
      ok: false,
      errorCode: 'NETWORK_ERROR',
      retryable: true,
    });
  });

  it('flags a structurally invalid success body as retryable', async () => {
    mockFetch.mockResolvedValueOnce(response({accepted_ids: []}));
    await expect(pushPracticeEvents(events)).resolves.toMatchObject({
      ok: false,
      errorCode: 'PRACTICE_EVENTS_INVALID_RESPONSE',
      retryable: true,
    });
  });
});
