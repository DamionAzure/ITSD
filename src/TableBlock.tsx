import { useContext, useMemo, type CSSProperties } from "react";
import { marked } from "marked";
import { DeckCtx } from "./ctx";
import { TABLE_STYLES, highlighted, tableFlag, tableView, type TableDef } from "./tableDef";

const pos = (v: string | undefined, d: number) => { const n = parseFloat(v ?? ""); return Number.isFinite(n) && n > 0 ? n : d; };

/** Colours and size a table takes as plain options: `head=` `stripe=` `rowline=` `hot=` `size=`. The same ones the trace's table understands. */
export function tableVars(a: Record<string, string>): CSSProperties {
  return {
    "--dt-fs": pos(a.size, 1),
    ...(a.head ? { "--dt-head": a.head } : null), ...(a.stripe ? { "--dt-stripe": a.stripe } : null),
    ...(a.rowline ? { "--dt-line": a.rowline } : null), ...(a.hot ? { "--dt-hot": a.hot } : null),
    ...(a.cellpad ? { "--dt-pad": `calc(var(--u) * ${pos(a.cellpad, 1)})` } : null),
  } as CSSProperties;
}
export const tableStyleOf = (a: Record<string, string>) => ((TABLE_STYLES as readonly string[]).includes(a.style) ? a.style : "plain");
export const tableClass = (a: Record<string, string>, extra = "") => `dt dt-${tableStyleOf(a)}${tableFlag(a.fit, false) ? " dt-fit" : ""}${a.class ? " " + a.class.replace(/[^\w\s-]/g, "") : ""}${extra ? " " + extra : ""}`;

export function TableBlock({ def }: { def: TableDef }) {
  const api = useContext(DeckCtx);
  const a = def.attrs;
  const v = useMemo(() => tableView(def), [def]);
  const hot = highlighted(a), index = tableFlag(a.index, false);
  const cell = (s: string) => ({ __html: api.fill(marked.parseInline(s) as string, true) });
  const al = (c: number) => (a.align?.split(/[\s,]+/)[c] as string | undefined) ?? (v.numeric[c] ? "right" : "left");
  const empty = !v.head && !v.body.length;
  return (
    <div className={tableClass(a)} style={tableVars(a)}>
      {empty ? <div className="dt-empty">Empty table: add rows like <code>Name | Score</code> between the ::: lines.</div> : (
        <table>
          {a.caption && <caption>{a.caption}</caption>}
          {v.head && <thead><tr>{index && <th className="ix">#</th>}{v.head.map((h, c) => <th key={c} style={{ textAlign: al(c) as CSSProperties["textAlign"] }} dangerouslySetInnerHTML={cell(h)} />)}</tr></thead>}
          <tbody>
            {v.body.map((r, k) => (
              <tr key={k} className={hot.has(v.from[k]) ? "hot" : ""} data-row={v.from[k] + 1}>
                {index && <td className="ix">{k + 1}</td>}
                {Array.from({ length: v.cols }, (_, c) => <td key={c} style={{ textAlign: al(c) as CSSProperties["textAlign"] }} dangerouslySetInnerHTML={cell(r[c] ?? "")} />)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
