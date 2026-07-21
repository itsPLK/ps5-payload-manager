export default {
  defaultNamespace: 'translation',
  lexers: {
    js: ['JsxLexer'], // we're writing jsx inside .js / .jsx
    jsx: ['JsxLexer'],
    default: ['JavascriptLexer']
  },
  locales: ['en-US'],
  output: 'src/locales/$LOCALE.json',
  input: ['src/**/*.{js,jsx}'],
  sort: false,
  createOldCatalogs: false,
  keySeparator: false,
  namespaceSeparator: false
};
