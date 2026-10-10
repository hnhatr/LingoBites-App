import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, StyleSheet, View} from 'react-native';

import {useAppTheme} from '@ui/theme';

import {fetchSourcePhoto, type SourcePhoto} from '../logic/sourcePhoto';

/** E4: the photo this lesson was made from. Shows nothing for lessons without one. */
export function SourcePhotoCard({
  lessonId,
  offline,
}: {
  lessonId: string;
  offline: boolean;
}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const [photo, setPhoto] = useState<SourcePhoto | null>(null);

  useEffect(() => {
    if (offline) return;
    let cancelled = false;
    fetchSourcePhoto(lessonId).then(result => {
      if (!cancelled && result.ok) setPhoto(result.value);
    });
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {borderRadius: 16, borderWidth: 2, overflow: 'hidden'},
  photo: {height: 180, width: '100%'},
});
