import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance, withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {useOptionalAppNavigation} from '@core/navigation';

import {
  type CapabilityProgressReport,
  useProgressReport,
} from '../logic/useProgressReport';
import type {ProfileStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProgressReport'>;

export type ProgressReportScreenProps = Props;

type Tone = 'teal' | 'gold' | 'coral';

const NOT_ENOUGH_DATA = 'Chưa đủ dữ liệu';

function hasAnyMetric(report: CapabilityProgressReport): boolean {
  return (
    report.sentencesSpokenWithoutLookingCount > 0 ||
    report.averageStartToAnswerMs !== null ||
    report.firstListenComprehensionRate !== null ||
    report.retention7DayRate !== null ||
    report.retention30DayRate !== null ||
    report.passedSituationsCount > 0 ||
    report.beforeAfterRecordings.earliest !== null
  );
}

function formatRecordingDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function ProgressReportScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const feedClearance = useFloatingTabBarClearance();
  const appNavigation = useOptionalAppNavigation();
  const {
    getCapabilityProgressReport,
    exportPrivacySafeMetrics,
    formatPercentage,
  } = useProgressReport();
  const [report, setReport] = useState<CapabilityProgressReport>(() =>
    getCapabilityProgressReport(),
  );
  const [exportJson, setExportJson] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setReport(getCapabilityProgressReport());
    }, [getCapabilityProgressReport]),
  );

  function handleExportMetrics() {
    const data = exportPrivacySafeMetrics();
    const jsonStr = JSON.stringify(data, null, 2);
    setExportJson(jsonStr);
    Alert.alert(
      'Xuất chỉ số học tập',
      'Chỉ số đã được xuất dạng JSON ẩn danh (không chứa văn bản, âm thanh hay đường dẫn tệp).',
    );
  }

  const {earliest, latest} = report.beforeAfterRecordings;
  const recordingCount =
    earliest && latest && earliest.id !== latest.id ? 2 : 1;
  const startSeconds =
    report.averageStartToAnswerMs === null
      ? null
      : (report.averageStartToAnswerMs / 1000).toFixed(1).replace('.', ',');

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title="Báo cáo tiến độ & Năng lực"
      />

      <ScrollView
        contentContainerStyle={[styles.content, {paddingBottom: feedClearance}]}
        showsVerticalScrollIndicator={false}
      >
        {!hasAnyMetric(report) ? (
          <View style={styles.empty} testID="progress-report-empty">
            <View style={styles.emptyIcon}>
              <MaterialIcon
                color={theme.colors.onTertiaryContainer}
                name="auto_awesome"
                size={22}
              />
            </View>
            <View style={styles.flexCopy}>
              <AppText style={styles.emptyTitle}>
                Chỉ số sẽ hiện dần khi bạn học
              </AppText>
              <AppText color="secondary" style={styles.emptyBody}>
                Luyện nói, nghe và ôn thẻ vài ngày để mở khóa từng chỉ số bên
                dưới.
              </AppText>
              {appNavigation ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => appNavigation.openToday()}
                  testID="progress-report-study"
                >
                  <AppText style={styles.emptyLink}>Học hôm nay</AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <SectionLabel styles={styles} title="Nói & phản xạ" />
        <View style={styles.grid}>
          <MetricTile
            description="Câu bạn nói được mà không cần nhìn văn bản."
            icon="record_voice_over"
            styles={styles}
            title="Nói không nhìn chữ"
            tone="teal"
            unit="câu"
            value={
              report.sentencesSpokenWithoutLookingCount > 0
                ? String(report.sentencesSpokenWithoutLookingCount)
                : null
            }
          />
          <MetricTile
            description="Trung bình từ lúc nghe câu hỏi tới lúc bắt đầu trả lời."
            icon="timer"
            styles={styles}
            title="Thời gian bắt đầu nói"
            tone="gold"
            unit="giây"
            value={startSeconds}
          />
        </View>

        <SectionLabel styles={styles} title="Nghe & ghi nhớ" />
        <AppCard>
          <View style={styles.metric}>
            <MetricHead
              icon="hearing"
              styles={styles}
              title="Hiểu ngay lần nghe đầu"
              tone="coral"
            />
            {report.firstListenComprehensionRate === null ? (
              <>
                <NotEnoughData styles={styles} />
                <AppText color="muted" style={styles.description}>
                  Tỷ lệ trả lời đúng mà không cần nghe lại.
                </AppText>
              </>
            ) : (
              <View style={styles.ringRow}>
                <Ring
                  color={theme.colors.secondaryContainer}
                  rate={report.firstListenComprehensionRate}
                  track={theme.colors.surfaceHigh}
                />
                <View style={styles.flexCopy}>
                  <MetricValue
                    styles={styles}
                    tone="coral"
                    unit="%"
                    value={String(
                      Math.round(report.firstListenComprehensionRate),
                    )}
                  />
                  <AppText color="muted" style={styles.description}>
                    Câu trả lời đúng mà không cần nghe lại.
                  </AppText>
                </View>
              </View>
            )}
          </View>
        </AppCard>
        <AppCard>
          <View style={styles.metric}>
            <MetricHead
              icon="psychology"
              styles={styles}
              title="Ghi nhớ thẻ ôn"
              tone="teal"
            />
            <RetentionBar
              label="7 ngày"
              rate={report.retention7DayRate}
              styles={styles}
              text={formatPercentage(report.retention7DayRate)}
            />
            <RetentionBar
              label="30 ngày"
              rate={report.retention30DayRate}
              styles={styles}
              text={formatPercentage(report.retention30DayRate)}
            />
            <AppText color="muted" style={styles.description}>
              Tỷ lệ thẻ bạn nhớ đúng khi đến lịch ôn.
            </AppText>
          </View>
        </AppCard>

        <SectionLabel styles={styles} title="Tình huống & ghi âm" />
        <View style={styles.grid}>
          <MetricTile
            description="Bài kiểm tra tình huống theo tuần và giai đoạn đã đạt."
            icon="emoji_events"
            styles={styles}
            title="Tình huống đã đạt"
            tone="gold"
            unit="tình huống"
            value={
              report.passedSituationsCount > 0
                ? String(report.passedSituationsCount)
                : null
            }
          />
          <MetricTile
            description="So phát âm và phản xạ qua thời gian."
            icon="compare"
            styles={styles}
            title="Ghi âm trước & sau"
            tone="coral"
            unit="bản"
            value={earliest && latest ? String(recordingCount) : null}
          />
        </View>
        {earliest && latest ? (
          <View style={styles.grid}>
            <RecordingChip
              label="Bản đầu"
              meta={`${formatRecordingDate(earliest.createdAt)} · ${Math.round(
                earliest.durationMs / 1000,
              )} giây`}
              styles={styles}
            />
            <RecordingChip
              label="Mới nhất"
              meta={`${formatRecordingDate(latest.createdAt)} · ${Math.round(
                latest.durationMs / 1000,
              )} giây`}
              styles={styles}
            />
          </View>
        ) : null}

        <Pressable
          accessibilityHint="Tạo bản JSON ẩn danh của các chỉ số"
          accessibilityLabel="Xuất dữ liệu chỉ số học tập"
          accessibilityRole="button"
          onPress={handleExportMetrics}
          style={({pressed}) => [styles.export, pressed && styles.pressed]}
          testID="progress-report-export"
        >
          <MaterialIcon color={theme.colors.primary} name="share" size={18} />
          <AppText style={styles.exportLabel}>
            Xuất chỉ số (JSON ẩn danh)
          </AppText>
        </Pressable>

        {exportJson ? (
          <AppCard>
            <View style={styles.metric}>
              <AppText style={styles.metricTitle}>Chỉ số đã xuất</AppText>
              <View style={styles.code}>
                <AppText style={styles.codeText}>{exportJson}</AppText>
              </View>
            </View>
          </AppCard>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function toneColors(theme: AppTheme, tone: Tone) {
  switch (tone) {
    case 'gold':
      return {bg: theme.colors.tertiarySoft, fg: theme.colors.tertiary};
    case 'coral':
      return {bg: theme.colors.secondarySoft, fg: theme.colors.secondary};
    default:
      return {bg: theme.colors.accentSoft, fg: theme.colors.primary};
  }
}

function SectionLabel({title, styles}: {title: string; styles: Styles}) {
  return <AppText style={styles.sectionLabel}>{title}</AppText>;
}

function MetricHead({
  icon,
  title,
  tone,
  styles,
}: {
  icon: HandoffIconName;
  title: string;
  tone: Tone;
  styles: Styles;
}) {
  const {theme} = useAppTheme();
  const colors = toneColors(theme, tone);
  return (
    <View style={styles.metricHead}>
      <View style={[styles.metricIcon, {backgroundColor: colors.bg}]}>
        <MaterialIcon color={colors.fg} name={icon} size={17} />
      </View>
      <AppText style={styles.metricTitle}>{title}</AppText>
    </View>
  );
}

function MetricValue({
  value,
  unit,
  tone,
  styles,
}: {
  value: string;
  unit: string;
  tone: Tone;
  styles: Styles;
}) {
  const {theme} = useAppTheme();
  const color =
    tone === 'gold'
      ? theme.colors.onTertiaryContainer
      : toneColors(theme, tone).fg;
  return (
    <AppText style={[styles.value, {color}]}>
      {value}
      <AppText style={styles.valueUnit}>{` ${unit}`}</AppText>
    </AppText>
  );
}

function NotEnoughData({styles}: {styles: Styles}) {
  const {theme} = useAppTheme();
  return (
    <View style={styles.notEnough}>
      <MaterialIcon color={theme.colors.text.muted} name="lock" size={13} />
      <AppText style={styles.notEnoughLabel}>{NOT_ENOUGH_DATA}</AppText>
    </View>
  );
}

function MetricTile({
  icon,
  title,
  tone,
  value,
  unit,
  description,
  styles,
}: {
  icon: HandoffIconName;
  title: string;
  tone: Tone;
  value: string | null;
  unit: string;
  description: string;
  styles: Styles;
}) {
  return (
    <AppCard style={styles.tile}>
      <View style={styles.metric}>
        <MetricHead icon={icon} styles={styles} title={title} tone={tone} />
        {value === null ? (
          <NotEnoughData styles={styles} />
        ) : (
          <MetricValue styles={styles} tone={tone} unit={unit} value={value} />
        )}
        <AppText color="muted" style={styles.description}>
          {description}
        </AppText>
      </View>
    </AppCard>
  );
}

function RetentionBar({
  label,
  rate,
  text,
  styles,
}: {
  label: string;
  rate: number | null;
  text: string;
  styles: Styles;
}) {
  return (
    <View style={styles.barRow}>
      <AppText style={styles.barLabel}>{label}</AppText>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {width: `${Math.max(0, Math.min(100, rate ?? 0))}%`},
          ]}
        />
      </View>
      <AppText style={rate === null ? styles.barEmpty : styles.barValue}>
        {rate === null ? '—' : text}
      </AppText>
    </View>
  );
}

function Ring({
  rate,
  color,
  track,
}: {
  rate: number;
  color: string;
  track: string;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, rate)) / 100) * circumference;
  return (
    <Svg height={64} viewBox="0 0 64 64" width={64}>
      <Circle
        cx={32}
        cy={32}
        fill="none"
        r={radius}
        stroke={track}
        strokeWidth={8}
      />
      <Circle
        cx={32}
        cy={32}
        fill="none"
        r={radius}
        stroke={color}
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        strokeWidth={8}
        transform="rotate(-90 32 32)"
      />
    </Svg>
  );
}

function RecordingChip({
  label,
  meta,
  styles,
}: {
  label: string;
  meta: string;
  styles: Styles;
}) {
  const {theme} = useAppTheme();
  return (
    <View style={styles.recording}>
      <View style={styles.recordingIcon}>
        <MaterialIcon color={theme.colors.primary} name="mic" size={16} />
      </View>
      <View style={styles.flexCopy}>
        <AppText style={styles.recordingLabel}>{label}</AppText>
        <AppText color="muted" style={styles.recordingMeta}>
          {meta}
        </AppText>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const mintEdge = withAlpha(theme.colors.primaryContainer, 0.45);
  const sunEdge = withAlpha(theme.colors.tertiaryContainer, 0.45);
  return StyleSheet.create({
    content: {
      gap: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingTop: 8,
    },
    flexCopy: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    empty: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 22,
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      ...getStickerEdge(4, sunEdge),
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    emptyTitle: {
      fontSize: 15.5,
      fontWeight: '800',
    },
    emptyBody: {
      fontSize: 13,
      lineHeight: 18,
    },
    emptyLink: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
      textDecorationLine: 'underline',
    },
    sectionLabel: {
      color: theme.colors.primary,
      fontSize: 12.5,
      fontWeight: '800',
      letterSpacing: 1,
      paddingHorizontal: 2,
      paddingTop: 4,
      textTransform: 'uppercase',
    },
    grid: {
      flexDirection: 'row',
      gap: 10,
    },
    tile: {
      flex: 1,
      minWidth: 0,
    },
    metric: {
      gap: 8,
    },
    metricHead: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    metricIcon: {
      alignItems: 'center',
      borderRadius: 11,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    metricTitle: {
      flex: 1,
      fontSize: 13.5,
      fontWeight: '800',
      lineHeight: 17,
    },
    value: {
      fontSize: 28,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    valueUnit: {
      color: theme.colors.text.muted,
      fontSize: 13,
      fontWeight: '700',
    },
    notEnough: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 9,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    notEnoughLabel: {
      color: theme.colors.text.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    description: {
      fontSize: 12.5,
      lineHeight: 17,
    },
    ringRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    barRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    barLabel: {
      color: theme.colors.text.secondary,
      fontSize: 12.5,
      fontWeight: '700',
      width: 58,
    },
    barTrack: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 6,
      flex: 1,
      height: 12,
      overflow: 'hidden',
    },
    barFill: {
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: 6,
      height: '100%',
    },
    barValue: {
      color: theme.colors.primary,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
      textAlign: 'right',
      width: 46,
    },
    barEmpty: {
      color: theme.colors.text.muted,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'right',
      width: 46,
    },
    recording: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      minWidth: 0,
      padding: 10,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    recordingIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    recordingLabel: {
      fontSize: 13,
      fontWeight: '800',
    },
    recordingMeta: {
      fontSize: 11.5,
      fontVariant: ['tabular-nums'],
    },
    export: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: theme.spacing.sm,
      minHeight: 46,
      ...getStickerEdge(3, mintEdge),
    },
    exportLabel: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    pressed: {
      transform: [{translateY: 2}],
    },
    code: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 12,
      padding: 10,
    },
    codeText: {
      color: theme.colors.text.secondary,
      fontFamily: 'Courier',
      fontSize: 11,
    },
  });
}
