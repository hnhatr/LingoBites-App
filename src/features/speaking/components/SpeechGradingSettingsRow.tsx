import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, Switch, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {getDatabase, withTransaction} from '@core/db/database';
import {deleteTaskAnswer} from '@core/sync/taskAnswers';

import {
  isEvaluationConsentOn,
  setEvaluationConsent,
} from '../logic/upload/recordingConsent';
import {requestRecordingUploadDrain} from '../logic/upload/recordingUploadQueue';

/**
 * PR 14 (decision H6): switch the consent to send step-5 spoken answers for
 * grading. Turning it off drops every answer not yet uploaded (its file,
 * its queue row and its pending answer); those attempts are not graded.
 */
export function applyEvaluationConsent(value: 'on' | 'off'): void {
  const files: string[] = [];
  withTransaction(getDatabase(), () => {
    setEvaluationConsent(value);
    if (value === 'off') {
      const rows = getDatabase().execute(
        `SELECT id, activity_id, file_path FROM speaking_recordings
          WHERE mode = 'lesson_task' AND upload_state = 'pending';`,
      ).rows;
      for (let index = 0; index < (rows?.length ?? 0); index += 1) {
        const row = rows!.item(index) as {
          id: string;
          activity_id: string | null;
          file_path: string;
        };
        getDatabase().execute('DELETE FROM speaking_recordings WHERE id = ?;', [
          row.id,
        ]);
        if (row.activity_id) deleteTaskAnswer(row.activity_id);
        files.push(row.file_path);
      }
    }
  });
  if (value === 'on') {
    requestRecordingUploadDrain();
    return;
  }
  if (files.length > 0) {
    import('../logic/recordingService')
      .then(({deleteRecordingFile}) =>
        Promise.all(files.map(file => deleteRecordingFile(file))),
      )
      .catch(() => undefined);
  }
}

export function SpeechGradingSettingsRow() {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [on, setOn] = useState(() => isEvaluationConsentOn());

  const handleToggle = useCallback((next: boolean) => {
    applyEvaluationConsent(next ? 'on' : 'off');
    setOn(next);
  }, []);

  return (
    <View testID="speech-grading-settings">
      <ProfileSettingsRow
        accessibilityHint="Gửi bản ghi bài nói ở bước 5 để máy chấm"
        accessibilityLabel="Chấm bài nói bằng máy"
        icon="record_voice_over"
        label="Chấm bài nói bằng máy"
        medallionTone="teal"
        trailing={{text: on ? 'Bật' : 'Tắt'}}
      />
      <View style={themedStyles.row}>
        <AppText color="secondary" style={themedStyles.flex} variant="caption">
          Gửi bản ghi bài nói ở bước 5 để máy chấm. Bản ghi tự xoá sau 30 ngày.
          Tắt thì bạn tự đánh giá, bản ghi chỉ ở trên máy.
        </AppText>
        <Switch
          accessibilityHint="Bật hoặc tắt chấm bài nói bằng máy"
          accessibilityLabel="Chấm bài nói bằng máy"
          onValueChange={handleToggle}
          testID="speech-grading-switch"
          value={on}
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
  });
}
