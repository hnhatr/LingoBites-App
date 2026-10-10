import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {getImageSizeCategory, trackEvent} from '@features/analytics';
import {extractText} from '@features/ocr';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {ErrorCard} from '@ui/components/ErrorCard';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

import {useFeatureFlags} from '@core/release';

import {
  type PickedImage,
  pickImageFromCamera,
  pickImageFromGallery,
} from '../logic/imagePicker';
import {analyzeImage} from '../logic/momentClient';
import {ensurePhotoConsent} from '../logic/photoConsent';
import type {CreateFlowParamList} from './navigationTypes';
type Props = NativeStackScreenProps<CreateFlowParamList, 'ImageCapture'>;

export type ImageCaptureScreenProps = Props;

type ScreenState =
  | {type: 'upload_idle'}
  | {type: 'picking'}
  | {type: 'preview'; image: PickedImage}
  | {type: 'ocr_loading'; image: PickedImage}
  | {type: 'permission_denied'}
  | {type: 'error'; message: string; image?: PickedImage};

export function ImageCaptureScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const {config} = useFeatureFlags();
  const momentFlow = config.features.momentFlow === true;
  const {sourceType} = route.params;
  const isGallery = sourceType === 'gallery';
  const [screenState, setScreenState] = useState<ScreenState>(
    isGallery ? {type: 'upload_idle'} : {type: 'picking'},
  );
  const ocrAbortRef = useRef<AbortController | null>(null);
  const ocrRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      ocrAbortRef.current?.abort();
    };
  }, []);

  const launchPicker = useCallback(async () => {
    setScreenState({type: 'picking'});
    const result =
      sourceType === 'camera'
        ? await pickImageFromCamera()
        : await pickImageFromGallery();

    if (!result.ok) {
      if (result.reason === 'permission_denied') {
        setScreenState({type: 'permission_denied'});
        return;
      }

      if (result.reason === 'cancelled') {
        if (isGallery) {
          setScreenState({type: 'upload_idle'});
        } else {
          navigation.goBack();
        }
        return;
      }

      setScreenState({
        type: 'error',
        message: result.message ?? t('errors.ocr_failed'),
      });
      return;
    }

    setScreenState({type: 'preview', image: result.image});
    trackEvent('image_selected', {
      source: sourceType,
      image_size_category: getImageSizeCategory(
        result.image.width,
        result.image.height,
      ),
      has_permission: true,
    });
  }, [isGallery, navigation, sourceType, t]);

  useEffect(() => {
    if (!isGallery) {
      launchPicker();
    }
  }, [isGallery, launchPicker]);

  /** E3 (P1, P8): with momentFlow on, the server reads and checks the photo, then the learner chooses. */
  async function analyzeForMoment(image: PickedImage) {
    const consented = await ensurePhotoConsent({
      title: t('moment.consent_title'),
      body: t('moment.consent_body'),
      confirmLabel: t('moment.consent_confirm'),
      cancelLabel: t('moment.consent_cancel'),
    });
    if (!consented) {
      setScreenState({type: 'preview', image});
      return;
    }
    setScreenState({type: 'ocr_loading', image});
    const result = await analyzeImage(image, sourceType);
    if (!result.ok) {
      setScreenState({
        type: 'error',
        message: result.message || t('errors.ocr_failed'),
        image,
      });
      return;
    }
    navigation.replace('MomentReview', {
      sourceType,
      image,
      analysis: result.value,
    });
  }

  async function handleContinue(image: PickedImage) {
    if (momentFlow) {
      await analyzeForMoment(image);
      return;
    }
    ocrAbortRef.current?.abort();
    const controller = new AbortController();
    ocrAbortRef.current = controller;
    const requestId = ++ocrRequestIdRef.current;

    setScreenState({type: 'ocr_loading', image});

    const result = await extractText(
      {
        uri: image.uri,
        fileName: image.fileName,
        type: image.type,
        width: image.width,
        height: image.height,
        sourceType,
      },
      controller.signal,
    );

    if (requestId !== ocrRequestIdRef.current) {
      return;
    }

    if (!result.ok) {
      if (result.cancelled) {
        return;
      }

      setScreenState({
        type: 'error',
        message: result.message,
        image,
      });
      return;
    }

    navigation.replace('OCRReview', {
      imageUri: image.uri,
      fileName: image.fileName,
      mimeType: image.type,
      width: image.width,
      height: image.height,
      sourceType,
      extractedText: result.extractedText,
      warnings: result.warnings,
    });
  }

  function handleBack() {
    if (screenState.type === 'preview' && isGallery) {
      setScreenState({type: 'upload_idle'});
      return;
    }
    navigation.goBack();
  }

  const headerTitle = isGallery
    ? t('ocr.title_gallery')
    : t('ocr.title_capture');

  if (screenState.type === 'picking' || screenState.type === 'ocr_loading') {
    return (
      <AppScreen>
        <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
        <View
          style={{
            alignItems: 'center',
            flex: 1,
            gap: theme.spacing.lg,
            justifyContent: 'center',
            padding: theme.spacing.xl,
          }}
        >
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <AppText color="secondary" style={styles.centerText}>
            {screenState.type === 'ocr_loading'
              ? t('ocr.scanning')
              : isGallery
              ? t('ocr.opening_gallery')
              : t('ocr.opening_camera')}
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
              launchPicker();
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
                handleContinue(screenState.image!);
              }}
            />
          ) : null}
          <AppButton
            title={t('ocr.pick_again')}
            variant="secondary"
            onPress={() => {
              launchPicker();
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
              launchPicker();
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
          <Pressable
            accessibilityLabel={t('ocr.extract_a11y')}
            accessibilityRole="button"
            onPress={() => {
              handleContinue(screenState.image);
            }}
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
            <AppText
              style={{
                color: theme.colors.text.inverse,
                fontSize: 18,
                fontWeight: '600',
              }}
            >
              {t('ocr.extract')}
            </AppText>
          </Pressable>
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
            launchPicker();
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
        <Pressable
          accessibilityLabel={t('ocr.extract_a11y')}
          accessibilityRole="button"
          onPress={() => {
            launchPicker();
          }}
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
          <AppText
            style={{
              color: theme.colors.text.inverse,
              fontSize: 18,
              fontWeight: '600',
            }}
          >
            {t('ocr.extract')}
          </AppText>
        </Pressable>
      </BottomActionBar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
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
