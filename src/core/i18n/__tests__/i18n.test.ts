import i18n from '../index';

describe('i18n', () => {
  it('uses Vietnamese as the default language', () => {
    expect(i18n.language).toBe('vi');
    expect(i18n.t('app.name')).toBe('LingoBites');
  });
});
