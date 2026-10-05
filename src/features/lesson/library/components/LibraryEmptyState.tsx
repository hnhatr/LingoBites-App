import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {Medallion} from '@ui/components/Medallion';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

export interface LibraryEmptyStateProps {
  type: 'lessons' | 'vocabulary' | 'grammar' | 'no-results';
}

const SAVE_HINT = 'Bấm ➕ trong bài học để lưu';

const EMPTY_STATE_CONFIG: Record<
  LibraryEmptyStateProps['type'],
  {icon: string; message: string; hint?: string}
> = {
  lessons: {icon: '📖', message: 'Chưa có bài học nào'},
  vocabulary: {icon: '📚', message: 'Chưa lưu từ vựng nào', hint: SAVE_HINT},
  grammar: {icon: '✏️', message: 'Chưa lưu ngữ pháp nào', hint: SAVE_HINT},
  'no-results': {icon: '🔍', message: 'Không tìm thấy kết quả'},
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
    },
    contentWrapper: {
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    message: {
      textAlign: 'center',
    },
  });
}

export function LibraryEmptyState({type}: LibraryEmptyStateProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const config = EMPTY_STATE_CONFIG[type];

  return (
    <View style={styles.container}>
      <View style={styles.contentWrapper}>
        <Medallion label={config.icon} />
        <AppText
          variant="body"
          color="secondary"
          style={styles.message}
          testID={`empty-state-message-${type}`}
        >
          {config.message}
        </AppText>
        {config.hint ? (
          <AppText
            variant="label"
            color="secondary"
            style={styles.message}
            testID={`empty-state-hint-${type}`}
          >
            {config.hint}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
