import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ProfileStackParamList} from './navigationTypes';
import {ProfileScreenView} from './ProfileScreenView';
import {useProfileScreen} from '../logic/useProfileScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

export type ProfileScreenProps = Props;

export function ProfileScreen({navigation}: Props) {
  const viewModel = useProfileScreen(navigation);
  return <ProfileScreenView {...viewModel} />;
}
