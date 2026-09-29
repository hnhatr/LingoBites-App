import {validFullOutput} from '@core/fixtures';
import {resolveQuickPractice} from '../resolveQuickPractice';

describe('resolveQuickPractice', () => {
  it('returns questions from the first lesson that has practice items', () => {
    const lessons = [
      {id: 'empty', title: 'Empty'},
      {id: 'ready', title: 'Ready lesson'},
    ];
    const getLessonById = (id: string) => {
      if (id === 'empty') {
        return {title: 'Empty', aiOutput: {practice: []}};
      }
      if (id === 'ready') {
        return {
          title: 'Ready lesson',
          aiOutput: {practice: validFullOutput.practice},
        };
      }
      return null;
    };

    const result = resolveQuickPractice(lessons, getLessonById);
    expect(result.questions).toEqual(validFullOutput.practice);
    expect(result.title).toBe('Ready lesson');
  });

  it('returns empty when no lesson has practice items', () => {
    const result = resolveQuickPractice([{id: 'a', title: 'A'}], () => ({
      title: 'A',
      aiOutput: {practice: []},
    }));
    expect(result).toEqual({questions: [], title: ''});
  });
});
