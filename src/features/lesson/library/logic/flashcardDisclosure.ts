import {Alert} from 'react-native';
import {
  getFlashcardDisclosureAcknowledged,
  saveFlashcardDisclosureAcknowledged,
} from './flashcardDisclosureStorage';

export async function confirmFirstFlashcardSave(
  onConfirm: () => void | Promise<void>,
): Promise<void> {
  const acknowledged = await getFlashcardDisclosureAcknowledged();
  if (acknowledged) {
    await onConfirm();
    return;
  }

  Alert.alert(
    'Lưu flashcard đầu tiên',
    'Flashcard đã lưu sẽ xuất hiện trong danh sách ôn tập và lịch nhắc lại. Bạn có thể bỏ lưu bất cứ lúc nào.',
    [
      {text: 'Hủy', style: 'cancel'},
      {
        text: 'Đã hiểu, lưu từ',
        onPress: () => {
          (async () => {
            await saveFlashcardDisclosureAcknowledged();
            await onConfirm();
          })();
        },
      },
    ],
    {cancelable: false},
  );
}
