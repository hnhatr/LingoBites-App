import {Platform} from 'react-native';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {resetDatabaseForTests} from '@core/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@core/db/constants';
import {saveFlashcard, recordFlashcardRating} from '@features/review';
import {validFullOutput} from '@core/fixtures';
import {
  configureReminderScheduler,
  noopReminderScheduler,
} from '../reminderService';
import {AuthorizationStatus, TriggerType} from '@notifee/react-native';
import type {NotificationSettings} from '@notifee/react-native';
import {
  createNativeReminderScheduler,
  configureNativeReminderNotifications,
  GOLDEN_HOUR_CHANNEL_ID,
  permissionStatusFromSettings,
  shouldRequestReminderPermission,
} from '../nativeReminderScheduler';
import type {NotifeeLike} from '../nativeReminderScheduler';
import type {PendingReminder} from '../reminderPolicy';

const NOW = '2026-09-02T09:00:00.000Z';
const FIXED_NOW_MS = () => Date.parse('2026-09-02T00:00:00.000Z');

function settingsWith(authorizationStatus: number): NotificationSettings {
  return {
    authorizationStatus:
      authorizationStatus as NotificationSettings['authorizationStatus'],
    ios: {authorizationStatus: authorizationStatus as never},
    android: {},
    web: {},
  } as unknown as NotificationSettings;
}

function createFakeNotifee(overrides: Partial<NotifeeLike> = {}): {
  api: NotifeeLike;
  calls: {
    scheduled: Array<Record<string, unknown>>;
    cancelled: string[];
    requested: number;
    channels: unknown[];
  };
} {
  const calls = {
    scheduled: [] as Array<Record<string, unknown>>,
    cancelled: [] as string[],
    requested: 0,
    channels: [] as unknown[],
  };
  const api: NotifeeLike = {
    getNotificationSettings: async () =>
      settingsWith(AuthorizationStatus.AUTHORIZED),
    requestPermission: async () => settingsWith(AuthorizationStatus.AUTHORIZED),
    createChannel: async channel => {
      calls.channels.push(channel);
      return GOLDEN_HOUR_CHANNEL_ID;
    },
    getTriggerNotifications: async () => [],
    createTriggerNotification: async (notification, trigger) => {
      calls.scheduled.push({notification, trigger});
      return notification.id ?? 'mock-id';
    },
    cancelTriggerNotification: async id => {
      calls.cancelled.push(id);
    },
    ...overrides,
  };
  return {api, calls};
}

/** Saves one flashcard whose next review then sits in the future at NOW. */
function seedFlashcardDueInFuture(): string {
  const saveResult = saveFlashcard({
    lessonId: 'lesson-1',
    vocabulary: validFullOutput.vocabulary[0],
    now: '2026-09-01T00:00:00.000Z',
  });
  if (!saveResult.ok) {
    throw new Error('failed to seed flashcard');
  }
  recordFlashcardRating({
    flashcardId: saveResult.flashcardId,
    rating: 'remembered',
    reviewedAt: '2026-09-02T08:00:00.000Z',
  });
  return saveResult.flashcardId;
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

describe('permissionStatusFromSettings', () => {
  it.each([
    [AuthorizationStatus.AUTHORIZED, 'granted'],
    [AuthorizationStatus.PROVISIONAL, 'granted'],
    [AuthorizationStatus.DENIED, 'denied'],
    [AuthorizationStatus.NOT_DETERMINED, 'not-determined'],
  ])('maps authorizationStatus %i -> %s', (status, expected) => {
    expect(permissionStatusFromSettings(settingsWith(status))).toBe(expected);
  });

  it('maps unknown statuses to unavailable', () => {
    expect(permissionStatusFromSettings(settingsWith(999))).toBe('unavailable');
  });
});

describe('shouldRequestReminderPermission', () => {
  it('never asks when already granted or unavailable', () => {
    expect(shouldRequestReminderPermission('granted', true)).toBe(false);
    expect(shouldRequestReminderPermission('unavailable', true)).toBe(false);
  });

  it('only asks when a reminder would actually do something', () => {
    expect(shouldRequestReminderPermission('not-determined', false)).toBe(
      false,
    );
    expect(shouldRequestReminderPermission('not-determined', true)).toBe(true);
  });

  it('does not re-ask after an explicit denial on iOS (final choice)', () => {
    expect(shouldRequestReminderPermission('denied', true)).toBe(false);
  });

  it('re-asks after denial on Android where denied also means not asked yet', () => {
    expect(
      shouldRequestReminderPermission('denied', true, {
        requestAfterDenied: true,
      }),
    ).toBe(true);
  });
});

describe('createNativeReminderScheduler', () => {
  beforeEach(() => {
    configureReminderScheduler(noopReminderScheduler);
  });

  it('schedules a future reminder through notifee and mirrors it in pending', () => {
    const {api, calls} = createFakeNotifee();
    const scheduler = createNativeReminderScheduler(api, {now: FIXED_NOW_MS});

    scheduler.schedule({
      cardId: 'card-1',
      word: 'hello',
      dueAt: '2026-09-05T08:00:00.000Z',
    });

    expect(calls.scheduled).toHaveLength(1);
    const scheduled = calls.scheduled[0] as {
      notification: {
        id: string;
        title: string;
        body: string;
        data: {kind: string; cardId: string; dueAt: string};
        android: {channelId: string};
      };
      trigger: {type: number; timestamp: number};
    };
    expect(scheduled.notification.id).toBe('card-1');
    expect(scheduled.notification.title).toContain('ôn tập');
    expect(scheduled.notification.body).toContain('hello');
    expect(scheduled.notification.data.dueAt).toBe('2026-09-05T08:00:00.000Z');
    expect(scheduled.notification.android.channelId).toBe(
      GOLDEN_HOUR_CHANNEL_ID,
    );
    expect(scheduled.trigger.type).toBe(TriggerType.TIMESTAMP);
    expect(scheduled.trigger.timestamp).toBe(
      Date.parse('2026-09-05T08:00:00.000Z'),
    );

    expect(scheduler.listPending()).toEqual([
      {cardId: 'card-1', dueAt: '2026-09-05T08:00:00.000Z'},
    ]);
  });

  it('never schedules a past or invalid due instant', () => {
    const {api, calls} = createFakeNotifee();
    const scheduler = createNativeReminderScheduler(api, {now: FIXED_NOW_MS});

    scheduler.schedule({
      cardId: 'past',
      word: 'w',
      dueAt: '2020-01-01T00:00:00.000Z',
    });
    scheduler.schedule({cardId: 'garbage', word: 'w', dueAt: 'not-a-date'});

    expect(calls.scheduled).toHaveLength(0);
    expect(scheduler.listPending()).toEqual([]);
  });

  it('cancels a card from pending and from the OS', () => {
    const {api, calls} = createFakeNotifee();
    const scheduler = createNativeReminderScheduler(api, {now: FIXED_NOW_MS});
    scheduler.schedule({
      cardId: 'card-1',
      word: 'hello',
      dueAt: '2026-09-05T08:00:00.000Z',
    });

    scheduler.cancel('card-1');

    expect(scheduler.listPending()).toEqual([]);
    expect(calls.cancelled).toEqual(['card-1']);
  });

  it('rolls the shadow back when the OS rejects a schedule', async () => {
    const {api} = createFakeNotifee({
      createTriggerNotification: async () => {
        throw new Error('not linked');
      },
    });
    const scheduler = createNativeReminderScheduler(api, {now: FIXED_NOW_MS});

    scheduler.schedule({
      cardId: 'card-1',
      word: 'hello',
      dueAt: '2026-09-05T08:00:00.000Z',
    });
    expect(scheduler.listPending()).toHaveLength(1);

    await flushMicrotasks();
    expect(scheduler.listPending()).toEqual([]);
  });

  it('refreshes the shadow from the OS pending set (data or trigger timestamp)', async () => {
    const {api} = createFakeNotifee({
      getTriggerNotifications: async () =>
        [
          {
            notification: {
              id: 'from-data',
              data: {dueAt: '2026-09-05T08:00:00.000Z'},
            },
            trigger: {
              type: TriggerType.TIMESTAMP,
              timestamp: Date.parse('2026-09-04T08:00:00.000Z'),
            },
          },
          {
            notification: {id: 'from-trigger'},
            trigger: {
              type: TriggerType.TIMESTAMP,
              timestamp: Date.parse('2026-09-05T08:00:00.000Z'),
            },
          },
          {
            notification: {id: 'no-timestamp'},
            trigger: {type: 3},
          },
        ] as unknown as Awaited<
          ReturnType<NotifeeLike['getTriggerNotifications']>
        >,
    });
    const scheduler = createNativeReminderScheduler(api, {now: FIXED_NOW_MS});

    await scheduler.refreshPending();

    const expected: PendingReminder[] = [
      {cardId: 'from-data', dueAt: '2026-09-05T08:00:00.000Z'},
      {
        cardId: 'from-trigger',
        dueAt: new Date(Date.parse('2026-09-05T08:00:00.000Z')).toISOString(),
      },
    ];
    expect(scheduler.listPending()).toEqual(expected);
  });

  it('keeps the current shadow when the OS pending query fails', async () => {
    const {api} = createFakeNotifee({
      getTriggerNotifications: async () => {
        throw new Error('unavailable');
      },
    });
    const scheduler = createNativeReminderScheduler(api, {now: FIXED_NOW_MS});
    scheduler.schedule({
      cardId: 'card-1',
      word: 'hello',
      dueAt: '2026-09-05T08:00:00.000Z',
    });

    await scheduler.refreshPending();

    expect(scheduler.listPending()).toEqual([
      {cardId: 'card-1', dueAt: '2026-09-05T08:00:00.000Z'},
    ]);
  });
});

describe('configureNativeReminderNotifications', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    configureReminderScheduler(noopReminderScheduler);
  });

  it('installs the native scheduler and schedules due reviews when granted', async () => {
    const cardId = seedFlashcardDueInFuture();
    const {api, calls} = createFakeNotifee();

    const status = await configureNativeReminderNotifications(api, {
      now: () => NOW,
    });

    expect(status).toBe('granted');
    // Reconcile after install schedules the one future reminder.
    expect(calls.scheduled).toHaveLength(1);
    const scheduled = calls.scheduled[0] as {
      notification: {id: string; data: {dueAt: string}};
    };
    expect(scheduled.notification.id).toBe(cardId);
    expect(scheduled.notification.data.dueAt).toBe('2026-09-05T08:00:00.000Z');
  });

  it('creates the Android channel before installing on Android', async () => {
    const originalOs = Platform.OS;
    Platform.OS = 'android' as typeof Platform.OS;
    try {
      seedFlashcardDueInFuture();
      const {api, calls} = createFakeNotifee();

      await configureNativeReminderNotifications(api, {now: () => NOW});

      expect(calls.channels).toHaveLength(1);
      expect(calls.channels[0]).toMatchObject({id: GOLDEN_HOUR_CHANNEL_ID});
    } finally {
      Platform.OS = originalOs;
    }
  });

  it('asks for permission when undetermined and a review is due, then installs', async () => {
    seedFlashcardDueInFuture();
    const {api, calls} = createFakeNotifee({
      getNotificationSettings: async () =>
        settingsWith(AuthorizationStatus.NOT_DETERMINED),
      requestPermission: async () => {
        calls.requested += 1;
        return settingsWith(AuthorizationStatus.AUTHORIZED);
      },
    });

    const status = await configureNativeReminderNotifications(api, {
      now: () => NOW,
    });

    expect(calls.requested).toBe(1);
    expect(status).toBe('granted');
    expect(calls.scheduled).toHaveLength(1);
  });

  it('does not prompt when nothing is due yet (no upcoming reminder)', async () => {
    const {api, calls} = createFakeNotifee({
      getNotificationSettings: async () =>
        settingsWith(AuthorizationStatus.NOT_DETERMINED),
      requestPermission: async () => {
        calls.requested += 1;
        return settingsWith(AuthorizationStatus.AUTHORIZED);
      },
    });

    const status = await configureNativeReminderNotifications(api, {
      now: () => NOW,
    });

    expect(status).toBe('not-determined');
    expect(calls.requested).toBe(0);
    expect(calls.scheduled).toHaveLength(0);
  });

  it('stays on the no-op scheduler when permission stays denied', async () => {
    seedFlashcardDueInFuture();
    const {api, calls} = createFakeNotifee({
      getNotificationSettings: async () =>
        settingsWith(AuthorizationStatus.DENIED),
      requestPermission: async () => settingsWith(AuthorizationStatus.DENIED),
    });

    const status = await configureNativeReminderNotifications(api, {
      now: () => NOW,
    });

    expect(status).toBe('denied');
    expect(calls.scheduled).toHaveLength(0);
  });

  it('returns unavailable without throwing when the native module is missing', async () => {
    seedFlashcardDueInFuture();
    const {api} = createFakeNotifee({
      getNotificationSettings: async () => {
        throw new Error('NativeModule: null');
      },
    });

    await expect(
      configureNativeReminderNotifications(api, {now: () => NOW}),
    ).resolves.toBe('unavailable');
  });
});
