const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute current TypeScript with controlled I/O and the real QueryClient.
// This avoids native Node's extensionless-import limitation without a dependency.
exports.loadSource = (relativePath, dependencies = {}) => {
  const source = fs.readFileSync(path.resolve(__dirname, '../..', relativePath), 'utf8')
    .replaceAll('import.meta.env', '({ DEV: true })')
    .replaceAll('import.meta.url', JSON.stringify(require('node:url').pathToFileURL(path.resolve(__dirname, '../..', relativePath)).href));
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
};
