import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme';

import {
  cacheSourcePhoto,
  fetchSourcePhoto,
  readCachedSourcePhoto,
  type SourcePhoto,
} from '../logic/sourcePhoto';
import {type ReportableItem, WordReportSheet} from './WordReportSheet';

/**
 * E4: the photo this lesson was made from. Shows nothing for lessons without one.
 * E6: from the photo, a learner can flag a wrong word (online only).
 */
export function SourcePhotoCard({
  lessonId,
  offline,
  items = [],
}: {
  lessonId: string;
  offline: boolean;
  items?: ReportableItem[];
}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const [photo, setPhoto] = useState<SourcePhoto | null>(null);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The saved copy works offline and online; the server is asked only without one.
      const cached = await readCachedSourcePhoto(lessonId);
      if (cancelled) return;
      if (cached) {
        setPhoto(cached);
        return;
      }
      if (offline) return;
      const result = await fetchSourcePhoto(lessonId);
      if (cancelled || !result.ok || result.value === null) return;
      setPhoto(result.value);
      void cacheSourcePhoto(lessonId, result.value.uri);
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, offline]);

  if (!photo) return null;
  return (
    <View
      style={[styles.card, {borderColor: theme.colors.accentSoft}]}
      testID="canonical-hub-source-photo"
    >
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={t('moment.review_title')}
        resizeMode="cover"
        source={{uri: photo.uri}}
        style={styles.photo}
      />
      {!offline && items.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setReporting(true)}
          style={styles.reportButton}
          testID="canonical-hub-report-word"
        >
          <AppText color="primary" style={styles.link}>
            {t('moment.report_word_button')}
          </AppText>
        </Pressable>
      ) : null}
      <WordReportSheet
        items={items}
        lessonId={lessonId}
        onClose={() => setReporting(false)}
        visible={reporting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {borderRadius: 16, borderWidth: 2, overflow: 'hidden'},
  photo: {height: 180, width: '100%'},
  link: {fontWeight: '600'},
  reportButton: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
