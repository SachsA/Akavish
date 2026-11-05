// https://docs.expo.dev/guides/using-eslint/
// ESLint flat config (Expo SDK 53+). Replaces the legacy .eslintrc.js, which
// ran on the deprecated ESLint 8.
const { defineConfig, globalIgnores } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([globalIgnores(['dist/*', '.expo/*']), expoConfig])
