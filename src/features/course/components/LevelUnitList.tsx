import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';

import {LibraryCover} from '@ui/components/LibraryCover';

import type {CourseUnit} from '../logic/courseClient';
import {curriculumGlyph} from '../logic/curriculumCover';
import {useLevelUnits} from '../logic/useCurriculum';
import {CurriculumList} from './CurriculumList';
import {UnitProgressBar} from './UnitProgressBar';

type Props = {
  levelId: string;
  /** The level code (e.g. A1): colours the units' default covers. */
  levelCode?: string;
  /** Shown above the units (e.g. the course screen's level switcher). */
  header?: React.ReactElement;
  onOpenUnit: (unit: CourseUnit) => void;
  testID: string;
};

/**
 * Units of one level, each with its cover picture (else a default cover in
 * the level colour) and a progress bar of its completed lessons (F14). Re-counted on focus, so finishing a lesson updates the bar on back.
 */
export function LevelUnitList({
  levelId,
  levelCode,
  header,
  onOpenUnit,
  testID,
}: Props) {
  const {t} = useTranslation();
  const {state, refresh} = useLevelUnits(levelId);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const rows =
    state.status === 'ready'
      ? state.data.map(({unit, progress}, index) => ({
          id: unit.id,
          eyebrow: t('course.unit_number', {number: index + 1}),
          title: unit.title,
          thumbnail: (
            <LibraryCover
              glyph={curriculumGlyph(unit.title, unit.canDo[0])}
              hideLevelChip
              imageUrl={unit.coverUrl}
              level={levelCode}
              shape="pack"
              testID={`unit-cover-${unit.id}`}
            />
          ),
          // The unit's first can-do says what it is for; else its blurb.
          description: unit.canDo[0]
            ? t('course.unit_can_do', {text: unit.canDo[0]})
            : unit.description,
          footer: progress ? (
            <UnitProgressBar
              progress={progress}
              testID={`unit-progress-${unit.id}`}
            />
          ) : null,
          accessibilityHint: t('course.unit_row_hint'),
          onPress: () => onOpenUnit(unit),
        }))
      : [];

  return (
    <CurriculumList
      emptyMessage={t('course.units_empty')}
      header={header}
      onRetry={refresh}
      rows={rows}
      status={state.status}
      testID={testID}
    />
  );
}
