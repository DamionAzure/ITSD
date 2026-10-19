import type { Snippet } from "./ContextBar";
import { flashBlock } from "./flashEdit";

export const SNIPPETS: Record<Snippet, string> = {
  slide: "\n---\n\n# New slide\n\n",
  code: '```python run id=example\nprint("Hello")\n```\n\n',
  button: '::: button "Label"\nrun example\n:::\n\n',
  input: '::: input data "Your data" default="1, 2, 3" run=example\n\nUse {{data}} in text or in code.\n\n',
  source: '```python def=my_source\nprint("Hello from a source")\n```\n\n',
  flash: flashBlock({ id: "flash1", start: "when-next" }) + "\n\n",
};
