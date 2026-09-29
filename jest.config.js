module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@app$': '<rootDir>/src/app',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@features$': '<rootDir>/src/features',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@ui$': '<rootDir>/src/ui',
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@core$': '<rootDir>/src/core',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@test$': '<rootDir>/src/test',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
  },
};
