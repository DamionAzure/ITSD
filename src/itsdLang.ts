// Syntax colouring for the deck's own markup (.itsd): separators, frontmatter, directives, ::: blocks, actions, {{vars}}.
// Code inside fences and ::: script blocks is handed to Monaco's own language for that code.
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

export const ITSD_LANG = "itsd";
const VERBS = "anim|run|show|hide|start|stop|goto|play|put|set|add|sub|after|every|cancel|wait|if|then|else|repeat|toggle|random|call|script|reset|branch|proceed|back";
import { RUN_LANGS } from "./langs";
// Every run language's fence names -> the Monaco language that colours it (longest names first, so `c++` is not read as `c`).
const FENCES: [string, string][] = RUN_LANGS.filter((l) => l.monaco !== "plaintext").flatMap((l) => [l.id, ...l.also].map((n) => [n, l.monaco] as [string, string])).sort((a, b) => b[0].length - a[0].length);
const MONACO_FENCES = [...new Set(FENCES.map(([, m]) => m))];
const esc = (n: string) => n.replace(/[+#]/g, "\\$&");

let done = false;
export function registerItsd() {
  if (done) return; done = true;
  monaco.languages.register({ id: ITSD_LANG, extensions: [".itsd"], aliases: ["ITSD"] });
  const tok: monaco.languages.IMonarchLanguage = {
    defaultToken: "",
    tokenizer: {
      root: [],
      inline: [
        [/\{\{\s*[\w.]+\s*\}\}/, "variable.itsd"],
        [/<\/?span\b[^>]*>/, "tag.itsd"],
        [/<\/?[A-Za-z][\w-]*[^>]*>/, "tag.itsd"],
        [/\*\*[^*]+\*\*/, "strong.itsd"],
        [/(?<![*\w])\*[^*\s][^*]*\*(?![*\w])/, "emphasis.itsd"],
        [/`[^`]+`/, "code.itsd"],
        [/!?\[[^\]]*\]\([^)]*\)/, "link.itsd"],
        [/^\s*([-*+]|\d+\.)\s/, "list.itsd"],
        [/^>.*$/, "quote.itsd"],
      ],
      fm: [
        [/^---\s*$/, { token: "separator.itsd", next: "@pop" }],
        [/^([A-Za-z][\w-]*)(:)(.*)$/, ["fmkey.itsd", "delim.itsd", "fmval.itsd"]],
        [/^\s*$/, { token: "", next: "@pop" }],
        [/^\s+-\s.*$/, "fmval.itsd"],
        [/(?=.)/, { token: "", next: "@pop" }],
      ],
      comment: [
        [/-->/, { token: "comment.itsd", next: "@pop" }],
        [/@[A-Za-z]+/, "directive.itsd"],
        [/\b(if|branch|transition|align|bg|font|headingfont|codefont|reveal|title|id|on)(?=\s*:)/, "key.itsd"],
        [/[A-Za-z][\w-]*(?==)/, "attr.itsd"],
        [/-?\d+(\.\d+)?(%|px|s|ms|deg)?/, "number.itsd"],
        [/"[^"]*"|'[^']*'/, "string.itsd"],
        [/[;:=]/, "delim.itsd"],
        [/[A-Za-z][\w-]*/, "fmval.itsd"],
        [/./, "comment.itsd"],
      ],
      block: [
        [/^:::\s*$/, { token: "block.itsd", next: "@pop" }],
        [new RegExp(`^\\s*(${VERBS})\\b`), "verb.itsd"],
        { include: "@bodyTokens" },
      ],
      bodyTokens: [
        [/\{\{\s*[\w.]+\s*\}\}/, "variable.itsd"],
        [/"[^"]*"|'[^']*'/, "string.itsd"],
        [/\b(then|else|as)\b/, "verb.itsd"],
        [/-?\d+(\.\d+)?(ms|s)?\b/, "number.itsd"],
        [/[A-Za-z_][\w-]*(?==)/, "attr.itsd"],
        [/[=<>!]+/, "delim.itsd"],
      ],
      attrs: [
        [/$/, { token: "", next: "@pop" }],
        { include: "@bodyTokens" },
      ],
      script: [
        [/^:::\s*$/, { token: "block.itsd", next: "@pop", nextEmbedded: "@pop" }],
        [/^/, { token: "", nextEmbedded: "javascript" }],
        [/.+/, ""],
      ],
    },
  };
  // Monarch can't switch state from a capture-group token list cleanly, so the block/fence openers are done as regex + state.
  tok.tokenizer.root = [
    [/^---\s*$/, { token: "separator.itsd", next: "@fm" }],
    [/^#{1,6}\s.*$/, "heading.itsd"],
    [/<!--/, { token: "comment.itsd", next: "@comment" }],
    [/^:::\s*script\b/, { token: "block.itsd", next: "@scriptHead" }],
    [/^:::\s*[A-Za-z][\w-]*/, { token: "block.itsd", next: "@blockHead" }],
    ...MONACO_FENCES.map((m) => [new RegExp("^\\s*```(?:" + FENCES.filter(([, x]) => x === m).map(([n]) => esc(n)).join("|") + ")(?![\\w+#])" + ".*$"), { token: "fence.itsd", next: "@code_" + m, nextEmbedded: m }] as [RegExp, monaco.languages.IMonarchLanguageAction]),
    [/^\s*```.*$/, { token: "fence.itsd", next: "@code_plain" }],
    { include: "inline" },
  ];
  const t = tok.tokenizer as Record<string, unknown[]>;
  t.blockHead = [[/$/, { token: "", switchTo: "@block" }], { include: "bodyTokens" }, [/[^\s]+/, "blockname.itsd"]];
  t.scriptHead = [[/$/, { token: "", switchTo: "@script", nextEmbedded: "javascript" }], { include: "bodyTokens" }, [/[^\s]+/, "blockname.itsd"]];
  for (const lang of MONACO_FENCES)
    t["code_" + lang] = [
      [/(?=\s*```\s*$)/, { token: "@rematch", switchTo: "@fenceEnd", nextEmbedded: "@pop" }],
      [/./, ""],
    ];
  t.fenceEnd = [[/\s*```\s*$/, { token: "fence.itsd", next: "@pop" }]];
  t.code_plain = [[/^\s*```\s*$/, { token: "fence.itsd", next: "@pop" }], [/.+/, "code.itsd"]];
  t.script = [
    [/(?=:::\s*$)/, { token: "@rematch", switchTo: "@scriptEnd", nextEmbedded: "@pop" }],
    [/./, ""],
  ];
  t.scriptEnd = [[/:::\s*$/, { token: "block.itsd", next: "@pop" }]];
  monaco.languages.setMonarchTokensProvider(ITSD_LANG, tok);
  monaco.languages.setLanguageConfiguration(ITSD_LANG, {
    comments: { blockComment: ["<!--", "-->"] },
    brackets: [["{{", "}}"], ["(", ")"], ["[", "]"]],
    autoClosingPairs: [{ open: "{{", close: "}}" }, { open: "(", close: ")" }, { open: "[", close: "]" }, { open: '"', close: '"', notIn: ["string"] }],
    surroundingPairs: [{ open: "**", close: "**" }, { open: "*", close: "*" }, { open: "`", close: "`" }, { open: '"', close: '"' }],
  });
}

export const ITSD_RULES: monaco.editor.ITokenThemeRule[] = [
  { token: "separator.itsd", foreground: "f2b84b", fontStyle: "bold" },
  { token: "heading.itsd", foreground: "7cc4ff", fontStyle: "bold" },
  { token: "comment.itsd", foreground: "7f8aa8" },
  { token: "directive.itsd", foreground: "ff9ac1", fontStyle: "bold" },
  { token: "key.itsd", foreground: "ffb86c" },
  { token: "attr.itsd", foreground: "8be9c4" },
  { token: "fmkey.itsd", foreground: "ffb86c" },
  { token: "fmval.itsd", foreground: "a5e075" },
  { token: "delim.itsd", foreground: "8a93b5" },
  { token: "block.itsd", foreground: "c792ea", fontStyle: "bold" },
  { token: "blockname.itsd", foreground: "e0aaff", fontStyle: "bold" },
  { token: "verb.itsd", foreground: "ff7b72" },
  { token: "variable.itsd", foreground: "56d6e0", fontStyle: "bold" },
  { token: "string.itsd", foreground: "a5e075" },
  { token: "number.itsd", foreground: "f7c873" },
  { token: "tag.itsd", foreground: "e5c07b" },
  { token: "strong.itsd", foreground: "ffffff", fontStyle: "bold" },
  { token: "emphasis.itsd", foreground: "d9c2ff", fontStyle: "italic" },
  { token: "code.itsd", foreground: "ce9178" },
  { token: "link.itsd", foreground: "4ec9f0", fontStyle: "underline" },
  { token: "list.itsd", foreground: "f2b84b" },
  { token: "quote.itsd", foreground: "9aa5c8", fontStyle: "italic" },
  { token: "fence.itsd", foreground: "6a9955" },
];
