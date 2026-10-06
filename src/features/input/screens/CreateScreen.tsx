import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getHardShadow} from '@ui/theme/hardShadow';

import {useYouTubeServerEnabled} from '@core/api/youtubeCapabilities';
import {useAppNavigation} from '@core/navigation';
import {useFeatureFlags} from '@core/release';

import type {CreateFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CreateFlowParamList, 'CreateHub'>;

export type CreateScreenProps = Props;

type Tile = {
  icon: 'add_photo_alternate' | 'play_circle' | 'content_paste';
  labelKey: string;
  descKey: string;
  a11yKey: string;
  onPress: () => void;
  testID: string;
};

/**
 * Lesson-creation hub (SETE-247), pushed from Home and the Library: the four input sources moved intact from
 * Home. All tiles share one visual style so equal-weight actions read as
 * equal — the only solid block on this screen is the camera hero.
 */
export function CreateScreen(_props: Props) {
  const appNavigation = useAppNavigation();
  const {theme} = useAppTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  const {config} = useFeatureFlags();
  const imageInputEnabled =
    config.features.imageInput &&
    config.features.ocrScanner &&
    config.features.ocrReviewEdit;
  // SETE-290 (DEV-1): the creation tile needs the server capability too —
  // without it the tile is hidden so no transcript request can start here.
  // The history link stays flag-gated: saved lessons are local data.
  const youtubeServerEnabled = useYouTubeServerEnabled();
  const youtubeEnabled =
    config.features.youtubeLearning && youtubeServerEnabled;
  const openYoutubeCreation = useCallback(
    () => appNavigation.startCreate({kind: 'youtube'}),
    [appNavigation],
  );
  const pasteEnabled = config.features.pasteTextInput;

  const openCamera = useCallback(
    () => appNavigation.startCreate({kind: 'camera'}),
    [appNavigation],
  );
  const openGallery = useCallback(
    () => appNavigation.startCreate({kind: 'gallery'}),
    [appNavigation],
  );

  const tiles: Tile[] = [];
  if (imageInputEnabled) {
    tiles.push({
      icon: 'add_photo_alternate',
      labelKey: 'home.upload_image',
      descKey: 'create.source_gallery_desc',
      a11yKey: 'home.upload_image_a11y',
      onPress: openGallery,
      testID: 'create-tile-gallery',
    });
  }
  if (youtubeEnabled) {
    tiles.push({
      icon: 'play_circle',
      labelKey: 'home.youtube',
      descKey: 'create.source_youtube_desc',
      a11yKey: 'home.youtube_a11y',
      onPress: openYoutubeCreation,
      testID: 'create-tile-youtube',
    });
  }
  if (pasteEnabled) {
    tiles.push({
      icon: 'content_paste',
      labelKey: 'home.paste_text',
      descKey: 'create.source_paste_desc',
      a11yKey: 'home.paste_text_a11y',
      onPress: () => appNavigation.startCreate({kind: 'paste'}),
      testID: 'create-tile-paste',
    });
  }
  const hasAnySource = imageInputEnabled || youtubeEnabled || pasteEnabled;

  return (
    <AppScreen>
      <ScreenHeader
        title={t('create.title')}
        onBack={appNavigation.goBack}
        numberOfLines={1}
      />
      <View style={styles.header}>
        <AppText color="secondary">{t('create.subtitle')}</AppText>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scrollContent]}
        showsVerticalScrollIndicator={false}
      >
        {!hasAnySource ? (
          <View style={styles.emptyWrap} testID="create-empty-state">
            <View style={styles.emptyMedallion}>
              <MaterialIcon
                color={theme.colors.primary}
                name="upload_file"
                size={28}
              />
            </View>
            <AppText variant="h3" style={styles.centerText}>
              {t('create.empty_title')}
            </AppText>
            <AppText color="secondary" style={styles.centerText}>
              {t('create.empty_body')}
            </AppText>
          </View>
        ) : (
          <>
            {imageInputEnabled ? (
              <Pressable
                accessibilityLabel={t('home.capture_photo_a11y')}
                accessibilityRole="button"
                onPress={openCamera}
                style={({pressed}) => [
                  styles.heroCamera,
                  pressed && styles.pressed,
                ]}
                testID="create-hero-camera"
              >
                <View style={styles.heroCameraIcon}>
                  <MaterialIcon
                    color={theme.colors.onPrimaryContainer}
                    name="photo_camera"
                    size={28}
                  />
                </View>
                <AppText
                  variant="h2"
                  style={styles.heroCameraTitle}
                  numberOfLines={2}
                >
                  {t('home.capture_photo')}
                </AppText>
                <AppText style={styles.heroCameraHint} numberOfLines={2}>
                  {t('home.capture_photo_hint')}
                </AppText>
              </Pressable>
            ) : null}
            {tiles.length > 0 ? (
              <View style={styles.sourceList}>
                <AppText style={styles.sectionTitle}>
                  {t('create.more_ways')}
                </AppText>
                {tiles.map(tile => (
                  <Pressable
                    accessibilityLabel={t(tile.a11yKey)}
                    accessibilityRole="button"
                    key={tile.testID}
                    onPress={tile.onPress}
                    style={({pressed}) => [
                      styles.sourceRow,
                      pressed && styles.pressed,
                    ]}
                    testID={tile.testID}
                  >
                    <View style={styles.sourceIcon}>
                      <MaterialIcon
                        color={theme.colors.primary}
                        name={tile.icon}
                        size={24}
                      />
                    </View>
                    <View style={styles.sourceCopy}>
                      <AppText variant="label" numberOfLines={1}>
                        {t(tile.labelKey)}
                      </AppText>
                      <AppText
                        variant="caption"
                        color="secondary"
                        numberOfLines={2}
                      >
                        {t(tile.descKey)}
                      </AppText>
                    </View>
                    <MaterialIcon
                      color={theme.colors.text.muted}
                      name="chevron_right"
                      size={22}
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {youtubeEnabled ? (
              <Pressable
                accessibilityLabel={t('home.youtube_history_a11y')}
                accessibilityRole="button"
                onPress={appNavigation.openCatalog}
                style={({pressed}) => [
                  styles.historyLink,
                  pressed && styles.linkPressed,
                ]}
                testID="create-history-link"
              >
                <MaterialIcon
                  color={theme.colors.primary}
                  name="history_edu"
                  size={20}
                />
                <AppText
                  variant="label"
                  style={styles.historyLabel}
                  numberOfLines={1}
                >
                  {t('home.youtube_history')}
                </AppText>
              </Pressable>
            ) : null}
            {imageInputEnabled ? (
              <View style={styles.tipCard} testID="create-tip-card">
                <MaterialIcon
                  color={theme.colors.onTertiaryContainer}
                  name="tips_and_updates"
                  size={22}
                />
                <AppText variant="label" style={styles.tipText}>
                  {t('home.tip')}
                </AppText>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      gap: theme.spacing.xs,
      paddingHorizontal: theme.gutter,
    },
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
    },
    heroCamera: {
      alignItems: 'center',
      backgroundColor: theme.colors.primaryContainer,
      borderColor: theme.colors.ink,
      borderRadius: 24,
      borderWidth: 2,
      gap: theme.spacing.sm,
      justifyContent: 'center',
      minHeight: 190,
      padding: theme.spacing.lg,
      ...getHardShadow(6, theme.colors.ink),
    },
    heroCameraIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.ink,
      borderRadius: 20,
      borderWidth: 2,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    heroCameraTitle: {
      color: theme.colors.onPrimaryContainer,
      textAlign: 'center',
    },
    heroCameraHint: {
      color: theme.colors.onPrimaryContainer,
      textAlign: 'center',
    },
    sourceList: {gap: theme.spacing.sm},
    sectionTitle: {
      color: theme.colors.text.primary,
      fontSize: 18,
      fontWeight: '700',
    },
    sourceRow: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.ink,
      borderRadius: 20,
      borderWidth: 2,
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 72,
      padding: theme.spacing.md,
      ...getHardShadow(4, theme.colors.ink),
    },
    sourceIcon: {
      alignItems: 'center',
      backgroundColor: solidOver(theme.colors.accentSoft, theme.colors.surface),
      borderColor: theme.colors.ink,
      borderRadius: 14,
      borderWidth: 2,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    sourceCopy: {flex: 1, gap: 2, minWidth: 0},
    historyLink: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 44,
      paddingHorizontal: theme.spacing.sm,
    },
    historyLabel: {
      color: theme.colors.primary,
      flex: 1,
    },
    tipCard: {
      alignItems: 'center',
      backgroundColor: solidOver(
        theme.colors.tertiarySoft,
        theme.colors.surface,
      ),
      borderColor: theme.colors.ink,
      borderRadius: 20,
      borderWidth: 2,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    tipText: {
      color: theme.colors.onTertiaryContainer,
      flex: 1,
    },
    emptyWrap: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xxl,
    },
    emptyMedallion: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    centerText: {textAlign: 'center'},
    linkPressed: {opacity: theme.states.pressedOpacity},
    pressed: {
      transform: [{translateY: 3}],
      ...getHardShadow(1, theme.colors.ink),
    },
  });
}
