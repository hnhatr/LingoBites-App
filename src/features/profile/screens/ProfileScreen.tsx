import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';

import {SpeakingRecordingsSettingsRow} from '@features/speaking';

import {useProfileScreen} from '../logic/useProfileScreen';
import type {ProfileStackParamList} from './navigationTypes';
import {ProfileScreenView} from './ProfileScreenView';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

export type ProfileScreenProps = Props;

export function ProfileScreen({navigation}: Props) {
  const viewModel = useProfileScreen(navigation);
  return (
    <ProfileScreenView
      {...viewModel}
      speakingRecordingsSection={<SpeakingRecordingsSettingsRow />}
    />
  );
}
