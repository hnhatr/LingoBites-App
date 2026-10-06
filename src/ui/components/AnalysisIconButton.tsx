import React from 'react';

import {IconButton} from './IconButton';

type Props = {
  /** True once an analysis exists for the item: the button turns accent. */
  analyzed?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  size?: number;
  testID?: string;
};

/**
 * Icon-only "analyze / view analysis" action shared by every sentence card.
 * The label stays on the accessibility props so screen readers still announce it.
 */
export function AnalysisIconButton({
  analyzed = false,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  size = 40,
  testID,
}: Props) {
  return (
    <IconButton
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      icon="auto_awesome"
      onPress={onPress}
      size={size}
      testID={testID}
      tone={analyzed ? 'accent' : 'ghost'}
    />
  );
}
