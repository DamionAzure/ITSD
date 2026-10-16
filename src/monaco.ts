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
export const MONO = 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';
export const monacoLang = (l: string) => (l === "node" || l === "js" ? "javascript" : l === "rs" ? "rust" : l === "py" ? "python" : l);

monaco.editor.defineTheme("itsd-chrome", {
  base: "vs-dark", inherit: true, rules: ITSD_RULES,
  colors: { "editor.background": "#1e1e1e", "editorLineNumber.foreground": "#6e7681", "editor.lineHighlightBackground": "#2a2d2e" },
});

registerItsd();
