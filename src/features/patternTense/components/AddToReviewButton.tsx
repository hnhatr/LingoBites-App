import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {StickerButton} from '@ui/components/StickerButton';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {addToReview} from '../logic/addToReview';
import {memoryOf} from '../logic/libraryRepository';

type Status = 'idle' | 'busy' | 'added' | 'offline' | 'failed';

type Props = {
  itemCode: string;
  /**
   * `outline` (default): an outline button, then a line of text once added.
   * `sticker`: a white sticker button for a pinned bottom bar, then a mint
   * "Đang ôn" face in the same place once added.
   */
  look?: 'outline' | 'sticker';
};

/** "Thêm vào ôn": puts one pattern or tense on the review schedule. */
export function AddToReviewButton({itemCode, look = 'outline'}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [status, setStatus] = useState<Status>(() =>
    memoryOf(itemCode) ? 'added' : 'idle',
  );
  const sticker = look === 'sticker';

  if (status === 'added') {
    return sticker ? (
      <View accessible style={styles.added} testID="add-to-review-done">
        <MaterialIcon
          color={theme.colors.primary}
          name="check_circle"
          size={20}
        />
        <AppText style={styles.addedText}>
          {t('patternTense.in_review_short')}
        </AppText>
      </View>
    ) : (
      <AppText color="secondary" testID="add-to-review-done">
        {t('patternTense.in_review')}
      </AppText>
    );
  }
  const add = async () => {
    setStatus('busy');
    const result = await addToReview(itemCode);
    setStatus(result.ok ? 'added' : result.offline ? 'offline' : 'failed');
  };
  const error =
    status === 'offline' || status === 'failed' ? (
      <AppText
        color="danger"
        style={sticker ? styles.stickerError : null}
        testID="add-to-review-error"
      >
        {t(
          status === 'offline'
            ? 'patternTense.needs_network'
            : 'patternTense.add_failed',
        )}
      </AppText>
    ) : null;
  return sticker ? (
    <>
      {error}
      <StickerButton
        disabled={status === 'busy'}
        icon="add"
        label={t('patternTense.add_to_review')}
        onPress={add}
        testID="add-to-review"
        tone="ghost"
      />
    </>
  ) : (
    <>
      <AppButton
        iconLeft="add"
        loading={status === 'busy'}
        onPress={add}
        testID="add-to-review"
        title={t('patternTense.add_to_review')}
        variant="outline"
      />
      {error}
    </>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    added: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 20,
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
      minHeight: 56,
      paddingHorizontal: theme.spacing.lg,
      ...getStickerEdge(4, withAlpha(theme.colors.primary, 0.2)),
    },
    addedText: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    stickerError: {
      textAlign: 'center',
    },
  });
}
