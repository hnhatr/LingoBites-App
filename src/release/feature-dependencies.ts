import type {FeatureKey} from './feature-registry';

// Each array represents an "OR" condition.
// Inside each array, the strings represent "AND" conditions.
// e.g. [['A', 'B'], ['C']] means (A and B) OR (C).
export type DependencyGroup = FeatureKey[];

export const featureDependencies: Record<FeatureKey, DependencyGroup[]> = {
  pasteTextInput: [],
  imageInput: [],
  ocrScanner: [['imageInput']],
  ocrReviewEdit: [['ocrScanner']],
  shortPractice: [],
  pronunciationSupport: [],

  themeSystem: [],
  themeSwitcher: [['themeSystem']],
  darkTheme: [['themeSystem']],
  pastelKidsTheme: [['themeSystem']],
  coreTheme: [['themeSystem']],
  neoTheme: [['themeSystem']],
  comicTheme: [['themeSystem']],
  cartoonTheme: [['themeSystem']],
  stickerSoftTheme: [['themeSystem']],

  reviewSystem: [],
  miniGame: [['reviewSystem']],
  wordMatchGame: [['miniGame']],
  fillBlankGame: [['miniGame']],
  tenseQuizGame: [['miniGame']],
  sentenceOrderGame: [['miniGame']],
  flashcardChallenge: [['miniGame', 'reviewSystem']],

  situationLearning: [],
  dialogueGenerator: [['situationLearning']],
  phraseExtractor: [['situationLearning']],
  situationPractice: [['situationLearning', 'reviewSystem']],

  youtubeLearning: [],
};
