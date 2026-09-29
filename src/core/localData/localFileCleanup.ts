import * as RNFS from '@dr.pogodin/react-native-fs';
import type {FileDeleter} from './types';

function nativeFsAvailable(): boolean {
  return (
    typeof RNFS.DocumentDirectoryPath === 'string' &&
    RNFS.DocumentDirectoryPath.length > 0
  );
}

/** Best-effort unlink that reports whether the file is gone afterward. */
export const defaultFileDeleter: FileDeleter = async filePath => {
  if (!nativeFsAvailable()) {
    return true;
  }
  try {
    await RNFS.unlink(filePath);
    return true;
  } catch {
    return false;
  }
};

export async function deleteLocalFiles(
  filePaths: string[],
  deleter: FileDeleter = defaultFileDeleter,
): Promise<string[]> {
  const failedFilePaths: string[] = [];
  for (const filePath of filePaths) {
    const removed = await deleter(filePath);
    if (!removed) {
      failedFilePaths.push(filePath);
    }
  }
  return failedFilePaths;
}
