import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {LessonSentence} from '@core/schemas/lesson';

import {
  type SentenceSaveControl,
  useSavedVideoSentences,
} from '../useSavedVideoSentences';

const SENTENCE = {
  id: 's1',
  position: 0,
  text_en: 'Nice to meet you.',
  text_vi: 'Rất vui được gặp bạn.',
  ipa: 'naɪs tə miːt juː',
  start_ms: 0,
  end_ms: 1000,
} satisfies LessonSentence;

let latest: SentenceSaveControl;

function Probe({lessonId}: {lessonId: string}) {
  latest = useSavedVideoSentences(lessonId);
  return null;
}

async function mount(lessonId: string) {
  await act(async () => {
    ReactTestRenderer.create(<Probe lessonId={lessonId} />);
  });
}

async function storedList(): Promise<Array<Record<string, unknown>>> {
  return JSON.parse(
    (await AsyncStorage.getItem('combo_saved_sentences_v1')) ?? '[]',
  );
}

describe('useSavedVideoSentences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saves a sentence with its lesson into Câu đã lưu, then unsaves it', async () => {
    await mount('lesson-1');
    expect(latest.isSaved('s1')).toBe(false);

    await act(async () => {
      latest.toggle(SENTENCE);
    });
    expect(latest.isSaved('s1')).toBe(true);
    expect(latest.savedCount).toBe(1);
    expect(await storedList()).toEqual([
      expect.objectContaining({
        id: 'video:lesson-1:s1',
        lessonId: 'lesson-1',
        setId: '',
        textEn: 'Nice to meet you.',
        textVi: 'Rất vui được gặp bạn.',
      }),
    ]);

    await act(async () => {
      latest.toggle(SENTENCE);
    });
    expect(latest.isSaved('s1')).toBe(false);
    expect(await storedList()).toEqual([]);
  });

  it('counts only the sentences of its own lesson', async () => {
    await AsyncStorage.setItem(
      'combo_saved_sentences_v1',
      JSON.stringify([
        {
          id: 'video:lesson-2:s1',
          setId: '',
          itemCode: '',
          textEn: 'Hi.',
          textVi: 'Chào.',
          savedAt: '2026-10-15T08:00:00.000Z',
          lessonId: 'lesson-2',
        },
        {
          id: 'combo-1',
          setId: 'set-1',
          itemCode: 'word:play',
          textEn: 'I play.',
          textVi: 'Tôi chơi.',
          savedAt: '2026-10-15T08:00:00.000Z',
        },
      ]),
    );
    await mount('lesson-1');
    expect(latest.savedCount).toBe(0);
    expect(latest.isSaved('s1')).toBe(false);
  });
});
