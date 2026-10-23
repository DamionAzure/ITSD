// Monaco, fully bundled: no CDN loader, workers come from the app itself.
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/editor.all";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution";
import "monaco-editor/esm/vs/basic-languages/rust/rust.contribution";
import "monaco-editor/esm/vs/basic-languages/go/go.contribution";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/java/java.contribution";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
import "monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution";
import "monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution";
import "monaco-editor/esm/vs/basic-languages/swift/swift.contribution";
import "monaco-editor/esm/vs/basic-languages/dart/dart.contribution";
import "monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution";
import "monaco-editor/esm/vs/basic-languages/lua/lua.contribution";
import "monaco-editor/esm/vs/basic-languages/php/php.contribution";
import "monaco-editor/esm/vs/basic-languages/perl/perl.contribution";
import "monaco-editor/esm/vs/basic-languages/r/r.contribution";
import "monaco-editor/esm/vs/basic-languages/julia/julia.contribution";
import "monaco-editor/esm/vs/basic-languages/elixir/elixir.contribution";
import "monaco-editor/esm/vs/basic-languages/shell/shell.contribution";
import "monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";
import "monaco-editor/esm/vs/basic-languages/fsharp/fsharp.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = { getWorker: () => new EditorWorker() };

monaco.editor.defineTheme("itsd", {
  base: "vs-dark", inherit: true, rules: ITSD_RULES,
  colors: {
    "editor.background": "#0e1222", "editor.foreground": "#e8eaf5",
    "editorCursor.foreground": "#f2b84b", "editor.lineHighlightBackground": "#151a2d",
    "editorLineNumber.foreground": "#4b537f", "editor.selectionBackground": "#323b6b",
  },
});

export { monaco };
import { registerItsd, ITSD_RULES } from "./itsdLang";
import { monacoOf } from "./langs";
export const MONO = 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';
/** The Monaco language for a fence name: "py" -> python, "zig" -> rust (coloured as the closest language Monaco has). */
export const monacoLang = (l: string) => (l === "node" ? "javascript" : monacoOf(l));

monaco.editor.defineTheme("itsd-chrome", {
  base: "vs-dark", inherit: true, rules: ITSD_RULES,
  colors: { "editor.background": "#1e1e1e", "editorLineNumber.foreground": "#6e7681", "editor.lineHighlightBackground": "#2a2d2e" },
});

registerItsd();
