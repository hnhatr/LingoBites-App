import React, {useCallback} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import type {NavigationProp} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {CreateStackParamList} from './navigationTypes';
import type {RootStackParamList, RootTabParamList} from '@features/home';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import {useFloatingTabBarClearance} from '@ui/components/layout/index';
import {useTranslation} from 'react-i18next';
import {useYouTubeServerEnabled} from '@core/api/youtubeCapabilities';
import {useFeatureFlags} from '@core/release/index';

type Props = NativeStackScreenProps<CreateStackParamList, 'CreateMain'>;

export type CreateScreenProps = Props;

type Tile = {
  icon: 'add_photo_alternate' | 'play_circle' | 'content_paste';
  labelKey: string;
  a11yKey: string;
  onPress: () => void;
  testID: string;
};

/**
 * Lesson-creation tab (SETE-247): the four input sources moved intact from
 * Home. All tiles share one visual style so equal-weight actions read as
 * equal — the only solid block on this screen is the camera hero.
 */
export function CreateScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
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
  const youtubeHistoryEnabled = config.features.youtubeLearning;
  const pasteEnabled = config.features.pasteTextInput;

  const openCamera = useCallback(
    () => navigation.navigate('ImageCapture', {sourceType: 'camera'}),
    [navigation],
  );
  const openGallery = useCallback(
    () => navigation.navigate('ImageCapture', {sourceType: 'gallery'}),
    [navigation],
  );

  const tiles: Tile[] = [];
  if (imageInputEnabled) {
    tiles.push({
      icon: 'add_photo_alternate',
      labelKey: 'home.upload_image',
      a11yKey: 'home.upload_image_a11y',
      onPress: openGallery,
      testID: 'create-tile-gallery',
    });
  }
  if (youtubeEnabled) {
    tiles.push({
      icon: 'play_circle',
      labelKey: 'home.youtube',
      a11yKey: 'home.youtube_a11y',
      onPress: () => navigation.navigate('YouTubeInput'),
      testID: 'create-tile-youtube',
    });
  }
  if (pasteEnabled) {
    tiles.push({
      icon: 'content_paste',
      labelKey: 'home.paste_text',
      a11yKey: 'home.paste_text_a11y',
      onPress: () => navigation.navigate('PasteText'),
      testID: 'create-tile-paste',
    });
  }
  const hasAnySource = imageInputEnabled || youtubeEnabled || pasteEnabled;

  return (
    <AppScreen>
      <View style={styles.header}>
        <AppText variant="h2">{t('create.title')}</AppText>
        <AppText color="secondary">{t('create.subtitle')}</AppText>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: feedClearance},
        ]}
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
              <View style={styles.tileRow}>
                {tiles.map(tile => (
                  <Pressable
                    accessibilityLabel={t(tile.a11yKey)}
                    accessibilityRole="button"
                    key={tile.testID}
                    onPress={tile.onPress}
                    style={({pressed}) => [
                      styles.tile,
                      pressed && styles.pressed,
                    ]}
                    testID={tile.testID}
                  >
                    <MaterialIcon
                      color={theme.colors.primary}
                      name={tile.icon}
                      size={22}
                    />
                    <AppText style={styles.tileLabel} numberOfLines={2}>
                      {t(tile.labelKey)}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {youtubeHistoryEnabled ? (
              <Pressable
                accessibilityLabel={t('home.youtube_history_a11y')}
                accessibilityRole="button"
                // SETE-289: History is a RootStack route above the tabs —
                // reach it through the tab parent so the stack-id lookup
                // stays type-safe (screen nav props carry no navigator id).
                onPress={() =>
                  navigation
                    .getParent<NavigationProp<RootTabParamList>>()
                    ?.getParent<NavigationProp<RootStackParamList>>('RootStack')
                    ?.navigate('YouTubeHistory')
                }
                style={({pressed}) => [
                  styles.historyLink,
                  pressed && styles.pressed,
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
      paddingTop: theme.spacing.md,
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
      borderRadius: theme.radius.xl,
      gap: theme.spacing.sm,
      justifyContent: 'center',
      minHeight: 190,
      padding: theme.spacing.lg,
    },
    heroCameraIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.overlayLight,
      borderRadius: theme.radius.pill,
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
    tileRow: {flexDirection: 'row', gap: theme.spacing.sm},
    tile: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outline,
      borderRadius: 20,
      borderWidth: 1.5,
      flex: 1,
      gap: theme.spacing.sm,
      justifyContent: 'center',
      minHeight: 88,
      minWidth: 0,
      padding: theme.spacing.sm,
    },
    tileLabel: {
      color: theme.colors.text.primary,
      fontSize: 13.5,
      fontWeight: theme.typography.weight.medium,
      lineHeight: 17,
      textAlign: 'center',
    },
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
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: theme.radius.lg,
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
    pressed: {opacity: theme.states.pressedOpacity},
  });
}
