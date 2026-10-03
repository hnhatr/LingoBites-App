import i18n from '@core/i18n';

import {buildWeeklyGoalCard} from '../homeScreenModel';

const TARGET = 6;

function hintText(card: ReturnType<typeof buildWeeklyGoalCard>): string {
  return card.hintParams
    ? i18n.t(card.hintKey, card.hintParams)
    : i18n.t(card.hintKey);
}

describe('buildWeeklyGoalCard (TC-4A / AC-001)', () => {
  it('S1: in-progress state caps the ring at 67% for 4 completions', () => {
    const card = buildWeeklyGoalCard({
      completedThisWeek: 4,
      target: TARGET,
      badgeEarned: false,
    });
    expect(card.ringPercent).toBe(67);
    expect(i18n.t(card.countLineKey, card.countLineParams)).toBe(
      '4 trên 6 bài đã xong',
    );
    expect(hintText(card)).toBe('Thêm 2 bài để nhận huy hiệu Chăm chỉ.');
  });

  it('S2: empty week shows 0% and six-lesson badge hint', () => {
    const card = buildWeeklyGoalCard({
      completedThisWeek: 0,
      target: TARGET,
      badgeEarned: false,
    });
    expect(card.ringPercent).toBe(0);
    expect(i18n.t(card.countLineKey, card.countLineParams)).toBe(
      '0 trên 6 bài đã xong',
    );
    expect(hintText(card)).toBe('Thêm 6 bài để nhận huy hiệu Chăm chỉ.');
  });

  it('S3: met state keeps count uncapped and ring at 100%', () => {
    const card = buildWeeklyGoalCard({
      completedThisWeek: 7,
      target: TARGET,
      badgeEarned: true,
    });
    expect(card.ringPercent).toBe(100);
    expect(i18n.t(card.countLineKey, card.countLineParams)).toBe(
      '7 trên 6 bài đã xong',
    );
    expect(hintText(card)).toBe('Bạn đã đạt mục tiêu tuần!');
  });

  it('S4: kept badge uses the weekly-target hint when N < target', () => {
    const card = buildWeeklyGoalCard({
      completedThisWeek: 2,
      target: TARGET,
      badgeEarned: true,
    });
    expect(card.hintKey).toBe('home.weekly_goal_hint_kept');
    expect(hintText(card)).toBe('Thêm 4 bài để đạt mục tiêu tuần.');
  });
});
