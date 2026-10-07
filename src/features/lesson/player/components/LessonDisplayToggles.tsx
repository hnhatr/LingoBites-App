import React from 'react';
import {useTranslation} from 'react-i18next';

import {HeaderIconButton} from '@ui/components/HeaderIconButton';

export type LessonDisplayTogglesProps = {
  showTranslation: boolean;
  showIpa: boolean;
  onToggleTranslation: () => void;
  onToggleIpa: () => void;
};

/** Translate / IPA toggles, rendered as standard screen-header buttons. */
export function LessonDisplayToggles({
  showTranslation,
  showIpa,
  onToggleTranslation,
  onToggleIpa,
}: LessonDisplayTogglesProps) {
  const {t} = useTranslation();

  return (
    <>
      <HeaderIconButton
        accessibilityHint={t('youtube.translation_toggle_hint')}
        accessibilityLabel={
          showTranslation
            ? t('youtube.translation_hide_a11y')
            : t('youtube.translation_show_a11y')
        }
        icon="translate"
        onPress={onToggleTranslation}
        selected={showTranslation}
        testID="youtube-toggle-translation"
      />
      <HeaderIconButton
        accessibilityLabel={
          showIpa ? t('youtube.ipa_hide_a11y') : t('youtube.ipa_show_a11y')
        }
        label="IPA"
        onPress={onToggleIpa}
        selected={showIpa}
        testID="youtube-toggle-ipa"
      />
    </>
  );
}
