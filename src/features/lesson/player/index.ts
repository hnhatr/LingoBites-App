export {
  CURRICULUM_LESSON_FIXTURE_REVISION,
  CURRICULUM_LESSON_SERVER_FIXTURE_SHA,
  CurriculumLessonTextVariantValues,
  CurriculumLessonTextBlockDataSchema,
  CurriculumLessonExampleBlockDataSchema,
  CurriculumLessonVocabularyItemSchema,
  CurriculumLessonMediaAssetSchema,
  CurriculumLessonMultipleChoiceOptionSchema,
  CurriculumLessonMultipleChoiceConfigSchema,
  CurriculumLessonFillBlankConfigSchema,
  CurriculumLessonTranslationConfigSchema,
  CurriculumLessonMultipleChoiceExerciseSchema,
  CurriculumLessonFillBlankExerciseSchema,
  CurriculumLessonTranslationExerciseSchema,
  CurriculumLessonExerciseExplanationSchema,
  CurriculumLessonExerciseSchema,
  CurriculumLessonDialogueTurnSchema,
  CurriculumLessonDialogueTurnSpeakerValues,
  CurriculumLessonContextBlockDataSchema,
  CurriculumLessonGrammarExampleSchema,
  CurriculumLessonGrammarTiedActionValues,
  CurriculumLessonGrammarBlockDataSchema,
  CurriculumLessonActivityKindValues,
  CurriculumLessonActivityBlockDataSchema,
  CurriculumLessonTextBlockSchema,
  CurriculumLessonExampleBlockSchema,
  CurriculumLessonVocabularyBlockSchema,
  CurriculumLessonMediaBlockSchema,
  CurriculumLessonExerciseBlockSchema,
  CurriculumLessonContextBlockSchema,
  CurriculumLessonGrammarBlockSchema,
  CurriculumLessonActivityBlockSchema,
  CurriculumLessonCheckAnswerSchema,
  CurriculumLessonBlockSchema,
  CurriculumLessonUnsupportedBlockSchema,
  CurriculumLessonAggregateSchema,
  CurriculumLessonAggregateSuccessResponseSchema,
  CurriculumLessonCheckRequestBodySchema,
  CurriculumLessonCheckSuccessResponseSchema,
  CurriculumLessonErrorCodeSchema,
  CurriculumLessonErrorResponseSchema,
  parseCurriculumLessonBlock,
  parseCurriculumLessonAggregateResponse,
  parseCurriculumLessonCheckResponse,
} from './logic/curriculumLessonSchema';
export type {
  CurriculumLessonTextBlockData,
  CurriculumLessonExampleBlockData,
  CurriculumLessonVocabularyItem,
  CurriculumLessonMediaAsset,
  CurriculumLessonMultipleChoiceOption,
  CurriculumLessonMultipleChoiceConfig,
  CurriculumLessonFillBlankConfig,
  CurriculumLessonTranslationConfig,
  CurriculumLessonMultipleChoiceExercise,
  CurriculumLessonFillBlankExercise,
  CurriculumLessonTranslationExercise,
  CurriculumLessonExerciseExplanation,
  CurriculumLessonExercise,
  CurriculumLessonDialogueTurn,
  CurriculumLessonContextBlockData,
  CurriculumLessonGrammarExample,
  CurriculumLessonGrammarBlockData,
  CurriculumLessonActivityBlockData,
  CurriculumLessonActivityKind,
  CurriculumLessonCheckAnswerInput,
  CurriculumLessonBlock,
  CurriculumLessonUnsupportedBlock,
  CurriculumLessonParsedBlock,
  CurriculumLesson,
  CurriculumLessonCheckAnswer,
  CurriculumLessonErrorCode,
  CurriculumLessonAggregateParseResult,
  CurriculumLessonCheckParseResult,
} from './logic/curriculumLessonSchema';
export {
  defaultCurriculumLessonSoundFactory,
  useCurriculumLessonAudio,
} from './logic/curriculumLessonAudio';
export type {
  CurriculumLessonSoundFactory,
  CurriculumLessonSoundHandle,
  CurriculumLessonAudioStatus,
  UseCurriculumLessonAudioOptions,
  UseCurriculumLessonAudioResult,
} from './logic/curriculumLessonAudio';
export {
  CURRICULUM_LESSON_BLOCK_RENDERERS,
  resolveCurriculumLessonBlockRenderer,
} from './logic/blockRegistry';
export type {CurriculumLessonBlockType} from './logic/blockRegistry';
export {TextBlockView} from './components/TextBlockView';
export {ContextBlockView} from './components/ContextBlockView';
export {GrammarBlockView} from './components/GrammarBlockView';
export {ActivityBlockView} from './components/ActivityBlockView';
export {ExampleBlockView} from './components/ExampleBlockView';
export {VocabularyBlockView} from './components/VocabularyBlockView';
export {MediaBlockView} from './components/MediaBlockView';
export {ExerciseBlockView} from './components/ExerciseBlockView';
export type {CurriculumLessonCheckFn} from './components/ExerciseBlockView';
export {UnsupportedBlockView} from './components/UnsupportedBlockView';
export {
  CurriculumLessonBlockSlot,
  CurriculumLessonBlockView,
} from './components/CurriculumLessonBlockView';
export type {CurriculumLessonBlockViewProps} from './components/CurriculumLessonBlockView';
export {CurriculumLessonPlayer} from './components/CurriculumLessonPlayer';
export type {CurriculumLessonPlayerProps} from './components/CurriculumLessonPlayer';
export {CurriculumLessonsEntry} from './components/CurriculumLessonsEntry';
export type {
  CanonicalCatalogRouteParams,
  CanonicalLessonPlayerRouteParams,
  LessonCreationRouteParams,
} from './screens/navigationTypes';
export {CanonicalLessonCatalogScreen} from './screens/CanonicalLessonCatalogScreen';
export {CanonicalLessonPlayerScreen} from './screens/CanonicalLessonPlayerScreen';
export {LessonCreationScreen} from './screens/LessonCreationScreen';
export {CanonicalLessonPlayer} from './components/CanonicalLessonPlayer';
export type {CanonicalLessonPlayerProps} from './components/CanonicalLessonPlayer';
export {CanonicalBlockView} from './components/CanonicalBlockView';
export {SentenceAnalysisPanel} from './components/SentenceAnalysisPanel';
export type {
  SentenceAnalysisPanelError,
  SentenceAnalysisPanelProps,
  SentenceAnalysisPanelState,
} from './components/SentenceAnalysisPanel';
export {YouTubeTimeline} from './components/YouTubeTimeline';
export type {YouTubeTimelineProps} from './components/YouTubeTimeline';
export {YouTubePlayer} from './components/YouTubePlayer';
export type {
  YouTubePlayerErrorCode,
  YouTubePlayerRef,
} from './components/YouTubePlayer';
export {
  buildCanonicalLessonProgression,
  hasDownloadedLessons,
  lessonMatchesKeywords,
  listDownloadedLessonSummaries,
  sentencesToSpeakingLines,
} from './logic/canonicalDownloadContent';
export type {
  CanonicalLessonProgression,
  DownloadedLessonSummary,
} from './logic/canonicalDownloadContent';
export {
  fetchLessonCatalog,
  fetchLessonCreationStatus,
  fetchLessonRevisions,
  fetchLessonSnapshot,
  fetchSentenceAnalysis,
  submitLessonCreation,
} from './logic/canonicalLessonClient';
export type {
  CanonicalLessonClientOptions,
  CanonicalLessonError,
  CanonicalLessonErrorKind,
  CanonicalLessonResult,
  LessonDownloadStatus,
} from './logic/canonicalLessonClient';
export {
  applyLessonRevisionStates,
  getLessonDownload,
  InvalidLessonSnapshotError,
  lessonMediaDirFor,
  listLessonDownloads,
  removeLessonDownload,
  saveLessonSnapshotBody,
  stageLessonMedia,
  sweepLessonMedia,
  LESSON_MEDIA_ROOT_SEGMENT,
} from './logic/canonicalDownloadRepository';
export type {
  LessonDownloadRecord,
  LessonMediaFileSystem,
  RevisionApplication,
  SaveLessonSnapshotInput,
} from './logic/canonicalDownloadRepository';
export {
  clearCreationIdempotencyKey,
  getOrCreateCreationIdempotencyKey,
  rotateCreationIdempotencyKey,
} from './logic/creationIdempotencyStore';
export {
  activeSentenceIndexAt,
  areCuesBoundedByDuration,
  formatCueTimestamp,
} from './logic/canonicalYouTubeCues';
export {useCanonicalCatalog} from './logic/useCanonicalCatalog';
export type {CanonicalCatalogState} from './logic/useCanonicalCatalog';
export {openLesson, openLessonCatalog} from './logic/lessonNavigation';
export type {
  LessonCatalogNavigation,
  LessonPlayerNavigation,
} from './logic/lessonNavigation';
export {useCanonicalLesson} from './logic/useCanonicalLesson';
export type {CanonicalLessonViewState} from './logic/useCanonicalLesson';
export {useLessonCreation} from './logic/useLessonCreation';
export type {LessonCreationState} from './logic/useLessonCreation';
export {fetchPublishedCurriculumLessons} from './logic/curriculumLessonSelection';
export type {
  CurriculumLessonSelectionItem,
  CurriculumLessonSelectionResult,
  CurriculumLessonSelectionOptions,
} from './logic/curriculumLessonSelection';
export {
  fetchCurriculumLesson,
  checkCurriculumLessonExercise,
} from './logic/curriculumLessonClient';

export {
  createLessonGenerationJob,
  fetchLessonGenerationJob,
  isLessonGenerationTerminal,
  LessonGenerationJobStatusValues,
  LessonGenerationWarningSchema,
  LessonGenerationErrorSchema,
  LessonGenerationJobSchema,
  LessonGenerationJobEnvelopeSchema,
} from './logic/lessonJobClient';
export type {
  LessonGenerationJob,
  LessonGenerationJobStatus,
  LessonJobErrorKind,
  LessonJobError,
  LessonJobResult,
  LessonJobClientOptions,
  CreateLessonGenerationJobInput,
} from './logic/lessonJobClient';
export {
  fetchLessonServerCapabilities,
  useLessonServerCapabilities,
  isUnifiedLessonReady,
} from './logic/lessonCapabilities';
export type {
  LessonServerCapabilities,
  UnifiedLessonReleaseFlags,
} from './logic/lessonCapabilities';
export {useLessonGenerationJob} from './logic/useLessonGenerationJob';
export type {
  LessonGenerationState,
  UseLessonGenerationJobOptions,
} from './logic/useLessonGenerationJob';
export type {
  CurriculumLessonErrorKind,
  CurriculumLessonError,
  CurriculumLessonResult,
  CurriculumLessonCheckResult,
  CurriculumLessonClientOptions,
  CurriculumLessonAnswerInput,
} from './logic/curriculumLessonClient';
export {
  LEARNING_PROGRESS_CLIENT_FIXTURE_REVISION,
  LEARNING_PROGRESS_CLIENT_DESIGN_REF,
  LessonProgressStatusSchema,
  LessonProgressSchema,
  VocabularyProgressStatusSchema,
  VocabularyProgressSchema,
  AttemptResultSchema,
  startLessonProgress,
  completeLessonProgress,
  listLessonProgress,
  submitExerciseAttempt,
  markVocabularySeen,
  setVocabularyProgress,
  fetchContinueLearning,
} from './logic/api/learningProgressClient';
export type {
  LessonProgressStatus,
  LessonProgress,
  VocabularyProgressStatus,
  VocabularyProgress,
  AttemptResult,
  LearningAttemptAnswer,
  LearningClientErrorKind,
  LearningClientError,
  StartLessonResult,
  CompleteLessonResult,
  LessonProgressListResult,
  SubmitAttemptResult,
  VocabularySeenResult,
  SetVocabularyProgressResult,
  ContinueLearningResult,
  LearningClientOptions,
} from './logic/api/learningProgressClient';
export {
  resolveLessonDestination,
  startLessonFromConfirmedText,
} from './logic/startLessonFromConfirmedText';
export type {
  LessonDestination,
  LessonFeatureFlags,
  UnifiedLessonReadiness,
  NavigateFn,
} from './logic/startLessonFromConfirmedText';
