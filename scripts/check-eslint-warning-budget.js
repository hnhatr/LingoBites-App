#!/usr/bin/env node

const {spawnSync} = require('child_process');
const path = require('path');

const WARNING_BUDGET = {
  totalWarnings: 314,
  rules: {
    'react-native-a11y/has-accessibility-hint': 84,
    'react-native-a11y/has-valid-accessibility-descriptors': 0,
    'react-native-a11y/has-valid-accessibility-ignores-invert-colors': 0,
    'react-native/no-inline-styles': 82,
    'no-bitwise': 131,
    'no-void': 16,
    'eslint-comments/no-unused-disable': 0,
    'jest/no-disabled-tests': 0,
    '@typescript-eslint/no-shadow': 0,
    'no-undef-init': 0,
    'react/no-unstable-nested-components': 1,
    'no-regex-spaces': 0,
    'no-useless-escape': 0,
  },
};

function countWarnings(eslintResults) {
  return eslintResults.reduce(
    (summary, fileResult) => {
      const messages = Array.isArray(fileResult.messages)
        ? fileResult.messages
        : [];
      messages.forEach(message => {
        if (message.severity !== 1) {
          return;
        }
        const ruleId = message.ruleId ?? '<unknown>';
        summary.totalWarnings += 1;
        summary.rules[ruleId] = (summary.rules[ruleId] ?? 0) + 1;
      });
      return summary;
    },
    {totalWarnings: 0, rules: {}},
  );
}

function evaluateWarningBudget(eslintResults, budget = WARNING_BUDGET) {
  const summary = countWarnings(eslintResults);
  const failures = [];

  if (summary.totalWarnings > budget.totalWarnings) {
    failures.push(
      `total warnings ${summary.totalWarnings} exceed budget ${budget.totalWarnings}`,
    );
  }

  Object.entries(summary.rules).forEach(([ruleId, count]) => {
    const ruleBudget = budget.rules[ruleId];
    if (ruleBudget === undefined) {
      failures.push(`${ruleId} warnings ${count} have no configured budget`);
      return;
    }
    if (count > ruleBudget) {
      failures.push(`${ruleId} warnings ${count} exceed budget ${ruleBudget}`);
    }
  });

  return {
    ok: failures.length === 0,
    failures,
    summary,
  };
}

function runEslint() {
  const eslintBin = path.join(process.cwd(), 'node_modules', '.bin', 'eslint');
  const result = spawnSync(eslintBin, ['.', '--format', 'json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !result.stdout) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return JSON.parse(result.stdout);
}

function printResult(result) {
  const lines = [
    `ESLint warning budget: ${result.summary.totalWarnings}/${WARNING_BUDGET.totalWarnings} warnings`,
    ...Object.entries(result.summary.rules)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ruleId, count]) => {
        const budget = WARNING_BUDGET.rules[ruleId];
        return `  ${ruleId}: ${count}/${budget ?? 'unconfigured'}`;
      }),
  ];

  if (!result.ok) {
    lines.push('', 'Budget failures:', ...result.failures.map(f => `  - ${f}`));
  }

  const output = `${lines.join('\n')}\n`;
  if (result.ok) {
    process.stdout.write(output);
  } else {
    process.stderr.write(output);
  }
}

function main() {
  const eslintResults = runEslint();
  const result = evaluateWarningBudget(eslintResults);
  printResult(result);
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  WARNING_BUDGET,
  countWarnings,
  evaluateWarningBudget,
};
