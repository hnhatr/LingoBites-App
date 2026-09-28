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
} from './curriculumLessonSchema';
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
} from './curriculumLessonSchema';
export {
  defaultCurriculumLessonSoundFactory,
  useCurriculumLessonAudio,
} from './curriculumLessonAudio';
export type {
  CurriculumLessonSoundFactory,
  CurriculumLessonSoundHandle,
  CurriculumLessonAudioStatus,
  UseCurriculumLessonAudioOptions,
  UseCurriculumLessonAudioResult,
} from './curriculumLessonAudio';
export {
  CURRICULUM_LESSON_BLOCK_RENDERERS,
  resolveCurriculumLessonBlockRenderer,
} from './blockRegistry';
export type {CurriculumLessonBlockType} from './blockRegistry';
export {TextBlockView} from './TextBlockView';
export {ContextBlockView} from './ContextBlockView';
export {GrammarBlockView} from './GrammarBlockView';
export {ActivityBlockView} from './ActivityBlockView';
export {ExampleBlockView} from './ExampleBlockView';
export {VocabularyBlockView} from './VocabularyBlockView';
export {MediaBlockView} from './MediaBlockView';
export {ExerciseBlockView} from './ExerciseBlockView';
export type {CurriculumLessonCheckFn} from './ExerciseBlockView';
export {UnsupportedBlockView} from './UnsupportedBlockView';
export {
  CurriculumLessonBlockSlot,
  CurriculumLessonBlockView,
} from './CurriculumLessonBlockView';
export type {CurriculumLessonBlockViewProps} from './CurriculumLessonBlockView';
export {CurriculumLessonPlayer} from './CurriculumLessonPlayer';
export type {CurriculumLessonPlayerProps} from './CurriculumLessonPlayer';
export {CurriculumLessonScreen} from './CurriculumLessonScreen';
export {CurriculumLessonsEntry} from './CurriculumLessonsEntry';
export type {
  CurriculumLessonRouteParams,
  UnifiedLessonGenerationRouteParams,
  UnifiedLessonsPreviewRouteParams,
} from './navigationTypes';
export {fetchPublishedCurriculumLessons} from './curriculumLessonSelection';
export type {
  CurriculumLessonSelectionItem,
  CurriculumLessonSelectionResult,
  CurriculumLessonSelectionOptions,
} from './curriculumLessonSelection';
export {
  fetchCurriculumLesson,
  checkCurriculumLessonExercise,
} from './curriculumLessonClient';
export {
  fetchLessonCatalogPage,
  UnifiedLessonSummarySchema,
  UnifiedLessonCatalogResponseSchema,
  LESSON_CATALOG_LIMIT_MIN,
  LESSON_CATALOG_LIMIT_MAX,
  LESSON_CATALOG_LIMIT_DEFAULT,
} from './lessonCatalogClient';
export type {
  UnifiedLessonSummary,
  LessonCatalogErrorKind,
  LessonCatalogError,
  LessonCatalogResult,
  LessonCatalogClientOptions,
} from './lessonCatalogClient';
export {
  createLessonGenerationJob,
  fetchLessonGenerationJob,
  isLessonGenerationTerminal,
  LessonGenerationJobStatusValues,
  LessonGenerationWarningSchema,
  LessonGenerationErrorSchema,
  LessonGenerationJobSchema,
  LessonGenerationJobEnvelopeSchema,
} from './lessonJobClient';
export type {
  LessonGenerationJob,
  LessonGenerationJobStatus,
  LessonJobErrorKind,
  LessonJobError,
  LessonJobResult,
  LessonJobClientOptions,
  CreateLessonGenerationJobInput,
} from './lessonJobClient';
export {
  fetchLessonServerCapabilities,
  useLessonServerCapabilities,
  isUnifiedLessonReady,
} from './lessonCapabilities';
export type {
  LessonServerCapabilities,
  UnifiedLessonReleaseFlags,
} from './lessonCapabilities';
export {useLessonCatalog} from './useLessonCatalog';
export type {
  LessonCatalogState,
  UseLessonCatalogOptions,
  UseLessonCatalogResult,
} from './useLessonCatalog';
export {useLessonGenerationJob} from './useLessonGenerationJob';
export type {
  LessonGenerationState,
  UseLessonGenerationJobOptions,
} from './useLessonGenerationJob';
export {
  UnifiedLessonCatalogView,
  UnifiedLessonsScreen,
  UnifiedLessonsRouteScreen,
} from './UnifiedLessonsScreen';
export {UnifiedLessonsPreviewScreen} from './UnifiedLessonsPreviewScreen';
export type {UnifiedLessonCatalogViewProps} from './UnifiedLessonsScreen';
export {
  UnifiedLessonGenerationView,
  UnifiedLessonGenerationScreen,
} from './UnifiedLessonGenerationScreen';
export type {UnifiedLessonGenerationViewProps} from './UnifiedLessonGenerationScreen';
export type {
  CurriculumLessonErrorKind,
  CurriculumLessonError,
  CurriculumLessonResult,
  CurriculumLessonCheckResult,
  CurriculumLessonClientOptions,
  CurriculumLessonAnswerInput,
} from './curriculumLessonClient';
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
} from './api/learningProgressClient';
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
} from './api/learningProgressClient';
export {
  resolveLessonDestination,
  startLessonFromConfirmedText,
} from './startLessonFromConfirmedText';
export type {
  LessonDestination,
  LessonFeatureFlags,
  UnifiedLessonReadiness,
  NavigateFn,
  UnifiedGenerationJobCreator,
} from './startLessonFromConfirmedText';
