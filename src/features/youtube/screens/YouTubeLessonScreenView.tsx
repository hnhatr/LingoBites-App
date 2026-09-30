import React from 'react';
import {useTranslation} from 'react-i18next';
import {View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {SentenceCarousel} from '../components/SentenceCarousel';
import {YouTubeMiniPlayer} from '../components/YouTubeMiniPlayer';
import type {YouTubePlayerErrorCode} from '../components/YouTubePlayer';
import {YouTubeToolsPopup} from '../components/YouTubeToolsPopup';
import {YouTubeTranscriptPopup} from '../components/YouTubeTranscriptPopup';
import type {YouTubeLessonScreenViewModel} from '../logic/useYouTubeLessonScreenController';
import type {YouTubeLessonScreenProps} from './youtubeLessonScreenTypes';

export function getPlayerErrorMessage(
  error: YouTubePlayerErrorCode,
  t: (key: string, options?: any) => string,
): string {
  switch (error) {
    case 'YOUTUBE_VIDEO_NOT_FOUND':
      return t('youtube.error_video_not_found', {
        defaultValue: 'Video không tồn tại hoặc đã bị xóa.',
      });
    case 'YOUTUBE_NOT_EMBEDDABLE':
      return t('youtube.error_not_embeddable', {
        defaultValue: 'Video không cho phép phát nhúng bên ngoài YouTube.',
      });
    case 'YOUTUBE_INVALID_URL':
      return t('youtube.error_invalid_url', {
        defaultValue: 'Đường dẫn video không hợp lệ.',
      });
    case 'YOUTUBE_PLAYER_HTML5_ERROR':
      return t('youtube.error_html5', {
        defaultValue: 'Trình phát video gặp sự cố HTML5.',
      });
    default:
      return t('youtube.player_error', {
        defaultValue: 'Video gặp sự cố khi phát. Vui lòng thử lại sau.',
      });
  }
}

export type YouTubeLessonScreenViewProps = YouTubeLessonScreenProps &
  YouTubeLessonScreenViewModel;

export function YouTubeLessonScreenView({
  lesson,
  onBack,
  onStartPractice,
  saveWarning = false,
  onPracticeSentence,
  level,
  retryBlock,
  testID,
  feedClearance,
  styles,
  listRef,
  internalEnrichmentMap,
  abLoopActive,
  abLoopEndIndex,
  abLoopStartIndex,
  activeIndex,
  clearAbLoop,
  closeToolsPopup,
  closeTranscriptPopup,
  handleCardScrollOffsetChange,
  handlePlaySentenceAudio,
  handlePracticeSentenceSegment,
  handlePressWord,
  handlePopupSeek,
  handleReplayAll,
  handlePracticeAll,
  handleRetryPlayback,
  handleScrollToActiveSentence,
  handleSeekToIndex,
  handleSelectLoopCount,
  handleSelectPlaybackRate,
  handleToggleGrammarSave,
  handleToggleSave,
  handleToggleWordSave,
  hasIpa,
  hasVietnamese,
  isAdPlaying,
  isCardScrolledDown,
  isCompleted,
  isOfflineReading,
  isToolsPopupOpen,
  isTranscriptPopupOpen,
  loopCount,
  miniVisible,
  openToolsPopup,
  openTranscriptPopup,
  playbackRate,
  playerBlockHeight,
  playerError,
  playerHeader,
  replayActiveSentence,
  savedGrammarIds,
  savedSegmentIds,
  savedWordIds,
  scrollBackToPlayer,
  showIpaEffective,
  showVietnameseEffective,
  toastMessage,
  toggleIpa,
  togglePlayPause,
  toggleVietnamese,
  durationS,
  getCurrentTimeS,
  playing,
  setAbLoopPointA,
  setAbLoopPointB,
}: YouTubeLessonScreenViewProps) {
  const {t} = useTranslation();

  const headerActions = (
    <View style={styles.headerActions}>
      <IconButton
        accessibilityHint={t('youtube.display_vietnamese_hint')}
        accessibilityLabel={
          showVietnameseEffective
            ? t('youtube.translation_hide_a11y', {defaultValue: 'Ẩn dịch'})
            : t('youtube.translation_show_a11y', {defaultValue: 'Hiện dịch'})
        }
        disabled={!hasVietnamese}
        icon="translate"
        onPress={toggleVietnamese}
        testID="youtube-toggle-vietnamese"
        tone={showVietnameseEffective ? 'accent' : 'surface'}
      />
      <IconButton
        accessibilityHint={t('youtube.display_ipa_hint')}
        accessibilityLabel={
          showIpaEffective
            ? t('youtube.ipa_hide_a11y', {defaultValue: 'Ẩn IPA'})
            : t('youtube.ipa_show_a11y', {defaultValue: 'Hiện IPA'})
        }
        disabled={!hasIpa}
        icon="record_voice_over"
        onPress={toggleIpa}
        testID="youtube-toggle-ipa"
        tone={showIpaEffective ? 'accent' : 'surface'}
      />
      <IconButton
        accessibilityHint={t('youtube.practice_hint', {
          defaultValue: 'Luyện tập câu',
        })}
        accessibilityLabel={t('youtube.practice_title', {
          defaultValue: 'Luyện tập',
        })}
        disabled={!onStartPractice}
        icon="school"
        onPress={() => onStartPractice?.()}
        testID="youtube-start-practice"
        tone="surface"
      />
    </View>
  );

  return (
    <AppScreen>
      <ScreenHeader
        onBack={onBack}
        rightAction={headerActions}
        title={lesson.video.title}
        titleNumberOfLines={1}
      />
      <YouTubeToolsPopup
        abLoopActive={abLoopActive}
        abLoopEndIndex={abLoopEndIndex}
        abLoopStartIndex={abLoopStartIndex}
        activeIndex={activeIndex}
        disabled={isOfflineReading || isAdPlaying}
        loopCount={loopCount}
        onClearAbLoop={clearAbLoop}
        onClose={closeToolsPopup}
        onOpenTranscript={openTranscriptPopup}
        onReplay={replayActiveSentence}
        onSelectLoopCount={handleSelectLoopCount}
        onSelectPlaybackRate={handleSelectPlaybackRate}
        onSetAbLoopPointA={setAbLoopPointA}
        onSetAbLoopPointB={setAbLoopPointB}
        playbackRate={playbackRate}
        segments={lesson.segments}
        topOffset={playerBlockHeight > 0 ? playerBlockHeight : 220}
        visible={isToolsPopupOpen}
      />
      <YouTubeTranscriptPopup
        activeIndex={activeIndex}
        disabled={isOfflineReading || isAdPlaying}
        onClose={closeTranscriptPopup}
        onPracticeSentence={onPracticeSentence}
        onPressWord={handlePressWord}
        onSeekSegment={handlePopupSeek}
        segments={lesson.segments}
        showIpa={showIpaEffective}
        showVietnamese={showVietnameseEffective}
        visible={isTranscriptPopupOpen}
      />
      {saveWarning ? (
        <View
          style={styles.saveWarningBanner}
          testID="youtube-lesson-save-warning"
        >
          <AppText accessibilityRole="alert" variant="label">
            {t('youtube.save_failed_title')}
          </AppText>
          <AppText color="secondary">{t('youtube.save_failed_body')}</AppText>
        </View>
      ) : null}
      {!saveWarning && lesson.warnings.length > 0 ? (
        <View style={styles.saveWarningBanner} testID="youtube-lesson-warnings">
          <AppText variant="label">
            {t('youtube.lesson_warnings_title')}
          </AppText>
          {lesson.warnings.map(warning => (
            <AppText color="secondary" key={warning}>
              {warning}
            </AppText>
          ))}
        </View>
      ) : null}
      {isAdPlaying ? (
        <View style={styles.adBanner} testID="youtube-ad-banner">
          <AppText color="muted" variant="caption">
            {t('youtube.ad_playing_notice', {
              defaultValue: 'Đang phát quảng cáo · Điều khiển tạm khóa',
            })}
          </AppText>
        </View>
      ) : null}
      {isOfflineReading ? (
        <View style={styles.offlineBanner} testID="youtube-offline-banner">
          <View style={styles.bannerTextWrap}>
            <AppText accessibilityRole="alert" variant="label">
              {t('youtube.offline_banner_title')}
            </AppText>
            <AppText color="secondary">
              {t('youtube.offline_banner_body')}
            </AppText>
          </View>
          <View style={styles.bannerActions}>
            <AppButton
              accessibilityHint={t('youtube.retry_hint', {
                defaultValue: 'Thử kết nối lại video',
              })}
              onPress={handleRetryPlayback}
              testID="youtube-offline-retry"
              title={t('youtube.retry_button', {defaultValue: 'Thử lại'})}
              variant="secondary"
            />
          </View>
        </View>
      ) : null}
      {abLoopActive ? (
        <View style={styles.playerControls}>
          <AppText
            color="secondary"
            testID="youtube-ab-loop-status"
            variant="caption"
          >
            {t('youtube.ab_loop_active', {
              from: abLoopStartIndex! + 1,
              to: abLoopEndIndex! + 1,
            })}
          </AppText>
        </View>
      ) : null}
      {playerError ? (
        <View style={styles.errorBanner} testID="youtube-player-error-banner">
          <AppText color="danger" testID="youtube-player-error">
            {getPlayerErrorMessage(playerError, t)}
          </AppText>
          <View style={styles.bannerActions}>
            <AppButton
              accessibilityHint={t('youtube.retry_hint', {
                defaultValue: 'Thử kết nối lại video',
              })}
              onPress={handleRetryPlayback}
              testID="youtube-error-retry"
              title={t('youtube.retry_button', {defaultValue: 'Thử lại'})}
              variant="secondary"
            />
            {onBack ? (
              <AppButton
                accessibilityHint={t('youtube.back_to_list_hint', {
                  defaultValue: 'Quay lại danh sách bài học',
                })}
                onPress={onBack}
                testID="youtube-error-back-to-list"
                title={t('youtube.back_to_list_button', {
                  defaultValue: 'Quay lại danh sách',
                })}
                variant="secondary"
              />
            ) : null}
          </View>
        </View>
      ) : null}
      {isCompleted ? (
        <View
          style={styles.completedBanner}
          testID="youtube-lesson-completed-actions"
        >
          <AppText style={styles.completedTitle} variant="label">
            {t('youtube.completed_title', {
              defaultValue: '🎉 Đã học xong video!',
            })}
          </AppText>
          <View style={styles.completedButtonsRow}>
            <AppButton
              accessibilityHint={t('youtube.completed_replay_hint', {
                defaultValue: 'Xem lại video từ đầu',
              })}
              iconLeft="refresh"
              onPress={handleReplayAll}
              testID="youtube-completed-replay"
              title={t('youtube.completed_replay_title', {
                defaultValue: 'Xem lại',
              })}
              variant="secondary"
            />
            <AppButton
              accessibilityHint={t('youtube.completed_practice_hint', {
                defaultValue: 'Luyện nói toàn bộ câu trong bài',
              })}
              disabled={!onStartPractice}
              iconLeft="school"
              onPress={handlePracticeAll}
              testID="youtube-completed-practice"
              title={t('youtube.completed_practice_title', {
                defaultValue: 'Luyện nói cả bài',
              })}
              variant="primary"
            />
            {onBack ? (
              <AppButton
                accessibilityHint={t('youtube.completed_next_hint', {
                  defaultValue: 'Quay về danh sách bài học',
                })}
                iconRight="chevron_right"
                onPress={onBack}
                testID="youtube-completed-next-lesson"
                title={t('youtube.completed_next_title', {
                  defaultValue: 'Bài kế',
                })}
                variant="secondary"
              />
            ) : null}
          </View>
        </View>
      ) : null}
      {playerHeader}
      <SentenceCarousel
        activeIndex={activeIndex}
        enrichmentMap={internalEnrichmentMap}
        level={level}
        onCardScrollOffsetChange={handleCardScrollOffsetChange}
        onPlaySentenceAudio={handlePlaySentenceAudio}
        onPracticeSentence={
          onPracticeSentence ? handlePracticeSentenceSegment : undefined
        }
        onPressBackChip={handleScrollToActiveSentence}
        onPressWord={handlePressWord}
        onSelectIndex={handleSeekToIndex}
        onToggleGrammarSave={handleToggleGrammarSave}
        onToggleSaveSegment={handleToggleSave}
        onToggleWordSave={handleToggleWordSave}
        ref={listRef}
        retryBlock={retryBlock}
        savedGrammarIds={savedGrammarIds}
        savedSegmentIds={savedSegmentIds}
        savedWordIds={savedWordIds}
        segments={lesson.segments}
        showBackChip={isCardScrolledDown && activeIndex >= 0}
        showTranslation={showVietnameseEffective}
        testID={testID}
        toastMessage={toastMessage}
        videoId={lesson.video.id}
      />
      {miniVisible && !isOfflineReading && !isAdPlaying ? (
        <View style={[styles.miniWrap, {bottom: feedClearance}]}>
          <YouTubeMiniPlayer
            activeIndex={activeIndex}
            disabled={isOfflineReading || isAdPlaying}
            durationS={durationS}
            getCurrentTimeS={getCurrentTimeS}
            onOpenTools={openToolsPopup}
            onPress={scrollBackToPlayer}
            onReplay={replayActiveSentence}
            onTogglePlay={togglePlayPause}
            playing={playing}
            totalSegments={lesson.segments.length}
            videoId={lesson.video.id}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}
