// Right-click menus for the Slides panel: one for a slide, one for the empty part of the panel. Built here, shown by App with ContextMenu.
import { bnum } from "./branch";
import { act, input, sub, SEP, type MenuItem } from "./ContextMenu";
import { beautifyDeck, beautifySlide } from "./beautifyDoc";
import { addSlide, deleteSlide, setSlideOpt, titleOf } from "./edit";
import type { Deck } from "./itsd";
import * as O from "./slideOps";

export interface SlideMenuApi {
  deck: Deck;
  text: () => string;
  /** Replace the whole file (one undo step) and move the Source pane to `line`, if given. */
  replace: (next: string, line?: number) => void;
  /** Show this slide (its place in the file) in the editor. */
  select: (id: number) => void;
  /** Slide text copied or cut in this session (paste works even if the system clipboard is off limits). */
  clip: { get: () => string | null; set: (s: string) => void };
  note: (message: string) => void;
}

const KEYS = ["Ctrl+→", "Ctrl+Enter", "Ctrl+Space"];
const TEMPLATES: [string, string[]][] = [
  ["Blank", ["", "# New slide", "", ""]],
  ["Title and subtitle", ["", "# Title", "", "A line under the title", "", ""]],
  ["Bullet list", ["", "# Points", "", "- First", "- Second", "- Third", "", ""]],
  ["Code you can run", ["", "# Try it", "", "```python run id=example", 'print("Hello")', "```", "", ""]],
  ["Question with a button", ["", "# A question", "", "What do you think?", "", '::: button "Show the answer"', "show answer", ":::", "", "::: wrap answer hidden", "The answer.", ":::", "", ""]],
];

export function slideMenu(api: SlideMenuApi, id: number): MenuItem[] {
  const { deck } = api, sl = deck.slides, s = sl[id], text = api.text();
  if (!s) return [];
  const isBranch = bnum(s) > 0, [m, e] = O.groupOf(sl, id), inGroup = e - m, counts = O.branchCounts(sl, id);
  const edit = (f: (t: string) => string, line?: (next: string) => number) => { const next = f(api.text()); api.replace(next, line?.(next)); };
  const lineOf = (k: number) => (next: string) => O.slideLine(next, k);
  const dupTo = (n: number) => edit((t) => O.duplicateSlides(t, id, n), lineOf(id + 1));
  const move = (d: O.Dir, label: string, hint?: string) => act(label, () => edit((t) => O.moveSmart(t, id, d)), { disabled: !O.canMove(text, id, d), hint });
  const nums = [1, 2, 3];
  const addBranch = (n: number, button: boolean) => { const r = O.addBranchSlide(api.text(), id, n, button); api.replace(r.text, O.slideLine(r.text, r.at)); api.note(`Added branch ${n} slide`); };
  const opt = (key: string, label: string, value: string | null) => act(label, () => edit((t) => setSlideOpt(t, id, key, value)), { checked: (s.opts[key] ?? null) === value });
  const choice = (key: string, label: string, values: string[]) => sub(label, [opt(key, "Deck default", null), ...values.map((v) => opt(key, v, v))]);

  const newSlide = sub("New slide", [
    act("After this one", () => edit((t) => addSlide(t, id), lineOf(id + 1) )),
    act("Before this one", () => edit((t) => O.insertBefore(t, id, ["", "# New slide", "", ""]), lineOf(id))),
    SEP,
    ...TEMPLATES.map(([label, lines]) => act(label, () => edit((t) => O.insertAfterLines(t, id, lines), lineOf(id + 1)))),
  ]);

  const branch = sub("Branch", [
    ...nums.map((n) => act(counts[n] ? `Add to branch ${n} (${counts[n]} so far)` : `New branch ${n} slide`, () => addBranch(n, false), { hint: KEYS[n - 1] })),
    sub("New branch slide + a button here", nums.filter((n) => !counts[n]).map((n) => act(`Branch ${n}`, () => addBranch(n, true))), nums.every((n) => counts[n] > 0)),
    input("Other branch number", String(Math.max(3, ...Object.keys(counts).map(Number)) + 1), (v) => { const n = parseInt(v, 10); if (n > 0) addBranch(n, false); }, "4"),
    SEP,
    sub("Copy this slide as a branch", nums.map((n) => act(`Branch ${n}`, () => { const r = O.duplicateAsBranch(api.text(), id, n); api.replace(r.text, O.slideLine(r.text, r.at)); }))),
    isBranch
      ? sub("Move to branch", [...nums.map((n) => act(`Branch ${n}`, () => edit((t) => O.setBranch(t, id, n)), { checked: bnum(s) === n })), act("Main line (not a branch)", () => edit((t) => O.setBranch(t, id, null)))])
      : sub("Turn into a branch of the slide above", nums.map((n) => act(`Branch ${n}`, () => edit((t) => O.setBranch(t, id, n)))), id === 0),
  ]);

  const clipText = api.clip.get();
  const copy = (cut: boolean) => {
    const src = O.slideSource(api.text(), id); api.clip.set(src);
    void navigator.clipboard?.writeText(src).catch(() => undefined);
    if (cut) edit((t) => deleteSlide(t, id));
    api.note(cut ? "Slide cut" : "Slide copied");
  };

  return [
    act("Show in editor", () => api.select(id)),
    SEP,
    act("Duplicate", () => dupTo(1), { hint: "⧉" }),
    input("Duplicate this many times", "2", (v) => { const n = parseInt(v, 10); if (n > 0) dupTo(Math.min(n, 50)); }, "2"),
    ...(!isBranch && inGroup > 0 ? [act(`Duplicate with its ${inGroup} branch slide${inGroup > 1 ? "s" : ""}`, () => edit((t) => O.duplicateGroup(t, id), lineOf(e + 1)))] : []),
    SEP,
    newSlide,
    branch,
    sub("Move", [move("up", "Up"), move("down", "Down"), SEP, move("top", isBranch ? "To the start of its branches" : "To the start of the deck"), move("end", isBranch ? "To the end of its branches" : "To the end of the deck")]),
    sub("Slide settings", [choice("transition", "Transition", ["fade", "slide", "zoom", "none"]), choice("reveal", "Reveal", ["stagger", "none"]), choice("align", "Align", ["left", "center", "right", "justify"])]),
    SEP,
    act("Copy slide", () => copy(false)),
    act("Cut slide", () => copy(true), { disabled: sl.length < 2 || (!isBranch && inGroup > 0) }),
    act("Paste after this one", () => { const c = api.clip.get(); if (c) edit((t) => O.pasteSlide(t, id, c), lineOf(id + 1)); }, { disabled: clipText === null }),
    input("Rename", titleOf(s), (v) => edit((t) => O.renameSlide(t, id, v)), "Slide title"),
    act("Tidy this slide (beautify)", () => { const r = beautifySlide(api.text(), id); if (r.changed) api.replace(r.text); api.note(r.summary); }),
    SEP,
    ...(!isBranch && inGroup > 0 ? [act(`Delete with its ${inGroup} branch slide${inGroup > 1 ? "s" : ""}`, () => edit((t) => O.deleteGroup(t, id)), { danger: true, disabled: e - m + 1 >= sl.length })] : []),
    act(!isBranch && inGroup > 0 ? "Delete this slide only" : "Delete slide", () => edit((t) => deleteSlide(t, id)), { danger: true, disabled: sl.length < 2, hint: "✕" }),
  ];
}

/** Right-click on the empty part of the panel. */
export function panelMenu(api: SlideMenuApi): MenuItem[] {
  const last = api.deck.slides.length - 1, c = api.clip.get();
  return [
    act("New slide at the end", () => { const next = addSlide(api.text(), last); api.replace(next, O.slideLine(next, last + 1)); }),
    act("Paste slide at the end", () => { if (c) { const next = O.pasteSlide(api.text(), last, c); api.replace(next, O.slideLine(next, last + 1)); } }, { disabled: c === null }),
    SEP,
    act("Beautify the whole deck", () => { const r = beautifyDeck(api.text()); if (r.changed) api.replace(r.text); api.note(r.summary); }, { hint: "Shift+Alt+F" }),
  ];
}
