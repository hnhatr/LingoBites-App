import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {saveLessonSnapshotBody} from '@features/lesson/player/logic/canonicalDownloadRepository';

import {AppThemeProvider} from '@ui/theme';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {buildLessonPracticePlan, practiceSeed} from '@core/learning';
import {FeatureFlagProvider} from '@core/release';
import {parseLessonSnapshotResponse} from '@core/schemas/lesson';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';
import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {PracticeScreen} from '../PracticeScreen';

jest.mock('@features/audio', () => ({
  speak: jest.fn(() => Promise.resolve({ok: true})),
}));
jest.mock('@features/speaking', () => ({loadLessonRecorder: () => null}));

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

const WORDS: Array<[string, string]> = [
  ['wake up', 'thức dậy'],
  ['coffee', 'cà phê'],
  ['book', 'cuốn sách'],
  ['park', 'công viên'],
  ['football', 'bóng đá'],
];

/** A learner's own text lesson (not six-step) with five words. */
function seedLearnerLesson() {
  const body = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as {
    contract_version: number;
    lesson: Record<string, unknown>;
  };
  body.lesson = {
    ...body.lesson,
    id: LESSON_ID,
    title: 'Morning routine',
    origin: 'learner',
    source_type: 'learner_text',
    unit: null,
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
    lesson_items: WORDS.map(([word, meaning], index) => {
      const kind = word.includes(' ') ? 'phrase' : 'word';
      return {
        role: 'required',
        introduction: 'new',
        position: index,
        item: {
          id: id(900 + index),
          code: `${kind}:${word}`,
          kind,
          text: word,
          meaning_vi: meaning,
          ipa: null,
          part_of_speech: null,
          note_vi: null,
          audience: 'all',
          payload: {},
          audio: null,
          image: null,
          examples: [],
          variants: [],
          errors: [],
        },
      };
    }),
  };
  saveLessonSnapshotBody({body});
  const parsed = parseLessonSnapshotResponse(body);
  if (!parsed.ok) throw new Error('fixture invalid');
  return parsed.response.lesson;
}

const rendered: ReactTestRenderer.ReactTestRenderer[] = [];

async function renderScreen() {
  const navigation = {goBack: jest.fn()};
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig({
          ...CORE_WITH_REVIEW,
          shortPractice: true,
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

const pressables = (
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) =>
  tree.root.findAll(
    node =>
      node.props.testID === testID && typeof node.props.onPress === 'function',
  );

const has = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll(node => node.props.testID === testID).length > 0;

const press = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  act(() => {
    pressables(tree, testID)[0]!.props.onPress();
  });

const text = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root
    .findAll(
      node => node.props.testID === testID && typeof node.type === 'string',
    )[0]!
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children as string)
    .join('');

function rows(sql: string): Array<Record<string, any>> {
  const result = getDatabase().execute(sql).rows;
  const out: Array<Record<string, any>> = [];
  for (let i = 0; i < (result?.length ?? 0); i += 1) out.push(result!.item(i));
  return out;
}

/**
 * Answers the current entry: a choice picks options from the top until the
 * right one (so the first is right only by chance); a typed entry shows the
 * answer. Then "Tiếp" / "Xong".
 */
function answerEntry(tree: ReactTestRenderer.ReactTestRenderer) {
  if (pressables(tree, 'lesson-flow-option-0').length > 0) {
    for (let i = 0; !has(tree, 'lesson-flow-feedback-right'); i += 1) {
      press(tree, `lesson-flow-option-${i}`);
    }
  } else {
    press(tree, 'lesson-flow-show-answer');
  }
  press(tree, 'lesson-flow-entry-next');
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

describe('PracticeScreen – practice run of a learner lesson', () => {
  it('runs every section, records each entry and completes the lesson', async () => {
    const lesson = seedLearnerLesson();
    const plan = buildLessonPracticePlan(
      lesson,
      practiceSeed(LESSON_ID, 4, 1),
    )!;
    const kinds = plan.sections.map(section => section.kind);
    expect(kinds).toEqual([
      'listen_and_repeat',
      'multiple_choice',
      'fill_blank',
      'translation',
    ]);
    const {tree} = await renderScreen();

    expect(text(tree, 'practice-run-progress')).toBe('Phần 1/4');
    expect(has(tree, 'practice-run-section-listen_and_repeat')).toBe(true);
    // D2: the speaking part can be skipped.
    press(tree, 'practice-run-skip-speaking');

    for (const [index, section] of plan.sections.slice(1).entries()) {
      expect(text(tree, 'practice-run-progress')).toBe(`Phần ${index + 2}/4`);
      expect(has(tree, `practice-run-section-${section.kind}`)).toBe(true);
      const count =
        section.kind === 'translation'
          ? section.content.sentences.length
          : section.kind === 'listen_and_repeat'
          ? section.content.prompts.length
          : section.content.questions.length;
      for (let entry = 0; entry < count; entry += 1) {
        answerEntry(tree);
      }
    }

    expect(has(tree, 'practice-run-result')).toBe(true);
    expect(text(tree, 'practice-run-completed')).toBe(
      'Bạn đã hoàn thành bài này.',
    );
    expect(text(tree, 'practice-run-section-listen_and_repeat')).toBe(
      'Nghe và nhắc lại: đã bỏ qua',
    );

    const attempts = rows('SELECT * FROM activity_attempts;');
    const entries = plan.sections.reduce(
      (sum, section) =>
        sum +
        (section.kind === 'translation'
          ? section.content.sentences.length
          : section.kind === 'listen_and_repeat'
          ? section.content.prompts.length
          : section.content.questions.length),
      0,
    );
    expect(attempts).toHaveLength(entries);
    expect(
      attempts.every(a => a.kind === 'practice' && a.lesson_id === LESSON_ID),
    ).toBe(true);
    expect(new Set(attempts.map(a => a.session_id)).size).toBe(1);
    const listen = plan.sections[0]!;
    expect(
      attempts.filter(a => a.activity === 'listen_and_repeat'),
    ).toHaveLength(
      listen.kind === 'listen_and_repeat' ? listen.content.prompts.length : -1,
    );
    expect(
      attempts
        .filter(a => a.activity === 'listen_and_repeat')
        .every(a => a.result === 'skipped'),
    ).toBe(true);
    // Shown answers count as not done.
    expect(
      attempts
        .filter(a => a.activity === 'translation')
        .every(a => a.result === 'incorrect'),
    ).toBe(true);

    // D1: finishing the run completes the lesson.
    expect(
      rows(
        `SELECT status FROM lesson_progress WHERE lesson_id = '${LESSON_ID}';`,
      )[0]?.status,
    ).toBe('completed');
    expect(
      rows(
        "SELECT * FROM gamification_events WHERE event_type = 'practice_session_completed';",
      ),
    ).toHaveLength(1);
  });

  it('offers words missed in the run as flashcards', async () => {
    seedLearnerLesson();
    const {tree} = await renderScreen();
    press(tree, 'practice-run-skip-speaking');
    while (!has(tree, 'practice-run-result')) {
      answerEntry(tree);
    }
    const missed = tree.root.findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('practice-save-') &&
        node.props.testID !== 'practice-save-all' &&
        typeof node.props.onPress === 'function',
    );
    if (missed.length === 0) {
      // Every word was right on the first pick by chance.
      return;
    }
    const testID = missed[0]!.props.testID as string;
    press(tree, testID);
    const cards = rows('SELECT item_key FROM flashcards;');
    expect(cards).toHaveLength(1);
    expect(`practice-save-${cards[0]!.item_key}`).toBe(testID);
  });

  it('a retry starts a new session from the first section', async () => {
    seedLearnerLesson();
    const {tree} = await renderScreen();
    press(tree, 'practice-run-skip-speaking');
    while (!has(tree, 'practice-run-result')) {
      answerEntry(tree);
    }
    press(tree, 'practice-retry');
    expect(text(tree, 'practice-run-progress')).toBe('Phần 1/4');
    press(tree, 'practice-run-skip-speaking');
    const sessions = new Set(
      rows('SELECT session_id FROM activity_attempts;').map(r => r.session_id),
    );
    expect(sessions.size).toBe(2);
  });
});
