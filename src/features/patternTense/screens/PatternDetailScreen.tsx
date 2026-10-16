import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {SpeechNotice, useSpeak} from '@features/audio';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {StickerButton} from '@ui/components/StickerButton';
import {StickerFooter} from '@ui/components/StickerFooter';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';
import {levelTone} from '@ui/theme/levelColors';

import {readCatalogItems} from '@core/db/catalogItems';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {AddToReviewButton} from '../components/AddToReviewButton';
import {type FramePart, frameParts} from '../logic/frameText';
import {functionLabels} from '../logic/libraryModel';
import {readPatternLibrary} from '../logic/libraryRepository';
import type {PatternDetailRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: PatternDetailRouteParams};
  /** Tests pass the item; the screen reads the device otherwise. */
  item?: CatalogItem | null;
  /** Tests pass the labels (level, functions); read from the kept library otherwise. */
  labels?: string[];
};

function readItem(code: string): CatalogItem | null {
  try {
    return readCatalogItems([code]).get(code) ?? null;
  } catch {
    return null;
  }
}

function readLabels(code: string): string[] {
  try {
    const library = readPatternLibrary();
    const pattern = library?.patterns.find(entry => entry.item.code === code);
    if (!library || !pattern) return [];
    return [
      pattern.cefrLevel,
      ...functionLabels(pattern, library.functions),
    ].filter((label): label is string => Boolean(label));
  } catch {
    return [];
  }
}

const CEFR = /^[ABC][12]$/;

/**
 * Vocab path P6 (F2): one pattern of the library, drawn like the lesson's
 * "Mẫu câu" card: the frame with its slots on yellow, tap a slot to pick a
 * value and hear the sentence it builds, the note, then the examples. "Luyện
 * câu tổ hợp" and "Thêm vào ôn" stay pinned at the bottom. Read from the
 * device, so it opens offline. The picked values are never stored.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function PatternDetailScreen({navigation, route, item, labels}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useAppNavigation();
  const {speak, notice} = useSpeak();
  const code = route?.params.itemCode ?? '';
  const pattern = item === undefined ? readItem(code) : item;
  const tags = labels ?? readLabels(code);
  const level = tags.find(tag => CEFR.test(tag)) ?? null;
  const functions = tags.filter(tag => tag !== level);
  const parts = useMemo(() => (pattern ? frameParts(pattern) : []), [pattern]);
  const slots = parts.filter(
    (part): part is Extract<FramePart, {type: 'slot'}> => part.type === 'slot',
  );
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [openSlot, setOpenSlot] = useState<string | null>(
    slots[0]?.name ?? null,
  );
  const [examplesOpen, setExamplesOpen] = useState(true);

  const valueOf = (slot: Extract<FramePart, {type: 'slot'}>) =>
    slot.values.length > 0
      ? slot.values[(picks[slot.name] ?? 0) % slot.values.length]!
      : `[${slot.labelVi}]`;
  const sentence = parts
    .map(part => (part.type === 'text' ? part.value : valueOf(part)))
    .join('');
  const open = slots.find(slot => slot.name === openSlot) ?? null;

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('patternTense.pattern_title')}
      />
      {pattern ? (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            testID="pattern-detail"
          >
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <AppText style={styles.kicker}>
                  {t('patternTense.pattern_kicker')}
                </AppText>
                {level ? (
                  <View
                    style={[
                      styles.level,
                      {backgroundColor: levelTone(theme, level).soft},
                    ]}
                  >
                    <AppText style={styles.levelText}>{level}</AppText>
                  </View>
                ) : null}
              </View>
              {functions.length > 0 ? (
                <AppText color="muted" variant="caption">
                  {functions.join(' · ')}
                </AppText>
              ) : null}

              <View style={styles.frame}>
                {parts.map((part, index) => {
                  if (part.type === 'text') {
                    const text = part.value.trim();
                    return text ? (
                      <AppText key={`t${index}`} style={styles.frameText}>
                        {text}
                      </AppText>
                    ) : null;
                  }
                  const on = openSlot === part.name;
                  return (
                    <Pressable
                      accessibilityHint={
                        part.values.length > 0
                          ? t('patternTense.slot_hint')
                          : undefined
                      }
                      accessibilityLabel={t('patternTense.slot_a11y', {
                        label: part.labelVi,
                        value: valueOf(part),
                      })}
                      accessibilityRole="button"
                      accessibilityState={{selected: on}}
                      key={`s${index}`}
                      onPress={() => setOpenSlot(part.name)}
                      style={[styles.slot, on ? styles.slotOn : null]}
                      testID={`pattern-slot-${part.name}`}
                    >
                      <AppText style={styles.slotValue}>
                        {part.values.length > 0 ? valueOf(part) : part.labelVi}
                      </AppText>
                      {part.values.length > 0 ? (
                        <AppText style={styles.slotLabel}>
                          {part.labelVi}
                        </AppText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {open && open.values.length > 0 ? (
                <View style={styles.choices} testID="pattern-choices">
                  {open.values.map((value, index) => {
                    const selected = valueOf(open) === value;
                    return (
                      <Pressable
                        accessibilityHint={t('patternTense.choice_hint')}
                        accessibilityLabel={value}
                        accessibilityRole="button"
                        accessibilityState={{selected}}
                        key={`${index}-${value}`}
                        onPress={() =>
                          setPicks(previous => ({
                            ...previous,
                            [open.name]: index,
                          }))
                        }
                        style={[
                          styles.choice,
                          selected ? styles.choiceOn : null,
                        ]}
                        testID={`pattern-choice-${open.name}-${index}`}
                      >
                        <AppText
                          style={[
                            styles.choiceText,
                            selected ? styles.choiceTextOn : null,
                          ]}
                        >
                          {value}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.built}>
                <View style={styles.flex}>
                  <AppText style={styles.builtText} testID="pattern-sentence">
                    {sentence}
                  </AppText>
                  <AppText color="secondary">{pattern.meaning_vi}</AppText>
                </View>
                <ActionIconButton
                  accessibilityHint={t('patternTense.speak_hint')}
                  accessibilityLabel={t('patternTense.speak', {
                    text: sentence,
                  })}
                  icon="volume_up"
                  onPress={() => speak(sentence)}
                  testID="pattern-speak"
                  tone="mint"
                />
              </View>

              {pattern.note_vi ? (
                <View style={styles.tip}>
                  <MaterialIcon
                    color={theme.colors.onTertiaryContainer}
                    name="lightbulb"
                    size={20}
                  />
                  <AppText style={styles.flex}>{pattern.note_vi}</AppText>
                </View>
              ) : null}
            </View>

            <SpeechNotice notice={notice} />

            {pattern.examples.length > 0 ? (
              <View style={styles.fold} testID="pattern-examples">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{expanded: examplesOpen}}
                  onPress={() => setExamplesOpen(value => !value)}
                  style={styles.foldHead}
                  testID="pattern-examples-toggle"
                >
                  <View style={styles.medal}>
                    <MaterialIcon
                      color={theme.colors.onTertiaryContainer}
                      name="menu_book"
                      size={17}
                    />
                  </View>
                  <AppText style={styles.foldTitle}>
                    {t('patternTense.examples')}
                  </AppText>
                  <View style={styles.count}>
                    <AppText style={styles.countText}>
                      {pattern.examples.length}
                    </AppText>
                  </View>
                  <MaterialIcon
                    color={theme.colors.text.muted}
                    name={examplesOpen ? 'chevron_left' : 'chevron_right'}
                    size={18}
                  />
                </Pressable>
                {examplesOpen ? (
                  <View style={styles.foldBody}>
                    {pattern.examples.map((example, index) => (
                      <View key={index} style={styles.example}>
                        <View style={[styles.flex, styles.exampleText]}>
                          <AppText variant="bodyLg">{example.text_en}</AppText>
                          <AppText color="secondary">{example.text_vi}</AppText>
                        </View>
                        <ActionIconButton
                          accessibilityHint={t('patternTense.speak_hint')}
                          accessibilityLabel={t('patternTense.speak', {
                            text: example.text_en,
                          })}
                          icon="volume_up"
                          onPress={() => speak(example.text_en)}
                          testID={`pattern-example-speak-${index}`}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
          <StickerFooter>
            <StickerButton
              icon="play_arrow"
              label={t('patternTense.practise_combo')}
              onPress={() => appNavigation.openComboSetup(pattern.code)}
              testID="pattern-practise"
            />
            <AddToReviewButton itemCode={pattern.code} look="sticker" />
          </StickerFooter>
        </>
      ) : (
        <AppText color="secondary" style={styles.missing}>
          {t('patternTense.not_on_device')}
        </AppText>
      )}
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    built: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      paddingLeft: 14,
      paddingRight: 12,
      paddingVertical: 12,
    },
    builtText: {
      color: theme.colors.text.primary,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 23,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 26,
      gap: 12,
      padding: theme.spacing.md,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    cardTop: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    choice: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 12,
    },
    choiceOn: {
      backgroundColor: theme.colors.tertiarySoft,
      borderColor: HERO_PALETTE.sun,
    },
    choiceText: {
      color: theme.colors.text.secondary,
      fontSize: 14,
      fontWeight: '600',
    },
    choiceTextOn: {
      color: theme.colors.onTertiaryContainer,
      fontWeight: '700',
    },
    choices: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    content: {
      gap: 14,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.xs,
    },
    count: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      justifyContent: 'center',
      minWidth: 24,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    countText: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
    example: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    exampleText: {
      borderLeftColor: HERO_PALETTE.sun,
      borderLeftWidth: 3,
      gap: 2,
      paddingLeft: 10,
    },
    flex: {
      flex: 1,
    },
    fold: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    foldBody: {
      gap: 12,
      paddingBottom: 14,
      paddingHorizontal: 14,
    },
    foldHead: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      minHeight: 56,
      paddingHorizontal: 14,
    },
    foldTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
    },
    frame: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    frameText: {
      color: theme.colors.text.primary,
      fontSize: 21,
      fontWeight: '800',
      lineHeight: 28,
    },
    kicker: {
      color: theme.colors.onTertiaryContainer,
      flex: 1,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    level: {
      borderRadius: theme.radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 2,
    },
    levelText: {
      color: theme.colors.text.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    medal: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 10,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    missing: {
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      textAlign: 'center',
    },
    slot: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderColor: HERO_PALETTE.sun,
      borderRadius: 12,
      borderWidth: 2,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 9,
      paddingVertical: 2,
    },
    slotLabel: {
      color: theme.colors.onTertiaryContainer,
      fontSize: 10.5,
      fontWeight: '700',
    },
    slotOn: {
      backgroundColor: HERO_PALETTE.sun,
      borderColor: HERO_PALETTE.sunShelf,
    },
    slotValue: {
      color: HERO_PALETTE.ink,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 24,
    },
    tip: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
  });
}
