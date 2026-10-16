import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';

import {addToReview} from '../logic/addToReview';
import {memoryOf} from '../logic/libraryRepository';

type Status = 'idle' | 'busy' | 'added' | 'offline' | 'failed';

/** "Thêm vào ôn": puts one pattern or tense on the review schedule. */
export function AddToReviewButton({itemCode}: {itemCode: string}) {
  const {t} = useTranslation();
  const [status, setStatus] = useState<Status>(() =>
    memoryOf(itemCode) ? 'added' : 'idle',
  );

  if (status === 'added') {
    return (
      <AppText color="secondary" testID="add-to-review-done">
        {t('patternTense.in_review')}
      </AppText>
    );
  }
  return (
    <>
      <AppButton
        iconLeft="add"
        loading={status === 'busy'}
        onPress={async () => {
          setStatus('busy');
          const result = await addToReview(itemCode);
          setStatus(
            result.ok ? 'added' : result.offline ? 'offline' : 'failed',
          );
        }}
        testID="add-to-review"
        title={t('patternTense.add_to_review')}
        variant="outline"
      />
      {status === 'offline' || status === 'failed' ? (
        <AppText color="danger" testID="add-to-review-error">
          {t(
            status === 'offline'
              ? 'patternTense.needs_network'
              : 'patternTense.add_failed',
          )}
        </AppText>
      ) : null}
    </>
  );
}
