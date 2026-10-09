import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {getLearnerAgeGroup, isAudienceVisible} from '@core/learning';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  readCachedProfile,
  sanitizeProfile,
  writeCachedProfile,
} from '../learnerProfileCache';
import {
  fetchLearnerProfile,
  putLearnerProfile,
  type ServerLearnerProfile,
} from '../learnerProfileClient';
import {
  DEFAULT_PROFILE,
  type LearnerProfileInput,
  toggleChoice,
} from '../profileOptions';
import {useLearnerProfileStore} from '../useLearnerProfileStore';

jest.mock('../learnerProfileClient', () => ({
  fetchLearnerProfile: jest.fn(),
  putLearnerProfile: jest.fn(),
}));

const mockFetchProfile = fetchLearnerProfile as jest.MockedFunction<
  typeof fetchLearnerProfile
>;
const mockPutProfile = putLearnerProfile as jest.MockedFunction<
  typeof putLearnerProfile
>;

const KID: LearnerProfileInput = {
  ageGroup: 'kids',
  levelCode: 'A1',
  goals: ['school'],
  interests: ['games', 'music'],
  dailyMinutes: 15,
};

const SERVER: ServerLearnerProfile = {
  age_group: 'adults',
  level_code: 'A2',
  goals: ['travel'],
  interests: ['movies'],
  daily_minutes: 20,
  placement: null,
};

beforeEach(() => {
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
  useLearnerProfileStore.getState().reset();
  mockFetchProfile.mockReset();
  mockPutProfile.mockReset();
  mockPutProfile.mockResolvedValue({ok: true, value: SERVER});
});

afterEach(() => {
  resetDatabaseForTests(null);
});

describe('profile options and cache', () => {
  it('toggles choices and stops at the maximum', () => {
    expect(toggleChoice(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleChoice(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleChoice(['a', 'b', 'c'], 'd', 3)).toEqual(['a', 'b', 'c']);
  });

  it('keeps a profile per account and drops unknown values', () => {
    writeCachedProfile({userId: 'u1', profile: KID, pending: true});
    expect(readCachedProfile('u1')).toEqual({
      userId: 'u1',
      profile: KID,
      pending: true,
    });
    expect(readCachedProfile('u2')).toBeNull();
    expect(
      sanitizeProfile({...KID, goals: ['flying'], interests: ['x', 'music']}),
    ).toEqual({...KID, goals: ['communication'], interests: ['music']});
    expect(sanitizeProfile({...KID, levelCode: 'C2'})).toBeNull();
  });
});

describe('useLearnerProfileStore', () => {
  it('asks for onboarding when neither the device nor the Server has a profile', async () => {
    mockFetchProfile.mockResolvedValue({ok: true, value: null});
    await useLearnerProfileStore.getState().load('u1');
    expect(useLearnerProfileStore.getState().status).toBe('needed');
  });

  it('onboards offline too when the Server cannot be reached', async () => {
    mockFetchProfile.mockResolvedValue({ok: false, kind: 'network-error'});
    await useLearnerProfileStore.getState().load('u1');
    expect(useLearnerProfileStore.getState().status).toBe('needed');
  });

  it('takes the Server profile and caches it', async () => {
    mockFetchProfile.mockResolvedValue({ok: true, value: SERVER});
    await useLearnerProfileStore.getState().load('u1');
    const state = useLearnerProfileStore.getState();
    expect(state.status).toBe('ready');
    expect(state.profile?.levelCode).toBe('A2');
    expect(readCachedProfile('u1')?.profile.dailyMinutes).toBe(20);
  });

  it('opens from the cache without waiting and sends answers still pending', async () => {
    writeCachedProfile({userId: 'u1', profile: KID, pending: true});
    await useLearnerProfileStore.getState().load('u1');
    expect(mockFetchProfile).not.toHaveBeenCalled();
    expect(mockPutProfile).toHaveBeenCalledWith(KID);
    expect(useLearnerProfileStore.getState()).toMatchObject({
      status: 'ready',
      pending: false,
    });
    expect(readCachedProfile('u1')?.pending).toBe(false);
  });

  it('stays in onboarding until it is finished, and keeps answers when offline', async () => {
    mockFetchProfile.mockResolvedValue({ok: true, value: null});
    mockPutProfile.mockResolvedValue({ok: false, kind: 'network-error'});
    const store = useLearnerProfileStore.getState();
    await store.load('u1');
    await store.save(KID);
    expect(useLearnerProfileStore.getState().status).toBe('needed');
    await store.save({...KID, levelCode: 'A2'}, {finish: true});
    expect(useLearnerProfileStore.getState()).toMatchObject({
      status: 'ready',
      pending: true,
    });
    expect(readCachedProfile('u1')).toMatchObject({
      pending: true,
      profile: {levelCode: 'A2'},
    });
  });

  it('shares the age group with the curriculum screens (G5)', async () => {
    mockFetchProfile.mockResolvedValue({ok: true, value: null});
    await useLearnerProfileStore.getState().load('u1');
    await useLearnerProfileStore.getState().save(KID, {finish: true});
    expect(getLearnerAgeGroup()).toBe('kids');
    expect(isAudienceVisible('adults')).toBe(false);
    expect(isAudienceVisible('all')).toBe(true);
    await useLearnerProfileStore.getState().save(DEFAULT_PROFILE);
    expect(isAudienceVisible('adults')).toBe(true);
    useLearnerProfileStore.getState().reset();
    expect(getLearnerAgeGroup()).toBeNull();
  });
});
