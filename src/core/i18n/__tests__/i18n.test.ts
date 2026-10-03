import en from '../en.json';
import i18n from '../index';
import vi from '../vi.json';

const DISCLOSURE_KEYS = [
  'disclosure_title',
  'disclosure_body',
  'disclosure_confirm',
  'disclosure_cancel',
] as const;

const LESSON_COMPLETION_KEYS = [
  'complete_lesson',
  'complete_lesson_hint',
  'completed_label',
  'complete_error',
] as const;

const EXPECTED_LESSON_COMPLETION_COPY = {
  vi: {
    complete_lesson: 'Hoàn thành bài',
    completed_label: 'Đã hoàn thành',
    complete_error: 'Chưa lưu được, thử lại nhé.',
  },
  en: {
    complete_lesson: 'Mark lesson complete',
    completed_label: 'Completed',
    complete_error: 'Could not save. Please try again.',
  },
} as const;

const EXPECTED_DISCLOSURE_BODY = {
  vi: 'Phụ đề của video sẽ được gửi tới máy chủ và nhà cung cấp AI để dịch sang tiếng Việt và tạo phiên âm IPA. Chỉ tiếp tục khi bạn đồng ý.',
  en: "The video's subtitles will be sent to our server and AI providers to translate them into Vietnamese and generate IPA. Continue only if you agree.",
} as const;

describe('i18n', () => {
  it('uses Vietnamese as the default language', () => {
    expect(i18n.language).toBe('vi');
    expect(i18n.t('app.name')).toBe('LingoBites');
  });

  describe('youtube.disclosure (LING-191 AC-006)', () => {
    it('defines all disclosure keys in vi and en with non-empty values', () => {
      for (const key of DISCLOSURE_KEYS) {
        expect(vi.youtube[key]?.length).toBeGreaterThan(0);
        expect(en.youtube[key]?.length).toBeGreaterThan(0);
      }
    });

    it('uses the approved disclosure_body copy in each locale', () => {
      expect(vi.youtube.disclosure_body).toBe(EXPECTED_DISCLOSURE_BODY.vi);
      expect(en.youtube.disclosure_body).toBe(EXPECTED_DISCLOSURE_BODY.en);
    });
  });

  describe('lessonPlayer completion (LING-222 FR-008)', () => {
    it('defines all completion keys in vi and en with non-empty values', () => {
      for (const key of LESSON_COMPLETION_KEYS) {
        expect(vi.lessonPlayer[key]?.length).toBeGreaterThan(0);
        expect(en.lessonPlayer[key]?.length).toBeGreaterThan(0);
      }
    });

    it('uses the approved hub completion copy in each locale', () => {
      for (const key of [
        'complete_lesson',
        'completed_label',
        'complete_error',
      ] as const) {
        expect(vi.lessonPlayer[key]).toBe(EXPECTED_LESSON_COMPLETION_COPY.vi[key]);
        expect(en.lessonPlayer[key]).toBe(EXPECTED_LESSON_COMPLETION_COPY.en[key]);
      }
    });
  });
});
