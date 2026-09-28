import invalidMissingFieldJson from './invalid-missing-field.json';
import validFullJson from './valid-full.json';
import validMinimalJson from './valid-minimal.json';

export const validFullOutput: any = validFullJson;
export const validMinimalOutput: any = validMinimalJson;
export const invalidMissingFieldOutput: any = invalidMissingFieldJson;

/** @deprecated Use validFullOutput — kept for existing imports */
export const validLessonOutput = validFullOutput;
