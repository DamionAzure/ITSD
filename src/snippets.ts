import type { Snippet } from "./ContextBar";
import { flashBlock } from "./flashEdit";
import { partsLines, DEFAULT_RECT } from "./traceEdit";
import { parseTraceDef } from "./traceBlock";

export const SNIPPETS: Record<Snippet, string> = {
  slide: "\n---\n\n# New slide\n\n",
  code: '```python run id=example\nprint("Hello")\n```\n\n',
  button: '::: button "Label"\nrun example\n:::\n\n',
  input: '::: input data "Your data" default="1, 2, 3" run=example\n\nUse {{data}} in text or in code.\n\n',
  source: '```python def=my_source\nprint("Hello from a source")\n```\n\n',
  notes: '::: notes\nWhat to say on this slide.\n:::\n\n',
  sound: '::: button "Play sound"\nplay ding\n:::\n\n',
  trace: partsLines(DEFAULT_RECT, parseTraceDef("from=example")).join("\n") + "\n\n", // separate parts, each placed
  traceOne: '::: trace from=example\n\n',
  table: '::: table style=zebra\nName | Score | Rank\nAda | 91 | 1\nBo | 78 | 2\nCy | 85 | 3\n:::\n\n',
  traceTable: '<!-- @ x=4 y=10 w=60 h=70 -->\n::: trace-table from=example style=zebra\n\n',
  macro: '::: macro reset_round\nput score 0\nput round 1\nplay chime\n:::\n\n',
  script: '::: script example\nadd("score", 5);\nawait wait(500);\nif (get("score") >= 10) play("ding");\n:::\n\n',
  on: '::: on key r\nput score 0\n:::\n\n',
  flash: flashBlock({ id: "flash1", start: "when-next" }) + "\n\n",
};
