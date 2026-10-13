import type {useTranslation} from 'react-i18next';

import type {PackKindCounts} from '../logic/packRows';

type Translate = ReturnType<typeof useTranslation>['t'];

/** "10 từ · 2 cụm từ": the kinds a pack holds, the most common first. */
export function kindSummary(t: Translate, counts: PackKindCounts): string {
  return (Object.keys(counts) as Array<keyof PackKindCounts>)
    .filter(kind => counts[kind] > 0)
    .sort((a, b) => counts[b] - counts[a])
    .map(kind => t(`wordPath.kind_${kind}`, {count: counts[kind]}))
    .join(' · ');
}
