import React from 'react';
import {ScrollView, StyleSheet} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

type Props = {
  title: string;
  onBack: () => void;
  statusMessage?: string | null;
  children: React.ReactNode;
};

/** Shared frame for the pages opened from the Profile hub. */
export function ProfileSubpage({
  title,
  onBack,
  statusMessage,
  children,
}: Props) {
  const {theme} = useAppTheme();
  const clearance = useFloatingTabBarClearance();

  return (
    <AppScreen>
      <ScreenHeader onBack={onBack} title={title} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            gap: theme.spacing.lg,
            paddingBottom: clearance,
            paddingHorizontal: theme.gutter,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
        {statusMessage ? (
          <AppText color="secondary">{statusMessage}</AppText>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
  },
});
