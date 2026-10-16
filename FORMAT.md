# .itsd — Interactive Tauri Slide Deck

Plain UTF-8 Markdown (MIME `text/x-itsd`). Open it in any text editor.

- **Frontmatter** (optional): a `---` block on line 1 with `key: value` lines (`title`, `author`).
- **Slides** are separated by a line containing only `---` (ignored inside code fences).
- **Runnable code**: add `run` after the language: ```` ```python run ````.
  Without `run`, a fence is a normal static code block.
- **Languages**: `c`, `cpp`, `rust`, `go`, `python`, `node` (add more in `LANGS` in `src-tauri/src/lib.rs`).
- Run output is never saved in the file; edits made to a block while presenting are not written back.

## Animation

- Frontmatter defaults: `transition: <name>[-left|-right|-up|-down]`, `duration: <seconds>` and `reveal: stagger | none` (see "Transitions" and "Object animations" below).
- Per-slide override: start a slide with an HTML comment, e.g. `<!-- transition: zoom; reveal: none -->`.
- `transition` is how the slide enters and leaves (Motion). `reveal` staggers the blocks inside a slide (GSAP).
- Both are switched off when the OS asks for reduced motion.
- Edits to runnable blocks survive moving between slides, until the source text changes.

## Interactivity

**Named blocks.** `` ```java run id=demo `` gives a runnable block a name buttons can target (same slide only).

**Sources.** A fence tagged `def=name` is hidden and defines a reusable source: `` ```python def=py_hello ``.
Buttons can also load a file next to the deck: `set demo = JavaExample.txt as java`.
Resolution order for `set`: named source, then file. Without `as`, the language comes from the source, then the file extension.

**Buttons.**
```
::: button "Label" class=fancy
set demo = py_hello as python
run demo
:::
```
Actions run top to bottom: `set <id> = <source|file> [as <lang>]`, `run <id>`, `show <id>`, `hide <id>`, `goto <slide number>`, `add`/`sub`/`put` (variables) and `branch`/`proceed`/`back` (see below).
Style with `style: deck.css` in the frontmatter (next to the deck) and `class=` on buttons.

## Input boxes

```
::: input data "Numbers to sort" default="34, 2, 53" run=sort live
```
A one-line text box (no closing `:::`). `data` is its name; the quoted text is the label; `default=` is the starting value.
- `{{data}}` in slide text shows the box's current value, live as you type.
- `{{data}}` in a `run` block is replaced by the value each time the block runs; the editor keeps the `{{data}}` text, so the
  block stays reusable. In Java, an array literal is `{{{data}}}` (the outer braces are Java's).
- `run=<block id>` (same slide) runs that block on Enter and adds a Run button. Add `live` to also re-run ~0.45 s after you stop typing.
- Values are kept while you move between slides, and reset when a deck is opened. Unknown names, such as `{{1}}`, are left as written.
- `placeholder="..."` is optional hint text.

## Text styling

Right-click in the Source pane to open the format panel: color, highlight, typeface, size, weight, italic and underline.
It wraps the selection (or the current line, ignoring `#`/`-`/`>` markers) in `<span style="...">…</span>`, so the deck is still
plain text and the styling can be edited by hand. Size is in `em` (× the surrounding text), so it scales with the slide.
Right-click inside an existing span to edit it; "Clear style" removes it. One Apply is one Ctrl+Z. It does nothing inside code
fences, buttons or frontmatter.

### More span properties
The panel also writes: strikethrough (`text-decoration:line-through`), letter spacing (`letter-spacing`, em), line height (`line-height`),
case (`text-transform`, or `font-variant:small-caps`) and shadow (soft, glow, hard, outline, written out as a full `text-shadow`).
Typeface can be one of the built-in names (Serif, Sans, Mono, Elegant, Display, Handwritten), a font file the deck lists in `fonts:`, or any font installed
on the computer, typed by name.

## Fonts

Frontmatter keys:

```
---
fonts: assets/fonts/Lobster.ttf, assets/fonts/Inter-Bold.woff2
font: Inter-Bold        body text
headingfont: Lobster    headings
codefont: Mono          code blocks and the code editor
---
```

- `fonts:` lists font files (`.ttf .otf .woff .woff2`) next to the deck. Each registers under its file name without the extension (`Lobster`, `Inter-Bold`).
  Keep the `assets/` folder next to the `.itsd` when you share the deck.
- `font:`, `headingfont:` and `codefont:` take a built-in name (Serif, Sans, Mono, Elegant, Display, Handwritten), a name from `fonts:`, an installed font's name,
  an installed font's name (listed under **Installed fonts** in the Format menu), or a full CSS family list (`"Inter", Georgia, serif`). Unknown names fall back to the system font.
- The same three keys work in a slide comment, `<!-- font: Mono; headingfont: Lobster -->`, and then apply to that slide only.
- In the app: **Format > Fonts for the whole deck / this slide**, and **Add font file…** (copies the file to `assets/fonts/` and lists it in `fonts:`).
  The right-click panel's typeface list also includes the deck's fonts.
- Lint: a `fonts:` entry that isn't a font file is an error; a repeated one is a warning.

## Alignment

Left, Center, Right and Justify, at two levels:

- **Whole slide**: the **Align** dropdown in the toolbar writes `align: center` into the slide's `<!-- ... -->` comment. Put `align: center` in the
  frontmatter to make it the default for every slide. A slide-level setting is the default for blocks that don't have their own.
- **One block**: right-click in the Source pane, pick an alignment in the panel and press Apply. It inserts a line directly above the block:

```
<!-- @center -->
## A centred heading
```
  `@left`, `@center`, `@right` or `@justify`. It applies to the whole next block: a paragraph, heading, list, quote, static code block, button,
  input box or in-flow flash box. Click the active alignment again and Apply to remove the line. Select several lines to align several blocks at once.
- Runnable code blocks are narrowed to 78% so left/centre/right has something to move; slide-wide alignment leaves them full width.
  Pictures and flash boxes placed with `x=`/`y=` are positioned absolutely, so alignment doesn't apply to them.
- Justify only shows on text that wraps onto more than one line.
- In the Visual view, right-click a block and use **Text alignment** (Left / Center / Right / Justify / Default); it edits the same line.
- Alignment and placement combine: a block can have both a `<!-- @center -->` line and a `<!-- @ x= y= w= -->` marker above it, in either order.
  Alignment then applies to the text inside the placed box. Deleting the block in the Visual view removes both lines.

## Pictures and backgrounds (Visual view)

The **Visual** view (Edit | Visual | Present) lays pictures out by dragging. Everything it does is saved as plain text:

```
<!-- bg: #1b3a4b; bgimage: assets/sky.jpg; bgdim: 30 -->
::: image "assets/cat.png" x=10 y=20 w=40 h=35.5 alt="A cat"
```
- `::: image "<file>" x= y= w= h=` is one line, no closing `:::`. `x`/`w` are percentages of the slide's width, `y`/`h` of its height,
  so the layout scales with the slide. Later lines are drawn on top of earlier ones. `alt=` is optional.
- Slide comment keys: `bg` (a colour), `bgimage` (a picture file, covers the slide) and `bgdim` (0-80, darkens the photo so text stays readable).
  On a light solid `bg` the slide text switches to a dark colour automatically.
- Image files are copied into an `assets/` folder next to the deck and referenced as `assets/name.png`. Keep that folder with the `.itsd` file.
  Importing into an unsaved deck saves it first. Formats: png, jpg, gif, webp, bmp, svg, avif.
- In the Visual view: drag a picture to move it (snaps to the slide's edges and centre; hold Alt to turn snapping off), drag any corner or side to resize
  (width and height are independent, so the picture stretches; hold Shift on a corner to keep the proportions), arrow keys nudge (Shift = 5), Delete removes, Ctrl+D duplicates. Drag a tile from the Media panel onto the slide, or drop
  image files from your computer. Every change is one Ctrl+Z.

## Placing any block (Visual view)

In the **Visual** view every block on a slide can be picked up and dropped anywhere: headings, paragraphs, lists, code blocks,
buttons, input boxes, flash regions and pictures. A block you drag leaves the normal text flow, and its place is saved as a
one-line marker directly above it:

```
<!-- @ x=10 y=20 w=45 -->
## A heading placed at 10% across, 20% down, 45% wide
```
- Optional `h=` sets a height too: `<!-- @ x=10 y=20 w=45 h=30 -->`. Without it the block is as tall as its content. With it the box has exactly that height:
  a code block's editor and an effect frame stretch to fill it, and text is clipped at the bottom. Drag any corner or side in the Visual view (Shift on a corner keeps
  the proportions), or type Width % and Height %; **Auto height** removes `h=`.

### Rotation, layering and stretching

All of these are optional words in the same marker (and on `::: image` lines, except `fit`):

```
<!-- @ x=10 y=20 w=45 h=30 rot=-8 z=2 -->
<!-- @ x=10 y=20 w=45 h=30 fit=scale lw=40 -->
::: image "assets/cat.png" x=10 y=20 w=40 h=35 rot=15 z=1
```
- **`rot=`** turns the block or picture, in degrees clockwise, about its centre. In the Visual view drag the round knob above a selected element
  (hold Shift to snap to 15°), use right-click > Rotate, or type **Rotate °** in the Inspector. Resizing a tilted element grows it about its centre,
  along its own axes. Flash regions can't be rotated.
- **`z=`** is the stacking order of placed elements: higher is in front. Placed text and boxes start at 0 and pictures at 10, so pictures sit in front
  of text unless you change it; text that still flows with the page is always behind placed things. Right-click > **Arrange** (Bring to front, Bring forward,
  Send backward, Send to back) or the ⤒ ↑ ↓ ⤓ buttons in the Inspector write the `z=` for you. A block has to be placed (dragged) before it can be arranged.
- **`fit=scale lw=`** switches a block from *clip* to *stretch*. The content is laid out `lw` percent of the slide wide, then stretched on X and Y to
  fill the `w` x `h` box, so pulling any handle scales the text itself, like resizing a picture. Turn it on with right-click > **Stretch to box (X and Y)**
  or the checkbox in the Inspector. It applies to text, code blocks and effect boxes; it needs `w` and `h`, and `lw` is set for you (the width at the moment
  you switch it on). Turn it off and the box goes back to clipping.

### Selecting several elements (Visual view)

**Shift+click** adds an element (picture or block) to the selection, and Shift+click again removes it. With two or more selected, the Inspector shows
**Align** (left edges, horizontal centres, right edges, top, vertical centres, bottom: lined up with the selection's own outer edges) and
**Distribute** (equal gaps across or down, needs three or more). Right-clicking a selected element shows the same commands. Blocks that were still in the
text flow get placed when they are moved. One command is one Ctrl+Z. Dragging a whole selection at once is not supported yet.
- `x`, `y` are the block's top-left corner and `w` its width, as percentages of the slide, so layouts scale with the window.
- The marker belongs to the block right under it. Delete the line (or right-click > Return to text flow) and the block flows again.
- Blocks you never drag keep flowing top to bottom, so old decks look exactly as before.
- Text, code blocks and flash regions can be resized with the handles on their left and right edges. Buttons and input boxes keep their own size.
- Flash regions and pictures keep their own `x=`/`y=` options instead of a marker.
- Dragging snaps to the slide's edges and centre and to the edges and centres of other elements (hold Alt to switch snapping off).
  Arrow keys nudge the selected block by 1% (Shift: 5%), Delete removes it, and everything is one Ctrl+Z.

## Trace slides

If a run prints lines of the form `@itsd {"op":"compare","a":[3,1,2],"hl":[0,1]}`, a generated slide with a scrubber,
play/pause/step controls, speed selector and the list of operations appears right after the slide that ran it.
Any language can print these lines. In Java, `Trace.step("compare", arr, i, j)` does it for you (the helper is attached automatically).
Trace slides are not saved in the file; they are rebuilt each time you run.

Trace slides also show a running count per operation name (everything except `start` and `done`), e.g. `compare 7  shift 4  insert 2`.

### Richer trace fields (insertion-sort style)

Optional fields on a trace line: `"sorted": n` (the first n items are the sorted region, tinted), `"key": v` (the value being
held out for insertion, drawn as a separate bar at the left) and `"line": n` (a 1-based line of the code that was run; the
trace slide shows a read-only copy of the code with that line lit).
In Java: `Trace.state("compare", a, sortedCount, key, i, j)`, with `Trace.NONE` when there is no key. `line` is filled in
automatically from the call site. The plain `Trace.step(op, arr, indices...)` still works.

## Editing in the app

Slides are edited as text in the Source pane. The Slides panel can add (+), duplicate, delete and drag-reorder slides; these
rewrite the source, so Ctrl+Z undoes them. "+ Slide" always inserts after the current slide.

## Flash regions

A box that flashes text items in order, in the colours you choose.

```
::: flash id=react size=26 mode=random time="1.5s +-0.5s" loop manual
3 #002ed1, 6 green
2 red
1 blue
:::
```

- **Items** are `text colour`, the last word being the colour (a name like `green` or hex like `#002ed1`). One per line and/or
  comma-separated. Quote text with spaces, or text with no colour: `"Hello there" blue`. `{{input}}` references work in the text.
- **mode**: `linear` (default) shows each item in the centre, in the order written. `random` shows each item at a random spot inside the box.
  Add the `shuffle` flag to randomise the order too.
- **time**: how long each item shows. `1.5s` is exact. Add jitter for a more hectic feel: `"1.5s +-0.5s"` (up to half a second either way),
  `"1.5s +0.3s -0.5s"` (from 1.0s to 1.8s). Units are `s` (default) or `ms`. Quote the value when it has spaces. Flashes never go below 0.2s.
- **gap**: blank time between items, same syntax as `time`.
- **size**: width of the box as a percentage of the slide's width. **h**: height as a percentage of the slide's height, so the box can be any shape
  (`size=40 h=15` is a wide strip). Without `h`, **ratio** (width/height, default `1`, a square) sets the height. In the Visual view, drag any
  side or corner of a flash region, or type Width % / Height %; that writes both `size` and `h`. Right-click > Shape has presets.
- **x / y**: place the box absolutely (percent of the slide, like `::: image`); without them it sits in the flow of the slide.
- **font**: text size, as a percentage of slide width. **frame=off** hides the dashed outline.
- **start**: when it activates.
  `new-slide` (default) starts every time you arrive at the slide.
  `at-start` starts only the first time you reach the slide in a presentation; coming back leaves it idle.
  `when-next` waits: the next Next press (key or button) starts it instead of advancing, and the press after that moves on.
  With several `when-next` regions on one slide, each Next starts the next one in order.
  `manual` waits for a `start` button or a click on the box. The old `manual` flag still works.
- **Flags**: `loop` repeats forever (each pass draws new random timings); `shuffle` randomises the order.
- **Buttons**: `start <id>` (restarts it) and `stop <id>`.

Rapid colour flashing can be uncomfortable or unsafe for people with photosensitive epilepsy. Keep `time` at or above 0.33s for a general audience.

## Modules and effects

A **module** is an optional folder in `src/modules/<id>/` with a `module.ts`. The app finds modules by itself; delete the folder and the
feature disappears, nothing else changes. A module provides **effects** for slides:

```
::: fx reactbits.Aurora speed=1.2 colorStops=#5227FF,#7cff67,#5227FF
::: fx reactbits.BlurText text="Hello {{name}}" delay=150
```
Effects from the shadcn-style vendors are named by their registry name, in lower case with dashes: `::: fx magicui.marquee`, `::: wrap magicui.shimmer-button`,
`::: wrap magicui.aurora-text` (with the words as its content), `::: fx magicui.particles`, and likewise `kokonutui.…`, `cultui.…`, `eldoraui.…`, `aceternity.…`. The kind (background / text / around content) is worked out
from the component's source when it is downloaded.

One line, no closing `:::`. `module.Effect` then `key=value` options (quote values with spaces). Options you leave out use the effect's own defaults.

- **background** effects fill the slide behind the text (like a slide background). Several can be stacked.
- **text** effects take `text=` and are a normal block: they flow with the text, take `<!-- @center -->` and `<!-- @ x= y= w= -->` lines,
  and can be dragged in the Visual view. `{{input}}` references work in `text=`.
- A deck that uses an effect whose module isn't installed still opens: the effect is skipped and the editor shows a warning on that line.

Every insert-effect menu groups effects by what they act on: **Background** (the whole slide), **Text** (animated words) and **Around content**
(frames and cards around what you write inside). In the Source pane's right-click panel each group is a dropdown; in the menu bar and Visual
view they are submenus.

Where to use them:
- **Visual view**: the **Modules** tab (next to Inspector, shown only when a module is installed) lists the effects to add and the options of the
  ones on the current slide. Right-click the slide > Add > Effect also works.
- **Edit view**: right-click in the Source pane > **Insert effect** (puts the line above the clicked line), or Insert > Effect in the menu bar.

- **wrap** effects go around content you write inside them (cards, spotlight and glare boxes, magnetic or click effects):
```
::: wrap reactbits.SpotlightCard spotlightColor=rgba(255,255,255,0.25)
## A card
Any markdown here.
:::
```
  It is a normal block too: it flows, can be aligned and placed, and `{{input}}` references work inside. If the module isn't installed the
  content is still shown, just without the effect.
  Select lines in the Source pane first, then right-click > Insert effect, and a wrapper goes around the selection.
  Frames (ElectricBorder, StarBorder, BorderGlow, SpotlightCard, GlareHover) get padding automatically (FlipCard pads each face); text wrappers (GradientText,
  GlitchText) take the content's words and inherit the slide's font size. Text wrappers use plain text only (bold etc. is dropped).

**Code blocks inside a wrapper.** The inside of a `::: wrap` is real slide content, so a `run` fence there is a live editor with a Run
button, exactly like one on the slide itself. `id=` works (buttons and input boxes elsewhere on the slide can drive it), and `{{input}}`
references are filled in. A `:::` inside a code fence does not close the wrapper.

````
::: wrap reactbits.BorderGlow backgroundColor=#0e1222 borderRadius=16
```python run
print("this editor lives inside the glow")
```
:::
````
Limits: `::: button` and `::: input` lines use `:::` themselves, so they can't go inside a wrapper (put them next to it and point them at the code
block's `id`). Text wrappers (GradientText, GlitchText) only take the content's words, so code blocks don't apply to them.

**Multi-part wrappers.** Some wrappers have several parts; a line containing only `+++` separates them. `reactbits.FlipCard` takes the front, then
`+++`, then the back (either side can hold code blocks):
````
::: wrap reactbits.FlipCard trigger=click direction=horizontal
## What does this print?
+++
```python run
print(sum(range(5)))
```
:::
````
`trigger=click` flips on a click on the card's own area or its corner button (clicks on the editor or Run button don't flip it);
`trigger=hover` flips while the pointer is over it and stays flipped while the cursor is in the code. Space/Enter flip it when the card has
focus. A wrapper that isn't multi-part just stacks the parts. `FlipCard` is written for itsd (React Bits has no flip card that fits a
slide) and lives next to the downloaded components; its `.meta.json` has `"parts": true`.

Setting up the React Bits effects: `src/modules/reactbits/components/` ships with Aurora, Particles, Lightning, Galaxy, Silk, Threads, DotGrid,
Plasma, PixelSnow, ElectricBorder, StarBorder, GlareHover, SpotlightCard, BorderGlow, ClickSpark, ShinyText, GradientText, GlitchText, BlurText,
DecryptedText and TextType. More: `npm run module:reactbits -- add <Name>` (needs internet).
React Bits is MIT + Commons Clause (see `components/REACTBITS-LICENSE.md`): fine to use in your decks and app, not to resell the components themselves.

### React Bits module (`src/modules/reactbits`)
Nothing is hand-written: components are downloaded from React Bits' own registry, so any component with plain props works.
```
npm run module:reactbits -- add Aurora BlurText Particles
npm run module:reactbits -- add "*"        # every component in the registry ("all" works too)
npm run module:reactbits -- remove Aurora     # or remove "*" to clear them all
npm run module:reactbits -- list
```
This writes the component and a `Name.meta.json` (its options, read from its TypeScript props) into `components/`, and runs `npm install` for any
package it needs. Components that need files the registry doesn't carry (shadcn `@/` imports, 3D models, images) are skipped so they can't break
the build. Options that can't be written as text (lists of objects, functions) aren't shown, so those components run with their defaults. Browse them at https://reactbits.dev.
Rapid flashing or fast motion can be a problem for some viewers; check effects before presenting to a general audience.

### Writing another module
`src/modules/<id>/module.ts` default-exports `{ id, name, effects: [{ id, label, kind: "background" | "text", props, load }] }` (see `types.ts`).
`load` is a dynamic `import()` of a React component; `props` lists `{ key, type, def }` so the Modules tab can edit it.

## Slide size and fitting

- A slide has the aspect ratio of the monitor the app is on (16:9, 16:10, 21:9 ...), in the editor and in Present, which fills the whole
  window. Everything is stored as percentages, so a deck still lays out correctly on a different screen.
- Slides never scroll. If the text, code blocks and boxes that flow down the slide are taller than the slide, they all shrink together until
  they fit (down to 30%), and grow back when there is room. Blocks you placed with `x=`/`y=` or a `<!-- @ ... -->` marker keep their size.

## Vendors (downloading effects)

ITSD doesn't contain any effects. **Vendor > React Bits** downloads them from React Bits' own site to this computer, on request, and keeps them
in the app's local storage, so they work offline afterwards. Each is compiled inside the app when first used. A list shows everything React Bits
offers, with search, per-component Download/Remove, and Download all / Remove all. Downloaded effects appear in the same menus and panels as any other
(Insert > Effect, the Modules tab, right-click > Add > Effect), and a deck uses them the same way: `::: fx reactbits.Aurora`.

Why not bundle them: React Bits is MIT + Commons Clause, which allows using the components in your own work, including commercially, but not
redistributing the components themselves "alone, in a bundle, or as a ported version". Downloading them straight from the source keeps them out of the repository
and out of the app. (This is not legal advice; read https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md for how you distribute.)

All 216 components can run this way. The app is built with every package they import (React 19, GSAP and its plugins, Motion 12, `ogl`, `three`,
React Three Fiber and drei, `postprocessing`, `vgpu`, `maath`, `matter-js`, hugeicons, react-icons, `@use-gesture/react`, Chakra UI, React Router) and hands
them to a downloaded component when it asks, loading each only when needed. A component that needs a Chakra or router provider is shown inside its own.

A download is test-run before it is kept, so one that can't run here is refused with the reason (Download all lists them under "Why n couldn't be added")
instead of failing later on a slide. A few components are built around data a deck can't write as text (link lists, logos, pictures, content to swap
between): those come with a small built-in sample (`src/vendor/samples.tsx`) so they work as effects, and their other options stay editable. Options a
component *requires* get a placeholder value, so leaving them out of the deck doesn't crash it. Canvas-based text effects get a box to draw in
(18% of the slide width tall) unless the deck sets `h=`.

**For developers:** `npm run module:reactbits -- add '*'` downloads the components into `src/modules/reactbits/components/` (not committed) so they are built
into your own build, including the ones that need extra packages (it installs those). It skips the few that would break the build (Chakra UI and the router need a provider, face detection needs model files); add `--force` to add them anyway, and `--no-install` to only download. The Vendor menu and the
command are independent: a deck works with either, and if both provide an effect, the built-in one is used.

Another vendor is one more file in `src/vendor/` like `reactbits.ts` (a catalog and a way to fetch one component), listed in `src/vendor/sources.ts`.

## Actions (animate on Next, on click, on enter)

Lines directly above a block or picture say what happens to it during a presentation. They sit in the same stack as `<!-- @center -->` and
`<!-- @ x= y= -->`, in any order, and are deleted with the block.

```
<!-- @id title -->
<!-- @on next: rotate this 90 -> fade this 0.3 -->
<!-- @on next: move title by 10 0 ; scale title 1.5 1 over 0.3s -->
<!-- @on click: rotate this 15 over 0.2s -->
<!-- @on enter: fade this out over 0s -> wait 1s -> fade this in -->
## A heading
```
- **`<!-- @id name -->`** names the block below so other lines can point at it. `this` means the block the line is above. A code block's `id=` is a name too.
- **Triggers.** `next`: one line is used up by each Next press, in the order the lines appear in the file; when all are used, Next goes to the next slide
  (it shares that queue with flash regions that start `when-next`). `click`: every click on the block. `enter`: when the slide appears, after its
  fade-in (Present only). Triggers do nothing while editing in the Visual view.
- **Chains.** Steps joined by `->` run one after another (each waits for the one before to finish). Steps joined by `;` start together.
- **Steps.** Anything animated takes `over 1s` (default 0.5s; `ms` works) and `delay 0.2s`.

| Step | Does |
| --- | --- |
| `rotate T 90` | turn by 90 degrees clockwise (negative turns the other way); `rotate T to 45` sets the angle |
| `move T by 10 -5` | shift by that percent of the slide's width and height; `move T to 40 30` puts its top-left corner there |
| `scale T 1.5` | make it 1.5 times its size; `scale T 2 0.5` stretches X and Y separately |
| `fade T in` / `out` / `0.4` | opacity |
| `show T` / `hide T` | appear or vanish at once (on a `run` block they keep their old meaning of showing or hiding the editor) |
| `reset T` | animate back to how it started |
| `wait 1s` | pause the chain |
| `run id`, `start id`, `stop id`, `goto 3`, `set id = source` | the same actions a button has |

`T` is `this` or an `@id`. Rotation, scale and shift are applied on top of the block's own `rot=`, `rot=`, `h=` and placement, and they are not saved:
the slide starts fresh every time. With reduced motion switched on in the operating system, steps jump instead of animating. The editor flags a step it
doesn't understand (error) and a name nothing on the slide has (warning). In the Visual view right-click a block > **Add action** for ready-made lines;
**Insert > Action (on Next)** adds one at the cursor in the Edit view.
## Trace parts (a trace as separate slide elements)

A trace is a set of separate elements that share one playback, so each one can be placed, resized, rotated, layered and styled on its own:

```
::: trace-title    from=sort title="Sorting" steps=false size=1.2
::: trace-bars     from=sort unsorted=#4466ff selected=#ffcc00 sorted=#2a9d6f key=#7fd6a4 selected-swap=#ff5577 labels=false size=1
::: trace-counts   from=sort
::: trace-controls from=sort speed=2 speeds="1 2 4" slider=false sound="compare:tick swap:pop done:chime" vol=0.8 pitch=+-0.1
::: trace-code     from=sort size=1.2
::: trace-ops      from=sort size=1
```
Each is one line, no closing `:::`, and a normal block: it flows with the text, or drag it in the Visual view (a dragged part gets a `<!-- @ x= y= w= h= -->` marker above it like any block).
`from=` is the `id` of the run block whose `@itsd` lines feed it (left out = "the latest run"); parts with the same `from` play together: Step on the controls moves the bars,
the operation list, the counts, the title and the lit code line at once. Use only the parts you want, as many times as you like.
- **Bar colours:** `unsorted` (the plain bars), `sorted` (the sorted region), `selected` (the bars a step points at), `key` (the held key); `selected-<op>` colours the selected bars for one kind of step, e.g. `selected-swap=#ff5577`.
  (`bar=` and `hot=` still work as older names for `unsorted` and `selected`.)
- **Options per part:** the Inspector (Visual view) has a field for each: colours and value labels for the bars, text size for the text parts, speed choices and the
  scrubber for the controls, the heading and step counter for the title. Each edit rewrites that part's own line. `sound=`, `vol=` and `pitch=` (see Sound effects) work on any part, usually the controls.
- **Sample:** before the first run the bars show a sample so you can lay everything out; the run's output tells you the trace is ready.
- **One block:** `::: trace from=sort title="..."` is still all the parts in one box. Right-click it > **Split into parts** (or the button on it, or in the Inspector) replaces it with
  separate parts laid out where it was.
- **Generated slide:** a run with no trace parts still adds a generated slide after the slide that ran it; its **Make editable** button gives the run block an `id` if it has none and
  inserts a slide made of separate parts. A run that has trace parts anywhere no longer gets a generated slide.
- Insert > Trace (separate parts) adds all six, laid out; Insert > Trace (one block) adds the single block.

## Sound effects

Sounds are looked up **by name**. Names come from two places; a file in your folder wins over a built-in of the same name.
- **Your sound folder**: Sound > Set sound folder... once. It is an app setting, not stored in the deck, so you can move or change it any time (Sound > Reload folder
  after adding files). `boom` finds `boom.wav`, `boom.mp3`, `boom.ogg`, `.m4a`, `.flac`, `.aac`, `.opus` or `.webm` (case-insensitive; `boom.wav` also works).
  A reference with a slash (`assets/boom.wav`) is read relative to the deck, or as an absolute path.
- **Built in** (synthesized, no files): `click tick pop blip ding chime success error whoosh zap boom`.

Ways to use a sound:
```
<!-- sound: whoosh -->                  plays when the slide appears while presenting (toolbar: Sound)
::: button "Boom"
play boom vol=0.6                       the `play` action; vol is 0 to 1, optional
:::
::: trace from=sort sound="swap:pop"    one sound per trace step
```
Sound > Volume sets one master level for everything. Sounds only play while presenting (slide `sound:`) or when you click or step; editing is quiet. The
toolbar's ▶ and Sound > Try... let you hear a name. An unknown name is silent.

### Volume and pitch, with a little randomness
Anywhere a sound is named (the slide `sound:`, the `play` action, a trace block) it can carry `vol=` and `pitch=`, and either can be a little random, drawn fresh
every time, so a sound that repeats doesn't wear on the ear:
```
vol=0.8              pitch=1.5            fixed (pitch is a ratio: 1 = as recorded, 2 = an octave up, 0.5 = an octave down)
pitch=1+-0.2         anywhere from 0.8 to 1.2     (`+-`, `+/-` and `±` all work)
pitch=+-0.2          the same: no number before it means "around 1"
pitch=+-2st          give or take up to 2 semitones (`st` = semitones; `pitch=3st` is a fixed 3 semitones up)
vol=0.8+-0.1         0.7 to 0.9
pitch=+0.2           a sign in front (+ or -) means "follow the data": see below. On its own (a button, a timer) it is just 0.2 up (1.2) or, as -0.2, 0.2 down (0.8)
```
It works the same in every place a sound can be started, including the scripting actions and timers:
```
play tick pitch=1+-0.15                 a button, or any action list
every 1s play tick pitch=+-2st          a different pitch each second
after 3s play "big boom" vol=0.7        (quote names that contain spaces)
<!-- sound: whoosh pitch=+-0.1 -->       when the slide appears
```
Pitch changes the speed of a folder file (higher = faster and shorter) and the notes of a built-in sound. Pitch is limited to 0.25 to 4.

### Sounds in the trace visualiser, per kind of step
`sound=` takes one entry per kind of step (`op:name`), and each entry can have its own `vol` and `pitch` after commas (no spaces). A bare name is the default for any step
without its own entry. `vol=` and `pitch=` on the trace line itself are the defaults for all of them:
```
::: trace from=sort sound="compare:tick swap:pop,pitch=1+-0.3 done:chime,vol=0.6" pitch=+-0.1 vol=0.8
```
**Pitch that follows the bars.** Write the pitch with a sign and it follows the value of the bar(s) a step highlights, from the lowest value in the whole trace to the highest:
`pitch=+1` rises from normal pitch at the lowest bar to an octave up at the highest; `pitch=-0.5` falls an octave across the same range; `pitch=+0.2` is a gentle slope
(`+12st` / `-12st` do the same in semitones). Add `+-` for a little random wobble on top, e.g. `pitch=+1+-0.05`. A sorted array therefore plays as a rising scale.
```
::: trace from=sort sound="compare:tick swap:pop" pitch=+1
```

So every compare ticks a hair differently, swaps pop at a wandering pitch, and the final step chimes once.

## Scoreboard

`::: wrap scoreboard.Board <options>` ... `:::` shows live standings from a log of score updates written inside the block
(module in `src/modules/scoreboard/`). Standings are always calculated from the log and the current time, so the same data drives a
static board, a replay and a video-synced board.

```
::: wrap scoreboard.Board title="Finals" keys=true
title: Finals, Game 3        optional title (the title= option wins)
teams: Alpha, Bravo, Charlie optional: sets the unsorted order and lets a team start at 0
// a comment
0:45 Alpha +3                time  team name (spaces allowed)  points
1:30 Bravo +2
2:10 Alpha =10
:::
```
- **Time** is seconds, `m:ss` or `h:mm:ss`. Lines can be in any order; they are sorted by time (same-time lines keep the order written).
- **Points**: `+n` / `-n` add or subtract, `=n` or a bare `n` sets the total. Tied scores share a rank (1, 2, 2, 4).
- **Team names** can't contain `_ * # >` (the block's text loses them before it is read). `{{name}}` references work.
- Options: `title=`, `src=<text file next to the deck holding the log; used instead of the lines inside>`, `video=<file>` (mp4, m4v, webm, ogv, mov;
  next to the deck, streamed from disk, any size), `offset=<seconds>` (video second that is 0:00 in the log, default 0),
  `speed=` (replay speed, default 1), `start=begin|end` (`end` = final standings at once), `sorted=true|false` (rows slide into rank order; default true),
  `autoplay=true` (start the replay by itself; no video), `keys=true` (while presenting, Next steps one update before leaving the slide; no video).
- With `video=` the video's own controls are the clock; without it the board has Play / step / slider / speed / Final controls.

## Video and audio blocks

```
::: video "assets/intro.mp4" id=intro autoplay loop muted controls=false fit=cover start=3 vol=0.8 poster=assets/still.png
::: audio "assets/theme.mp3" id=theme autoplay loop
```
One line, no closing `:::`. They are ordinary blocks: they flow with the text, or you drag them in the Visual view to place, resize (the video fills the box), rotate and layer them.
- The file is **streamed from disk**, never loaded into memory, so long videos are fine and seeking is instant. Insert > Video… / Audio… copies the file into `assets/`
  next to the deck (a disk copy) and adds the line; or write any deck-relative or absolute path yourself. Video: mp4 m4v webm ogv mov. Audio: wav mp3 ogg m4a flac aac opus.
  What actually plays is decided by the system's web view (for example, WebKitGTK on Linux may need GStreamer codecs for H.264/AAC).
- Options: `autoplay` (starts when the slide appears **while presenting**; editing stays quiet; a web view may refuse sound until you click, so add `muted` for a silent video),
  `loop`, `muted`, `controls=false` (hide the player bar), `fit=cover|contain` (video only, default contain), `start=` (seconds), `vol=` (0 to 1), `poster=` (picture shown before play).
- `id=` lets a button control it: `start intro`, `stop intro` (stop rewinds to `start`), `show intro`, `hide intro`.
- The scoreboard's `video=` uses the same streaming.

## Variables and button actions

`::: var name default=value` (one line, no closing `:::`) declares a named value; it draws nothing. It is the same store as `::: input`, so `{{name}}` in
slide text and in `run` blocks shows the live value. Names are letters, digits and `_`, not starting with a digit.

Button actions (one per line, top to bottom) that change values:
- `add <name> <number>` / `sub <name> <number>`: add or subtract (a value that isn't a number counts as 0).
- `put <name> <value>` (or `put name = value`): set it to a number or text.

Scoreboard `live=true`: the block's lines only supply the `teams:`; each team's score is the variable named after it (characters other than
letters, digits and `_` become `_`), so `add Alpha 3` works and `{{Alpha}}` shows it. A Reset button sets every team to 0.

## Branch slides

`<!-- branch: N -->` as a slide's first comment (N = 1, 2, 3, ...; can be combined: `<!-- branch: 2; transition: zoom -->`) takes the slide off the main
line. Its *mother* is the nearest slide above it without `branch:`. Several branch slides in a row with the same N form one branch.
- Ctrl+Right, Ctrl+Enter, Ctrl+Space (while presenting) enter branch 1, 2, 3 of the current slide (or, from inside a branch, of its mother).
- On a main slide, Right, Space, PageDown go to the next main slide and Left, PageUp to the previous one; they never enter a branch. Inside a branch they walk
  through that branch's own slides (Right: next child, and after the last one on to the main slide after the mother; Left: previous child, and from the first one back to the mother). A `when-next` region or a scoreboard with `keys=true` still takes the Next press first.
- Button actions: `branch <n>` (enter branch n), `proceed` (next slide of this branch; after the last one, on to the main slide after the mother), `back` (to the mother).
  They do nothing on a main slide (`branch` works anywhere). `goto <slide number>` still jumps to any slide by its place in the file.
- Numbering: the slide counter and the Slides panel count main slides only; a branch slide is labelled `<mother>-<N>` (`30-1`, `30-1.2`).
- Lint: `branch:` must be a positive number, and a branch slide needs a main slide above it.

## Calculations and `when` rules

A calculation (`src/expr.ts`) is parsed and evaluated by the app itself; it is not JavaScript and has no access to files or the system.
- Numbers, text in `"double"` or `'single'` quotes, `true` / `false`, and variable names.
- Operators, tightest first: `**`, unary `- + not !`, `* / %`, `+ -` (`+` joins text if either side is text), `== != < <= > >= =`, `and &&`, `or ||`. Brackets group.
- Functions: `min` `max` (any number of values), `round(x)` / `round(x, digits)`, `floor`, `ceil`, `abs`, `sqrt`, `len(text)`, `if(condition, then, else)`.
- A variable with no value is 0; stored `true` / `false` are yes/no; text that looks like a number is a number. Dividing by 0 (and other non-numbers) gives 0.
- Where: `{{ calculation }}` in slide text (only when every name in it is a known variable, so `{{1}}` or `{{a: 1}}` in code is left alone; in Markdown text
  write `a * b` with spaces), the value of `add` / `sub` (`add score bonus * 2`), and `put name = calculation` (without the `=`, `put name text` stores the text as written).

```
::: when <condition>
<action>
<action>
:::
```
A `when` block draws nothing. While presenting, it runs its actions (the same ones a button can use) when the condition turns from false to true while the slide is showing.
Arriving on the slide with the condition already true does nothing; it runs again after the condition has gone false and true again. Bad conditions and calculations are marked as errors in the editor.

## Timers

- Time: `2s`, `1.5s`, `500ms`, `2m` or a bare number of seconds.
- Actions (anywhere an action is allowed, including `when` blocks): `after <time> <action>` runs the action once after the delay; `every <time> <action>` runs it repeatedly (minimum 50 ms);
  `cancel` stops every timer of the current slide. Timers started this way run whenever the button is clicked, also in the editor.
- Blocks: `::: after <time>` / `::: every <time>` followed by action lines up to `:::` start when the slide appears, **only while presenting**, and draw nothing.
- All timers of a slide stop when the slide is left (and `cancel` stops them early). Variables keep their values, so reset them at the start (`::: after 0s` with a `put`) if the slide can be revisited.
- Bad times and the actions inside timers are checked by the editor like any other action.

## Scripting

Everything below works in actions (buttons, `::: on`, `::: when`, `::: after`, `::: every`, macros). Actions run top to bottom; `wait` pauses the rest of that list.

| Action | What it does |
|---|---|
| `wait 500ms` | pause (`s`, `ms`, `m`) |
| `if score >= 5 then goto 3 else play error` | one action or another; the condition is a calculation (see below) |
| `repeat 3 add score 2` | do an action n times (1 to 1000) |
| `toggle flag` | flip a variable between true and false |
| `random roll 1 6` | put a whole number from lo to hi in a variable (lo and hi can be calculations) |
| `call name a b "c d"` | run a `::: macro`; `$1 $2 ...` and `$*` in its lines are the arguments |
| `script name a b` | run a `::: script` (JavaScript); the arguments arrive as `args` |

**Macros** are reusable lists of actions, defined on any slide and usable from every slide:
```
::: macro reset_round
put score 0
play chime
:::
```
**Event rules** run actions when something happens, while presenting: `::: on enter [once]` / `::: on leave [once]` (as the slide appears / goes),
`::: on key r space` (those keys; letters, `space`, `enter`, `arrowup`... avoid the arrows and space, which move between slides), `::: on change score`
(when that variable changes; its own actions don't re-trigger it).
```
::: on key r
call reset_round
:::
```
**Calculations** (`{{ }}` in text, `if`, `add`, `put name = ...`, `::: when`) also have: `clamp(x, lo, hi) sign pow mod sin cos`, `random() randint(lo, hi) pick(a, b, c)`,
`upper lower trim left(t, n) right(t, n) contains(t, part) replace(t, old, new) num str`, and the built-in names `slide`, `slides` and `elapsed` (seconds since Present started). A variable of your own with the same name wins.

**Scripts** (`::: script name` ... `:::`) are JavaScript for what the above can't do. They run in a separate worker (no page, no files, network switched off as far as possible) and are
stopped if they compute for more than a few seconds without a `wait`. The app asks before running scripts, once per opened deck. Available inside:
`get(name) set(name, v) add(name, by) vars args`, `goto(n) branch(n) proceed() back()`, `play(name, {vol, pitch})`, `show(id) hide(id) start(id) stop(id) run(id)`,
`call(macro, ...args) script(name, ...args)`, `await wait(ms)`, `random() randint(lo, hi) pick(...)`, `log(...)`. A problem is put in the variable `script_error`
(declare it with `::: var script_error` to show it). Not a hardened sandbox against a hostile script: only allow scripts in decks you trust. A line containing only `---` inside a script would split the slide.
```
::: script shuffle
for (let i = 0; i < 5; i++) { set("roll", randint(1, 6)); play("tick"); await wait(120); }
:::
```
The editor checks the new syntax: unknown macros/scripts, bad conditions, script syntax errors, malformed `on` rules.
## Show-if, `if` actions, keys, random values, toggle and reset

*Both `::: key a` (this section) and `::: on key a` (Scripting above) work; they do the same thing. `random(6)` / `random(3, 8)` give whole numbers, and `randint(lo, hi)` is the same as `random(lo, hi)`.*

- **Show-if:** a line `<!-- if: <condition> -->` above a block (paragraph, heading, list, button, input, picture, `wrap`, ...) shows that block only while the condition is true (only while presenting; the editor shows all).
  It applies to the next block only. Conditions may not use `random()` / `pick()`.
- **`if <condition> then <action> [else <action>]`** is an action: the condition is calculated when it runs. The first ` else ` ends the `then` part, so an `if` can follow `else` but not sit inside `then` together with an `else`.
  Conditions here may use `random()` (they are calculated once).
- **`::: key <key>`** ... `:::` runs its actions when the key is pressed while presenting (this slide only; key repeats are ignored; no Ctrl/Alt/Cmd). Keys: one letter or digit, one of `+ - = [ ] , . ; /`, or `enter`, `up`, `down`.
  Space, Left, Right, PageUp, PageDown and Escape are taken. The block draws nothing.
- **`random()`** is 0 to 1, **`random(n)`** a whole number 1..n, **`random(a, b)`** a whole number a..b; **`pick(a, b, ...)`** one of its values. They are not allowed in `{{ }}` text (left as written) or in `when` / show-if conditions (editor error).
- **`toggle <name>`** flips a variable between `true` and `false`. **`reset <name>`** puts a variable back to its declared default; **`reset`** alone resets all variables and input boxes.
  Starting a presentation (F5 / Shift+F5) also resets all of them.

## Trace bar looks, autoplay, and the Format button

`::: trace-bars` also takes `view=bars|dots|line|numbers|heat`, `gap=` and `radius=` (slide units). `::: trace-controls` takes `autoplay=true` and `loop=true`.
All of them are in the Inspector when a trace piece is selected.

Code blocks have a **Format** button (Shift+Alt+F). JavaScript, TypeScript, JSON, CSS, HTML and Markdown use the bundled Prettier; Rust, Python, Go, C, C++ and Java use
rustfmt, black, gofmt and clang-format when installed (`format_code` in `lib.rs`); otherwise a basic tidy (spaces, blank lines, bracket indent) runs.

## Beautify: the tidy form of a file

**Format > Beautify deck** rewrites only whitespace and spacing, to this form: LF line endings; no trailing spaces (a hard break, two spaces before more text, is kept); at most one blank line in a row;
`key: value` in the settings at the top; `---` with one blank line either side; `::: kind attribute=value ...` with single spaces (text inside quotes untouched) and a bare `:::` to close;
`<!-- key: value; key: value -->` for slide options; `# Heading` with one space; the file ends with one newline. Fenced code and the body of `::: script` are copied exactly, a placement marker
(`<!-- @... -->`) is left alone and stays directly above its block, and a blank line is never added inside a slide. The result is checked by parsing it again: same settings, same number of
slides, same options and the same text on every slide (whitespace aside), otherwise the file is left as it was.

## Trace: look and feel (every part, all optional)
Put these on any `::: trace-title|bars|counts|controls|ops|code` line, or set them in the Inspector (the part's own fields).
- **Layout and type:** `font="Space Grotesk"` `weight=700` `italic=true` `caps=true` `spacing=0.05` (letter spacing, em) `color=#ffd866` (text) `fill=#101530` (box) `border=#f2b84b` `borderw=0.25` `round=1.5` `pad=1` `shadow=soft|glow|hard|inset` `opacity=0.9` `align=left|center|right` `size=1.2` (text size ×).
- **Bars views** (`view=`): `bars dots line numbers heat` and `grid` (`cols=4`), `stack` (last value on top), `tree` (the array read as a binary heap), `ring`. Extras: `index=true` (positions under each value), `pointers=true` with `pointer="i j k l"` (names on the lit values), `prefix=$` `suffix=ms`, `gap` `radius`, `anim=0.4` (seconds a change takes) `ease=ease-out|linear|cubic-bezier(...)`.
- **Per step:** `names="compare=Look swap=Exchange"` renames step kinds in the heading, the operations list and the counts; `colors="swap=#ff6188 compare=#f2b84b"` colours them (lit bars, list markers, counts). `selected-<op>=#...` still works for bars.
- **Operations list:** `numbers=true` numbers the steps; `args=false` hides the positions after each name. **Controls:** `back=` `play=` `pause=` `next=` change the button text. **Code:** `font=` and `lines=false` (line numbers off).

## Trace slides, Settings and styling the trace with CSS

**A run that prints a trace gets its own slide.** The first time a `run` block prints `@itsd` lines and no slide shows that run yet (no `::: trace-*` block with `from=` its id), the app writes a
real **branch slide** off the slide that ran it (`<!-- branch: 1 -->`, or the lowest free number; if the run slide is already in a branch, the trace slide joins that branch) made of the
separate trace parts, plus a **Return** button (`back`). The run block gets an `id=trace` if it had none, and the slide that ran gets a **Show trace** button (`branch 1`) so a presenter can reach it.
From then on it is an ordinary slide: move, resize, restyle or delete any part, add your own text and pictures. Presenting never edits the file; a run during a presentation shows a generated slide instead.
File > Settings > Trace chooses: a branch slide (default), a generated slide right after the run ("Make editable" turns it into real parts), or nothing.

**Settings** (File > Settings, Ctrl+,) are about the app, not the deck, and are kept on this computer: sound folder and volume (also in the Sound menu), the trace choice above, the Show trace button,
a **trace stylesheet**, and what to do about `::: script` blocks (ask once per deck, always, never).

**Your own CSS.** Two places, both plain CSS: the deck's `style: file.css` header (that deck only) and File > Settings > Trace stylesheet (every deck; read again whenever you click back into the app).
Order: the app's CSS, then the Settings file, then the deck's file; at equal specificity the later one wins. `example/exampletrace.css` lists every hook and restyles the trace; `example/trace.itsd` uses it.
Hooks on every part's box: classes `tp`, `tp-title|bars|counts|controls|ops|code`, `itsd-trace` and whatever you set with `class=name` (Inspector > Look > CSS class); attributes `data-part`, `data-from`,
`data-op` (the step now showing), `data-step`, `data-steps`, `data-playing`; bars parts also `data-view`. Inside: `.bar` (`.hot` selected, `.sorted`, `.keyed`; `data-i`, `data-v`), `.pt` `.node` `.cell` for the other Looks,
`.ops li` (`.cur`, `data-op`), `.counts span` (`data-op`), `.ctl button`. Sizes use `--u` (1% of the slide's width): write `calc(var(--u) * 2)` rather than px so it scales with the slide.


## Transitions (PowerPoint style) and Morph
`transition: <name>` in the frontmatter (whole deck) or a slide's options comment (that slide), plus an optional `duration: 0.8` (seconds, 0 to 5). Names:
`none fade dissolve push slide wipe cover uncover split zoom zoom-out iris flip cube rotate drop morph`. `push wipe cover uncover flip cube` take a side
(`push-left`, `wipe-down`, ...) = the side the new slide comes from; without one the direction follows your movement (Next comes from the right, Previous from the left).
`<!-- transition: cube-right; duration: 1.2 -->`.
**Morph**: objects on two neighbouring slides are matched by `<!-- @id name -->`, else by the same picture file, else by identical text. A matched object glides from its
old position, size and angle (`@ x= y= w= rot=`) to the new ones; unmatched objects fade in; the old slide's background cross-fades. Give two objects the same `@id`
on both slides to make them morph even when the text changed. Reduced-motion systems get a cut. Transitions panel: Transitions menu or the **Transition** button in the toolbar.

## Object animations (anim)
`<!-- @on next: anim <target> <effect> [left|right|up|down] [over 0.6s] [delay 0.2s] -->`, a normal action step, so it chains with `->` (after previous) and `;` (with previous):
`<!-- @on next: anim title fly-in left -> anim sub fade-in ; anim logo pulse -->`.
- Entrance (object is hidden until its turn): `appear fade-in fly-in float-in wipe-in zoom-in bounce-in spin-in swivel-in drop-in split-in`
- Emphasis (plays and returns): `pulse grow spin shake wobble blink bounce flip heartbeat`
- Exit (object stays hidden afterwards): `disappear fade-out fly-out float-out wipe-out zoom-out spin-out shrink-out`
The direction is the side an object comes from / goes to. Default durations are per effect; `over` overrides. Triggers are the usual `@on next | click | enter`. The Animations
pane (toolbar **Animations**, or the Animations menu) adds them for you: choose an object, Start (On click / With previous / After previous / When the slide appears), direction, duration, delay,
then click an effect. It names the object with `@id objN` when needed, lists every animation in Next-press order, and can reorder or remove them. In the Edit view the canvas shows entrances hidden;
press Next under the canvas (or Present) to play them.

## Syntax colours
The Source editor colours the deck's own markup: `---` separators and frontmatter keys, headings, `<!-- -->` comments with directives (`@on`, `@id`, `@`) and option keys,
`:::` blocks and their names, action verbs, `{{variables}}`, `<span>` tags and the code inside fences (in its own language). Colours only; nothing in the file changes.
