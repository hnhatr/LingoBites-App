import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import {act} from 'react-test-renderer';

import {LessonSnapshotResponseSchema} from '@core/schemas/lesson';

import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import {fetchComposeQuota, submitCompose} from '../../logic/composeClient';
import {
  getComposeEntry,
  resetComposeTrackerForTests,
  useComposeTracker,
} from '../../logic/composeTracker';
import {ComposeSheet} from '../ComposeSheet';

jest.mock('../../logic/composeClient', () => ({
  ...jest.requireActual('../../logic/composeClient'),
  submitCompose: jest.fn(),
  fetchComposeQuota: jest.fn(),
  fetchActiveComposes: jest.fn(() => Promise.resolve({ok: true, value: []})),
}));
jest.mock('../../logic/canonicalLessonClient', () => ({
  ...jest.requireActual('../../logic/canonicalLessonClient'),
  fetchLessonCreationStatus: jest.fn(() => new Promise(() => {})),
}));
jest.mock('../../logic/canonicalDownloadRepository', () => ({
  getLessonDownload: jest.fn(() => null),
  saveLessonSnapshotBody: jest.fn(),
}));

const mockedSubmit = submitCompose as jest.Mock;
const mockedQuota = fetchComposeQuota as jest.Mock;

const snapshot = LessonSnapshotResponseSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../core/schemas/__tests__/fixtures/valid-lesson-snapshot-response.json',
      ),
      'utf8',
    ),
  ),
).lesson;
const [S1, S2, S3] = snapshot.sentences.map(sentence => sentence.id) as [
  string,
  string,
  string,
];
const REQUEST = '33333333-3333-4333-8333-333333333301';
const LESSON = '55555555-5555-4555-8555-555555555501';

const quota = (remaining: number) => ({
  ok: true,
  value: {
    limit: 1,
    used: 1 - remaining,
    remaining,
    resets_at: '2026-10-09T17:00:00.000Z',
  },
});

const progress = (stage: string, extra: Record<string, unknown> = {}) => ({
  stage,
  stage_started_at: null,
  elapsed_ms: 4000,
  expected_ms: 25000,
  quota_charged: false,
  reason_vi: null,
  suggestion_vi: null,
  dropped_sentence_ids: [],
  ...extra,
});

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

function renderSheet(offline = false) {
  const onClose = jest.fn();
  const onOpenLesson = jest.fn();
  const tree = renderWithTheme(
    <ComposeSheet
      offline={offline}
      onClose={onClose}
      onOpenLesson={onOpenLesson}
      onSpeakText={jest.fn()}
      snapshot={snapshot}
      visible
    />,
  );
  return {tree, onClose, onOpenLesson};
}

function setEntry(patch: Record<string, unknown>) {
  act(() => {
    useComposeTracker.setState(state => ({
      entries: state.entries.map(entry =>
        entry.requestId === REQUEST ? {...entry, ...patch} : entry,
      ),
    }));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetComposeTrackerForTests();
  mockedQuota.mockResolvedValue(quota(1));
});

describe('ComposeSheet (S4.3)', () => {
  it('picks sentences, shows the quota and sends them in lesson order', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {kind: 'queued', requestId: REQUEST},
    });
    const {tree} = renderSheet();
    await flush();
    expect(textOf(tree, 'compose-quota')).toBe('Còn 1 lượt hôm nay');

    press(tree, `compose-sentence-${S2}`);
    expect(textOf(tree, 'compose-issue')).toBe('Chọn ít nhất 2 câu.');
    press(tree, `compose-sentence-${S1}`);
    expect(textOf(tree, 'compose-picked-count')).toBe('Đã chọn 2/8');
    expect(has(tree, 'compose-issue')).toBe(false);

    press(tree, 'compose-submit');
    await flush();
    expect(mockedSubmit).toHaveBeenCalledWith(
      snapshot.id,
      [S1, S2],
      expect.any(String),
    );
    // Following the request; the tracker keeps it after the sheet closes.
    expect(has(tree, 'compose-progress')).toBe(true);
    expect(getComposeEntry(REQUEST)?.sourceLessonId).toBe(snapshot.id);

    setEntry({progress: progress('writing')});
    expect(textOf(tree, 'compose-stage-preparing')).toContain('✓');
    expect(textOf(tree, 'compose-stage-writing')).toContain('…');
    expect(textOf(tree, 'compose-waited')).toBe(
      'Đã chờ 4 giây · thường mất khoảng 25 giây',
    );

    setEntry({progress: progress('writing', {elapsed_ms: 60_000})});
    expect(has(tree, 'compose-slow')).toBe(true);
  });

  it('opens the ready lesson and says what was dropped', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {kind: 'queued', requestId: REQUEST},
    });
    const {tree, onOpenLesson, onClose} = renderSheet();
    await flush();
    press(tree, `compose-sentence-${S1}`);
    press(tree, `compose-sentence-${S2}`);
    press(tree, `compose-sentence-${S3}`);
    press(tree, 'compose-submit');
    await flush();
    setEntry({
      status: 'succeeded',
      lessonId: LESSON,
      progress: progress('done', {dropped_sentence_ids: [S3]}),
    });
    expect(textOf(tree, 'compose-dropped')).toBe(
      'Đã bỏ 1 câu không cùng tình huống.',
    );
    expect(getComposeEntry(REQUEST)?.seen).toBe(true);
    press(tree, 'compose-start');
    expect(onClose).toHaveBeenCalled();
    expect(onOpenLesson).toHaveBeenCalledWith(LESSON);
  });

  it('shows the AI reason, keeps the pick and says the try was charged', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {kind: 'queued', requestId: REQUEST},
    });
    const {tree} = renderSheet();
    await flush();
    press(tree, `compose-sentence-${S1}`);
    press(tree, `compose-sentence-${S2}`);
    press(tree, 'compose-submit');
    await flush();
    setEntry({
      status: 'failed',
      error: {code: 'COMPOSE_NOT_SUITABLE', retryable: false},
      progress: progress('writing', {
        quota_charged: true,
        reason_vi: 'Đây là lời bài hát.',
        suggestion_vi: 'Hãy chọn một đoạn hội thoại.',
      }),
    });
    expect(textOf(tree, 'compose-failed-message')).toBe(
      'Đây là lời bài hát. Hãy chọn một đoạn hội thoại.',
    );
    expect(textOf(tree, 'compose-charged')).toBe('Lượt này đã được tính.');
    expect(has(tree, 'compose-retry')).toBe(false);
    press(tree, 'compose-repick');
    await flush();
    expect(textOf(tree, 'compose-picked-count')).toBe('Đã chọn 2/8');
  });

  it('offers a free retry after a timeout', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {kind: 'queued', requestId: REQUEST},
    });
    const {tree} = renderSheet();
    await flush();
    press(tree, `compose-sentence-${S1}`);
    press(tree, `compose-sentence-${S2}`);
    press(tree, 'compose-submit');
    await flush();
    setEntry({
      status: 'failed',
      error: {code: 'COMPOSE_TIMEOUT', retryable: true},
      progress: progress('writing'),
    });
    expect(textOf(tree, 'compose-charged')).toBe('Lượt này không bị tính.');
    expect(has(tree, 'compose-retry')).toBe(true);
  });

  it('turns the button off without quota, offline, and maps refusals', async () => {
    mockedQuota.mockResolvedValue(quota(0));
    const {tree} = renderSheet();
    await flush();
    expect(textOf(tree, 'compose-quota')).toBe(
      'Hôm nay bạn đã tạo đủ bài 6 bước. Mai thử lại nhé.',
    );
    press(tree, `compose-sentence-${S1}`);
    press(tree, `compose-sentence-${S2}`);
    const submit = tree.root.findAll(
      node =>
        node.props.testID === 'compose-submit' &&
        node.props.disabled !== undefined,
    )[0];
    expect(submit?.props.disabled).toBe(true);

    mockedQuota.mockResolvedValue(quota(1));
    mockedSubmit.mockResolvedValue({
      ok: false,
      kind: 'server-error',
      errorCode: 'COMPOSE_LIMIT_REACHED',
      message: 'limit',
      retryable: true,
      details: {limit: 1},
    });
    const second = renderSheet();
    await flush();
    press(second.tree, `compose-sentence-${S1}`);
    press(second.tree, `compose-sentence-${S2}`);
    press(second.tree, 'compose-submit');
    await flush();
    expect(textOf(second.tree, 'compose-refused')).toBe(
      'Hôm nay bạn đã dùng hết 1 lượt. Lượt mới có lúc 0:00.',
    );

    const offline = renderSheet(true);
    await flush();
    expect(has(offline.tree, 'compose-offline')).toBe(true);
  });

  it('answers a cached pick with the lesson already made', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {kind: 'cached', lessonId: LESSON},
    });
    const {tree, onOpenLesson} = renderSheet();
    await flush();
    press(tree, `compose-sentence-${S1}`);
    press(tree, `compose-sentence-${S2}`);
    press(tree, 'compose-submit');
    await flush();
    press(tree, 'compose-open-cached');
    expect(onOpenLesson).toHaveBeenCalledWith(LESSON);
    expect(getComposeEntry(REQUEST)).toBeNull();
  });
});
