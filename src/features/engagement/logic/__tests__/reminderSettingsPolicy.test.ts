import {
  DEFAULT_REMINDER_SETTINGS,
  nextDailyReminderAtMs,
  parseReminderSettings,
  parseReminderTime,
} from '../reminderSettingsPolicy';

describe('reminderSettingsPolicy', () => {
  it('defaults to Golden Hour on with no daily reminder', () => {
    expect(parseReminderSettings(null)).toEqual({
      enabled: true,
      dailyTime: null,
    });
    expect(parseReminderSettings('not json')).toBe(DEFAULT_REMINDER_SETTINGS);
    expect(parseReminderSettings('42')).toBe(DEFAULT_REMINDER_SETTINGS);
  });

  it('keeps valid stored values and drops an invalid time', () => {
    expect(
      parseReminderSettings(
        JSON.stringify({enabled: true, dailyTime: '20:00'}),
      ),
    ).toEqual({enabled: true, dailyTime: '20:00'});
    expect(
      parseReminderSettings(
        JSON.stringify({enabled: false, dailyTime: '25:00'}),
      ),
    ).toEqual({enabled: false, dailyTime: null});
  });

  it('parses HH:MM times only', () => {
    expect(parseReminderTime('07:30')).toEqual({hour: 7, minute: 30});
    expect(parseReminderTime('7:30')).toBeNull();
    expect(parseReminderTime('24:00')).toBeNull();
  });

  it('fires later today when the time is still ahead, else tomorrow', () => {
    const morning = new Date(2026, 9, 5, 8, 0, 0).getTime();
    expect(nextDailyReminderAtMs('20:00', morning)).toBe(
      new Date(2026, 9, 5, 20, 0, 0).getTime(),
    );
    const night = new Date(2026, 9, 5, 21, 0, 0).getTime();
    expect(nextDailyReminderAtMs('20:00', night)).toBe(
      new Date(2026, 9, 6, 20, 0, 0).getTime(),
    );
    const exactly = new Date(2026, 9, 5, 20, 0, 0).getTime();
    expect(nextDailyReminderAtMs('20:00', exactly)).toBe(
      new Date(2026, 9, 6, 20, 0, 0).getTime(),
    );
    expect(nextDailyReminderAtMs('bad', morning)).toBeNull();
  });
});
