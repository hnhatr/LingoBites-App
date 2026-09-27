import type {
  RawCue,
  YouTubeTranscript,
} from '@shared/schemas/youtube-transcript-v1';

export type YouTubeInputRouteParams =
  | {
      fromHome?: boolean;
      url?: string;
      transcriptRequired?: string;
    }
  | undefined;

export type YouTubeProcessingRouteParams = {
  url: string;
  manualCues?: RawCue[];
};

export type YouTubeLessonRouteParams =
  | {
      lesson: YouTubeTranscript;
      saveFailed?: boolean;
    }
  | {
      lessonId: string;
    };

export type YouTubeHistoryRouteParams = undefined;
