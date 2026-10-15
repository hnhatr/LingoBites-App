import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {ErrorCard} from '@ui/components/ErrorCard';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {StickerButton} from '@ui/components/StickerButton';
import {StickerFooter} from '@ui/components/StickerFooter';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {useImageAnalysisFlow} from '../logic/useImageAnalysisFlow';
import type {CreateFlowParamList} from './navigationTypes';
type Props = NativeStackScreenProps<CreateFlowParamList, 'ImageCapture'>;

export type ImageCaptureScreenProps = Props;

function ExtractButton({onPress}: {onPress: () => void}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  return (
    <Pressable
      accessibilityLabel={t('ocr.extract_a11y')}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        {
          alignItems: 'center',
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.lg,
          flexDirection: 'row',
          gap: 8,
          justifyContent: 'center',
          minHeight: 52,
          opacity: pressed ? theme.states.pressedOpacity : 1,
        },
      ]}
    >
      <MaterialIcon
        color={theme.colors.text.inverse}
        name="document_scanner"
        size={22}
      />
      <AppText style={[styles.actionText, {color: theme.colors.text.inverse}]}>
        {t('ocr.extract')}
      </AppText>
    </Pressable>
  );
}

/**
 * The photo being read, with a light line sweeping over it (held still when
 * the learner asked for reduced motion).
 */
function ScanningPhoto({uri}: {uri: string}) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const sweep = useRef(new Animated.Value(0.5)).current;
  const [height, setHeight] = useState(0);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (cancelled || reduce) return;
      sweep.setValue(0.1);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, {
            duration: 1100,
            toValue: 0.9,
            useNativeDriver: true,
          }),
          Animated.timing(sweep, {
            duration: 1100,
            toValue: 0.1,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [sweep]);

  return (
    <View
      onLayout={event => setHeight(event.nativeEvent.layout.height)}
      style={themedStyles.photoFrame}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={{uri}}
        style={styles.photo}
      />
      <Animated.View
        style={[
          themedStyles.scanLine,
          {
            transform: [
              {
                translateY: sweep.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, height],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

export function ImageCaptureScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  const {sourceType} = route.params;
  const {
    state: screenState,
    isGallery,
    pick,
    analyze,
    backToIdle,
  } = useImageAnalysisFlow({
    sourceType,
    onAnalyzed: (image, analysis) =>
      navigation.replace('MomentReview', {sourceType, image, analysis}),
    onCameraCancelled: () => navigation.goBack(),
  });

  function handleBack() {
    if (screenState.type === 'preview' && isGallery) {
      backToIdle();
      return;
    }
    navigation.goBack();
  }

  const headerTitle = isGallery
    ? t('ocr.title_gallery')
    : t('ocr.title_capture');

  if (screenState.type === 'camera_unavailable') {
    return (
      <AppScreen>
        <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
        <ScrollView
          contentContainerStyle={themedStyles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={themedStyles.empty} testID="camera-unavailable">
            <View style={themedStyles.emptyIcon}>
              <MaterialIcon
                color={HERO_PALETTE.coralShelf}
                name="photo_camera"
                size={36}
              />
            </View>
            <AppText style={styles.centerText} variant="h2">
              {t('ocr.camera_unavailable_title')}
            </AppText>
            <AppText color="secondary" style={styles.centerText} variant="body">
              {t('ocr.camera_unavailable_body')}
            </AppText>
          </View>
          <View style={themedStyles.tips}>
            <AppText style={themedStyles.tipsTitle} variant="caption">
              {t('ocr.tips_title')}
            </AppText>
            <View style={styles.tipRow}>
              <MaterialIcon
                color={theme.colors.onTertiaryContainer}
                name="lightbulb"
                size={16}
              />
              <AppText style={styles.tipText} variant="label">
                {t('ocr.tip_light')}
              </AppText>
            </View>
            <View style={styles.tipRow}>
              <MaterialIcon
                color={theme.colors.onTertiaryContainer}
                name="document_scanner"
                size={16}
              />
              <AppText style={styles.tipText} variant="label">
                {t('ocr.tip_frame')}
              </AppText>
            </View>
          </View>
        </ScrollView>
        <StickerFooter>
          <StickerButton
            icon="add_photo_alternate"
            label={t('ocr.pick_from_gallery')}
            onPress={() =>
              navigation.replace('ImageCapture', {sourceType: 'gallery'})
            }
            testID="camera-unavailable-gallery"
          />
          <StickerButton
            icon="edit"
            label={t('ocr.type_instead')}
            onPress={() => navigation.navigate('PasteText')}
            testID="camera-unavailable-type"
            tone="ghost"
          />
        </StickerFooter>
      </AppScreen>
    );
  }

  if (screenState.type === 'analyzing') {
    return (
      <AppScreen>
        <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
        <ScrollView
          contentContainerStyle={themedStyles.content}
          showsVerticalScrollIndicator={false}
        >
          <ScanningPhoto uri={screenState.image.uri} />
          <View accessibilityLiveRegion="polite" style={styles.steps}>
            <View style={styles.stepRow}>
              <View style={[themedStyles.stepDot, themedStyles.stepDotNow]}>
                <View style={themedStyles.stepDotCore} />
              </View>
              <AppText style={styles.grow} variant="h3">
                {t('ocr.step_reading')}
              </AppText>
              <AppText color="muted" variant="caption">
                {t('ocr.step_reading_now')}
              </AppText>
            </View>
            <View style={styles.stepRow}>
              <View style={themedStyles.stepDot} />
              <AppText color="muted" style={styles.grow} variant="h3">
                {t('ocr.step_review')}
              </AppText>
            </View>
          </View>
        </ScrollView>
        <StickerFooter>
          <StickerButton
            label={t('ocr.cancel')}
            onPress={() => navigation.goBack()}
            testID="ocr-cancel"
            tone="ghost"
          />
        </StickerFooter>
      </AppScreen>
    );
  }

  if (screenState.type === 'picking') {
    return (
      <AppScreen>
        <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
        <View style={themedStyles.centered}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <AppText color="secondary" style={styles.centerText}>
            {isGallery ? t('ocr.opening_gallery') : t('ocr.opening_camera')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  if (screenState.type === 'permission_denied') {
    return (
      <AppScreen>
        <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
        <View
          style={{
            flex: 1,
            gap: theme.spacing.md,
            justifyContent: 'center',
            padding: theme.spacing.xl,
          }}
        >
          <ErrorCard
            message={t('errors.permission_denied')}
            onRetry={() => {
              pick();
            }}
          />
          <AppButton
            title={t('ocr.manual_text')}
            variant="secondary"
            onPress={() => navigation.navigate('PasteText')}
          />
        </View>
      </AppScreen>
    );
  }

  if (screenState.type === 'error') {
    return (
      <AppScreen>
        <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
        <ScrollView
          contentContainerStyle={{
            gap: theme.spacing.md,
            padding: theme.spacing.xl,
          }}
        >
          {screenState.image ? (
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={{uri: screenState.image.uri}}
              style={{
                backgroundColor: theme.colors.surfaceMuted,
                borderRadius: theme.radius.lg,
                height: 280,
                width: '100%',
              }}
            />
          ) : null}
          <ErrorCard message={screenState.message} />
          {screenState.image ? (
            <AppButton
              title={t('ocr.retry')}
              onPress={() => {
                analyze(screenState.image!);
              }}
            />
          ) : null}
          <AppButton
            title={t('ocr.pick_again')}
            variant="secondary"
            onPress={() => {
              pick();
            }}
          />
          <AppButton
            title={t('ocr.manual_text')}
            variant="secondary"
            onPress={() => navigation.navigate('PasteText')}
          />
        </ScrollView>
      </AppScreen>
    );
  }

  if (screenState.type === 'preview') {
    return (
      <AppScreen>
        <ScreenHeader onBack={handleBack} title={headerTitle} />
        <ScrollView
          contentContainerStyle={{
            gap: theme.spacing.lg,
            paddingHorizontal: theme.gutter,
            paddingTop: theme.spacing.sm,
          }}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={{uri: screenState.image.uri}}
            style={{
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.lg,
              height: 280,
              width: '100%',
            }}
          />
          <AppButton
            title={t('ocr.pick_again')}
            variant="secondary"
            onPress={() => {
              pick();
            }}
          />
        </ScrollView>
        <BottomActionBar
          style={{
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.outlineVariant,
            paddingBottom: theme.spacing.lg,
          }}
        >
          <ExtractButton onPress={() => analyze(screenState.image)} />
        </BottomActionBar>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing.lg,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityLabel={t('ocr.pick_from_gallery_a11y')}
          accessibilityRole="button"
          onPress={() => {
            pick();
          }}
          style={({pressed}) => [
            {
              alignItems: 'center',
              backgroundColor: theme.colors.surfaceLow,
              borderColor: theme.colors.accentSoft,
              borderRadius: theme.radius.lg,
              borderStyle: 'dashed',
              borderWidth: 2,
              gap: 10,
              opacity: pressed ? theme.states.pressedOpacity : 1,
              paddingHorizontal: 24,
              paddingVertical: 32,
            },
          ]}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.pill,
              height: 72,
              justifyContent: 'center',
              shadowColor: theme.colors.primary,
              shadowOffset: {width: 0, height: 8},
              shadowOpacity: 0.1,
              shadowRadius: 20,
              width: 72,
            }}
          >
            <MaterialIcon
              color={theme.colors.primary}
              name="add_photo_alternate"
              size={34}
            />
          </View>
          <AppText
            style={[styles.pickText, {color: theme.colors.primary}]}
            variant="h3"
          >
            {t('ocr.tap_to_pick')}
          </AppText>
          <AppText color="muted" variant="caption">
            {t('ocr.file_formats')}
          </AppText>
        </Pressable>

        <AppCard style={styles.ocrCard}>
          <MaterialIcon
            color={theme.colors.primary}
            name="auto_awesome"
            size={22}
          />
          <View style={styles.ocrTextContainer}>
            <AppText variant="label">{t('ocr.ocr_card_title')}</AppText>
            <AppText color="muted" variant="caption">
              {t('ocr.ocr_card_body')}
            </AppText>
          </View>
        </AppCard>
      </ScrollView>

      <BottomActionBar
        style={{
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.outlineVariant,
          paddingBottom: theme.spacing.lg,
        }}
      >
        <ExtractButton onPress={() => pick()} />
      </BottomActionBar>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.lg,
    },
    centered: {
      alignItems: 'center',
      flex: 1,
      gap: theme.spacing.lg,
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    empty: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 26,
      ...getStickerEdge(5, theme.colors.surfaceHigh),
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.secondarySoft,
      borderRadius: 26,
      height: 76,
      justifyContent: 'center',
      marginBottom: 4,
      width: 76,
      ...getStickerEdge(4, HERO_PALETTE.coralRing),
    },
    tips: {
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 20,
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    tipsTitle: {
      color: theme.colors.onTertiaryContainer,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    photoFrame: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.xl,
      height: 300,
      overflow: 'hidden',
      ...getStickerEdge(5, theme.colors.surfaceContainer),
    },
    scanLine: {
      backgroundColor: theme.colors.accent,
      height: 3,
      left: 0,
      position: 'absolute',
      right: 0,
      shadowColor: theme.colors.accent,
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.8,
      shadowRadius: 10,
      top: 0,
    },
    stepDot: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.surfaceHigh,
      borderRadius: 14,
      borderWidth: 2,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    stepDotNow: {
      backgroundColor: HERO_PALETTE.coral,
      borderColor: HERO_PALETTE.coral,
    },
    stepDotCore: {
      backgroundColor: HERO_PALETTE.white,
      borderRadius: 4,
      height: 8,
      width: 8,
    },
  });
}

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
  grow: {
    flex: 1,
  },
  photo: {
    height: '100%',
    width: '100%',
  },
  steps: {
    gap: 6,
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
  },
  tipRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
  },
  tipText: {
    flex: 1,
  },
  pickText: {
    fontWeight: '600',
  },
  ocrCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  ocrTextContainer: {
    flex: 1,
    gap: 2,
  },
  actionText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
