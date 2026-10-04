import {SyncOwnershipChangedError} from '@core/sync/syncDrainOwnership';

import {ensureValidSession} from '../../auth/authSession';
import {authenticatedFetch} from '../authenticatedFetch';

jest.mock('../../auth/authClient', () => ({
  createAuthClient: jest.fn(() => ({})),
}));

jest.mock('../../auth/authSession', () => ({
  ensureValidSession: jest.fn(),
}));

jest.mock('@core/sync/syncDrainOwnership', () => {
  const actual = jest.requireActual('@core/sync/syncDrainOwnership');
  return {
    ...actual,
    assertSyncDrainOwnershipUnchanged: jest.fn().mockResolvedValue(true),
  };
});

const mockedEnsure = ensureValidSession as jest.Mock;

describe('authenticatedFetch expectedUserId guard', () => {
  const fetchImpl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchImpl.mockResolvedValue({status: 200, ok: true});
  });

  it('sends zero requests when there is no valid session', async () => {
    mockedEnsure.mockResolvedValue({status: 'no-session'});

    await expect(
      authenticatedFetch(
        'https://api.test/v1/recordings',
        {method: 'POST'},
        fetchImpl,
        {expectedUserId: 'user-1'},
      ),
    ).rejects.toBeInstanceOf(SyncOwnershipChangedError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends zero requests when the session user does not match expectedUserId', async () => {
    mockedEnsure.mockResolvedValue({
      status: 'valid',
      userId: 'other-user',
      session: {access_token: 'token'},
    });

    await expect(
      authenticatedFetch(
        'https://api.test/v1/recordings',
        {method: 'POST'},
        fetchImpl,
        {expectedUserId: 'user-1'},
      ),
    ).rejects.toBeInstanceOf(SyncOwnershipChangedError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the request when the session user matches expectedUserId', async () => {
    mockedEnsure.mockResolvedValue({
      status: 'valid',
      userId: 'user-1',
      session: {access_token: 'token'},
    });

    await authenticatedFetch(
      'https://api.test/v1/recordings',
      {method: 'POST'},
      fetchImpl,
      {expectedUserId: 'user-1'},
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer token',
    );
  });
});
