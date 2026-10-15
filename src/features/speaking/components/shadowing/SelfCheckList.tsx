import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {ShadowingSelfCheck} from '../../logic/shadowing/useShadowingSession';

export const SHADOWING_SELF_CHECK_ITEMS: {
  key: keyof ShadowingSelfCheck;
  label: string;
}[] = [
  {key: 'fullSentence', label: 'Nói hết câu'},
  {key: 'keyWords', label: 'Phát âm rõ từ chính'},
  {key: 'rhythm', label: 'Theo kịp nhịp'},
];

export type ShadowingComparePlayback = 'sample' | 'mine' | null;

export type SelfCheckListProps = {
  values: ShadowingSelfCheck;
  onToggle: (key: keyof ShadowingSelfCheck) => void;
  onPlaySample: () => void;
  onPlayMyTake: () => void;
  onReRecord: () => void;
  myTakeLabel: string;
  /** Which row is playing, and how far (0..1), to fill its wave. */
  playing?: ShadowingComparePlayback;
  playProgress?: number;
};

const COMPARE_BARS = 30;

/**
 * After a take: "Mẫu" and "Của bạn" rows to listen side by side, "Ghi lại",
 * then the three self-check items. The save button lives in the screen's
 * pinned footer.
 */
export function SelfCheckList({
  values,
  onToggle,
  onPlaySample,
  onPlayMyTake,
  onReRecord,
  myTakeLabel,
  playing = null,
  playProgress = 0,
}: SelfCheckListProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ticked = SHADOWING_SELF_CHECK_ITEMS.filter(
    item => values[item.key],
  ).length;

  return (
    <View style={styles.wrap} testID="shadowing-self-check">
      <AppCard>
        <View style={styles.compare}>
          <CompareRow
            active={playing === 'sample'}
            kind="sample"
            label="Mẫu"
            onPress={onPlaySample}
            progress={playing === 'sample' ? playProgress : 0}
            testID="shadowing-play-sample-compact"
          />
          <View style={styles.rowDivider} />
          <View style={styles.mineRow}>
            <View style={styles.flex1}>
              <CompareRow
                active={playing === 'mine'}
                duration={myTakeLabel}
                kind="mine"
                label="Của bạn"
                onPress={onPlayMyTake}
                progress={playing === 'mine' ? playProgress : 0}
                testID="shadowing-play-my-take"
              />
            </View>
            <Pressable
              accessibilityHint="Xóa bản ghi này và ghi câu lại"
              accessibilityLabel="Ghi lại"
              accessibilityRole="button"
              onPress={onReRecord}
              style={({pressed}) => [
                styles.again,
                pressed && {opacity: theme.states.pressedOpacity},
              ]}
              testID="shadowing-rerecord"
            >
              <MaterialIcon
                color={theme.colors.text.secondary}
                name="replay"
                size={17}
              />
              <AppText style={styles.againLabel}>Ghi lại</AppText>
            </Pressable>
          </View>
        </View>
      </AppCard>

      <View style={styles.checkHead}>
        <AppText style={styles.checkTitle}>Bạn thấy mình đã…</AppText>
        <AppText color="muted" style={styles.checkCount}>
          {`${ticked}/${SHADOWING_SELF_CHECK_ITEMS.length}`}
        </AppText>
      </View>
      {SHADOWING_SELF_CHECK_ITEMS.map(item => {
        const on = values[item.key];
        return (
          <Pressable
            accessibilityHint="Chạm để đánh dấu hoặc bỏ đánh dấu"
            accessibilityLabel={item.label}
            accessibilityRole="checkbox"
            accessibilityState={{checked: on}}
            key={item.key}
            onPress={() => onToggle(item.key)}
            style={({pressed}) => [
              styles.item,
              on ? styles.itemOn : styles.itemOff,
              pressed && styles.itemPressed,
            ]}
            testID={`shadowing-self-check-${item.key}`}
          >
            <View style={[styles.box, on && styles.boxOn]}>
              {on ? (
                <MaterialIcon
                  color={HERO_PALETTE.white}
                  name="check_circle"
                  size={16}
                />
              ) : null}
            </View>
            <AppText style={[styles.itemLabel, on && styles.itemLabelOn]}>
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type CompareRowProps = {
  kind: 'sample' | 'mine';
  label: string;
  duration?: string;
  active: boolean;
  progress: number;
  onPress: () => void;
  testID: string;
};

function CompareRow({
  kind,
  label,
  duration,
  active,
  progress,
  onPress,
  testID,
}: CompareRowProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sample = kind === 'sample';
  const lit = sample ? theme.colors.accent : HERO_PALETTE.coral;
  return (
    <View style={styles.compareRow}>
      <Pressable
        accessibilityHint="Phát lại để so sánh"
        accessibilityLabel={
          sample ? 'Nghe mẫu' : `Nghe bản của bạn ${duration ?? ''}`
        }
        accessibilityRole="button"
        accessibilityState={{busy: active}}
        onPress={onPress}
        style={({pressed}) => [
          styles.play,
          sample
            ? active
              ? styles.playSampleOn
              : styles.playSample
            : active
              ? styles.playMineOn
              : styles.playMine,
          pressed && styles.itemPressed,
        ]}
        testID={testID}
      >
        <MaterialIcon
          color={
            active
              ? HERO_PALETTE.white
              : sample
                ? theme.colors.primary
                : theme.colors.onSecondaryContainer
          }
          name="play_arrow"
          size={22}
        />
      </Pressable>
      <View style={styles.compareText}>
        <View style={styles.compareHead}>
          <AppText style={styles.compareLabel}>{label}</AppText>
          {duration ? (
            <AppText color="muted" style={styles.compareTime}>
              {duration}
            </AppText>
          ) : null}
        </View>
        <View style={styles.bars}>
          {Array.from({length: COMPARE_BARS}, (_, index) => (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  backgroundColor:
                    active && index / COMPARE_BARS < progress
                      ? lit
                      : theme.colors.surfaceHigh,
                  height: barHeight(index, sample ? 0 : 0.6),
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** A fixed, speech-like silhouette; the rows show no real waveform. */
function barHeight(index: number, phase: number): number {
  return (
    6 +
    Math.round(
      14 * Math.abs(Math.sin(index * 1.7 + phase) * Math.cos(index * 0.45)),
    )
  );
}

function makeStyles(theme: AppTheme) {
  const mintEdge = withAlpha(theme.colors.primaryContainer, 0.45);
  const coralEdge = withAlpha(HERO_PALETTE.coral, 0.4);
  return StyleSheet.create({
    wrap: {
      gap: theme.spacing.sm,
    },
    flex1: {
      flex: 1,
    },
    compare: {
      gap: theme.spacing.sm,
    },
    rowDivider: {
      backgroundColor: theme.colors.surfaceHigh,
      height: StyleSheet.hairlineWidth * 2,
    },
    mineRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    compareRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    play: {
      alignItems: 'center',
      borderRadius: 14,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    playSample: {
      backgroundColor: theme.colors.accentSoft,
      ...getStickerEdge(3, mintEdge),
    },
    playSampleOn: {
      backgroundColor: theme.colors.primary,
      ...getStickerEdge(3, theme.colors.primaryPressed),
    },
    playMine: {
      backgroundColor: theme.colors.secondarySoft,
      ...getStickerEdge(3, coralEdge),
    },
    playMineOn: {
      backgroundColor: HERO_PALETTE.coral,
      ...getStickerEdge(3, HERO_PALETTE.coralShelf),
    },
    compareText: {
      flex: 1,
      gap: 5,
      minWidth: 0,
    },
    compareHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    compareLabel: {
      fontSize: 14,
      fontWeight: '800',
    },
    compareTime: {
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      fontWeight: '600',
    },
    bars: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
      height: 20,
    },
    bar: {
      borderRadius: 2,
      flex: 1,
    },
    again: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 12,
    },
    againLabel: {
      color: theme.colors.text.secondary,
      fontSize: 13,
      fontWeight: '700',
    },
    checkHead: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.sm,
    },
    checkTitle: {
      fontSize: 15,
      fontWeight: '800',
    },
    checkCount: {
      fontSize: 12,
      fontWeight: '700',
    },
    item: {
      alignItems: 'center',
      borderRadius: 18,
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    itemOff: {
      backgroundColor: theme.colors.surface,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    itemOn: {
      backgroundColor: theme.colors.accentSoft,
      ...getStickerEdge(3, mintEdge),
    },
    itemPressed: {
      transform: [{translateY: 2}],
    },
    box: {
      alignItems: 'center',
      borderColor: theme.colors.outlineVariant,
      borderRadius: 9,
      borderWidth: 2,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    boxOn: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    itemLabel: {
      color: theme.colors.text.secondary,
      fontSize: 15,
      fontWeight: '700',
    },
    itemLabelOn: {
      color: theme.colors.primary,
    },
  });
}
