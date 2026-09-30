import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {useHomeScreenController} from '../logic/useHomeScreenController';
import {HomeScreenView} from './HomeScreenView';
import type {HomeStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export type HomeScreenProps = Props;

/**
 * Paper-cut home (SETE-279): hero → 2×2 explore grid → "Tiếp tục học" rail.
 * Orchestration lives in {@link useHomeScreenController}; rendering in
 * {@link HomeScreenView}.
 */
export function HomeScreen({navigation}: Props) {
  const viewModel = useHomeScreenController({navigation});
  return <HomeScreenView {...viewModel} />;
}
