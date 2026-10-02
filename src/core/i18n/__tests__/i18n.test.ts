import en from '../en.json';
import i18n from '../index';
import vi from '../vi.json';

const DISCLOSURE_KEYS = [
  'disclosure_title',
  'disclosure_body',
  'disclosure_confirm',
  'disclosure_cancel',
] as const;

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
});
