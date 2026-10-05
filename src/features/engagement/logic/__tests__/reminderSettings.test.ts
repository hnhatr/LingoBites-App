import type {NotifeeLike} from '../nativeReminderScheduler';
import {DAILY_REMINDER_NOTIFICATION_ID} from '../nativeReminderScheduler';
import {syncDailyReminder} from '../reminderSettings';

function fakeApi() {
  return {
    getNotificationSettings: jest.fn(),
    requestPermission: jest.fn(),
    createChannel: jest.fn().mockResolvedValue('daily-study-reminder'),
    getTriggerNotifications: jest.fn().mockResolvedValue([]),
    createTriggerNotification: jest.fn().mockResolvedValue('id'),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
  };
}

describe('syncDailyReminder', () => {
  const nowMs = new Date(2026, 9, 5, 8, 0, 0).getTime();

  it('schedules one repeating trigger at the chosen time', async () => {
    const api = fakeApi();
    await syncDailyReminder(
      api as unknown as NotifeeLike,
      {enabled: true, dailyTime: '20:00'},
      nowMs,
    );
    expect(api.createTriggerNotification).toHaveBeenCalledTimes(1);
    const [notification, trigger] = api.createTriggerNotification.mock.calls[0];
    expect(notification.id).toBe(DAILY_REMINDER_NOTIFICATION_ID);
    expect(trigger.timestamp).toBe(new Date(2026, 9, 5, 20, 0, 0).getTime());
    expect(trigger.repeatFrequency).toBe(1); // RepeatFrequency.DAILY
    expect(api.cancelTriggerNotification).not.toHaveBeenCalled();
  });

  it('cancels the daily trigger when reminders are off or no time is set', async () => {
    const api = fakeApi();
    await syncDailyReminder(
      api as unknown as NotifeeLike,
      {enabled: false, dailyTime: '20:00'},
      nowMs,
    );
    await syncDailyReminder(
      api as unknown as NotifeeLike,
      {enabled: true, dailyTime: null},
      nowMs,
    );
    expect(api.createTriggerNotification).not.toHaveBeenCalled();
    expect(api.cancelTriggerNotification).toHaveBeenCalledTimes(2);
    expect(api.cancelTriggerNotification).toHaveBeenCalledWith(
      DAILY_REMINDER_NOTIFICATION_ID,
    );
  });

  it('never throws when the native call fails', async () => {
    const api = fakeApi();
    api.createTriggerNotification.mockRejectedValue(new Error('no module'));
    await expect(
      syncDailyReminder(
        api as unknown as NotifeeLike,
        {enabled: true, dailyTime: '07:00'},
        nowMs,
      ),
    ).resolves.toBeUndefined();
  });
});
