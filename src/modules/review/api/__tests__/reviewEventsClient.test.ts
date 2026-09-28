import i18n from '@/i18n';
import {pushReviewEvents} from '../reviewEventsClient';
import type {ReviewEventPayload} from '@shared/db/types';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const payload: ReviewEventPayload = {
  schema_version: 1,
  card_id: 'card-1',
  lesson_id: 'lesson-1',
  rating: 'remembered',
  reviewed_at: '2026-09-05T12:00:00.000Z',
  interval_days: 7,
  next_review_at: '2026-09-12T12:00:00.000Z',
};

const events = [
  {
    id: 'event-1',
    event_type: 'review' as const,
    entity_id: 'card-1',
    payload,
    created_at: '2026-09-05T12:00:00.000Z',
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

describe('pushReviewEvents', () => {
  it('POSTs the batch to /v1/review-events and returns accepted and duplicate ids', async () => {
    mockFetch.mockResolvedValueOnce(
      response({
        request_id: 'server-req',
        status: 'success',
        accepted: 1,
        duplicates: 0,
        accepted_ids: ['event-1'],
        duplicate_ids: [],
      }),
    );

    const result = await pushReviewEvents(events);

    expect(result).toEqual({
      ok: true,
      acceptedIds: ['event-1'],
      duplicateIds: [],
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/review-events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({events}),
      }),
    );
  });

  it('maps a replay batch (all duplicates) to ok with no accepted ids', async () => {
    mockFetch.mockResolvedValueOnce(
      response({
        request_id: 'server-req',
        status: 'success',
        accepted: 0,
        duplicates: 1,
        accepted_ids: [],
        duplicate_ids: ['event-1'],
      }),
    );

    await expect(pushReviewEvents(events)).resolves.toEqual({
      ok: true,
      acceptedIds: [],
      duplicateIds: ['event-1'],
    });
  });

  it('maps a fetch rejection to a retryable NETWORK_ERROR', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    await expect(pushReviewEvents(events)).resolves.toEqual({
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: i18n.t('errors.network_lost'),
      retryable: true,
    });
  });

  it('maps a JSON parse rejection to a retryable NETWORK_ERROR', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('bad json')),
    });

    await expect(pushReviewEvents(events)).resolves.toEqual({
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: i18n.t('errors.network_lost'),
      retryable: true,
    });
  });

  it('maps an HTTP 500 envelope to a retryable rejection with the server code', async () => {
    mockFetch.mockResolvedValueOnce(
      response(
        {
          request_id: 'r',
          status: 'failed',
          error: {code: 'INTERNAL', message: 'boom'},
        },
        {ok: false, status: 500},
      ),
    );

    await expect(pushReviewEvents(events)).resolves.toEqual({
      ok: false,
      errorCode: 'INTERNAL',
      message: 'boom',
      retryable: true,
    });
  });

  it('maps a 4xx rejection to a non-retryable failure', async () => {
    mockFetch.mockResolvedValueOnce(
      response(
        {
          request_id: 'r',
          status: 'failed',
          error: {code: 'VALIDATION_REVIEW_EVENTS', message: 'bad payload'},
        },
        {ok: false, status: 400},
      ),
    );

    await expect(pushReviewEvents(events)).resolves.toEqual({
      ok: false,
      errorCode: 'VALIDATION_REVIEW_EVENTS',
      message: 'bad payload',
      retryable: false,
    });
  });

  it('flags a structurally invalid success body', async () => {
    mockFetch.mockResolvedValueOnce(response({status: 'success'}));

    await expect(pushReviewEvents(events)).resolves.toEqual({
      ok: false,
      errorCode: 'REVIEW_EVENTS_INVALID_RESPONSE',
      message: i18n.t('errors.sync_failed'),
      retryable: true,
    });
  });
});
