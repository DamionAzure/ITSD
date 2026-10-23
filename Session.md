# Session log

What was built in this working session, in order, then the four features added last, then what is known to be untested.
Everything is also described for users in `MANUAL.md` (friendly) and `FORMAT.md` (exact syntax).

## What was done, in order

1. **Format panel and live input.** Right-click in the Source pane opens a panel for colour, highlight, typeface, size, weight, italic and underline
   (it wraps the selection in a `<span style>`, so decks stay plain text). `::: input` gives a live text box whose value fills `{{name}}` in slide text
   and in `run` blocks.
2. **Preview viewport.** The preview was fixed to a locked aspect ratio so a wide slide (the trace visualiser) can't blow it up. A later version of the
   project replaced this with slides that take the monitor's aspect ratio and shrink their flowing content to fit (`src/aspect.ts`).
3. **Backgrounds and alignment.** A background picture chosen from a file dialog and copied into `assets/`, linked from the slide comment. Left / Center /
   Right / Justify for the whole slide (toolbar), for one block (a `<!-- @center -->` line), and from the Visual view's right-click menu.
4. **Universal drag.** Any block can be dragged anywhere in the Visual view, stored as `<!-- @ x= y= w= -->` above it. Merged with alignment so a block can
   carry both lines.
5. **Effects (React Bits).** Worked on the module system (`::: fx`, `::: wrap`). Found why text and wrapper effects misbehaved: the prop parser gave several
   components the wrong kind (TextType, ShinyText), GlitchText needed a plain string instead of HTML, and the components' own CSS was poster-sized with no
   padding. Fixed those, added "wrap the selected lines in a frame" to the Source pane's Insert effect, and a demo slide. A later version of the project
   replaced the bundled components with the **Vendor** menu (downloads from React Bits on request), which is the right fit for its Commons Clause license.
6. **README.md, MANUAL.md and Help > Manual (F1).** The manual is written as "I want to..." recipes and also opens inside the app.
7. **Free X and Y scaling.** Pictures can be pulled from any corner or side with width and height independent (Shift keeps the proportions). Blocks got an
   optional `h=` in the marker, with all eight handles and a Height % field.
8. **Four more things (below).**

## The four features added last

### 1. Layering (`z=`)
- `z=` on a placed block's marker or on a `::: image` line. CSS stacking is `10 + z`. Placed blocks default to z 0 and pictures to z 10, so pictures stay in
  front of text exactly as before; flowing text is behind everything placed.
- To make blocks and pictures interleave, `.in.free` and `.layer` no longer create stacking contexts (`style.css`).
- Commands (`stack()` in `Visual.tsx`): Bring to front, Bring forward, Send backward, Send to back. Right-click > **Arrange**, and ⤒ ↑ ↓ ⤓ in the Inspector.
  Forward and backward hop over the neighbour; front and back go one beyond the highest or lowest. Lowest allowed is z -9.
- Only placed elements can be arranged (a block that flows has no z). Flash regions are not part of this.

### 2. Rotation (`rot=`)
- `rot=` (degrees clockwise) on markers and image lines, rendered with the CSS `rotate` property, about the centre.
- Visual view: a round knob above the selected element (Shift snaps to 15°), right-click > **Rotate** (90°, 180°, reset), and **Rotate °** in the Inspector.
- Resizing a tilted element is done in its own axes and grows it about the centre (`rotResize`). Rotated blocks are measured from their unrotated box so the
  selection outline stays correct.
- Flash regions cannot be rotated.

### 3. Stretch text (`fit=scale lw=`)
- Normally `h=` clips. With `fit=scale lw=40` the content is laid out `lw` percent of the slide wide, then stretched on X and Y to fill the `w` x `h` box
  (`Scaled` in `SlideView.tsx`, using the CSS `scale` property so it composes with rotation and dragging).
- Switch on with right-click > **Stretch to box (X and Y)** or the Inspector checkbox; `lw` is filled in for you. Works for text, code blocks and effect boxes.
- The Slides-panel thumbnails don't stretch (they show the clipped box).

### 4. Multi-select, align and distribute
- **Shift+click** adds or removes pictures and blocks. With two or more selected the Inspector shows **Align** (left, centre, right, top, middle, bottom, to the
  selection's own edges) and **Distribute** (even gaps across or down, three or more). The right-click menu on a selected element offers the same.
- All edits for one command go through a single text change, so one Ctrl+Z. Blocks are processed last-to-first so inserted marker lines don't shift the
  line numbers still to be edited. Blocks that were flowing are placed as they move.
- Not done: dragging a whole selection at once, and Ctrl+A.

## Added after that: actions (`@on next: ... -> ...`)
Asked for as "on-next=execute(Rotate This 90) -> execute(); ...". Built as directive lines above a block, not new button syntax:
- `<!-- @id name -->` and `<!-- @on next|click|enter: chain -->`, parsed in `toBlocks` (`src/SlideView.tsx`) and carried on the block as `id`, `ons`, `dir`.
- `src/motion.ts`: the step parser (`parseChain`: `->` is then, `;` is together; `over`/`delay`) and the runner. It animates with the Web Animations API on the
  CSS `rotate`, `translate`, `scale` and `opacity` properties, so it stacks on top of a block's own `rot=`, placement and stretch. Parallel steps on one element
  only touch their own property.
- `next` lines register with the existing `armNext` queue (shared with flash `when-next`), so one Next press = one line, then the slide advances.
- Button actions (`run`, `start`, `stop`, `goto`, `set`) work inside a chain, by handing the text to the existing `parseAct`/`perform`.
- Lint: unknown step is an error, a target nothing has is a warning, duplicate `@id` is an error. Deleting a block also deletes its action lines
  (`BlockRef.dir`). Visual view: right-click a block > **Add action** (presets). Insert menu: **Action (on Next)**.
- Not saved and not shown in the Visual view; `enter` waits for the slide's fade-in. Pictures can be targets (an `@id`/`@on` line above `::: image`).
- Checked in the browser: two `@on next` lines took two Next presses and the third went to the next slide; rotate, fade, move and scale (X/Y) landed on the
  right values, with `;` steps not overwriting each other; lint flagged a bad step and an unknown name; delete removed the action lines.

## Added after that: fonts and text formatting
- Deck fonts: frontmatter `fonts:` (files), `font:`, `headingfont:`, `codefont:`; the same three keys in a slide comment. They set the CSS variables
  `--body-font`, `--head-font`, `--code-font` (`App.tsx`, `SlideView.tsx` `fontVars`, `style.css`). Monaco follows the code font (`CodeBlock.tsx`).
- `src/fonts.ts` registers listed files with `FontFace`; `import_font` (Rust, `lib.rs`) copies a file into `<deck>/assets/fonts/`.
- **Format** menu: fonts for the deck / this slide, Add font file. Right-click panel gained strikethrough, letter spacing, line height, case, shadow and the deck's fonts.
- `assets.ts` gives fonts a proper MIME type; `lint.ts` flags a non-font or repeated `fonts:` entry.
- Checked in headless Chromium with a mocked backend: choosing a deck heading font wrote `headingfont: Display` and the slide's `h1` used it; a slide font wrote
  `<!-- font: Mono -->`; Add font file wrote `fonts:`, registered the face (`DejaVuSerif-Bold: loaded`) and applied it to headings.
- Not checked: the real `import_font` in the Tauri app, and the span panel's new controls in the live UI (only the style round-trip in `format.ts`).
- Installed fonts: Rust command `list_system_fonts` (`fontdb` crate) fills an **Installed fonts** submenu and an optgroup in the right-click panel. The Rust snippet compiled in a scratch crate (72 families found here); the full Tauri build couldn't run in the sandbox (no GTK), and the first real build downloads `fontdb`. A deck using a system font only looks right on computers that have it.

## Files touched by the last two steps
`src/layout.ts` (marker: `h rot z fit lw`), `src/images.ts` (image `rot z`), `src/ImageLayer.tsx`, `src/SlideView.tsx` (placed style, `Scaled`),
`src/Visual.tsx` (resize, rotate, layering, stretch, multi-select, menus, Inspector), `src/motion.ts` (new), `src/lint.ts`, `src/App.tsx`, `src/style.css`, `FORMAT.md`, `MANUAL.md`, this file.

## How it was checked
- `tsc --noEmit` and `vite build` pass.
- In headless Chromium with a mocked Tauri backend: markers with `rot` render; Shift+click two blocks and Align left wrote equal `x`; Bring to front wrote
  `z=11` (one above the picture's default 10); the Stretch checkbox wrote `fit=scale lw=` and the text visibly stretched; dragging the rotate knob wrote
  `rot=90`; resizing a rotated block kept its `rot` and grew about the centre; earlier, an explicit `h` made a code block's editor fill its box; Present mode (F5) shows a rotated box and a stretched text block correctly.

## Not checked, so look at these first
- The real Tauri app. In particular the Linux webview (WebKitGTK) needs the individual CSS properties `rotate` and `scale` (WebKitGTK 2.32 or newer).
- Effect frames filling an explicit height or stretching: no React Bits effects are downloaded in the test setup.
- Undo of each new command as a single step in the real editor (each is one text replacement, which should be).

## Vendor: dependencies and fixes (latest)
- The app now carries every package a React Bits component imports (React 19 and Motion 12 to match the registry; three, React Three Fiber, drei, vgpu,
  postprocessing, maath, matter-js, hugeicons, react-icons, @use-gesture/react, Chakra UI, React Router). `src/vendor/compile.ts` hands them to downloaded
  code, each as its own lazily loaded chunk. Chakra and the router are given a provider around the component.
- Downloads are test-run on install (`runtime.ts`), so a component that can't run is refused with the reason.
- `src/vendor/samples.tsx`: built-in sample data for the components that need lists, pictures, content or element references.
- `meta.mjs`: required props get placeholder values (`req`), named string unions resolve, the `<Id>Props` interface is preferred, canvas text gets `fill`.
- `Fx.tsx`: the error boundary resets per effect (a failed one no longer breaks the next slide's), shows why, and the effect cache survives a refresh of the list.
- Checked by downloading all 216 and rendering each in headless Chromium (software WebGL). Not run: a real Tauri build, reactbits.dev (this sandbox can't reach it;
  the app uses the same files from React Bits' GitHub repository).

## Added after the four features: trace blocks and sound
- **`::: trace from=<id>`** (`src/traceBlock.ts`, `TraceView.tsx` with `block`): the trace visualiser as a normal block that can be placed, sized, rotated and layered.
  Shows a sample until the run block has run. A run claimed by a block no longer gets a generated slide; unclaimed runs still do, with a **Make editable** button
  (`makeTraceSlide`, which also adds `id=` to an unnamed run fence). Traces are now keyed by run-block id so typing no longer discards them (unnamed ones are still dropped on edit).
- **Sound** (`src/sound.ts`): one app-level sound folder (localStorage `itsd.sfx`, set from the Sound menu, changeable any time) plus 11 synthesized built-ins.
  Triggers: slide comment `sound:`, button action `play name vol=`, `sound=` on a trace block (per step). Backend: `read_sound`, `list_sounds` in `lib.rs`. Master volume in the Sound menu.
- Checked: `tsc`, `vite build`, headless Chromium with a mocked backend (sample shown, fills after a run, generated slide suppressed when claimed, Make editable writes the id and the new slide,
  placed + rotated trace block in the Visual view). **Not checked: any audio output** (no sound device here), the Tauri side (`read_sound`/`list_sounds`, folder dialog), WebKitGTK/WebView2 decoding of each format.

## Scoreboard module (added later)
- `src/modules/scoreboard/` (`data.ts` parser + standings, `Board.tsx`, `board.css`, `module.ts`). Use: `::: wrap scoreboard.Board ...` with one score update per line inside. One component, three versions:
  static (`start=end`), animated replay (Play / step / slider / Sorted toggle / `keys=true` to step with the Next key), and video-synced (`video=`, `offset=`).
- Core changes: `assets.ts` and `read_binary` in `src-tauri/src/lib.rs` now also read video files (mp4, m4v, webm, ogv, mov; 512 MB cap), kept out of the picture importer's list.
- Checked: `tsc --noEmit`, `vite build`, the parser/standings in Node, and in headless Chromium (a harness with a fake deck context, plus the real `SlideView`):
  rows slide to new ranks, step/prev/final/slider/speed/sort toggle, video seek and play drive the numbers, `start=end` shows the final standings.
- Not checked: the real Tauri build (the Rust change in `read_binary` is not compiled here), a real game video, and the Next-key stepping (`keys=true`) inside a presentation.
- Merged with the trace-block/sound work; checked together in Chromium (Next-key stepping with `keys=true`, `start=end`, a trace block and a slide `sound:` on the same deck). Team names lose `_ * # >` (SlideView strips markdown characters from the text of `plain` effects).

## Video and audio blocks (added after the merge)
- `::: video` / `::: audio` (`mediaDef.ts` parser, `MediaBlock.tsx`, `media.ts` hook): placeable blocks with autoplay/loop/muted/controls/fit/start/vol/poster, controllable by `start|stop|show|hide <id>`.
- **Streaming, not memory:** media URLs come from Tauri's asset protocol (`convertFileSrc`), enabled in `tauri.conf.json` (`assetProtocol`, empty scope) and `Cargo.toml` (`protocol-asset`).
  The scope grows per file through the `allow_media` command, so only files a deck names are readable. `import_media` copies into `assets/` with `fs::copy`. If the web view refuses the URL, `useMediaUrl`
  falls back to reading the file into memory (`read_binary`, which now also accepts audio) so short clips still play. The scoreboard's `video=` was moved onto the same hook.
- Checked in Chromium with a mocked backend and a real webm: video block renders and fills a placed box, `start clip` plays it, the scoreboard follows a seek of its video.
- **Not checked (Rust never compiled here: no GTK/WebKit libraries):** `allow_media`, `import_media`, the asset-protocol setup, range requests from the real asset protocol, codecs in the real web view, autoplay policy there, the in-memory fallback.

## Variables, live scoreboard and branch slides (added after the media work)
- `::: var name default=` (shares the input store; `scanInputs` and `SlideView.toBlocks`), button actions `add`/`sub`/`put` (`itsd.ts` `parseAct`, `SlideView.perform`).
  Scoreboard `live=true` reads one variable per team (`varName()` in `scoreboard/data.ts`), so `add Alpha 3` moves the rows.
- `src/branch.ts`: `<!-- branch: N -->` slides. `App.tsx` `advance` / Left use `mainNext` / `mainPrev` while presenting; Ctrl+Right / Ctrl+Enter / Ctrl+Space call `enterBranch(1|2|3)`;
  actions `branch n`, `proceed`, `back` are on `DeckApi`. Generated trace slides copy their source slide's `branch` so they stay in that branch.
  The counter / HUD (`where()`) and the Slides panel (`labels()`) number main slides only and label branches `30-1`.
- Navigation rules (confirmed): Left from a branch returns to the mother (not the slide before it); `proceed` after a branch's last slide goes to the main slide after the mother (confirmed: mother+1; Left returns to the mother).
- Checked: `tsc --noEmit`; `branch.ts` and `parseAct` in Node; in the real app in headless Chromium with a mocked Tauri backend and a test deck: counters, `put`, live scoreboard ranks,
  Ctrl+Right / Ctrl+Enter / Ctrl+Space, Right and Left from branches, `proceed` / `back`, sibling branch, no branch on a slide without one, outline labels.
- Not checked: the real Tauri window (Ctrl+Space may be taken by the operating system's input-method switcher on some machines; `branch 3` on a button is the fallback).

## Calculations and `when` rules
- `src/expr.ts`: safe expression parser/evaluator (precedence climbing, no `eval`). `fillRefs` (`inputs.ts`) now evaluates `{{ calculation }}` when every name in it is a known variable (so `{{1}}` in code is untouched);
  `add` / `sub` take a calculation and `put name = calculation` calculates (`itsd.ts` `parseAct`, `SlideView.perform`, `DeckApi.calc`).
- `::: when <condition>` ... `:::` (`itsd.ts` `scanWhen`; skipped in `toBlocks`; an effect in `SlideView` subscribes to the variable store and fires on a false->true edge, only while presenting; arriving already-true does not fire).
- Lint (`lint.ts`) reports malformed conditions and calculations as errors.
- Checked: `tsc --noEmit`; the evaluator in Node (arithmetic, comparisons, text, functions, errors); in the real app in headless Chromium (mocked Tauri): `{{score * 2}}`, `if()`,
  `put total = score * 10 + 1`, `add score bonus`, `when score >= 5 goto 2` firing once, no bounce on Left, firing again after a reset; the status bar counts bad expressions.
- Not checked: the real Tauri window, `when` rules with `run`/`show` actions on the same slide, and expressions inside Markdown that uses `*` or `_` without spaces (Markdown may rewrite them first).
- Not built (suggested next): timers (`after 2s show answer`), `::: script` (sandboxed JS limited to deck variables).

## Timers
- Actions `after <time> <action>`, `every <time> <action>` (min 50 ms) and `cancel` (`itsd.ts` `parseAct`, `parseDelay`; run in `SlideView.perform`); blocks `::: after 3s` / `::: every 1s` (`scanTimers`)
  start with the slide while presenting only. A slide's timers live in one ref and stop on unmount or `cancel`.
- Lint checks block times and the action inside `after` / `every`.
- Checked: `tsc --noEmit`; in the real app in headless Chromium (mocked Tauri): `after 0s` reset, `every 1s` countdown, `when time <= 0 cancel / goto`, a button's `after 1s add n 1`,
  `::: after 1s` with `goto`, `every` counting on a slide and stopping on `cancel`, timer blocks staying quiet in the editor, errors for bad times.
- Not checked: timers across a long presentation, the real Tauri window.
- Still not built: sandboxed `::: script` JS.

## Trace as separate parts (added after the timers work)
- The trace is now `::: trace-title|bars|code|ops|controls|counts` (`traceBlock.ts` parsing, `TraceParts.tsx` components), each an ordinary placeable block. They share playback through `tracePlayer.ts`
  (one player per `from` key, outside React, with the per-step sound/pitch logic moved there), so Step / Play / the scrubber drive every part with the same `from` together. `::: trace` (whole) is the
  composite of all six; **Split into parts** (`traceEdit.ts` `splitTraceBlock`: block menu, Inspector button, and a button on the block) replaces it with six placed parts. **Make editable** now builds a slide of parts.
- Per-part options are edited in the Inspector (`TraceFields.tsx`, field lists in `traceEdit.ts` `FIELDS`); each edit rewrites that part's line (`patchTraceLine`). Colours and text size use CSS variables on the part.
- Checked in Chromium (mocked Tauri): split writes six placed parts; Step on the controls moves title, bars, operations and lit bars together; changing the bar colour in the Inspector sets `--bar`; Make editable on a
  generated slide gives six parts; the scoreboard example still runs (static, replay and Next-key stepping).
- Not checked: sound per step through the parts (no audio device), dragging each part with the mouse (placement uses the existing block machinery, which was tested for other blocks), the real Tauri window.
- Not done: bars one by one (the bars are a single element), per-op colours, a ::: trace-sound part.

## Bars, scoreboard starter data, scripting (after the trace parts)
- Trace bars: `unsorted` / `sorted` / `selected` / `key` colours (+ `selected-<op>` per step kind) in the Inspector; `bar=` / `hot=` still read.
- Scoreboard from the Insert menu had no data (the generic wrap placeholder text parsed to zero score lines). Effects can now carry `starter: { attrs, body }` (`modules/types.ts`, `fxSnippet`); the scoreboard has teams and score lines.
- Scripting: new actions `wait if repeat toggle random call script` (`itsd.ts parseAct`, run in `SlideView.perform`); `::: macro` / `::: script` definitions (`scanDefs`, `Deck.macros/scripts`); `::: on enter|leave|key|change` (`scanOn`, effects in SlideView);
  ~20 more calculator functions and the built-ins `slide slides elapsed` (`expr.ts`, `App.tsx` `builtin`); `src/script.ts` runs `::: script` in a Web Worker (best-effort lockdown, 3 s CPU watchdog, allow-prompt once per deck in `App.tsx`);
  lint checks (recursive `checkAct`, script syntax compiled not run); Insert > Script submenu.
- Checked in Chromium (mocked Tauri): call/macro args, if/else, repeat, random, toggle + wait, a script that adds, waits and reads fresh variables, fetch() blocked inside a script, an infinite loop stopped with the UI alive, `on key` and `on change` while presenting,
  Insert > Effect > Scoreboard now shows rows and the Final button works; trace parts: per-step sound requests through a faked audio engine (tick on compare, pop on swap, none on done), dragging and resizing a part writes its marker.
- Not checked: real audio output, the real Tauri window, `on leave` / `enter once` in a long run, scripts in the real webviews (WebKitGTK/WebView2 Worker-from-Blob support is expected but unverified).
## Show-if, if actions, keys, random, toggle, reset
- Show-if: `<!-- if: cond -->` above a block sets `Block.cond` (`toBlocks` `takeIf`); `SlideView.node` returns null while presenting and `api.holds(cond)` is false; fades in via `.blk.cin`.
- `if cond then A else B` action (`Act` `{op:"if", yes, no}`; `yes`/`no`, not `then`, to avoid a thenable); `toggle`, `reset` (`inputs.unset` / `clear`, `DeckApi.reset`); `::: key` (`itsd.ts` `scanKeys`, `parseKey`; a keydown listener in `SlideView`).
- `random` / `pick` in `expr.ts` are marked `impure`: refused by `fillRefs` (text), `DeckApi.holds` (conditions) and flagged by lint; allowed in action calculations (`put roll = random(6)`).
- Starting a presentation now clears all variables and input boxes (`App.present`).
- Lint (`lint.ts`) uses one `check(act)` for every action list, including inside `if` / `after` / `every`.
- Checked: `tsc --noEmit`; random/pick ranges in Node; in the real app in headless Chromium (mocked Tauri): show-if hides and shows, keys `a` and `enter`, `toggle`, `random(6)` hitting 1..6, `if ... then put msg big else put msg small`,
  `reset score`, a fresh start on the second presentation, the editor showing everything, six kinds of editor errors.
- Not checked: the real Tauri window, key handling while a Monaco editor has focus in presenting mode, show-if on placed (dragged) blocks and on `wrap` blocks.

## Merge of the media, trace-parts, script and logic versions with fonts and actions
Four uploaded versions (media2, trace-parts, script, logic) were merged onto the fonts + actions tree. They share one ancestor (the four-features version).
media -> trace-parts -> script is one line of work; logic branched off before the trace parts. Merged with a three-way merge (script onto ours, then logic onto that,
with media2 as logic's base), and every conflict resolved by hand so both sides' features stay:
- Actions (`@on next`) and fonts: untouched; `lib.rs` now registers both sets of commands; `read_binary` allows images, fonts, video and audio.
- `if`: script's shape `{then, else}` is kept (logic's `{yes, no}` was dropped); logic's show-if `<!-- if: -->`, `::: key`, `reset`, `holds()` are added.
- Two ways to bind keys: script's `::: on key r` and logic's `::: key r`. Both work.
- `random`: logic's `random(6)` / `random(3, 8)` (whole numbers) plus script's `random()`, `randint`, `pick` and the extra functions. `random`, `randint` and `pick` are impure.
- Starting a presentation now clears variables (logic) and restarts the elapsed clock (script).
- Branch slides: Right / Space inside a branch now steps through the branch's own slides (2-1, 2-1.2, ...) and rejoins the main line after the last; Left steps back and ends at the mother. Before, those keys jumped straight out of the branch (only the `proceed` button walked through it). `branch.ts` `mainNext` / `mainPrev`. Checked in Chromium.

## Format button and trace bar views (added to merged2)
- `beautify.ts` + Rust `format_code` + Format button in `CodeBlock` (Shift+Alt+F); prettier dependency. `trace-bars` `view/gap/radius`, `trace-controls` `autoplay/loop` (`tracePlayer.ts`, `TraceParts.tsx`, `traceEdit.ts` FIELDS, `style.css`).
- Checked: tsc, build, browser smoke test. Not checked: Tauri build.

## More vendors: Magic UI, Cult UI, Kokonut UI, Aceternity UI (shadcn-registry adapter)
- **One adapter, `src/vendor/shadcn.ts`**, for any vendor that publishes the shadcn registry format. A vendor is a few lines in `sources.ts` (`item` URL with `{name}`, plus `index` = its registry.json, or `names` = a fixed list when it has none). Items build on other items (`registryDependencies`): looked up in the vendor's own index first, else in shadcn/ui's MIT base set (`button badge card input textarea skeleton label`; the Radix-heavy ones are reported as "can't run here").
- **Tailwind without Tailwind**: `tailwind.ts` runs Tailwind v4's own `compile()` at *download* time on the class names found in the string literals of the component (and what it builds on), and stores the CSS in `Stored.css` (`tw: true`). Nothing Tailwind-related loads at startup. The CSS is deliberately **not in a cascade layer** (the app's global `button {}` and `.in h1 {}` would beat layered utilities). `dark:` = inside `.slide`; `bg-background`-style colours come from `--itsd-*` set on `.fx, .fxbg` in `style.css`; `rem` is rewritten to `calc(n * var(--rem, 1rem))` with `--rem` = 1.25% of slide width, so components scale like the rest of the slide. Only `@keyframes`, `@utility` and `cssVars.theme` from a registry item are honoured (global selectors are dropped on purpose).
- **Runtime** (`compile.ts`): files are found by name (`@/components/ui/button` -> the file called `button`), several named exports (`Stored.main`), shims for `next/image|link|navigation` and `next-themes`, `cn()` at `@/lib/utils`. New npm deps: `tailwindcss clsx tailwind-merge class-variance-authority lucide-react @radix-ui/react-slot|label|use-controllable-state react-use-measure @tauri-apps/plugin-http`. CSS keys are now `vendor/id` (two vendors can both have `marquee`).
- **Classification** is by source, in `shadcn.ts#classify`: renders `{children}` = wrap; the JSX tag around `{children}` being span/h1/p… = `plain` (words, not blocks); a "background" with no absolute/inset/full-size/canvas is really content = text. `meta.mjs` (shared with React Bits) got three fixes: nested object types no longer leak fake props, `type P = HTMLAttributes<..> & {..}` is read, `string | string[]` children are plain. **Diffed against the old parser on all 216 React Bits: 215 identical, 1 better (SpotlightCard now shows its options).**
- **Install-time probe** (`probe.tsx`): shadcn-style components are mounted once off screen with default props; one that throws (needs a provider/data) is refused with the reason instead of failing on a slide. Not done for React Bits (there "can't start" can just mean no WebGL).
- Network: `net.ts` uses Tauri's HTTP plugin when running in the app (no CORS), plain `fetch` in a browser. Allow-list in `capabilities/default.json` (raw.githubusercontent.com, ui.aceternity.com). Magic UI / Cult UI / Kokonut UI are read from their GitHub repos' built registry files (same files their sites serve).
- A rename: the app's `.outline` class is now `.slidepanel`, because Tailwind's `outline` utility would have drawn a box round the slide panel. After installing everything, the only class shared between generated CSS and `style.css` is `slide` (the intended `dark:` selector). Re-check when adding app classes: install all, intersect the class names of `style[data-vendor]` with those in `style.css`.
- **Results (real downloads from GitHub, real Chromium, each effect rendered on a 1280x720 slide):** Magic UI 68 of 78 install (8 need packages we don't have: react-tweet, shiki, cobe, canvas-confetti, rough-notation…; file-tree, icon-cloud need Radix Accordion / react-dom/server) and 68/68 render; Kokonut UI 51 of 54, 51/51 render; Cult UI (`registry:ui` only; its other entries are `*-demo` pages) 71 of 137 and 71/71 render, the rest need shader/base-ui/geist packages, data props (logos, tabs, callbacks) or are compound `Thing.Root` sets; React Bits 216/216 as before.
- **Not checked:** (1) *Aceternity against its real site*: unreachable from the sandbox. The adapter was run against intercepted responses (valid item, 401, 404) and behaves; the 16 names in `sources.ts` come from public docs/install commands and some may be renamed (they'd show under "couldn't be added"). Aceternity publishes no index; add names to the list by hand. Its Blocks are paid (every category on /blocks says "Included with all-access") and are deliberately not offered. (2) *The Rust side*: `tauri-plugin-http` (Cargo.toml, lib.rs, capability) was added but never compiled here; if the build fails there, drop the plugin and `net.ts` falls back to `fetch`, which works for the GitHub-hosted vendors. (3) Visual polish of every effect: spot-checked ~40 in screenshots (dark-on-dark Gradient Heading in Cult UI noticed, not fixed). (4) `npm run module:reactbits` was not extended; the dialog is the way in for the new vendors.
- `vite build` needs a bigger Node heap on a 4 GB machine (`NODE_OPTIONS=--max-old-space-size=3200`); I didn't check whether the unmodified project needs it too.

### Eldora UI added (MIT, verified in its repo's LICENSE.md)
Read from GitHub like Magic UI / Cult UI / Kokonut UI; `registry:ui` only (its blocks are page sections, its examples are demos). Real downloads in Chromium: 28 of 34 eligible install, 28/28 render (the other 6: missing react-icons / three post-processing / data props / an undeclared dependency). Spot-checked in screenshots; Wavy Text drops the space between words, Holographic Card shows an empty dark card.
**Held back: Motion Primitives (ibelick).** Its registry is reachable (`public/c/`, 33 items, mostly plain Motion + cn) but I found no LICENSE file in the repo; the only "mit" I saw is a tag on 21st.dev's listing. Add it to `sources.ts` once the licence is confirmed (item `.../ibelick/motion-primitives/main/public/c/{name}.json`, index `.../public/c/registry.json`). Animata (MIT) publishes no registry file I could find.

## Beautifier for the .itsd file, Slides panel menu, Format menu and panel (this round)
- **`src/beautifyDoc.ts`** (not `beautify.ts`, which formats code inside code blocks): `beautifyDeck`, `beautifySlide`. Conservative by design (see FORMAT.md "Beautify"), self-checking via `sameDeck` (re-parse, compare settings/slide count/options/whitespace-free text; settings compared trimmed). Tested with `npx tsx` on every `.itsd` in the project (safe + idempotent) and on a deliberately messy deck (fences, `::: script`, markers, CRLF, hard breaks). Wired to Format menu, `Shift+Alt+F` (a Monaco *action* in SourceEditor), and a status-bar message (`StatusBar note`).
- **`src/slideOps.ts`** (pure text -> text: group-aware move, duplicate group, delete group, paste, rename, `addBranchSlide`, `duplicateAsBranch`, `setBranch`) and **`src/slideMenu.ts`** (menu builder), mounted from `Outline.tsx` `onMenu` + `App.tsx` (`openSlideMenu`). `edit.ts` now exports `split`/`join`. Cut is disabled on a main slide that has branches (it would lose them); "Delete this slide only" vs "Delete with its N branch slides".
- **Format menu**: Transition / Reveal / Align each as Whole deck / This slide (checked marks show current), fonts, "This slide" (move, reset settings).
- **Format text panel**: `Fmt` gained `script stroke strokeColor opacity decoStyle decoColor wordSpacing chip gradient` (all plain CSS in the span; partial presets stay in `extra`). Round-trip tested.
- **Vendors**: Motion Primitives and Animata, both MIT, verified in their repos (Motion Primitives: `LICENCE.md`, "MIT License, Copyright (c) 2024 ibelick"; the earlier "no LICENSE file" was a spelling miss). Motion Primitives: 33/33 install and render against the real GitHub files. Animata publishes no registry file, so `shadcn.ts` has a `raw` mode that reads component source from raw.githubusercontent.com and turns its imports into dependencies; `vendor/animata.ts` lists the 145 single-file components whose imports are all provided. Real download in Chromium: 116 of 145 install and render; 29 refused by the install probe (reasons not recorded). This replaces the earlier approach that read animata.design (which the sandbox could not reach).
- Tested in Chromium on the real app: slide menu, Duplicate (13->14), Branch (adds `2-1`), panel menu, Format menu, Beautify (Format menu and Shift+Alt+F), Format panel writes the new CSS. Not tested: the Tauri desktop build (Rust never compiled here), Ctrl+click multi-select of slides (not built).

## Vendors: effects only; Trace look and feel
- Vendor lists no longer offer ordinary UI-kit widgets: `isPlainUi` in `vendor/shadcn.ts` (exact names such as button/input/dialog/table/tabs/navbar, plus names that say page furniture: form, pricing, dashboard, testimonial, demo...) hides them from the list and refuses them at install; animated variants ("shimmer-button") stay. Animata is limited to its background, text, image, icon, preloader, hero categories plus animated-dock and fibonacci-lines (45 items; the rest of its widgets/cards/graphs stay buildable only as dependencies: `raw.offer`). Name-based, so a few borderline items may be hidden or shown wrongly; adjust the two lists at the top of that function.
- Trace: `src/traceStyle.ts` (box/type options, per-step names and colours, value format) used by every part in `TraceParts.tsx`; new bar views grid / stack / tree / ring plus `index`, `pointers`; Inspector gets select fields and a Look group per part (`traceEdit.ts` `FIELDS`). Documented in FORMAT.md "Trace: look and feel".
- Checked in Chromium (sample data, mocked Tauri): all five new/changed views render, per-step names and colours show in ops and counts, font/border/fill/shadow apply, pointer and index labels, button text. Not checked: a real run's trace with many values (tree/ring with 30+ values will be crowded), the Inspector fields by hand (only the attributes were tested), Tauri build.

## Settings, trace slide as a branch, trace CSS (after merged53)
- `src/settings.ts` (localStorage store, `useSettings`) and `SettingsDialog.tsx` (File > Settings, Ctrl+,): sound folder/volume (the existing `sound.ts` store), `traceSlide` branch|next|off, `traceButton`, `traceCss` (+on/off, read through `read_deck`, re-read on window focus into `<style id="trace-style">` placed before the deck's own `deck-style`), `scripts` ask|allow|deny (checked in `App.tsx runScript`).
- `makeTraceSlide(text, srcId, name, taken, mode, button)` now has mode "branch" (`slideOps.addBranchLines`: own branch when the run slide is one, else the lowest free number; parts + a placed `Return` button; `Show trace` button on the mother) or "next" (old behaviour). `App.onTrace` creates it on the first trace of an unclaimed run when not presenting, re-keying the stored trace under the new id (the editor's onChange drops unnamed traces) and returning a note that `CodeBlock` prints under the run. "Make editable" on a generated slide uses the same function with the setting's mode.
- Trace parts carry stable hooks (`itsd-trace`, `class=`, `data-part|op|step|steps|playing|from|view`, bars `data-i|v`, ops/counts `data-op`) via `hook()` in `TraceParts.tsx`. `example/exampletrace.css` + `example/trace.itsd`.
- Fixed a null `closest` in `CodePart`'s resize callback after unmount.
- Checked in Chromium (mocked Tauri): run -> branch slide with text/id/buttons, Show trace and Return while presenting, data attributes, Settings dialog and storage, off and next modes, Make editable, settings CSS applied (including `class=fancy`). Not checked: the real Tauri window and file dialogs (Choose… buttons), exampletrace.css visually, focus-reload in the real window.

## Home dashboard and the folder system (after the Settings round)
- Rust: `src-tauri/src/workspace.rs` (plain std, unit tests inside: init never overwrites, path guard `inside`, copy/rename/trash-to-`.trash`/mkdir, unique names, `from_template`); lib.rs wraps it as `workspace_init / list / stat / op / new / reveal` (`WorkspaceInfo`: install dir, resource dir, workspace, version, bundled templates and examples). Operations are confined to the workspace; browsing also allows the read-only resource dir. `tauri.conf.json`: `bundle.resources` = `../example/` and `../templates/`, `windows.wix.language`; `npm run bundle:msi`. New project folder `templates/` (Blank, Title and sections, Interactive quiz, Algorithm trace, Branching talk).
- Front end: `workspace.ts` (invoke wrappers, `summarize`, recent list in localStorage `itsd.recent`), `Dashboard.tsx` (Home: start a deck / recent / folder browser / where things are; cards show title, first heading and lines, slide count), settings `workspace` and `homeAtStart` (also in the Settings dialog). `App.tsx`: Home over everything at start (not when a launch file is given), `load` and `saveDeck` add to Recent, Save As starts in `Decks`, the sound folder defaults to the workspace `Sounds` once (flag `itsd.sfx.auto`).
- Checked: `cargo test` of `workspace.rs` in a scratch crate (2 tests pass); `cargo check` of the whole crate in a copy with stub icons (clean apart from an old dead-code warning); Home in Chromium with an in-memory mock of the commands (cards, template -> new deck opens, Recent, folder browse, rename, delete, new folder, read-only examples, Settings section). Not checked: a real MSI build/install (WiX needs Windows), the real file manager "Show", real folder dialogs, whether `resource_dir()` points at the installed `templates\` in your build (it should: Tauri copies `resources` next to the exe). `src-tauri/icons` only had `icon.png` in the uploaded zip; the build needs your own icon set as before.


## Transitions, animations, Morph, syntax colours, UI polish (after itsd-home)
- Base is the user's `itsd-home` zip (it already had the Beautify command, the Slides-panel menu and the Format menu work). Added on top: `src/itsdLang.ts` (Monarch tokenizer + theme rules, language id `itsd`, code in fences/`::: script` is handed to Monaco's own language via `nextEmbedded`), wired in `monaco.ts` / `SourceEditor.tsx`.
- `src/transitions.ts` (names, groups, default durations, `push-left` style parsing) and a rewritten `Stage.tsx`: 17 transitions (Motion variants; `popLayout` so old and new overlap, `wait` for fade/flip), `duration:` option, Morph = FLIP on `[data-blk],[data-pn]` objects keyed by `@id`, picture src or text, done in a layout effect while the old slide is still mounted.
- `src/anim.ts` (28 effects as WAAPI keyframes, `composite: "add"` on translate/scale/rotate so they stack on a block's own placement) and a new `anim` step in `motion.ts`; entrances hide their object when the slide is armed (`hideUntilEntrance`).
- `src/animOps.ts` (list/add/remove/swap, names objects with `@id objN`), `TransitionsPanel.tsx` (gallery with hover previews), `AnimationsPanel.tsx` (object, start, direction, duration, delay, effect chips, animation pane). Menus: Transitions, Animations; toolbar buttons replace the old transition select.
- UI polish is a CSS block at the end of `style.css` (calmer chrome tokens, pill buttons, rounded panels, dotted canvas, thin scrollbars).
- Checked in Chromium (mocked-free dev server): all 17 transitions run without errors and Morph / wipe / cube were inspected mid-flight; the Animations panel wrote the expected `@on next: anim ...` lines and Next played them. Not checked: the Tauri build, Visual-view selection driving the Animations panel (it uses a dropdown / cursor instead), sound with transitions.

## Home out of the view group, transition previews, dashboard in the editor's look (after itsd-transitions)
- `App.tsx`: the Home button is gone from the Edit / Visual / Present group (Home is still File > Home and Ctrl+Shift+H).
- `TransitionsPanel.tsx`: the previews were two plain blue/orange rectangles that only started after 1.5 s. `Mini` now plays at once on hover (140 ms), loops slide 1 -> 2 -> 1 with a hold,
  and the two little slides have a title, lines, a picture and a big 1 / 2, so a push, cube or iris is readable. A big sticky preview at the top of the panel follows the hovered tile (and rests on the chosen one) with its name and one-line description.
  It plays the real `TRANS_VARIANTS`, so it can't drift from what Present does.
- `Dashboard.tsx` + `style.css` (end of file): the Home screen now uses the editor's frame and tokens: menu bar with the ITSD brand and a Back to the deck button, a side panel like the Slides panel, the dotted canvas as the background, rounded slide-like deck cards with the editor's blue hover ring, editor-style buttons and inputs, and the status bar.
- Checked in Chromium (mocked Tauri): the view group shows Edit, Visual, Present; hover frames of Cube and Push show slide 1 turning into slide 2 within 0.15 s; the caption changes with the hovered tile; the dashboard screenshot.
- Not checked: the dashboard with real decks and folders (the mocked backend has none), Windows/macOS rendering, `prefers-reduced-motion` (the previews always animate on hover).

## Home in the editor's ribbon; preview fixes (after itsd-ui)
- Home is a ribbon button next to File (toggles; Ctrl+Shift+H still works). On the Home page the ribbon is reduced to File / Home / Help; the toolbar, panels and status bar are hidden (kept mounted, so the editor keeps its state), and the Dashboard sits under the same ribbon instead of being a fixed overlay with its own bar. `MenuBar` menus can now be plain buttons (`run`, `on`).
- Preview bug: the Slides panel's own `li` rules (flex, padding, 13px) also hit the list items *inside* each thumbnail, so bullet lists were drawn huge and without bullets. Panel selectors are now `.slidepanel > ol > li`. The same kind of leak hit Home: its `.hmain h1` style (small grey capitals) restyled slide headings in the cards; now `.hmain > h1`.
- Home cards show the deck's first slide drawn by the same `Thumb` as the Slides panel (`Summary.first`), with the text summary only as a fallback.
- Checked in Chromium (mocked Tauri and workspace commands): Home page, switching to the editor and back, thumbnails with bullets. Not checked: the real folder commands, Tauri build.

## Wiki, Home first (after itsd-merged54)
- Base is the user's `itsd-merged54` (it already contained the previous round's previews, dashboard restyle and the Home ribbon button). Menu order is now Home, File, Insert ... (on the Home page: Home, File, Help).
- `src/wikiData.ts` (53 entries in 12 categories: question, where = menu path / keys, steps, optional action key) and `src/Wiki.tsx` (searchable dialog, category list, "Take me there" button). Opened with F2, Help > Wiki, or the Wiki button on Home. Actions are mapped in `App.tsx` (`wikiActions`: new/open, Home, Settings, Visual, panels, Beautify, fonts, sound folder, Present, Vendor, Insert snippets); an entry whose action isn't available shows no button.
- Checked in Chromium: menu order, F2, search ("transition" gives 4 cards), Take me there opens the Transitions panel. Not checked: every button's action, the Tauri build.

## Wiki coverage, controls (after itsd-wiki)
- Audited the Wiki against FORMAT.md/MANUAL.md and added ~30 entries (83 total): reveal/align, goto buttons, variables, calculations, timers, macros, scripts, random/toggle/reset, flash, nudging, return to text flow, right-click menus, transition duration, per-slide transitions, animation reorder, built-in sounds, scripts setting, licences. Claims were checked against the code; one (a "Present from here" menu item) wasn't real in this base and was reworded.
- Not covered in the Wiki on purpose: exact syntax of every block (that stays in FORMAT.md / the manual), the Vendor library catalogue, trace look-and-feel options.
- Controls: a block at the end of `style.css` replaces raw browser styling for select (custom chevron, dark list), text/number inputs, checkboxes (switches) and range; Settings/Manual window restyled. Slide content (`.slide`, `.fx`) is left alone via `revert-layer`. The toolbar no longer wraps button text.

- Wiki: new category "Trace looks" (12 entries: the nine bar views and which to pick, recolouring, step names/colours, positions and pointers, autoplay/loop/speed, step sounds, choosing parts, per-part styling, change speed, CSS, where trace slides go). Wiki is now 95 entries.

## Publisher name (wiki3)
`bundle.publisher` / `copyright` / `category` / descriptions in `tauri.conf.json`, `authors` + `description` in `Cargo.toml`, `author` in `package.json`; `WorkspaceInfo.publisher` read from the bundle config and shown on Home. `cargo check` clean (stub icons, scratch copy), `tsc` clean. Not checked: a real MSI (Manufacturer / "Publisher" in Apps & features). Note `tauri.conf.json` version is 0.1.0 while package.json says 0.2.0; the MSI uses the former.

## Speaker notes, Presenter View, slide grid (after wiki3 + publisher)
- `notes.ts` (`notesOf`, `setNotes`; `::: notes`, fence-aware, skipped by `toBlocks`), `NotesBox.tsx` under the canvas (commit on blur), `Prefs.notes`, Insert > Speaker notes, `notes` snippet.
- Presenter View: `presenterBus.ts` (BroadcastChannel `itsd-presenter`; `PState` = plain slide data + notes + idx/next; commands next/prev/goto/end/hello; `openPresenter` creates a Tauri `WebviewWindow` "presenter" at `index.html?presenter=1`, falls back to `window.open`), `Presenter.tsx` (`PresenterWindow`, own stub `DeckCtx` with `fill` + assets so `Thumb` renders), `main.tsx` picks it by `?presenter` (dynamic imports). App: `pstate()`, bus handlers via `h.current`, state pushed on view/cur/presenting/path, `present()` opens/closes the window when `settings().presenter`. Capability: `windows: [main, presenter]` + `core:window:allow-create|close|set-focus`, `core:webview:allow-create-webview-window` (`cargo check` validates the identifiers).
- Grid: `gridView = edit && outline && !source && !canvas`; `toggle` now only requires one of the three panes; `Outline` `grid`/`onOpen`; `.docs` hidden in grid.
- Checked in Chromium with two pages in one context (the bus is real, Tauri window creation is mocked): notes box read/write/undo-safe commit, notes not drawn, presenter shows now/next/notes, Next/goto/End from the presenter drive the main window, main arrows update the presenter, timer ticks, grid with 3 cards, double-click returns. Not checked: the real second Tauri window (creation, focus, whether BroadcastChannel reaches between two WebView2 windows of one app; it should, same origin/profile), multi-monitor placement, `?presenter=1` URL form in the packaged app. If the window can't be created the app opens a browser window instead.

## Player
Added: `player.ts`, `Player.tsx`, `jsRun.ts`; `PLAYER` branch in App.tsx (own return before the editor; files come from the bundle via resolveRef/assets/sfx/mediaUrl/readFile); `write_binary` + File > Package for phone; `mobile_entry_point`; Settings `player`; `viewport-fit=cover`. Tested with touch/mobile emulation in Chromium (mocked backend). NOT tested: a real Android/iOS build (gen/android is not in the zip), real touch devices, Rust for mobile targets.

## Recorded runs dropped; scoreboard looks; no auto-fit (this round)
- Removed: `runs.ts`, record/replay and "Record all orders" in `CodeBlock.tsx`, the `recordRuns` setting and its Settings section, the wiki entry. The Player stays (JavaScript blocks run in a worker; other languages show "needs a computer"). A deck that still carries a trailing `<!-- itsd-runs ... -->` comment has it stripped when opened (`stripRuns` in App.tsx) and it is gone at the next save.
- Removed the automatic shrink-to-fit of a slide's flowing content (`SlideView.tsx`: the `step` ResizeObserver and the `k` state). `k` is a constant 1, `--k` stays 1. Content taller than the slide is clipped at the slide edge (no scrolling), as the slide already hid overflow. `fit=scale` (the explicit "Stretch to box" option on a placed block) is a separate, opt-in thing and was left alone.
- Scoreboard looks (`src/modules/scoreboard/`): `look=` presets + about 30 options, all variables on `.sb` (see FORMAT.md, Scoreboard). Props in `module.ts` become Inspector fields. Checked in Chromium: all 7 presets and two option-heavy boards drawn. Not checked: the `video=` split layout with the new looks, long team names with `size=`.

## Looks everywhere, and slideshows

- **`src/look.ts`**: one `<!-- @look preset key=value -->` line above any block (parse, format, `lookStyle`, `lookClass`, `patchLook`, `setLookPreset`, 16 presets). `toBlocks` reads it (`Block.look`, `lookLine`); `SlideView` applies it to the block's box (a button's goes on the button; a picture's goes through `ImageDef.look` into `ImageLayer`). Trace parts use the same engine (`TraceParts` wraps it with `size: false`, because a part's `size` is its own multiplier), so they gained gradient, glow, glass blur, shape, filters, hover and more.
- **Inspector and menus**: `LookFields.tsx` (`LookPanel` for every block and picture, `ShowFields` for slideshows); right-click > Look; Insert > Look (Edit view only).
- **`src/slideshow.ts` + `SlideshowView.tsx`**: `::: slideshow` with modes loop / random / staggered / once, ten change effects (WAAPI, enter plus exit keyframes), `start`/`stop` through the block registry, Insert > Slideshow…, Inspector with a picture list and Add pictures….
- Wiki: new categories "Looks" (8) and "Slideshows" (7). Docs in FORMAT.md and MANUAL.md.
- **Tested** headless (Playwright against vite, mocked Tauri `read_binary`): looks render on heading, paragraph, button and slideshows; loop, random and staggered change pictures; Inspector and right-click Look menu appear. **Not tested:** the real Tauri build, Presenter View with slideshows, packaging a deck that has a slideshow for the phone Player (its pictures are found by `fileRefs`, so they should be included).

## Merged with core 0.5.0 (version 0.5.3)

- Three-way merge of the 0.5.0 core source (Phone Player, `.itsdpak` export, updater, bundled React Bits, release workflow) with the Looks and Slideshow work. Five conflicts, all resolved by keeping both sides: the Insert menu, `toBlocks`, `style.css`, `FORMAT.md`, `MANUAL.md`. `src/vendor/`, `templates/`, `example/` stay (the core zip leaves them out but `App.tsx` imports the vendor code).
- Compatibility: the Phone Player renders through `Stage` / `SlideView`, and reads pictures through the bundle-aware asset store, so looks and slideshows need nothing extra. `packBundle` writes `features` into `itsd.json`.
- Polish: slideshow pictures preload; reduced-motion users get a short fade only; optional `pan` slow zoom; the Inspector now shows `shuffle` and `pan` correctly when written as flags.
- Not tested: a real Android build, a real `.itsdpak` round trip, the updater.
- **Bug found and fixed in the 0.5.0 core:** in Phone Player mode `App.tsx` returned `<Player>` outside `<DeckCtx.Provider>`, so any slide crashed with "Cannot read properties of null (reading 'subscribe')" and the screen stayed blank. It is wrapped now. Verified by opening a real `.itsdpak` (deck, manifest, three pictures) with `?player=1` at phone size: looks, the slideshow and its pictures all render.

- **Windows note:** the component is `SlideshowView.tsx`, not `Slideshow.tsx`: on a case-insensitive file system that name collides with `slideshow.ts`, and the import resolved to the wrong file ("No matching export ... Slideshow").

## Added later: Table element and trace table
- `::: table` (`src/tableDef.ts`, `src/TableBlock.tsx`, `src/TableFields.tsx`): rows as plain text split on `|`, seven looks (`style=`), `sort=` / `dir=`, `index`, `hl`, `align`, `caption`. A normal block in `toBlocks` (kind `table`), placed, looked and arranged like any other; the Inspector has a Rows box and every option.
- `::: trace-table` (`TablePart` in `src/TraceParts.tsx`, identity tracking in `src/traceRows.ts`): the same look classes (`.dt`) inside the trace. Rows are keyed by identity, positioned with `--k`, and slide with a CSS transform when the run swaps values. Not one of the six parts Insert > Trace lays out.
- Lint: unclosed table, unknown look, bad `sort`, ragged rows. Docs: FORMAT.md, MANUAL.md, wiki, RELEASE_NOTES.md, `example/tables.itsd`.
- Checked: `tsc --noEmit`, `vite build`, and in headless Chromium with a mocked Tauri backend: the static table sorts and numbers its rows; the trace table's rows swap places step by step (final y positions match the final order); the Visual Inspector shows the table's rows and options. Row matching was also unit-tested on duplicate values.
- Not checked: the real Tauri app, a real run feeding the trace table (the sample trace was used), and merge-sort style traces that overwrite values (matched by nearest slot, only unit-tested).
