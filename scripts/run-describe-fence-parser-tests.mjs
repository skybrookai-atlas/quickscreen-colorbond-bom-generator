import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, "node_modules", ".tmp", "describe-fence-parser-tests");
const files = [
  "src/lib/voiceFillers.ts",
  "src/lib/measurementParser.ts",
  "src/lib/describeFenceParser.ts",
  "src/lib/describeFenceParser.test.ts",
];

fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText.replace(/from "\.\/([^"]+)"/g, 'from "./$1.mjs"');
  fs.writeFileSync(path.join(outDir, path.basename(file, ".ts") + ".mjs"), output);
}

const testModule = await import(pathToFileURL(path.join(outDir, "describeFenceParser.test.mjs")).href);
testModule.runDescribeFenceParserTestCases();
console.log(`Describe fence parser corpus passed: TC-01 through TC-${testModule.describeFenceParserTestCases.length}`);
