import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {featureRegistry, useFeatureFlags} from '@core/release';
import type {FeatureRegistryEntry} from '@core/release/types';

import type {ProfileStackParamList} from './navigationTypes';

type Props = Partial<
  NativeStackScreenProps<ProfileStackParamList, 'FeatureStatus'>
>;

export function FeatureStatusScreen({navigation}: Props = {}) {
  const {theme} = useAppTheme();
  const themedStyles = makeStyles(theme);
  const {isFeatureEnabled} = useFeatureFlags();

  return (
    <AppScreen>
      <ScreenHeader
        onBack={navigation ? () => navigation.goBack() : undefined}
        title="Feature Status"
      />
      <ScrollView contentContainerStyle={themedStyles.scrollContent}>
        {featureRegistry.map(item => {
          const entry = item as unknown as FeatureRegistryEntry;
          const isEnabled = isFeatureEnabled(entry.key as any);
          const isMissing = entry.status === 'not_implemented';

          return (
            <AppCard key={entry.key} style={themedStyles.card}>
              <View style={themedStyles.row}>
                <AppText style={themedStyles.title}>{entry.key}</AppText>
                <View
                  style={[
                    themedStyles.badge,
                    isEnabled
                      ? themedStyles.badgeEnabled
                      : themedStyles.badgeDisabled,
                  ]}
                >
                  <AppText style={themedStyles.badgeText}>
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </AppText>
                </View>
              </View>
              <AppText color="secondary" variant="caption">
                Module: {entry.module}
              </AppText>
              <AppText color="secondary" variant="caption">
                Status: {entry.status}
              </AppText>
              <AppText color="secondary" variant="caption">
                Group: {entry.releaseGroup}
              </AppText>
              {entry.limitations && entry.limitations.length > 0 && (
                <View style={themedStyles.limitations}>
                  <AppText variant="caption" color="danger">
                    Limitations:
                  </AppText>
                  {entry.limitations.map((limit: string, idx: number) => (
                    <AppText key={idx} variant="caption" color="danger">
                      - {limit}
                    </AppText>
                  ))}
                </View>
              )}
              {entry.entryPoint && !isMissing && (
                <View style={themedStyles.launchContainer}>
                  <AppText variant="caption" color="primary">
                    Entry Point: {entry.entryPoint}
                  </AppText>
                </View>
              )}
            </AppCard>
          );
        })}
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    card: {
      gap: 4,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontWeight: 'bold',
      fontSize: 16,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    badgeEnabled: {
      backgroundColor: theme.colors.secondarySoft,
    },
    badgeDisabled: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    limitations: {
      marginTop: 8,
    },
    launchContainer: {
      marginTop: 8,
      padding: 8,
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: 4,
    },
  });
}
