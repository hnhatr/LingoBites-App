import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {getImageSizeCategory, trackEvent} from '@features/analytics';

import {
  type PickedImage,
  pickImageFromCamera,
  pickImageFromGallery,
} from './imagePicker';
import {analyzeImage, type ImageAnalysis} from './momentClient';
import {imageAnalysisFailureMessage} from './momentMessages';
import {ensurePhotoConsent} from './photoConsent';

export type ImageAnalysisFlowState =
  | {type: 'upload_idle'}
  | {type: 'picking'}
  | {type: 'preview'; image: PickedImage}
  | {type: 'analyzing'; image: PickedImage}
  | {type: 'permission_denied'}
  /** The device has no camera (e.g. a simulator): offer the library instead. */
  | {type: 'camera_unavailable'}
  | {type: 'error'; message: string; image?: PickedImage};

type Options = {
  sourceType: 'camera' | 'gallery';
  /** The server read and checked the photo: the learner chooses next. */
  onAnalyzed: (image: PickedImage, analysis: ImageAnalysis) => void;
  /** The camera was closed without a photo (the gallery returns to idle). */
  onCameraCancelled: () => void;
};

/**
 * E3 (P1, P8): pick a photo, ask for consent, send it for analysis. The
 * screen only renders `state`; every transition lives here.
 */
export function useImageAnalysisFlow({
  sourceType,
  onAnalyzed,
  onCameraCancelled,
}: Options) {
  const {t} = useTranslation();
  const isGallery = sourceType === 'gallery';
  const [state, setState] = useState<ImageAnalysisFlowState>(
    isGallery ? {type: 'upload_idle'} : {type: 'picking'},
  );
  const abortRef = useRef<AbortController | null>(null);
  // Callbacks via refs: an inline arrow from the screen must not re-open the camera.
  const onAnalyzedRef = useRef(onAnalyzed);
  const onCameraCancelledRef = useRef(onCameraCancelled);
  onAnalyzedRef.current = onAnalyzed;
  onCameraCancelledRef.current = onCameraCancelled;

  useEffect(() => () => abortRef.current?.abort(), []);

  const pick = useCallback(async () => {
    setState({type: 'picking'});
    const result = isGallery
      ? await pickImageFromGallery()
      : await pickImageFromCamera();

    if (!result.ok) {
      if (result.reason === 'permission_denied') {
        setState({type: 'permission_denied'});
      } else if (result.reason === 'camera_unavailable') {
        setState({type: 'camera_unavailable'});
      } else if (result.reason === 'cancelled') {
        if (isGallery) {
          setState({type: 'upload_idle'});
        } else {
          onCameraCancelledRef.current();
        }
      } else {
        setState({
          type: 'error',
          message: result.message ?? t('errors.ocr_failed'),
        });
      }
      return;
    }

    setState({type: 'preview', image: result.image});
    trackEvent('image_selected', {
      source: sourceType,
      image_size_category: getImageSizeCategory(
        result.image.width,
        result.image.height,
      ),
      has_permission: true,
    });
  }, [isGallery, sourceType, t]);

  const analyze = useCallback(
    async (image: PickedImage) => {
      const consented = await ensurePhotoConsent({
        title: t('moment.consent_title'),
        body: t('moment.consent_body'),
        confirmLabel: t('moment.consent_confirm'),
        cancelLabel: t('moment.consent_cancel'),
      });
      if (!consented) {
        setState({type: 'preview', image});
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({type: 'analyzing', image});

      const result = await analyzeImage(image, sourceType, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      if (!result.ok) {
        trackEvent('moment_rejected', {
          code: result.errorCode,
          stage: 'analyze',
        });
        setState({
          type: 'error',
          message: imageAnalysisFailureMessage(result, t),
          image,
        });
        return;
      }

      trackEvent('moment_analyzed', {
        kind: result.value.kind,
        has_image_id: result.value.image_id !== null,
      });
      onAnalyzedRef.current(image, result.value);
    },
    [sourceType, t],
  );

  /** Gallery preview → back to the empty picker instead of leaving. */
  const backToIdle = useCallback(() => setState({type: 'upload_idle'}), []);

  useEffect(() => {
    if (!isGallery) {
      pick();
    }
  }, [isGallery, pick]);

  return {state, isGallery, pick, analyze, backToIdle};
}
