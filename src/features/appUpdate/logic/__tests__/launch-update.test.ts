import {
  type LaunchUpdateApi,
  type LaunchUpdatePhase,
  runLaunchUpdate,
} from '../launchUpdate';

function makeApi(overrides: Partial<LaunchUpdateApi> = {}): LaunchUpdateApi {
  return {
    isEnabled: true,
    checkForUpdateAsync: jest.fn().mockResolvedValue({isAvailable: false}),
    fetchUpdateAsync: jest.fn().mockResolvedValue({isNew: true}),
    reloadAsync: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as LaunchUpdateApi;
}

async function run(
  api: LaunchUpdateApi,
  options: {isDev?: boolean; checkTimeoutMs?: number} = {},
) {
  const phases: LaunchUpdatePhase[] = [];
  await runLaunchUpdate(phase => phases.push(phase), {
    api,
    isDev: false,
    ...options,
  });
  return phases;
}

describe('runLaunchUpdate', () => {
  it('downloads an available update and reloads into it', async () => {
    const api = makeApi({
      checkForUpdateAsync: jest.fn().mockResolvedValue({isAvailable: true}),
    });
    await expect(run(api)).resolves.toEqual([
      'checking',
      'downloading',
      'reloading',
    ]);
    expect(api.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(api.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('carries on when no update is available', async () => {
    const api = makeApi();
    await expect(run(api)).resolves.toEqual(['checking', 'done']);
    expect(api.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('does not reload when the fetched update is not new', async () => {
    const api = makeApi({
      checkForUpdateAsync: jest.fn().mockResolvedValue({isAvailable: true}),
      fetchUpdateAsync: jest.fn().mockResolvedValue({isNew: false}),
    });
    await expect(run(api)).resolves.toEqual([
      'checking',
      'downloading',
      'done',
    ]);
    expect(api.reloadAsync).not.toHaveBeenCalled();
  });

  it('carries on when the check fails (offline)', async () => {
    const api = makeApi({
      checkForUpdateAsync: jest.fn().mockRejectedValue(new Error('offline')),
    });
    await expect(run(api)).resolves.toEqual(['checking', 'done']);
  });

  it('carries on when the download fails', async () => {
    const api = makeApi({
      checkForUpdateAsync: jest.fn().mockResolvedValue({isAvailable: true}),
      fetchUpdateAsync: jest.fn().mockRejectedValue(new Error('network')),
    });
    await expect(run(api)).resolves.toEqual([
      'checking',
      'downloading',
      'done',
    ]);
    expect(api.reloadAsync).not.toHaveBeenCalled();
  });

  it('gives up on a check that outlasts the timeout', async () => {
    const api = makeApi({
      checkForUpdateAsync: jest.fn(() => new Promise<never>(() => {})),
    });
    await expect(run(api, {checkTimeoutMs: 10})).resolves.toEqual([
      'checking',
      'done',
    ]);
    expect(api.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('skips everything in dev builds or when updates are disabled', async () => {
    const devApi = makeApi();
    await expect(run(devApi, {isDev: true})).resolves.toEqual(['done']);
    const disabledApi = makeApi({isEnabled: false});
    await expect(run(disabledApi)).resolves.toEqual(['done']);
    expect(devApi.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(disabledApi.checkForUpdateAsync).not.toHaveBeenCalled();
  });
});
