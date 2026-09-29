/* eslint-disable react-hooks/exhaustive-deps */
import {useCallback, useEffect, useMemo, useState} from 'react';
import {createRequestId} from '@core/api/requestId';
import {
  findLatestPracticeSetForLesson,
  findLatestSessionForLesson,
} from './data/PracticeRepository';
import {buildDefaultPracticeConfig} from './practiceDefaults';
import {preparePracticeSet} from './practiceFlow';
import {
  projectPracticeUi,
  type PracticeUiProjection,
} from './practiceUiProjection';
import {createSession, retrySession} from './sessionEngine';

function loadProjection(
  lessonId: string,
  isPreparing: boolean,
): PracticeUiProjection {
  return projectPracticeUi({
    latestSet: findLatestPracticeSetForLesson(lessonId),
    latestSession: findLatestSessionForLesson(lessonId),
    isPreparing,
  });
}

type Args = {
  lessonId: string;
  lessonRevision: number;
  lessonLevel: string;
  isOffline: boolean;
  enabled: boolean;
};

export function usePracticeController({
  lessonId,
  lessonRevision,
  lessonLevel,
  isOffline,
  enabled,
}: Args) {
  const [isPreparing, setIsPreparing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [versionMismatchWarning, setVersionMismatchWarning] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const projection = useMemo(() => {
    if (!enabled) {
      return projectPracticeUi({
        latestSet: null,
        latestSession: null,
        isPreparing: false,
      });
    }
    return loadProjection(lessonId, isPreparing);
  }, [enabled, lessonId, isPreparing, refreshToken]);

  const refresh = useCallback(() => {
    setActionError(null);
    setIsPreparing(false);
    setRefreshToken(token => token + 1);
  }, []);

  useEffect(() => {
    if (enabled) {
      refresh();
    }
  }, [enabled, lessonId, lessonRevision, refresh]);

  const createPracticeSet = useCallback(async () => {
    if (!enabled) {
      return null;
    }
    if (isOffline) {
      setActionError('Không có kết nối mạng. Thử lại khi có mạng.');
      return null;
    }
    setActionError(null);
    setIsPreparing(true);
    try {
      const config = buildDefaultPracticeConfig({
        level: lessonLevel,
      });
      const result = await preparePracticeSet(
        lessonId,
        lessonRevision,
        config,
        createRequestId(),
      );
      setRefreshToken(token => token + 1);
      if (result.status === 'ready') {
        setVersionMismatchWarning(result.hasVersionMismatchWarning);
        return result;
      }
      if (result.status === 'network_error') {
        setActionError(
          'Không thể tạo bài luyện tập. Kiểm tra mạng và thử lại.',
        );
      } else if (result.status === 'rejected') {
        setActionError('Bài học chưa có đủ nội dung để tạo bài luyện tập.');
      } else if (result.status === 'generation_failed') {
        setActionError('Không tạo được bài luyện tập. Thử lại.');
      } else {
        setActionError('Không thể tạo bài luyện tập lúc này.');
      }
      return null;
    } finally {
      setIsPreparing(false);
    }
  }, [enabled, isOffline, lessonId, lessonLevel, lessonRevision]);

  const startNewSession = useCallback(() => {
    const set = projection.practiceSet;
    if (!set || set.status !== 'ready') {
      return null;
    }
    const session = createSession({set});
    setRefreshToken(token => token + 1);
    return session;
  }, [projection.practiceSet]);

  const resumeExistingSession = useCallback(() => {
    if (projection.session?.status === 'in_progress') {
      return projection.session;
    }
    return null;
  }, [projection.session]);

  const restartAfterCompletion = useCallback(() => {
    const session = projection.session;
    if (!session) {
      return null;
    }
    const next = retrySession({sessionId: session.id});
    setRefreshToken(token => token + 1);
    return next;
  }, [projection.session]);

  return {
    projection,
    isPreparing,
    actionError,
    versionMismatchWarning,
    createPracticeSet,
    startNewSession,
    resumeExistingSession,
    restartAfterCompletion,
    refresh,
  };
}

export type UsePracticeController = ReturnType<typeof usePracticeController>;
