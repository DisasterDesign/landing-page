import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import ts from "typescript";

/** Execute real route code with external I/O replaced; never import live auth/DB/provider clients. */
export function loadRoute<T>(url: URL, dependencies: Record<string, unknown>): T {
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const localRequire = createRequire(import.meta.url);
  const execute = runInThisContext(`(function(exports, require, console, process) { ${compiled}\n})`, { filename: url.pathname });
  execute(exports, (id: string) => {
      if (id in dependencies) return dependencies[id];
      if (id === "@/lib/notifications/visibility") return localRequire("../notifications/visibility");
      throw new Error(`Unexpected route dependency: ${id}`);
    }, { log() {}, warn() {}, error() {} }, { env: {} });
  return exports as T;
}
