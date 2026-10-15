import AsyncStorage from '@react-native-async-storage/async-storage';
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
import {loadSavedComboSentences} from '../../logic/savedComboSentences';
import {SITUATION_BOOKMARKS_KEY} from '../../logic/situationBookmarks';
import {ComboHistoryList, ComboHistoryScreen} from '../ComboHistoryScreen';
import {ComboSetScreen} from '../ComboSetScreen';
import {ComboSetupScreen} from '../ComboSetupScreen';
import {SavedComboSentencesList} from '../SavedComboSentencesList';

/** Vocab path P5: the combo screens open a set, read it offline, add a batch, play the IPA and report. */

const mockSpeak = jest.fn();
jest.mock('@features/audio', () => ({
  useSpeak: () => ({speak: mockSpeak, notice: null}),
}));

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

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
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
    let finish: (value: unknown) => void = () => undefined;
    mocked.openComboSet.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );

    const tree = renderWithTheme(
      <ComboSetupScreen route={{params: {itemCode: 'word:play'}}} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(has(tree, 'combo-setup-limits')).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain('Còn 4 lượt AI');
    expect(JSON.stringify(tree.toJSON())).toContain('He / She');
    // A plan with one polarity has nothing to choose.
    expect(has(tree, 'combo-setup-mix')).toBe(false);
    press(tree, 'combo-setup-situation-field');
    press(tree, 'combo-setup-situation-club');
    expect(has(tree, 'combo-setup-situation-sheet')).toBe(false);
    expect(textOf(tree, 'combo-setup-summary')).toContain('Câu lạc bộ');
    press(tree, 'combo-setup-tense-grammar:present-simple');
    // One tense of the 12 is open; the others show a lock.
    expect(JSON.stringify(tree.toJSON())).toContain('1/12 thì mở');
    expect(
      tree.root.findAll(
        node =>
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.endsWith(': chưa mở') &&
          typeof node.type === 'string',
      ),
    ).toHaveLength(11);
    expect(textOf(tree, 'combo-setup-tense-picked')).toContain('Hiện tại đơn');
    press(tree, 'combo-setup-count-3');
    expect(textOf(tree, 'combo-setup-summary')).toBe(
      'Câu lạc bộ · Hiện tại đơn · 3 câu',
    );
    // All six subjects show; the four the plan does not open carry a lock.
    for (const group of ['you', 'we', 'they', 'noun_phrase']) {
      expect(has(tree, `combo-setup-group-locked-${group}`)).toBe(true);
    }
    expect(has(tree, 'combo-setup-group-locked-i')).toBe(false);
    expect(textOf(tree, 'combo-setup-groups-locked')).toBe(
      '4 chủ ngữ có ổ khóa chưa mở trong gói của bạn',
    );
    expect(JSON.stringify(tree.toJSON())).toContain('đã chọn 2/2');
    press(tree, 'combo-setup-groups-all');
    expect(textOf(tree, 'combo-setup-groups-note')).toBe(
      'Chọn ít nhất một chủ ngữ',
    );
    expect(textOf(tree, 'combo-setup-summary')).toBe(
      'Chọn ít nhất một chủ ngữ',
    );
    press(tree, 'combo-setup-groups-all');
    expect(textOf(tree, 'combo-setup-groups-note')).toBe(
      'Chạm để chọn hoặc bỏ chọn',
    );
    await act(async () => {
      press(tree, 'combo-setup-start');
    });
    // While the set is made the waiting screen covers the setup.
    expect(textOf(tree, 'combo-generating-title')).toBe(
      'Đang tạo bộ câu với play',
    );
    await act(async () => {
      finish({
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
      await Promise.resolve();
    });
    expect(has(tree, 'combo-generating')).toBe(false);

    expect(mocked.openComboSet).toHaveBeenCalledWith({
      itemCode: 'word:play',
      grammarCode: 'grammar:present-simple',
      situationCode: 'club',
      polarityCounts: {affirmative: 3},
      subjectGroups: ['i', 'he_she'],
    });
    expect(listLocalComboSets()).toEqual([
      expect.objectContaining({id: SET_ID, sentenceCount: 1}),
    ]);
    expect(mockAppNavigation.openComboSet).toHaveBeenCalledWith(SET_ID, 1);
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
    press(tree, 'combo-setup-situation-field');
    press(tree, 'combo-setup-situation-cafe');
    press(tree, 'combo-setup-count-3');
    await act(async () => {
      press(tree, 'combo-setup-start');
    });
    expect(mocked.openComboSet).toHaveBeenCalledWith(
      expect.objectContaining({
        itemCode: 'pattern:can-i-have',
        situationCode: 'cafe',
        polarityCounts: {affirmative: 3},
      }),
    );
    expect(mocked.openComboSet.mock.calls[0]![0].grammarCode).toBeUndefined();
  });

  it('stays on setup and says why when the Server opens no sentences', async () => {
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
        ai_left_today: 0,
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
        sentences: [],
        missing: 3,
        reason: 'AI_DAILY_LIMIT',
      },
    });
    const tree = renderWithTheme(
      <ComboSetupScreen route={{params: {itemCode: 'pattern:can-i-have'}}} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    press(tree, 'combo-setup-situation-field');
    press(tree, 'combo-setup-situation-cafe');
    press(tree, 'combo-setup-count-3');
    await act(async () => {
      press(tree, 'combo-setup-start');
    });
    expect(textOf(tree, 'combo-setup-start-error')).toContain(
      'Hôm nay đã hết lượt tạo câu mới',
    );
    expect(mockAppNavigation.openComboSet).not.toHaveBeenCalled();
    expect(has(tree, 'combo-generating')).toBe(false);
    expect(listLocalComboSets()).toHaveLength(0);
  });

  it("names the Server's error and shows its request id when a set is refused", async () => {
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
        ai_left_today: 5,
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
      ok: false,
      kind: 'client-error',
      message: 'The request failed (409).',
      code: 'SITUATION_NOT_ENABLED',
      requestId: 'req-409',
    });
    const tree = renderWithTheme(
      <ComboSetupScreen route={{params: {itemCode: 'pattern:can-i-have'}}} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    press(tree, 'combo-setup-situation-field');
    press(tree, 'combo-setup-situation-cafe');
    press(tree, 'combo-setup-count-3');
    await act(async () => {
      press(tree, 'combo-setup-start');
    });
    expect(textOf(tree, 'combo-setup-start-error')).toContain(
      'Tình huống này chưa được bật cho bộ câu',
    );
    expect(textOf(tree, 'combo-setup-start-error-id')).toContain('req-409');
    expect(mockAppNavigation.openComboSet).not.toHaveBeenCalled();
  });

  it('lists bookmarked and recent situations first, searches without marks, and sends the polarity mix', async () => {
    await AsyncStorage.setItem(
      SITUATION_BOOKMARKS_KEY,
      JSON.stringify(['cafe']),
    );
    saveComboSet(
      {
        id: '0b1f6c1e-2d3a-4b5c-8d9e-555555555555',
        itemCode: 'word:play',
        grammarCode: 'grammar:present-simple',
        situationCode: 'gym',
        sentences: [sentence('s1', 'I play here.')],
      },
      new Date('2026-10-12T08:00:00.000Z'),
    );
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
        subject_groups: ['i'],
        polarities: ['affirmative', 'negative', 'question'],
        batch_sizes: [3, 6, 9, 12],
        max_per_set: 27,
        ai_left_today: 4,
        sets_left_today: 2,
      },
    });
    const situation = (code: string, titleVi: string) => ({
      code,
      title_en: code,
      title_vi: titleVi,
      register: 'casual',
      level_code: 'A1',
    });
    mocked.fetchComboSituations.mockResolvedValue({
      ok: true,
      value: {
        request_id: 'r',
        status: 'success',
        situations: [
          situation('club', 'Câu lạc bộ'),
          situation('cafe', 'Quán cà phê'),
          situation('gym', 'Phòng tập'),
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
    press(tree, 'combo-setup-situation-field');
    const sheet = textOf(tree, 'combo-setup-situation-sheet');
    const saved = sheet.indexOf('Đã lưu');
    const recent = sheet.indexOf('Dùng gần đây');
    const all = sheet.indexOf('Tất cả tình huống');
    expect(saved).toBeGreaterThan(-1);
    expect(sheet.indexOf('Quán cà phê')).toBeGreaterThan(saved);
    expect(sheet.indexOf('Quán cà phê')).toBeLessThan(recent);
    expect(sheet.indexOf('Phòng tập')).toBeGreaterThan(recent);
    expect(sheet.indexOf('Phòng tập')).toBeLessThan(all);

    await act(async () => {
      press(tree, 'combo-setup-bookmark-club');
    });
    expect(
      JSON.parse((await AsyncStorage.getItem(SITUATION_BOOKMARKS_KEY)) ?? ''),
    ).toEqual(['cafe', 'club']);

    const search = tree.root.find(
      node =>
        node.props.testID === 'combo-setup-situation-search' &&
        typeof node.props.onChangeText === 'function',
    );
    act(() => {
      search.props.onChangeText('quan ca');
    });
    expect(textOf(tree, 'combo-setup-situation-sheet')).not.toContain(
      'Câu lạc bộ',
    );
    act(() => {
      search.props.onChangeText('xyz');
    });
    expect(has(tree, 'combo-setup-situation-empty')).toBe(true);
    act(() => {
      search.props.onChangeText('quan ca');
    });
    press(tree, 'combo-setup-situation-cafe');

    // 3 affirmative to start; a quick pick fills the batch with questions.
    expect(textOf(tree, 'combo-setup-mix-value-affirmative')).toBe('3');
    press(tree, 'combo-setup-mix-preset-question');
    expect(textOf(tree, 'combo-setup-mix-value-question')).toBe('12');
    expect(textOf(tree, 'combo-setup-mix-value-affirmative')).toBe('0');
    expect(textOf(tree, 'combo-setup-mix-hint')).toContain('Đã đủ 12 câu');
    // A full batch takes no more: lower questions to add negatives.
    press(tree, 'combo-setup-mix-more-negative');
    expect(textOf(tree, 'combo-setup-mix-value-negative')).toBe('0');
    press(tree, 'combo-setup-mix-less-question');
    press(tree, 'combo-setup-mix-less-question');
    press(tree, 'combo-setup-mix-more-negative');
    press(tree, 'combo-setup-mix-more-affirmative');
    expect(textOf(tree, 'combo-setup-summary')).toContain(
      '12 câu (3 KĐ, 3 PĐ, 6 CH)',
    );
    await act(async () => {
      press(tree, 'combo-setup-start');
    });
    expect(mocked.openComboSet).toHaveBeenCalledWith(
      expect.objectContaining({
        situationCode: 'cafe',
        polarityCounts: {question: 6, negative: 3, affirmative: 3},
      }),
    );
  });
});

describe('ComboSetScreen', () => {
  it('greets a set that was just made with a toast that goes away', async () => {
    jest.useFakeTimers();
    try {
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
      const tree = renderWithTheme(
        <ComboSetScreen route={{params: {setId: SET_ID, created: 2}}} />,
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(JSON.stringify(tree.toJSON())).toContain('Đã tạo 2 câu mới');
      expect(has(tree, 'combo-sentence-s2')).toBe(true);
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(has(tree, 'combo-set-created')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows no toast when an older set is opened', () => {
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
    const tree = renderWithTheme(
      <ComboSetScreen route={{params: {setId: SET_ID}}} />,
    );
    expect(has(tree, 'combo-set-created')).toBe(false);
  });

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
    expect(JSON.stringify(tree.toJSON())).toContain('Thêm 2 câu');

    await act(async () => {
      press(tree, 'combo-set-more');
    });
    expect(mocked.addToComboSet).toHaveBeenCalledWith(SET_ID);
    expect(has(tree, 'combo-sentence-s3')).toBe(true);
    expect(listLocalComboSets()).toEqual([
      expect.objectContaining({id: SET_ID, sentenceCount: 4}),
    ]);
  });

  it('opens the grammar breakdown the Server sent, and the parts from the words without one', () => {
    saveComboSet(
      {
        id: SET_ID,
        itemCode: 'word:june',
        grammarCode: 'grammar:past-simple',
        situationCode: 'club',
        sentences: [
          {
            ...sentence('s1', 'She came in June.'),
            analysis: {
              tense: {
                code: 'grammar:past-simple',
                time: 'past',
                aspect: 'simple',
                name_vi: 'Quá khứ đơn',
                polarity_vi: 'Khẳng định',
                formula: 'S + V2/ed',
              },
              parts: [
                {text: 'She', role: 'subject', label_vi: 'Chủ ngữ'},
                {text: 'came', role: 'verb', label_vi: 'Động từ · V2 của come'},
                {text: 'in June', role: 'item', label_vi: 'Thời gian'},
              ],
              notes: [
                '**came** là dạng quá khứ (V2) bất quy tắc của **come**.',
              ],
            },
          },
          sentence('s2', 'I play today.'),
        ],
      },
      new Date('2026-10-12T08:00:00.000Z'),
    );
    const tree = renderWithTheme(
      <ComboSetScreen route={{params: {setId: SET_ID}}} />,
    );
    // The hero names the word and the tense.
    const all = JSON.stringify(tree.toJSON());
    expect(all).toContain('june');
    expect(all).toContain('2 câu · Quá khứ đơn');
    expect(has(tree, 'combo-grammar-s1')).toBe(false);
    press(tree, 'combo-grammar-open-s1');
    const grammar = textOf(tree, 'combo-grammar-s1');
    expect(grammar).toContain('Quá khứ đơn · Khẳng định');
    expect(grammar).toContain('S + V2/ed');
    expect(grammar).toContain('Động từ · V2 của come');
    expect(grammar).toContain('là dạng quá khứ (V2) bất quy tắc của');

    press(tree, 'combo-grammar-open-s2');
    const parts = textOf(tree, 'combo-grammar-s2');
    expect(parts).toContain('Chủ ngữ');
    expect(parts).toContain('Động từ');
  });

  it('reads a sentence aloud and saves it to the Library', async () => {
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
    const tree = renderWithTheme(
      <ComboSetScreen route={{params: {setId: SET_ID}}} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    press(tree, 'combo-listen-s1');
    expect(mockSpeak).toHaveBeenCalledWith('I play here.');
    expect(textOf(tree, 'combo-listen-s1')).toContain('Đang đọc');

    press(tree, 'combo-token-s1-1');
    press(tree, 'combo-say-s1');
    expect(mockSpeak).toHaveBeenLastCalledWith('play');

    await act(async () => {
      press(tree, 'combo-save-s1');
    });
    expect(textOf(tree, 'combo-save-s1')).toContain('Đã lưu');
    expect(await loadSavedComboSentences()).toEqual([
      expect.objectContaining({
        id: 's1',
        setId: SET_ID,
        itemCode: 'word:play',
        textEn: 'I play here.',
      }),
    ]);
    await act(async () => {
      press(tree, 'combo-save-s1');
    });
    expect(await loadSavedComboSentences()).toEqual([]);
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
    expect(textOf(tree, 'combo-report-open-s1')).toContain('Đã báo');
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
    // The card names the word, not its catalog code, and shows a sentence.
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('"play"');
    expect(text).not.toContain('word:play');
    expect(text).toContain('I ');
    press(tree, `combo-history-${SET_ID}`);
    expect(mockAppNavigation.openComboSet).toHaveBeenCalledWith(SET_ID);
  });
});

describe('ComboHistoryList search', () => {
  it('shows only the sets whose word matches the search', () => {
    const sets = [
      {
        id: 'a1',
        itemCode: 'word:play',
        grammarCode: 'g',
        situationCode: 'c',
        sentenceCount: 2,
        createdAt: 'x',
      },
      {
        id: 'a2',
        itemCode: 'word:tea',
        grammarCode: 'g',
        situationCode: 'c',
        sentenceCount: 1,
        createdAt: 'x',
      },
    ];
    const tree = renderWithTheme(<ComboHistoryList sets={sets} query="PLA" />);
    expect(has(tree, 'combo-history-a1')).toBe(true);
    expect(has(tree, 'combo-history-a2')).toBe(false);
  });

  it('does not match every set on the "word:" prefix', () => {
    const sets = [
      {
        id: 'a1',
        itemCode: 'word:play',
        grammarCode: 'g',
        situationCode: 'c',
        sentenceCount: 2,
        createdAt: 'x',
      },
    ];
    const tree = renderWithTheme(<ComboHistoryList sets={sets} query="word" />);
    expect(has(tree, 'combo-history-a1')).toBe(false);
    expect(has(tree, 'combo-history-no-match')).toBe(true);
  });

  it('offers the word packs when there is no set', () => {
    const tree = renderWithTheme(<ComboHistoryList sets={[]} showPackLink />);
    expect(has(tree, 'combo-history-empty')).toBe(true);
    press(tree, 'combo-history-open-packs');
    expect(mockAppNavigation.openWordPath).toHaveBeenCalled();
  });
});

describe('SavedComboSentencesList', () => {
  it('lists the saved sentences, opens their set and unsaves one', async () => {
    await AsyncStorage.setItem(
      'combo_saved_sentences_v1',
      JSON.stringify([
        {
          id: 's1',
          setId: SET_ID,
          itemCode: 'word:play',
          textEn: 'I play here.',
          textVi: 'Tôi chơi ở đây.',
          savedAt: '2026-10-12T08:00:00.000Z',
        },
      ]),
    );
    const tree = renderWithTheme(<SavedComboSentencesList />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(textOf(tree, 'saved-sentence-s1')).toContain('Tôi chơi ở đây.');
    press(tree, 'saved-sentence-listen-s1');
    expect(mockSpeak).toHaveBeenCalledWith('I play here.');
    const open = tree.root.findAll(
      node =>
        node.props.accessibilityHint === 'Mở bộ câu có câu này' &&
        typeof node.props.onPress === 'function',
    )[0]!;
    act(() => open.props.onPress());
    expect(mockAppNavigation.openComboSet).toHaveBeenCalledWith(SET_ID);
    await act(async () => {
      press(tree, 'saved-sentence-unsave-s1');
    });
    expect(has(tree, 'saved-sentences-empty')).toBe(true);
  });
});
