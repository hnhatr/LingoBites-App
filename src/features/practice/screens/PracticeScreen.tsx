import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {HandoffProgressTrack} from '@ui/components/HandoffProgressTrack';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {QuizOption, type QuizOptionState} from '@ui/components/QuizOption';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useTranslation} from 'react-i18next';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import type {PracticeQuestion as LegacyPracticeQuestion} from '../logic/practiceQuestion';
import type {PracticeQuestion, ResultSummary} from '@shared/schemas/practice';
import {useQuiz} from '../logic/useQuiz';
import {hasInvalidMetaOptions} from '../logic/quizEngine';
import {usePracticeSessionScreen} from '../logic/usePracticeSessionScreen';

export type PracticeRouteParams =
  | {questions: LegacyPracticeQuestion[]; title?: string}
  | {lessonId: string; sessionId: string; title?: string};

export type PracticeScreenProps = {
  navigation: {
    goBack: () => void;
    setParams: (params: Partial<PracticeRouteParams>) => void;
    getParent?: <T = any>() => T;
    dispatch?: (action: any) => void;
  };
  route: {
    params: PracticeRouteParams;
  };
};

type Props = PracticeScreenProps;

function isSessionParams(
  params: PracticeRouteParams,
): params is {lessonId: string; sessionId: string; title?: string} {
  return 'sessionId' in params && typeof params.sessionId === 'string';
}

function isLegacyParams(
  params: PracticeRouteParams,
): params is {questions: LegacyPracticeQuestion[]; title?: string} {
  return (
    'questions' in params &&
    Array.isArray(params.questions) &&
    params.questions.every(
      q =>
        q != null &&
        typeof q === 'object' &&
        typeof (q as LegacyPracticeQuestion).id === 'string' &&
        typeof (q as LegacyPracticeQuestion).question === 'string' &&
        typeof (q as LegacyPracticeQuestion).answer === 'string',
    )
  );
}

export function PracticeScreen({navigation, route}: Props) {
  if (isSessionParams(route.params)) {
    return (
      <SessionPracticeScreen
        key={route.params.sessionId}
        navigation={navigation}
        sessionId={route.params.sessionId}
        title={route.params.title}
      />
    );
  }

  if (!isLegacyParams(route.params)) {
    return null;
  }

  return (
    <LegacyPracticeScreen
      navigation={navigation}
      questions={route.params.questions}
      title={route.params.title}
    />
  );
}

function SessionPracticeScreen({
  navigation,
  sessionId,
  title,
}: {
  navigation: Props['navigation'];
  sessionId: string;
  title?: string;
}) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const session = usePracticeSessionScreen(sessionId);
  const headerTitle = title ?? 'Luyện tập nhanh';

  const {snapshot, pendingFeedback, pendingSync, resultSummary} = session;
  const total = snapshot.session.question_order.length;
  const answeredCount = snapshot.answered;
  const progress =
    snapshot.isFinished && !pendingFeedback
      ? 1
      : Math.min(answeredCount / Math.max(total, 1), 1);

  return (
    <AppScreen>
      <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
      <ScrollView
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {pendingSync ? (
          <AppText
            color="secondary"
            testID="practice-sync-banner"
            variant="caption"
          >
            Kết quả sẽ đồng bộ khi có mạng.
          </AppText>
        ) : null}

        <HandoffProgressTrack
          label={`${Math.min(
            answeredCount + (pendingFeedback ? 0 : 1),
            total,
          )} / ${total}`}
          progress={progress}
        />

        {snapshot.isFinished && !pendingFeedback && resultSummary ? (
          <SessionResultCard
            onDone={() => navigation.goBack()}
            onRetry={() => {
              const nextSessionId = session.restart();
              navigation.setParams({sessionId: nextSessionId});
            }}
            summary={resultSummary}
          />
        ) : pendingFeedback ? (
          <AnsweredQuestionBlock
            feedback={pendingFeedback}
            isLast={answeredCount >= total}
            onContinue={() => session.continueAfterFeedback()}
          />
        ) : snapshot.currentQuestion ? (
          <ActiveQuestionBlock
            onSubmit={optionId => session.submitAnswer(optionId)}
            question={snapshot.currentQuestion}
          />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function ActiveQuestionBlock({
  question,
  onSubmit,
}: {
  question: PracticeQuestion;
  onSubmit: (optionId: string) => void;
}) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const prompt =
    question.variant === 'cloze_choice'
      ? question.stem_with_placeholder
      : question.prompt_vi;

  return (
    <View style={themedStyles.questionBlock}>
      <AppText accessibilityRole="header" variant="h2">
        {prompt}
      </AppText>
      {question.prompt_vi !== prompt ? (
        <AppText color="secondary">{question.prompt_vi}</AppText>
      ) : null}
      <View style={styles.optionList}>
        {question.options.map((option, optionIndex) => (
          <QuizOption
            key={option.id}
            label={option.text}
            onPress={() => onSubmit(option.id)}
            optionKey={String.fromCharCode(65 + optionIndex)}
            testID={`practice-option-${option.id}`}
          />
        ))}
      </View>
    </View>
  );
}

function AnsweredQuestionBlock({
  feedback,
  isLast,
  onContinue,
}: {
  feedback: {
    question: PracticeQuestion;
    selectedOptionId: string;
    isCorrect: boolean;
  };
  isLast: boolean;
  onContinue: () => void;
}) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const {question, selectedOptionId, isCorrect} = feedback;
  const prompt =
    question.variant === 'cloze_choice'
      ? question.stem_with_placeholder
      : question.prompt_vi;

  return (
    <View style={themedStyles.questionBlock}>
      <AppText variant="h2">{prompt}</AppText>
      <View style={styles.optionList}>
        {question.options.map((option, optionIndex) => {
          let optionState: QuizOptionState = 'default';
          if (option.id === question.correct_option_id) {
            optionState = 'correct';
          } else if (option.id === selectedOptionId) {
            optionState = 'wrong';
          }
          return (
            <QuizOption
              key={option.id}
              disabled
              label={option.text}
              optionKey={String.fromCharCode(65 + optionIndex)}
              state={optionState}
              testID={`practice-option-${option.id}`}
            />
          );
        })}
      </View>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="text"
        style={themedStyles.feedbackBlock}
        testID="practice-feedback"
      >
        <View style={styles.feedbackRow}>
          <MaterialIcon
            color={isCorrect ? theme.colors.primary : theme.colors.danger}
            name={isCorrect ? 'check_circle' : 'close'}
            size={20}
          />
          <AppText
            style={
              isCorrect
                ? themedStyles.correctFeedback
                : themedStyles.incorrectFeedback
            }
            variant="label"
          >
            {isCorrect ? 'Chính xác!' : 'Chưa đúng.'}
          </AppText>
        </View>
        {question.explanation_vi ? (
          <AppText color="muted">{question.explanation_vi}</AppText>
        ) : null}
        <AppButton
          onPress={onContinue}
          testID="practice-next-button"
          title={isLast ? 'Xem kết quả' : 'Câu tiếp theo'}
        />
      </View>
    </View>
  );
}

function SessionResultCard({
  summary,
  onRetry,
  onDone,
}: {
  summary: ResultSummary;
  onRetry: () => void;
  onDone: () => void;
}) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const breakdownEntries = Object.entries(summary.breakdown).filter(
    ([, value]) => typeof value === 'number' && value > 0,
  );

  return (
    <View style={themedStyles.resultBlock} testID="practice-result">
      <AppCard style={themedStyles.resultCard}>
        <MaterialIcon
          color={theme.colors.accent}
          name="emoji_events"
          size={40}
        />
        <AppText color="muted" variant="caption">
          Kết quả
        </AppText>
        <AppText style={themedStyles.resultScore} variant="display">
          {summary.correct}/{summary.answered}
        </AppText>
        <AppText color="secondary">
          Độ chính xác {summary.score_percent}%
        </AppText>
      </AppCard>
      {breakdownEntries.length > 0 ? (
        <AppCard style={themedStyles.breakdownCard}>
          <AppText variant="label">Phân tích theo kỹ năng</AppText>
          {breakdownEntries.map(([skill, count]) => (
            <AppText color="secondary" key={skill}>
              {skill}: {count} đúng
            </AppText>
          ))}
        </AppCard>
      ) : null}
      {summary.review_candidates.length > 0 ? (
        <AppCard style={themedStyles.breakdownCard}>
          <AppText variant="label">Cần ôn lại</AppText>
          {summary.review_candidates.map(candidate => (
            <AppText
              color="secondary"
              key={`${candidate.source_kind}:${candidate.source_id}`}
            >
              {candidate.source_kind} · sai {candidate.wrong_count} lần
            </AppText>
          ))}
        </AppCard>
      ) : null}
      <AppButton onPress={onRetry} title="Làm lại" variant="secondary" />
      <AppButton onPress={onDone} title="Hoàn tất" />
    </View>
  );
}

function LegacyPracticeScreen({
  navigation,
  questions,
  title,
}: {
  navigation: Props['navigation'];
  questions: LegacyPracticeQuestion[];
  title?: string;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const quiz = useQuiz(questions);
  const headerTitle = title ?? 'Luyện tập nhanh';

  const tabNavigation = navigation.getParent?.<{
    navigate: (tab: 'Create' | 'Home' | string) => void;
  }>();

  if (questions.length === 0) {
    return (
      <AppScreen>
        <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
        <View style={themedStyles.emptyState} testID="practice-quick-empty">
          <AppText style={styles.centerText} variant="label">
            {t('practice.quick_empty_cause')}
          </AppText>
          <AppText color="secondary" style={styles.centerText}>
            {t('practice.quick_empty_explain')}
          </AppText>
          <AppButton
            accessibilityLabel={t('home.empty_create_a11y')}
            onPress={() => tabNavigation?.navigate('Create')}
            testID="practice-quick-empty-create"
            title={t('home.empty_create')}
          />
        </View>
      </AppScreen>
    );
  }

  const {state, current, total, accuracy} = quiz;
  const progress = state.status === 'finished' ? 1 : state.index / total;

  return (
    <AppScreen>
      <ScreenHeader onBack={() => navigation.goBack()} title={headerTitle} />
      <ScrollView
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HandoffProgressTrack
          label={`${Math.min(state.index + 1, total)} / ${total}`}
          progress={progress}
        />

        {state.status === 'finished' ? (
          <LegacyResultCard
            accuracy={accuracy}
            onDone={() => navigation.goBack()}
            onRetry={() => quiz.restart()}
            score={state.score}
            total={total}
          />
        ) : current ? (
          <LegacyQuestionBlock quiz={quiz} />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function LegacyQuestionBlock({quiz}: {quiz: ReturnType<typeof useQuiz>}) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const {state, current, isLast, isMultipleChoice, correctIndex} = quiz;
  if (!current) {
    return null;
  }
  const answered = state.status === 'answered';

  // Data defect guard (SETE-210 P0): never render meta-label options such as
  // `từ vựng: English`. Offer a skip instead of an unanswerable question.
  if (isMultipleChoice && hasInvalidMetaOptions(current)) {
    return (
      <View
        style={themedStyles.questionBlock}
        testID="practice-invalid-question"
      >
        <AppText variant="h2">{current.question}</AppText>
        <AppText color="muted">
          Câu hỏi này bị lỗi dữ liệu nên không hiển thị đáp án. Bạn có thể bỏ
          qua và làm câu tiếp theo.
        </AppText>
        <AppButton
          onPress={() => quiz.next()}
          testID="practice-skip-button"
          title={isLast ? 'Xem kết quả' : 'Bỏ qua câu này'}
        />
      </View>
    );
  }

  return (
    <View style={themedStyles.questionBlock}>
      <AppText variant="h2">{current.question}</AppText>

      {isMultipleChoice && current.options ? (
        <View style={styles.optionList}>
          {current.options.map((option, optionIndex) => {
            let optionState: QuizOptionState = 'default';
            if (answered) {
              if (optionIndex === correctIndex) {
                optionState = 'correct';
              } else if (optionIndex === state.selectedIndex) {
                optionState = 'wrong';
              }
            }
            return (
              <QuizOption
                key={`${optionIndex}-${option}`}
                disabled={answered}
                label={option}
                onPress={() => quiz.select(optionIndex)}
                optionKey={String.fromCharCode(65 + optionIndex)}
                state={optionState}
              />
            );
          })}
        </View>
      ) : null}

      {answered ? (
        <View
          accessibilityLiveRegion="polite"
          style={themedStyles.feedbackBlock}
        >
          {state.isCorrect !== null ? (
            <AppText
              style={
                state.isCorrect
                  ? themedStyles.correctFeedback
                  : themedStyles.incorrectFeedback
              }
              variant="label"
            >
              {state.isCorrect
                ? 'Chính xác!'
                : 'Chưa đúng — xem đáp án được tô sáng.'}
            </AppText>
          ) : null}
          {current.explanation_vi ? (
            <AppText color="muted">{current.explanation_vi}</AppText>
          ) : null}
          <AppButton
            onPress={() => quiz.next()}
            title={isLast ? 'Xem kết quả' : 'Câu tiếp theo'}
          />
        </View>
      ) : null}
    </View>
  );
}

function LegacyResultCard({
  score,
  total,
  accuracy,
  onRetry,
  onDone,
}: {
  score: number;
  total: number;
  accuracy: number;
  onRetry: () => void;
  onDone: () => void;
}) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.resultBlock}>
      <AppCard style={themedStyles.resultCard}>
        <MaterialIcon
          color={theme.colors.accent}
          name="emoji_events"
          size={40}
        />
        <AppText color="muted" variant="caption">
          Kết quả
        </AppText>
        <AppText style={themedStyles.resultScore} variant="display">
          {score}/{total}
        </AppText>
        <AppText color="secondary">Độ chính xác {accuracy}%</AppText>
      </AppCard>
      <AppButton onPress={onRetry} title="Làm lại" variant="secondary" />
      <AppButton onPress={onDone} title="Hoàn tất" />
    </View>
  );
}

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
  feedbackRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  optionList: {
    gap: 10,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    breakdownCard: {
      gap: theme.spacing.xs,
    },
    correctFeedback: {
      color: theme.colors.primary,
    },
    emptyState: {
      alignItems: 'center',
      flex: 1,
      gap: theme.spacing.md,
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    feedbackBlock: {
      gap: theme.spacing.sm,
    },
    incorrectFeedback: {
      color: theme.colors.danger,
    },
    questionBlock: {
      gap: theme.spacing.lg,
    },
    resultBlock: {
      gap: theme.spacing.lg,
    },
    resultCard: {
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xl,
    },
    resultScore: {
      color: theme.colors.primary,
    },
    scrollContent: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.xxxl,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
  });
}
