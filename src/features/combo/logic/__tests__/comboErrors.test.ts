import {reportError} from '@core/errors';

import {comboEmptyNotice, comboFailureNotice} from '../comboErrors';

jest.mock('@core/errors', () => ({reportError: jest.fn()}));

const mockedReport = reportError as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('comboFailureNotice', () => {
  it('names a known Server code and keeps the request id, without reporting it', () => {
    expect(
      comboFailureNotice(
        {
          ok: false,
          kind: 'client-error',
          message: 'm',
          code: 'SITUATION_NOT_ENABLED',
          requestId: 'req-1',
        },
        'open',
      ),
    ).toEqual({
      key: 'combo.errors.situation_not_enabled',
      requestId: 'req-1',
    });
    expect(mockedReport).not.toHaveBeenCalled();
  });

  it('says the network is down without reporting it', () => {
    expect(
      comboFailureNotice(
        {ok: false, kind: 'network-error', message: 'm'},
        'open',
      ),
    ).toEqual({key: 'combo.errors.network'});
    expect(mockedReport).not.toHaveBeenCalled();
  });

  it('reports anything unexpected with its code and request id', () => {
    expect(
      comboFailureNotice(
        {
          ok: false,
          kind: 'server-error',
          message: 'The request failed (500).',
          requestId: 'req-2',
        },
        'more',
      ),
    ).toEqual({key: 'combo.errors.unknown', requestId: 'req-2'});
    expect(mockedReport).toHaveBeenCalledWith(expect.any(Error), {
      scope: 'combo',
      action: 'more',
      kind: 'server-error',
      code: undefined,
      request_id: 'req-2',
    });
  });
});

describe('comboEmptyNotice', () => {
  it('explains the daily limit and the pool-only case without reporting them', () => {
    expect(comboEmptyNotice('AI_DAILY_LIMIT', 'r')).toEqual({
      key: 'combo.setup.empty_ai_limit',
      requestId: 'r',
    });
    expect(comboEmptyNotice('MINOR_POOL_ONLY', 'r').key).toBe(
      'combo.setup.empty_pool_only',
    );
    expect(mockedReport).not.toHaveBeenCalled();
  });

  it('reports a set the AI could not fill', () => {
    expect(comboEmptyNotice('AI_FAILED', 'r')).toEqual({
      key: 'combo.setup.empty_failed',
      requestId: 'r',
    });
    expect(mockedReport).toHaveBeenCalledWith(expect.any(Error), {
      scope: 'combo',
      reason: 'AI_FAILED',
      request_id: 'r',
    });
  });
});
