import { useState } from "react";
import { FieldList } from "./LookFields";
import { TABLE_STYLES, tableView, type TableDef } from "./tableDef";
import type { LookField } from "./look";

/** The Inspector for a `::: table`: its rows as text (one per line), then its options. Each change rewrites the table's own lines. */
export function TableFields({ def, onPatch, onRows }: { def: TableDef; onPatch: (p: Record<string, string | null>) => void; onRows: (rows: string[]) => void }) {
  const [txt, setTxt] = useState<string | null>(null);
  const done = () => { if (txt !== null && txt !== def.raw.join("\n")) onRows(txt.split("\n")); setTxt(null); };
  const v = tableView(def), heads = v.head ?? [];
  const f = (k: string, label: string, t: LookField["t"], extra: Partial<LookField> = {}): LookField => ({ k, label, t, ...extra });
  return (
    <div className="tf">
      <label>Rows (one per line, cells split with |)
        <textarea rows={Math.min(9, Math.max(4, def.raw.length + 1))} value={txt ?? def.raw.join("\n")} onChange={(e) => setTxt(e.target.value)} onBlur={done} spellCheck={false} />
      </label>
      <FieldList a={def.attrs} onPatch={onPatch} fields={[
        f("style", "Table look", "select", { opts: TABLE_STYLES as unknown as string[], d: "plain" }),
        f("header", "First row is the heading", "bool", { d: "true" }), f("index", "Number the rows", "bool", { d: "false" }),
        f("sort", "Sort by column", "select", { opts: ["", ...heads.map((_, c) => String(c + 1))], d: "" }), f("dir", "Order", "select", { opts: ["asc", "desc"], d: "asc" }),
        f("hl", "Highlight rows", "text", { hint: "2,4" }), f("align", "Column alignment", "text", { hint: "left right center" }), f("caption", "Caption", "text"),
        f("head", "Heading colour", "color", { d: "#1b2147" }), f("stripe", "Stripe colour", "color", { d: "#171b38" }), f("rowline", "Row line colour", "color", { d: "#2a3160" }), f("hot", "Highlight colour", "color", { d: "#f2b84b" }),
        f("size", "Text size ×", "num", { hint: "1" }), f("cellpad", "Cell padding", "num", { hint: "1" }),
      ]} />
      {heads.length > 0 && def.attrs.sort && <p className="hint">Sorted by “{heads[parseInt(def.attrs.sort, 10) - 1] ?? def.attrs.sort}”. The file keeps your own order.</p>}
    </div>
  );
}
