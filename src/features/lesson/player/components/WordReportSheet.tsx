import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme';

import {
  ITEM_REPORT_REASONS,
  type ItemReportReason,
  reportLessonItem,
} from '../logic/itemReport';

export type ReportableItem = {code: string; text: string; meaning_vi: string};

type Phase =
  | {type: 'pick'}
  | {type: 'reason'; item: ReportableItem}
  | {type: 'sending'; item: ReportableItem}
  | {type: 'done'}
  | {type: 'failed'; item: ReportableItem};

/**
 * E6 (R1): pick a word of a photo lesson and say why it looks wrong. Only the
 * word code and the reason are sent; the photo is not.
 */
export function WordReportSheet({
  visible,
  lessonId,
  items,
  onClose,
}: {
  visible: boolean;
  lessonId: string;
  items: ReportableItem[];
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const [phase, setPhase] = useState<Phase>({type: 'pick'});

  const close = () => {
    setPhase({type: 'pick'});
    onClose();
  };

  const submit = async (item: ReportableItem, reason: ItemReportReason) => {
    setPhase({type: 'sending', item});
    const result = await reportLessonItem(lessonId, item.code, reason);
    setPhase(result.ok ? {type: 'done'} : {type: 'failed', item});
  };

  const optionStyle = {
    borderColor: theme.colors.accentSoft,
    borderRadius: 14,
    borderWidth: 2,
    padding: theme.spacing.md,
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      transparent
      visible={visible}
    >
      <View style={[styles.backdrop, {backgroundColor: theme.colors.overlay}]}>
        <View
          style={[styles.sheet, {backgroundColor: theme.colors.background}]}
        >
          <AppText variant="h3">{t('moment.report_word_title')}</AppText>

          {phase.type === 'pick' ? (
            <ScrollView>
              <AppText color="secondary" variant="body">
                {t('moment.report_word_pick')}
              </AppText>
              {items.map(item => (
                <Pressable
                  accessibilityRole="button"
                  key={item.code}
                  onPress={() => setPhase({type: 'reason', item})}
                  style={[optionStyle, styles.row]}
                  testID={`word-report-item-${item.code}`}
                >
                  <AppText variant="body">{item.text}</AppText>
                  <AppText color="secondary" variant="caption">
                    {item.meaning_vi}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {phase.type === 'reason' ? (
            <View style={styles.stack}>
              <AppText variant="body">
                {`${phase.item.text} — ${t('moment.report_word_reason')}`}
              </AppText>
              {ITEM_REPORT_REASONS.map(reason => (
                <Pressable
                  accessibilityRole="button"
                  key={reason}
                  onPress={() => {
                    submit(phase.item, reason);
                  }}
                  style={[optionStyle, styles.row]}
                  testID={`word-report-reason-${reason}`}
                >
                  <AppText variant="body">
                    {t(`moment.report_reason_${reason}`)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}

          {phase.type === 'sending' ? (
            <AppText color="secondary" variant="body">
              …
            </AppText>
          ) : null}

          {phase.type === 'done' ? (
            <AppText variant="body">{t('moment.report_word_done')}</AppText>
          ) : null}

          {phase.type === 'failed' ? (
            <View style={styles.stack}>
              <AppText color="secondary" variant="body">
                {t('moment.report_word_failed')}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPhase({type: 'reason', item: phase.item})}
              >
                <AppText color="primary" style={styles.link}>
                  {t('common.retry')}
                </AppText>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={close}
            style={styles.close}
            testID="word-report-close"
          >
            <AppText color="primary" style={styles.link}>
              {t('moment.report_word_close')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, justifyContent: 'flex-end'},
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
    maxHeight: '75%',
    padding: 20,
  },
  row: {gap: 4},
  stack: {gap: 10},
  close: {alignSelf: 'flex-end', paddingVertical: 8},
  link: {fontWeight: '600'},
});
