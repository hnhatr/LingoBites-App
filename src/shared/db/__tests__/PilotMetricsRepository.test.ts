import {getDatabase} from '../database';
import {
  getCapabilityProgressReport,
  exportPrivacySafeMetrics,
  formatDurationMs,
  formatPercentage,
} from '../PilotMetricsRepository';
import {
  insertSpeakingRecording,
  captureErrorEvent,
} from '../SpeakingRepository';
import {clearAllLocalDatabaseRows} from '../localDataWipe';

describe('PilotMetricsRepository (REQ-39 & CON-6)', () => {
  beforeEach(() => {
    void clearAllLocalDatabaseRows();
  });

  test('returns "Chưa đủ dữ liệu" / null for empty windows and missing metrics', () => {
    const report = getCapabilityProgressReport('2026-09-07T10:00:00.000Z');
    expect(report.sentencesSpokenWithoutLookingCount).toBe(0);
    expect(report.averageStartToAnswerMs).toBeNull();
    expect(report.startToAnswerTimeFormatted).toBe('Chưa đủ dữ liệu');
    expect(report.firstListenComprehensionRate).toBeNull();
    expect(report.retention7DayRate).toBeNull();
    expect(report.retention30DayRate).toBeNull();
    expect(report.passedSituationsCount).toBe(0);
    expect(report.beforeAfterRecordings.earliest).toBeNull();
    expect(report.beforeAfterRecordings.latest).toBeNull();

    expect(formatDurationMs(null)).toBe('Chưa đủ dữ liệu');
    expect(formatPercentage(null)).toBe('Chưa đủ dữ liệu');
  });

  test('computes metrics from seeded recordings and review sessions', () => {
    const db = getDatabase();
    const nowIso = '2026-09-07T10:00:00.000Z';

    // Seed speaking recordings
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'shadowing',
      filePath: '/tmp/rec1.m4a',
      durationMs: 2500,
      createdAt: '2026-09-01T10:00:00.000Z',
    });
    insertSpeakingRecording({
      id: 'rec-2',
      mode: 'quick_answer',
      filePath: '/tmp/rec2.m4a',
      durationMs: 3500,
      createdAt: '2026-09-07T09:00:00.000Z',
    });

    // Seed review sessions in 7d window
    db.execute(
      `INSERT INTO review_sessions (id, card_id, lesson_id, rating, reviewed_at, interval_days, next_review_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'rev-1',
        'card-1',
        'lesson-1',
        'good',
        '2026-09-05T10:00:00.000Z',
        1,
        '2026-09-06T10:00:00.000Z',
        '2026-09-05T10:00:00.000Z',
      ],
    );
    db.execute(
      `INSERT INTO review_sessions (id, card_id, lesson_id, rating, reviewed_at, interval_days, next_review_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'rev-2',
        'card-2',
        'lesson-1',
        'again',
        '2026-09-06T10:00:00.000Z',
        1,
        '2026-09-07T10:00:00.000Z',
        '2026-09-06T10:00:00.000Z',
      ],
    );

    // Seed error event
    captureErrorEvent({
      id: 'err-1',
      source: 'speaking',
      category: 'pronunciation_affecting_meaning',
      createdAt: '2026-09-06T12:00:00.000Z',
    });

    const report = getCapabilityProgressReport(nowIso);
    expect(report.sentencesSpokenWithoutLookingCount).toBe(2);
    expect(report.averageStartToAnswerMs).toBe(3000);
    expect(report.retention7DayRate).toBe(50); // 1 good out of 2 = 50%
    expect(report.beforeAfterRecordings.earliest?.id).toBe('rec-1');
    expect(report.beforeAfterRecordings.latest?.id).toBe('rec-2');
  });

  test('exportPrivacySafeMetrics contains no CON-6 prohibited data', () => {
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'shadowing',
      filePath: '/private/documents/secret_audio.m4a',
      durationMs: 4000,
      createdAt: '2026-09-05T10:00:00.000Z',
    });

    const exportData = exportPrivacySafeMetrics('2026-09-07T10:00:00.000Z');
    const jsonString = JSON.stringify(exportData);

    // Verify schema and fields
    expect(exportData.schema_version).toBe('lingobites-pilot-metrics-v1');
    expect(exportData.aggregate_metrics.total_recordings_count).toBe(1);
    expect(exportData.aggregate_metrics.total_speaking_duration_ms).toBe(4000);

    // CON-6 Privacy assertions: NO raw text, NO file paths, NO audio bytes
    expect(jsonString).not.toContain('/private/documents/secret_audio.m4a');
    expect(jsonString).not.toContain('filePath');
    expect(jsonString).not.toContain('transcript');
    expect(jsonString).not.toContain('ocr_raw_text');
  });

  test('clearAllLocalData removes all pilot metric rows and review items', () => {
    insertSpeakingRecording({
      id: 'rec-1',
      mode: 'shadowing',
      filePath: '/tmp/rec1.m4a',
      durationMs: 2000,
      createdAt: '2026-09-05T10:00:00.000Z',
    });
    captureErrorEvent({
      id: 'err-1',
      source: 'speaking',
      category: 'vocabulary',
      createdAt: '2026-09-05T10:00:00.000Z',
    });

    void clearAllLocalDatabaseRows();

    const report = getCapabilityProgressReport();
    expect(report.sentencesSpokenWithoutLookingCount).toBe(0);
    expect(report.beforeAfterRecordings.earliest).toBeNull();
  });
});
