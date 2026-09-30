const {evaluateWarningBudget} = require('../check-eslint-warning-budget');

const baseResults = [
  {
    filePath: '/repo/src/components/AppButton.tsx',
    warningCount: 1,
    messages: [
      {
        severity: 1,
        ruleId: 'react-native-a11y/has-accessibility-hint',
      },
    ],
  },
  {
    filePath: '/repo/src/modules/lesson/LessonResultView.tsx',
    warningCount: 2,
    messages: [
      {
        severity: 1,
        ruleId: 'react-native/no-inline-styles',
      },
      {
        severity: 1,
        ruleId: 'no-void',
      },
    ],
  },
];

describe('evaluateWarningBudget', () => {
  it('passes when warning totals stay within the configured budget', () => {
    const result = evaluateWarningBudget(baseResults, {
      totalWarnings: 3,
      rules: {
        'react-native-a11y/has-accessibility-hint': 1,
        'react-native/no-inline-styles': 1,
        'no-void': 1,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.summary.totalWarnings).toBe(3);
  });

  it('fails when a rule-specific warning count grows above budget', () => {
    const result = evaluateWarningBudget(baseResults, {
      totalWarnings: 3,
      rules: {
        'react-native-a11y/has-accessibility-hint': 0,
        'react-native/no-inline-styles': 1,
        'no-void': 1,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      'react-native-a11y/has-accessibility-hint warnings 1 exceed budget 0',
    ]);
  });

  it('fails when total warnings exceed aggregate budget even if each rule is individually within budget', () => {
    const createWarnings = (ruleId, count) =>
      Array.from({length: count}, () => ({severity: 1, ruleId}));
    const syntheticResults = [
      {
        filePath: '/repo/src/synthetic.tsx',
        messages: [
          ...createWarnings('no-bitwise', 133),
          ...createWarnings('react-native-a11y/has-accessibility-hint', 87),
          ...createWarnings('react-native/no-inline-styles', 91),
          ...createWarnings('no-void', 17),
          ...createWarnings('no-regex-spaces', 13),
        ],
      },
    ];

    const result = evaluateWarningBudget(syntheticResults, {
      totalWarnings: 340,
      rules: {
        'no-bitwise': 133,
        'react-native-a11y/has-accessibility-hint': 87,
        'react-native/no-inline-styles': 91,
        'no-void': 17,
        'no-regex-spaces': 43,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('total warnings 341 exceed budget 340');
  });

  it('evaluates correctly using the default WARNING_BUDGET', () => {
    const createWarnings = (ruleId, count) =>
      Array.from({length: count}, () => ({severity: 1, ruleId}));
    const validResults = [
      {
        filePath: '/repo/src/synthetic.tsx',
        messages: [
          ...createWarnings('no-bitwise', 131),
          ...createWarnings('react-native-a11y/has-accessibility-hint', 84),
          ...createWarnings('react-native/no-inline-styles', 73),
          ...createWarnings('no-void', 10),
          ...createWarnings('react/no-unstable-nested-components', 1),
        ],
      },
    ];

    const result = evaluateWarningBudget(validResults);
    expect(result.ok).toBe(true);
    expect(result.summary.totalWarnings).toBe(299);
  });
});
