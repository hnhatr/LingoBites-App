import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {TextField} from '@ui/components/TextField';
import {TileComposer} from '@ui/components/TileComposer';

export type FreeWritingEntryProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Lesson words offered in the suggestion strip. */
  vocabulary: readonly string[];
  testID: string;
};

/**
 * A free written answer (no model): the QWERTY tile keyboard by default,
 * with a switch to the phone keyboard for long answers (decided with the
 * user). The text is the same either way.
 */
export function FreeWritingEntry({
  value,
  onChangeText,
  vocabulary,
  testID,
}: FreeWritingEntryProps) {
  const {t} = useTranslation();
  const [systemKeyboard, setSystemKeyboard] = useState(false);
  return (
    <View>
      {systemKeyboard ? (
        <TextField
          accessibilityHint={t('lessonFlow.independent_write_hint')}
          accessibilityLabel={t('lessonFlow.answer_label')}
          multiline
          onChangeText={onChangeText}
          placeholder={t('lessonFlow.answer_placeholder')}
          testID={testID}
          value={value}
        />
      ) : (
        <TileComposer
          accessibilityHint={t('lessonFlow.independent_write_hint')}
          accessibilityLabel={t('lessonFlow.answer_label')}
          mode="keyboard"
          onChangeText={onChangeText}
          testID={testID}
          value={value}
          vocabulary={vocabulary}
        />
      )}
      <AppButton
        accessibilityHint={t(
          systemKeyboard
            ? 'tileComposer.use_tiles_hint'
            : 'tileComposer.use_system_keyboard_hint',
        )}
        onPress={() => setSystemKeyboard(on => !on)}
        testID={`${testID}-keyboard-switch`}
        title={t(
          systemKeyboard
            ? 'tileComposer.use_tiles'
            : 'tileComposer.use_system_keyboard',
        )}
        variant="ghost"
      />
    </View>
  );
}
