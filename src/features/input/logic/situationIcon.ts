import type {HandoffIconName} from '@ui/icons/iconRegistry';

import type {Situation} from './momentClient';

/** First match wins: a situation's interests are more specific than its goals. */
const BY_TAG: ReadonlyArray<[string, HandoffIconName]> = [
  ['food', 'restaurant_menu'],
  ['shopping', 'sell'],
  ['health', 'heart'],
  ['fitness', 'fitness_center'],
  ['school', 'school'],
  ['travel', 'language'],
  ['work', 'event_note'],
  ['social', 'person'],
];

/** The small icon of a suggested situation, from the tags the server sends. */
export function situationIcon(
  situation: Pick<Situation, 'interests' | 'goals'>,
): HandoffIconName {
  const tags = [...situation.interests, ...situation.goals];
  for (const [tag, icon] of BY_TAG) {
    if (tags.includes(tag)) return icon;
  }
  return 'record_voice_over';
}
