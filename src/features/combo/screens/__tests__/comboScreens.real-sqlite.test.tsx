import {act} from 'react-test-renderer';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {mockAppNavigation} from '@test/support/appNavigationMock';
import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import {
  addToComboSet,
  type ComboSentence,
  fetchComboOptions,
  fetchComboSet,
  fetchComboSituations,
  openComboSet,
  reportComboSentence,
} from '../../logic/comboClient';
import {listLocalComboSets, saveComboSet} from '../../logic/comboSetRepository';
import {ComboHistoryScreen} from '../ComboHistoryScreen';
import {ComboSetScreen} from '../ComboSetScreen';
import {ComboSetupScreen} from '../ComboSetupScreen';

/** Vocab path P5: the combo screens open a set, read it offline, add a batch, play the IPA and report. */

jest.mock('../../logic/comboClient', () => ({
  ...jest.requireActual('../../logic/comboClient'),
  fetchComboOptions: jest.fn(),
  fetchComboSituations: jest.fn(),
  openComboSet: jest.fn(),
  fetchComboSet: jest.fn(),
  addToComboSet: jest.fn(),
  reportComboSentence: jest.fn(),
}));

const mocked = {
  fetchComboOptions: fetchComboOptions as jest.Mock,
  fetchComboSituations: fetchComboSituations as jest.Mock,
  openComboSet: openComboSet as jest.Mock,
  fetchComboSet: fetchComboSet as jest.Mock,
  addToComboSet: addToComboSet as jest.Mock,
  reportComboSentence: reportComboSentence as jest.Mock,
};

const SET_ID = '0b1f6c1e-2d3a-4b5c-8d9e-444444444444';

function sentence(id: string, text: string, batch = 1): ComboSentence {
  return {
    id,
    position: 0,
    batch,
    subject_group: 'i',
    subject_text: 'I',
    polarity: 'affirmative',
    text_en: text,
    text_vi: 'câu',
    tokens: [
      {t: 'I', ipa: 'aɪ', role: 'subject'},
      {t: 'play', ipa: 'pleɪ', role: 'verb'},
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

describe('ComboSetupScreen', () => {
  it('opens a set with the picked situation, tense, groups and count, and keeps it on the device', async () => {
    mocked.fetchComboOptions.mockResolvedValue({
      ok: true,
      value: {
        request_id: 'r',
        status: 'success',
        tense_mode: 'free',
        tenses: [
          {
            code: 'grammar:present-simple',
            name_en: 'Present simple',
            time: 'present',
            aspect: 'simple',
          },
        ],
        subject_groups: ['i', 'he_she'],
        polarities: ['affirmative'],
        batch_sizes: [3, 6],
        max_per_set: 27,
        ai_left_today: 4,
        sets_left_today: 2,
      },
    });
    mocked.fetchComboSituations.mockResolvedValue({
      ok: true,
      value: {
        request_id: 'r',
        status: 'success',
        situations: [
          {
            code: 'club',
            title_en: 'At the club',
            title_vi: 'Câu lạc bộ',
            register: 'casual',
            level_code: 'A1',
          },
        ],
      },
    });
    mocked.openComboSet.mockResolvedValue({
      ok: true,
      value: {
        request_id: 'r',
        status: 'success',
        set_id: SET_ID,
        sentences: [sentence('s1', 'I play here.')],
        missing: 0,
        reason: null,
      },
    });

    const tree = renderWithTheme(
      <ComboSetupScreen route={{params: {itemCode: 'word:play'}}} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(textOf(tree, 'combo-setup-limits')).toContain('4');
    press(tree, 'combo-setup-situation-club');
    press(tree, 'combo-setup-tense-grammar:present-simple');
    press(tree, 'combo-setup-count-3');
    await act(async () => {
      press(tree, 'combo-setup-start');
    });

    expect(mocked.openComboSet).toHaveBeenCalledWith({
      itemCode: 'word:play',
      grammarCode: 'grammar:present-simple',
      situationCode: 'club',
      count: 3,
      polarity: 'affirmative',
      subjectGroups: ['i', 'he_she'],
    });
    expect(listLocalComboSets()).toEqual([
      expect.objectContaining({id: SET_ID, sentenceCount: 1}),
    ]);
    expect(mockAppNavigation.openComboSet).toHaveBeenCalledWith(SET_ID);
  });

  it('starts a locked pattern without a tense', async () => {
    mocked.fetchComboOptions.mockResolvedValue({
      ok: true,
      value: {
        request_id: 'r',
        status: 'success',
        tense_mode: 'locked',
        tenses: [],
        subject_groups: ['i'],
        polarities: ['affirmative'],
        batch_sizes: [3],
        max_per_set: 27,
        ai_left_today: 4,
        sets_left_today: 2,
      },
    });
    mocked.fetchComboSituations.mockResolvedValue({
      ok: true,
      value: {
        request_id: 'r',
        status: 'success',
        situations: [
          {
            code: 'cafe',
            title_en: 'Cafe',
            title_vi: 'Quán cà phê',
            register: 'casual',
            level_code: 'A1',
          },
        ],
      },
    });
    mocked.openComboSet.mockResolvedValue({
      ok: true,
      value: {
        request_id: 'r',
        status: 'success',
        set_id: SET_ID,
        sentences: [sentence('s1', 'I can have tea.')],
        missing: 0,
        reason: null,
      },
    });
    const tree = renderWithTheme(
      <ComboSetupScreen route={{params: {itemCode: 'pattern:can-i-have'}}} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(has(tree, 'combo-setup-locked')).toBe(true);
    expect(has(tree, 'combo-setup-tense-grammar:present-simple')).toBe(false);
    press(tree, 'combo-setup-situation-cafe');
    press(tree, 'combo-setup-count-3');
    await act(async () => {
      press(tree, 'combo-setup-start');
    });
    expect(mocked.openComboSet).toHaveBeenCalledWith(
      expect.objectContaining({
        itemCode: 'pattern:can-i-have',
        situationCode: 'cafe',
        count: 3,
      }),
    );
    expect(mocked.openComboSet.mock.calls[0]![0].grammarCode).toBeUndefined();
  });
});

describe('ComboSetScreen', () => {
  it('shows the sentence from the device, plays a word IPA on tap, and adds a batch of the same size', async () => {
    saveComboSet(
      {
        id: SET_ID,
        itemCode: 'word:play',
        grammarCode: 'grammar:present-simple',
        situationCode: 'club',
        sentences: [
          sentence('s1', 'I play here.'),
          sentence('s2', 'I play today.'),
        ],
      },
      new Date('2026-10-12T08:00:00.000Z'),
    );
    mocked.addToComboSet.mockResolvedValue({
      ok: true,
      value: {
        request_id: 'r',
        status: 'success',
        set_id: SET_ID,
        sentences: [
          sentence('s3', 'I play often.', 2),
          sentence('s4', 'I play now.', 2),
        ],
        missing: 0,
        reason: null,
      },
    });
    const tree = renderWithTheme(
      <ComboSetScreen route={{params: {setId: SET_ID}}} />,
    );
    expect(has(tree, 'combo-sentence-s1')).toBe(true);
    press(tree, 'combo-token-s1-1');
    expect(textOf(tree, 'combo-ipa-s1')).toBe('pleɪ');

    await act(async () => {
      press(tree, 'combo-set-more');
    });
    expect(mocked.addToComboSet).toHaveBeenCalledWith(SET_ID, 2);
    expect(has(tree, 'combo-sentence-s3')).toBe(true);
    expect(listLocalComboSets()).toEqual([
      expect.objectContaining({id: SET_ID, sentenceCount: 4}),
    ]);
  });

  it('reports a sentence with a reason', async () => {
    saveComboSet(
      {
        id: SET_ID,
        itemCode: 'word:play',
        grammarCode: 'grammar:present-simple',
        situationCode: 'club',
        sentences: [sentence('s1', 'I play here.')],
      },
      new Date('2026-10-12T08:00:00.000Z'),
    );
    mocked.reportComboSentence.mockResolvedValue({
      ok: true,
      value: {request_id: 'r', status: 'success', flagged: false},
    });
    const tree = renderWithTheme(
      <ComboSetScreen route={{params: {setId: SET_ID}}} />,
    );
    press(tree, 'combo-report-open-s1');
    await act(async () => {
      press(tree, 'combo-report-s1-unnatural');
    });
    expect(mocked.reportComboSentence).toHaveBeenCalledWith('s1', 'unnatural');
    expect(has(tree, 'combo-set-notice')).toBe(true);
  });
});

describe('ComboHistoryScreen', () => {
  it('lists the sets kept on the device', () => {
    saveComboSet(
      {
        id: SET_ID,
        itemCode: 'word:play',
        grammarCode: 'grammar:present-simple',
        situationCode: 'club',
        sentences: [sentence('s1', 'I play here.')],
      },
      new Date('2026-10-12T08:00:00.000Z'),
    );
    const tree = renderWithTheme(<ComboHistoryScreen />);
    expect(has(tree, `combo-history-${SET_ID}`)).toBe(true);
    press(tree, `combo-history-open-${SET_ID}`);
    expect(mockAppNavigation.openComboSet).toHaveBeenCalledWith(SET_ID);
  });
});
