import React, {useState, useCallback} from 'react';
import {Alert, ScrollView, View, StyleSheet} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ProfileStackParamList} from './navigationTypes';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SectionHeader} from '@ui/components/SectionHeader';
import {AppButton} from '@ui/components/AppButton';
import {useAppTheme} from '@ui/theme/index';
import {
  useProgressReport,
  type CapabilityProgressReport,
} from '../logic/useProgressReport';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProgressReport'>;

export type ProgressReportScreenProps = Props;

export function ProgressReportScreen({navigation}: Props) {
  const {theme} = useAppTheme();
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

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <IconButton
          accessibilityLabel="Quay lại"
          icon="arrow_back"
          onPress={() => navigation.goBack()}
          tone="surface"
        />
        <AppText style={[styles.headerTitle, {color: theme.colors.primary}]}>
          Báo cáo tiến độ & Năng lực
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          {
            gap: theme.spacing.md,
            paddingBottom: 32,
            paddingHorizontal: theme.gutter,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="Chỉ số năng lực học tập" />

        {/* 1. Spoken without looking */}
        <AppCard style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialIcon
              color={theme.colors.primary}
              name="record_voice_over"
              size={24}
            />
            <AppText variant="h3">Nói không cần nhìn prompt</AppText>
          </View>
          <AppText style={[styles.metricValue, {color: theme.colors.primary}]}>
            {report.sentencesSpokenWithoutLookingCount > 0
              ? `${report.sentencesSpokenWithoutLookingCount} câu`
              : 'Chưa đủ dữ liệu'}
          </AppText>
          <AppText color="secondary" variant="caption">
            Số lượng câu/mẫu câu học viên thực hành phản xạ không cần nhìn văn
            bản.
          </AppText>
        </AppCard>

        {/* 2. Start-to-answer time */}
        <AppCard style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialIcon
              color={theme.colors.tertiary}
              name="timer"
              size={24}
            />
            <AppText variant="h3">Thời gian bắt đầu phản xạ</AppText>
          </View>
          <AppText style={[styles.metricValue, {color: theme.colors.tertiary}]}>
            {report.startToAnswerTimeFormatted}
          </AppText>
          <AppText color="secondary" variant="caption">
            Thời gian trung bình từ khi nhận tín hiệu đến khi đưa ra câu trả
            lời.
          </AppText>
        </AppCard>

        {/* 3. First-listen comprehension */}
        <AppCard style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialIcon
              color={theme.colors.secondary}
              name="hearing"
              size={24}
            />
            <AppText variant="h3">Hiểu ngay lần nghe đầu tiên</AppText>
          </View>
          <AppText
            style={[styles.metricValue, {color: theme.colors.secondary}]}
          >
            {formatPercentage(report.firstListenComprehensionRate)}
          </AppText>
          <AppText color="secondary" variant="caption">
            Tỷ lệ trả lời chính xác ngay trong lần nghe đầu tiên không cần nghe
            lại.
          </AppText>
        </AppCard>

        {/* 4. 7-day & 30-day Retention */}
        <AppCard style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialIcon
              color={theme.colors.accentInk}
              name="psychology"
              size={24}
            />
            <AppText variant="h3">Tỷ lệ ghi nhớ SRS (7d / 30d)</AppText>
          </View>
          <View style={styles.retentionRow}>
            <View style={styles.retentionBox}>
              <AppText color="secondary" variant="caption">
                7 ngày qua
              </AppText>
              <AppText
                style={[styles.metricValueSmall, {color: theme.colors.primary}]}
              >
                {formatPercentage(report.retention7DayRate)}
              </AppText>
            </View>
            <View style={styles.retentionBox}>
              <AppText color="secondary" variant="caption">
                30 ngày qua
              </AppText>
              <AppText
                style={[styles.metricValueSmall, {color: theme.colors.primary}]}
              >
                {formatPercentage(report.retention30DayRate)}
              </AppText>
            </View>
          </View>
          <AppText color="secondary" variant="caption">
            Tỷ lệ ôn tập thành công trên cửa sổ 7 ngày và 30 ngày.
          </AppText>
        </AppCard>

        {/* 5. Passed situations */}
        <AppCard style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialIcon
              color={theme.colors.primary}
              name="check_circle"
              size={24}
            />
            <AppText variant="h3">Tình huống đã đạt</AppText>
          </View>
          <AppText style={[styles.metricValue, {color: theme.colors.primary}]}>
            {report.passedSituationsCount > 0
              ? `${report.passedSituationsCount} tình huống`
              : 'Chưa đủ dữ liệu'}
          </AppText>
          <AppText color="secondary" variant="caption">
            Số lượng bài kiểm tra tình huống (tuần và theo giai đoạn) đã đạt yêu
            cầu.
          </AppText>
        </AppCard>

        {/* 6. Before / After Recordings */}
        <AppCard style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialIcon
              color={theme.colors.tertiary}
              name="compare"
              size={24}
            />
            <AppText variant="h3">So sánh ghi âm trước & sau</AppText>
          </View>
          {report.beforeAfterRecordings.earliest &&
          report.beforeAfterRecordings.latest ? (
            <View style={{gap: 8, marginTop: 4}}>
              <AppText variant="body">
                • Bản ghi đầu:{' '}
                {new Date(
                  report.beforeAfterRecordings.earliest.createdAt,
                ).toLocaleDateString()}{' '}
                (
                {Math.round(
                  report.beforeAfterRecordings.earliest.durationMs / 1000,
                )}
                s)
              </AppText>
              <AppText variant="body">
                • Bản ghi mới nhất:{' '}
                {new Date(
                  report.beforeAfterRecordings.latest.createdAt,
                ).toLocaleDateString()}{' '}
                (
                {Math.round(
                  report.beforeAfterRecordings.latest.durationMs / 1000,
                )}
                s)
              </AppText>
            </View>
          ) : (
            <AppText
              style={[styles.metricValue, {color: theme.colors.text.secondary}]}
            >
              Chưa đủ dữ liệu ghi âm
            </AppText>
          )}
          <AppText color="secondary" variant="caption">
            So sánh chất lượng phản xạ và phát âm qua thời gian.
          </AppText>
        </AppCard>

        {/* Export anonymized learning metrics */}
        <View style={{marginTop: theme.spacing.md}}>
          <AppButton
            accessibilityLabel="Xuất dữ liệu chỉ số học tập"
            title="Xuất chỉ số học tập (JSON)"
            onPress={handleExportMetrics}
            variant="primary"
          />
        </View>

        {exportJson ? (
          <AppCard
            style={{marginTop: 12, backgroundColor: theme.colors.surface}}
          >
            <AppText variant="h3">Chỉ số đã xuất (JSON ẩn danh):</AppText>
            <AppText
              style={{
                fontFamily: 'Courier',
                fontSize: 11,
                marginTop: 8,
                color: theme.colors.text.secondary,
              }}
            >
              {exportJson}
            </AppText>
          </AppCard>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 8,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  metricCard: {
    gap: 8,
  },
  metricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  metricValueSmall: {
    fontSize: 18,
    fontWeight: '700',
  },
  retentionBox: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  retentionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
});
