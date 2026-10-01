import React from 'react';
import {Text, View} from 'react-native';

import {useAppTheme} from '@ui/theme';

import type {LessonBlock} from '@core/schemas/lesson';

import {blockBaseStyles} from '../logic/blockStyles';

function blockTestId(type: string): string {
  return `canonical-block-${type}`;
}

/**
 * Canonical lesson-level block renderer (7 kept types; `exercise` was
 * removed by FR-014). Unknown types render the unsupported fallback instead
 * of crashing the player.
 */
export function CanonicalBlockView({block}: {block: LessonBlock}) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  const data = block.data as Record<string, unknown>;
  const textOf = (value: unknown): string =>
    typeof value === 'string' ? value : '';
  switch (block.type) {
    case 'text':
    case 'example':
    case 'context':
      return (
        <View testID={blockTestId(block.type)} style={styles.container}>
          {block.title ? (
            <Text
              testID={`${blockTestId(block.type)}-title`}
              style={styles.title}
            >
              {block.title}
            </Text>
          ) : null}
          <Text
            testID={`${blockTestId(block.type)}-content`}
            style={styles.body}
          >
            {textOf(data.content ?? data.text ?? data.body)}
          </Text>
        </View>
      );
    case 'vocabulary':
    case 'grammar':
    case 'activity':
    case 'media':
      return (
        <View testID={blockTestId(block.type)} style={styles.container}>
          {block.title ? (
            <Text
              testID={`${blockTestId(block.type)}-title`}
              style={styles.title}
            >
              {block.title}
            </Text>
          ) : null}
          <Text
            testID={`${blockTestId(block.type)}-content`}
            style={styles.secondary}
          >
            {textOf(
              data.nameEn ??
                data.name ??
                data.description ??
                data.content ??
                data.url ??
                data.caption ??
                JSON.stringify(data),
            )}
          </Text>
        </View>
      );
    default:
      return (
        <View testID="canonical-block-unsupported" style={styles.fallbackBox}>
          <Text style={styles.fallbackText}>
            This block type is not supported in this app version.
          </Text>
        </View>
      );
  }
}
