import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {saveLessonSnapshotBody} from '@features/lesson/player/logic/canonicalDownloadRepository';

import {AppThemeProvider} from '@ui/theme';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  buildPracticeSource,
  generatePracticeSet,
  practiceSeed,
} from '@core/learning';
import {FeatureFlagProvider} from '@core/release';
import {parseLessonSnapshotResponse} from '@core/schemas/lesson';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';
import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {PracticeScreen} from '../PracticeScreen';

const FIXTURE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'core',
  'schemas',
  '__tests__',
  'fixtures',
  'valid-lesson-snapshot-response.json',
);

const LESSON_ID = '33333333-3333-4333-8333-333333333302';
const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

const SENTENCES = [
  ['I wake up at six.', 'Tôi thức dậy lúc sáu giờ.'],
  ['Then I drink coffee.', 'Sau đó tôi uống cà phê.'],
  ['She reads a book.', 'Cô ấy đọc một cuốn sách.'],
  ['We walk to the park.', 'Chúng tôi đi bộ đến công viên.'],
  ['They play football.', 'Họ chơi bóng đá.'],
] as const;

const WORDS: Array<[string, string, number]> = [
  ['wake up', 'thức dậy', 0],
  ['coffee', 'cà phê', 1],
  ['book', 'cuốn sách', 2],
  ['park', 'công viên', 3],
  ['football', 'bóng đá', 4],
];

function seedLesson(
  withItems = true,
): ReturnType<typeof parseLessonSnapshotResponse> {
  const body = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as {
    contract_version: number;
    lesson: Record<string, unknown>;
  };
  body.contract_version = 2;
  body.lesson = {
    ...body.lesson,
    id: LESSON_ID,
    title: 'Morning routine',
    content_revision: 4,
    sentences: SENTENCES.map(([en, vi], index) => ({
      id: id(index + 1),
      position: index,
      text_en: en,
      text_vi: vi,
      ipa: 'ə',
      start_ms: null,
      end_ms: null,
    })),
    blocks: [],
    analyses: {},
    items: withItems
      ? WORDS.map(([word, meaning, sentence], index) => ({
          id: id(900 + index),
          kind: word.includes(' ') ? 'phrase' : 'word',
          item_key: word,
          payload: {word, meaning_vi: meaning, ipa: null, pos: null},
          sentence_ids: [id(sentence + 1)],
        }))
      : undefined,
  };
  saveLessonSnapshotBody({body});
  return parseLessonSnapshotResponse(body);
}

const rendered: ReactTestRenderer.ReactTestRenderer[] = [];

async function renderScreen(
  features: Partial<Record<string, boolean>> = {shortPractice: true},
) {
  const navigation = {goBack: jest.fn()};
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig({
          ...CORE_WITH_REVIEW,
          ...features,
        })}
      >
        <AppThemeProvider>
          <PracticeScreen
            navigation={navigation}
            route={{params: {lessonId: LESSON_ID}}}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  rendered.push(tree);
  return {tree, navigation};
}

const byId = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll(
    node => node.props.testID === testID && typeof node.type === 'string',
  );

const press = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  act(() => {
    tree.root
      .findAll(
        node =>
          node.props.testID === testID &&
          typeof node.props.onPress === 'function',
      )[0]!
      .props.onPress();
  });

const text = (
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
): string => {
  const node = byId(tree, testID)[0]!;
  return node
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children as string)
    .join('');
};

function expectedQuestions(attemptNo: number) {
  const parsed = seedLessonSnapshot();
  return generatePracticeSet(
    buildPracticeSource(parsed),
    practiceSeed(LESSON_ID, 4, attemptNo),
  );
}

function seedLessonSnapshot() {
  const result = seedLesson();
  if (!result.ok) throw new Error('fixture invalid');
  return result.response.lesson;
}

function rows(sql: string): Array<Record<string, any>> {
  const result = getDatabase().execute(sql).rows;
  const out: Array<Record<string, any>> = [];
  for (let i = 0; i < (result?.length ?? 0); i += 1) out.push(result!.item(i));
  return out;
}

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  getDatabase();
});

afterEach(() => {
  rendered.splice(0).forEach(tree => act(() => tree.unmount()));
});

describe('PracticeScreen', () => {
  it('asks for a download when the lesson is not on the device', async () => {
    const {tree, navigation} = await renderScreen();
    expect(text(tree, 'practice-unavailable')).toBe(
      'Hãy tải bài học về máy để luyện tập.',
    );
    press(tree, 'practice-unavailable-back');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('says so when the flag is off, even for a downloaded lesson', async () => {
    seedLesson();
    const {tree} = await renderScreen({shortPractice: false});
    expect(text(tree, 'practice-unavailable')).toBe(
      'Tính năng luyện tập hiện chưa được bật.',
    );
  });

  it('plays a whole quiz: answers are graded, recorded and summarised', async () => {
    seedLesson();
    const questions = expectedQuestions(1);
    const {tree} = await renderScreen();

    expect(text(tree, 'practice-progress')).toBe(`Câu 1/${questions.length}`);
    expect(text(tree, 'practice-prompt')).toBe(questions[0]!.prompt);

    // Answer every question: wrong on the first, right on the rest.
    for (let i = 0; i < questions.length; i += 1) {
      const question = questions[i]!;
      const wrongIndex = question.options.findIndex(
        option => option.id !== question.correctOptionId,
      );
      const rightIndex = question.options.findIndex(
        option => option.id === question.correctOptionId,
      );
      press(tree, `practice-option-${i === 0 ? wrongIndex : rightIndex}`);
      if (i === 0) {
        expect(text(tree, 'practice-feedback')).toBe(
          `Chưa đúng. Đáp án: ${question.answerText}`,
        );
      } else {
        expect(text(tree, 'practice-feedback')).toBe('Chính xác!');
      }
      press(tree, 'practice-next');
    }

    expect(text(tree, 'practice-result-score')).toBe(
      `${questions.length - 1}/${questions.length} câu đúng`,
    );
    const attempts = rows(
      'SELECT * FROM activity_attempts ORDER BY occurred_at;',
    );
    expect(attempts).toHaveLength(questions.length);
    expect(attempts.filter(a => a.result === 'incorrect')).toHaveLength(1);
    expect(new Set(attempts.map(a => a.session_id)).size).toBe(1);
    expect(
      attempts.every(a => a.kind === 'practice' && a.lesson_id === LESSON_ID),
    ).toBe(true);
    // Attempts queue for sync; finishing credits the streak.
    expect(
      rows("SELECT * FROM sync_outbox WHERE event_type = 'activity_attempts';"),
    ).toHaveLength(questions.length);
    expect(
      rows(
        "SELECT * FROM gamification_events WHERE event_type = 'practice_session_completed';",
      ),
    ).toHaveLength(1);
  });

  it('offers the missed word as a flashcard and saves it once', async () => {
    seedLesson();
    const questions = expectedQuestions(1);
    const first = questions[0]!;
    const {tree} = await renderScreen();

    for (let i = 0; i < questions.length; i += 1) {
      const question = questions[i]!;
      const index = question.options.findIndex(option =>
        i === 0
          ? option.id !== question.correctOptionId
          : option.id === question.correctOptionId,
      );
      press(tree, `practice-option-${index}`);
      press(tree, 'practice-next');
    }

    if (!first.itemKey) {
      // The first question was a translation: nothing to save, no missed list.
      expect(byId(tree, 'practice-missed')).toHaveLength(0);
      return;
    }
    expect(byId(tree, 'practice-missed').length).toBeGreaterThan(0);
    press(tree, `practice-save-${first.itemKey}`);
    const cards = rows('SELECT item_key, word, is_saved FROM flashcards;');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.item_key).toBe(first.itemKey);
    expect(cards[0]!.is_saved).toBe(1);
  });

  it('a retry is a new attempt with different questions and a new session', async () => {
    seedLesson();
    const {tree} = await renderScreen();
    const total = expectedQuestions(1).length;
    const firstQuiz = text(tree, 'practice-prompt');

    for (let i = 0; i < total; i += 1) {
      press(tree, 'practice-option-0');
      press(tree, 'practice-next');
    }
    press(tree, 'practice-retry');

    expect(text(tree, 'practice-progress')).toBe(
      `Câu 1/${expectedQuestions(2).length}`,
    );
    expect(text(tree, 'practice-prompt')).toBe(expectedQuestions(2)[0]!.prompt);
    expect(firstQuiz).toBe(expectedQuestions(1)[0]!.prompt);
    press(tree, 'practice-option-0');
    const sessions = new Set(
      rows('SELECT session_id FROM activity_attempts;').map(r => r.session_id),
    );
    expect(sessions.size).toBe(2);
  });

  it('cannot answer twice or advance before answering', async () => {
    seedLesson();
    const {tree} = await renderScreen();
    press(tree, 'practice-next'); // disabled: nothing happens
    expect(text(tree, 'practice-progress')).toMatch(/^Câu 1\//);
    press(tree, 'practice-option-0');
    press(tree, 'practice-option-1'); // already answered
    expect(rows('SELECT * FROM activity_attempts;')).toHaveLength(1);
  });

  it('a download without items still offers a translation quiz', async () => {
    const result = seedLesson(false);
    expect(result.ok).toBe(true);
    // No items[], blocks or analyses: no word questions, but every sentence
    // has a translation, so the quiz is made of translation questions.
    const {tree} = await renderScreen();
    expect(byId(tree, 'practice-unavailable')).toHaveLength(0);
    expect(SENTENCES.map(([en]) => en)).toContain(
      text(tree, 'practice-prompt'),
    );
    expect(text(tree, 'practice-progress')).toBe('Câu 1/5');
  });
});
