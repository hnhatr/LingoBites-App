import React from 'react';
import {StyleSheet, View} from 'react-native';

/**
 * Boot gate route (SETE-303 / T6). The root navigator still mounts this route
 * for every account phase that cannot reach `Tabs`, but what the learner sees
 * (loading, offline / failure retry, the signed-out Continue action) is drawn
 * by the app-level `LaunchGate`, which covers the whole navigator in those
 * phases. This screen stays empty underneath it.
 */
export function BootGateScreen() {
  return <View style={styles.fill} testID="boot-gate" />;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
