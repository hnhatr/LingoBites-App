import type {
  YouTubeSegment,
  YouTubeTranscript,
} from '../logic/youtubeTranscriptPort';
import type {SentenceEnrichment} from '@core/schemas/sentence-contract';
import type {RetryBlockFn} from '../logic/sentence/useSentenceEnrichment';

export type YouTubeLessonScreenProps = {
  lesson: YouTubeTranscript;
  onBack?: () => void;
  onStartPractice?: () => void;
  /**
   * SETE-283 (HVB-07): the lesson opened even though the local save failed.
   * Shows a persistent not-saved warning instead of any saved state.
   */
  saveWarning?: boolean;
  /**
   * SETE-325 (C-3): when set, each line shows a mic button that reports
   * the tapped sentence (the route screen navigates it to SpeakingRoom).
   * The route screen owns navigation, so this screen only forwards taps.
   */
  onPracticeSentence?: (segment: YouTubeSegment) => void;
  level?: string | null;
  enrichmentMap?: Record<number, SentenceEnrichment | null>;
  retryBlock?: RetryBlockFn;
  testID?: string;
};
