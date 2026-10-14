import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
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
import {useAppTheme} from '@ui/theme';

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

export function ImageCaptureScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
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

  if (screenState.type === 'picking' || screenState.type === 'analyzing') {
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
            {screenState.type === 'analyzing'
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
