module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true
  },
  extends: [
    'standard',
    'eslint:recommended'
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    semi: [2, 'never'],
    'no-implicit-globals': ['error'],
    'no-undef': ['error'],
    'no-restricted-globals': ['error', 'self']
  }
}
