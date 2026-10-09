import React from 'react';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';

type Option<T extends string | number> = {value: T; label: string};

type Props<T extends string | number> = {
  title: string;
  hint?: string;
  options: ReadonlyArray<Option<T>>;
  selected: readonly T[];
  onToggle: (value: T) => void;
  testID?: string;
};

/** A titled group of choice chips (single or multiple choice). */
export function OptionChips<T extends string | number>({
  title,
  hint,
  options,
  selected,
  onToggle,
  testID,
}: Props<T>) {
  return (
    <View style={styles.group} testID={testID}>
      <AppText variant="h3">{title}</AppText>
      {hint ? <AppText color="secondary">{hint}</AppText> : null}
      <View style={styles.chips}>
        {options.map(option => (
          <Chip
            key={String(option.value)}
            label={option.label}
            onPress={() => onToggle(option.value)}
            selected={selected.includes(option.value)}
            testID={`${testID ?? 'option'}-${option.value}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  group: {
    gap: 8,
  },
});
