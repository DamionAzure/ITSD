# .itsd — Interactive Tauri Slide Deck

Plain UTF-8 Markdown (MIME `text/x-itsd`). Open it in any text editor.

- **Frontmatter** (optional): a `---` block on line 1 with `key: value` lines (`title`, `author`).
- **Slides** are separated by a line containing only `---` (ignored inside code fences).
- **Runnable code**: add `run` after the language: ```` ```python run ````.
  Without `run`, a fence is a normal static code block.
- **Languages**: `c`, `cpp`, `rust`, `go`, `python`, `node` (add more in `LANGS` in `src-tauri/src/lib.rs`).
- Run output is never saved in the file; edits made to a block while presenting are not written back.

## Animation

- Frontmatter defaults: `transition: fade | slide | zoom | none` and `reveal: stagger | none`.
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
Actions run top to bottom: `set <id> = <source|file> [as <lang>]`, `run <id>`, `show <id>`, `hide <id>`, `goto <slide number>`.
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

About 170 of the 216 components can run this way: the app supplies React, GSAP (with ScrollTrigger, SplitText and friends), Motion, `ogl` and `@gsap/react`.
The rest need packages ITSD doesn't include (icon packs, three.js, React Three Fiber, a router…) and are listed as "can't run inside ITSD".

**For developers:** `npm run module:reactbits -- add '*'` downloads the components into `src/modules/reactbits/components/` (not committed) so they are built
into your own build, including the ones that need extra packages (it installs those). It skips the few that would break the build (Chakra UI, a router,
face detection, and React Three Fiber on React 18); add `--force` to add them anyway, and `--no-install` to only download. The Vendor menu and the
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
