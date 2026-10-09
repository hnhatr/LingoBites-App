import {useEffect, useState} from 'react';

import {fetchCourseLevels} from '@features/course';

import {LEARNING_COURSE_SLUG} from './profileOptions';
import {useLearnerProfileStore} from './useLearnerProfileStore';

export type LearningPath = {
  levelCode: string;
  levelId: string;
  title: string;
};

/**
 * Phase 2 (P2.4): where the learner starts — the level of the trial course
 * matching their profile. Null until the profile and the level list are
 * known, or when the course has no such level (the card stays hidden).
 */
export function useLearningPath(): LearningPath | null {
  const levelCode = useLearnerProfileStore(state => state.profile?.levelCode);
  const [path, setPath] = useState<LearningPath | null>(null);

  useEffect(() => {
    if (!levelCode) {
      setPath(null);
      return;
    }
    const controller = new AbortController();
    fetchCourseLevels(LEARNING_COURSE_SLUG, {signal: controller.signal})
      .then(result => {
        if (controller.signal.aborted) return;
        const level = result.ok
          ? result.value.find(entry => entry.code === levelCode)
          : undefined;
        setPath(
          level ? {levelCode, levelId: level.id, title: level.title} : null,
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [levelCode]);

  return path;
}
