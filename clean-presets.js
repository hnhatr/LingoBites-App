const fs = require('fs');
const path = require('path');

const configsDir = path.join(__dirname, 'src', 'release', 'configs');
const files = fs.readdirSync(configsDir).filter(f => f.endsWith('.ts'));

const keysToRemove = [
  'pronunciationSupport',
  'miniGame',
  'wordMatchGame',
  'fillBlankGame',
  'tenseQuizGame',
  'sentenceOrderGame',
  'flashcardChallenge',
  'situationLearning',
  'dialogueGenerator',
  'phraseExtractor',
  'situationPractice',
  'lingobitesMvpReviewFlow',
];

for (const file of files) {
  const filePath = path.join(configsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  const lines = content.split('\n');
  const newLines = lines.filter(line => {
    return !keysToRemove.some(key => line.includes(`${key}:`));
  });

  fs.writeFileSync(filePath, newLines.join('\n'));
}

console.log('Cleaned presets.');
