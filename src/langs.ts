// The languages a ```lang run block can use. `id` is what Settings and the native runner call it; the rest are other names for it in a fence.
// To add one: a line here, one in LANGS in src-tauri/src/lib.rs, and (for colours) a Monaco language id.
export interface RunLang { id: string; label: string; also: string[]; monaco: string; note?: string }
export const RUN_LANGS: RunLang[] = [
  { id: "python", label: "Python", also: ["py"], monaco: "python" },
  { id: "node", label: "JavaScript (Node.js)", also: ["js", "javascript"], monaco: "javascript" },
  { id: "typescript", label: "TypeScript (Deno)", also: ["ts", "deno"], monaco: "typescript" },
  { id: "rust", label: "Rust (rustc)", also: ["rs"], monaco: "rust" },
  { id: "go", label: "Go", also: ["golang"], monaco: "go" },
  { id: "zig", label: "Zig", also: [], monaco: "rust", note: "coloured as Rust" },
  { id: "odin", label: "Odin", also: [], monaco: "go", note: "coloured as Go" },
  { id: "c", label: "C (cc)", also: [], monaco: "cpp" },
  { id: "cpp", label: "C++ (c++)", also: ["c++", "cc"], monaco: "cpp" },
  { id: "java", label: "Java", also: [], monaco: "java" },
  { id: "dart", label: "Dart", also: [], monaco: "dart" },
  { id: "ruby", label: "Ruby", also: ["rb"], monaco: "ruby" },
  { id: "lua", label: "Lua", also: [], monaco: "lua" },
  { id: "php", label: "PHP", also: [], monaco: "php" },
  { id: "perl", label: "Perl", also: ["pl"], monaco: "perl" },
  { id: "julia", label: "Julia", also: ["jl"], monaco: "julia" },
  { id: "haskell", label: "Haskell (runghc)", also: ["hs"], monaco: "plaintext" },
  { id: "bash", label: "Bash", also: ["sh", "shell"], monaco: "shell" },
  { id: "sql", label: "SQL (SQLite)", also: ["sqlite"], monaco: "sql" },
];
const BY = new Map<string, RunLang>(RUN_LANGS.flatMap((l) => [[l.id, l] as [string, RunLang], ...l.also.map((a) => [a, l] as [string, RunLang])]));
/** "py" -> "python", "c++" -> "cpp". Unknown names come back as they are. */
export const canon = (l: string) => BY.get(l.toLowerCase())?.id ?? l;
export const isRunnable = (l: string) => BY.has(l.toLowerCase());
export const monacoOf = (l: string) => BY.get(l.toLowerCase())?.monaco ?? l;
