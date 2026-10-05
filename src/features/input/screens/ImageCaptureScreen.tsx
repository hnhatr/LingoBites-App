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
import {ImagePlaceholder} from '@ui/components/ImagePlaceholder';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {SectionHeader} from '@ui/components/SectionHeader';
import {useAppTheme} from '@ui/theme';

import {
  type PickedImage,
  pickImageFromCamera,
  pickImageFromGallery,
} from '../logic/imagePicker';
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

const RECENT_PLACEHOLDERS = ['flyer.jpg', 'menu.png', 'sign.jpg'] as const;

export function ImageCaptureScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
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

  async function handleContinue(image: PickedImage) {
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

  const headerTitle = isGallery ? 'Upload ảnh' : 'Chụp ảnh';

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
              ? 'Đang nhận diện chữ trong ảnh...'
              : isGallery
              ? 'Đang mở thư viện ảnh...'
              : 'Đang mở camera...'}
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
            title="Nhập text thủ công"
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
              title="Thử OCR lại"
              onPress={() => {
                handleContinue(screenState.image!);
              }}
            />
          ) : null}
          <AppButton
            title="Chọn ảnh khác"
            variant="secondary"
            onPress={() => {
              launchPicker();
            }}
          />
          <AppButton
            title="Nhập text thủ công"
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
            title="Chọn ảnh khác"
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
            accessibilityLabel="Trích xuất text"
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
              Trích xuất text
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
          accessibilityLabel="Chọn ảnh từ thư viện"
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
            Chạm để chọn ảnh
          </AppText>
          <AppText color="muted" variant="caption">
            PNG hoặc JPG
          </AppText>
        </Pressable>

        <View>
          <SectionHeader title="Ảnh gần đây" />
          <View style={styles.recentRow}>
            {RECENT_PLACEHOLDERS.map(label => (
              <View key={label} style={styles.flex1}>
                <ImagePlaceholder height={96} label={label} />
              </View>
            ))}
          </View>
        </View>

        <AppCard style={styles.ocrCard}>
          <MaterialIcon
            color={theme.colors.primary}
            name="auto_awesome"
            size={22}
          />
          <View style={styles.ocrTextContainer}>
            <AppText variant="label">OCR thông minh</AppText>
            <AppText color="muted" variant="caption">
              Tự phát hiện ngôn ngữ và trích các từ đáng học từ ảnh của bạn.
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
          accessibilityLabel="Trích xuất text"
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
            Trích xuất text
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
  recentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flex1: {
    flex: 1,
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
