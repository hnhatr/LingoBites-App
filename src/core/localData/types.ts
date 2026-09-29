export type LocalDataDeletionResult = {
  /** True only when database cleanup succeeded and every targeted file was removed. */
  ok: boolean;
  dbCleared: boolean;
  failedFilePaths: string[];
};

export type FileDeleter = (filePath: string) => Promise<boolean>;
