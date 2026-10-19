# ITSD Manual

*The short version for people who don't read READMEs.* Slides are plain text. You write them, run code on them, and present them.
This page is also in the app: **Help > Manual**.

## Your first 5 minutes

1. **File > New** (Ctrl+N). You get a starter deck.
2. In the left pane (the **Source**) type a heading and a line of text. The right pane (the **Canvas**) shows the slide as you type.
3. A line with just `---` starts a new slide. Or press **+ Slide** in the toolbar.
4. Put code in a fence and add the word `run`:

   ````
   ```python run
   print("hello")
   ```
   ````

   A **Run** button appears on the slide. Press it and the output shows underneath.
5. Press **F5** to present. **Right arrow** or **Space** goes forward, **Left arrow** goes back, **Esc** leaves.
6. **Ctrl+S** saves. The file ends in `.itsd` and is plain text, so you can open it anywhere.

That's the whole idea. Everything below is "how do I…".

## The three views

| View | What it's for |
| --- | --- |
| **Edit** | Source on the left, live slide on the right. Best for writing. |
| **Visual** | Drag things around the slide with the mouse. Best for layout, pictures and effects. |
| **Present** | Full screen, no editing chrome. F5. |

Switch with the **Edit / Visual / Present** buttons top right, or **View** in the menu bar. **Ctrl+B** shows or hides the slide list.
In Edit view, the strip on the far left toggles the Slides, Source and Canvas panes.

Everything you do in any view is just a change to the text, so **Ctrl+Z** undoes it, and each action is one step.

## I want to…

### …make a new slide
Type `---` on its own line, or press **+ Slide** (it goes after the current slide). In the Slides panel you can also duplicate, delete and **drag to reorder**.

### …run code
Add `run` after the language. Languages: `c`, `cpp`, `rust`, `go`, `python`, `java`, `node`. The language's tools must be installed on your computer
(Python for `python`, a C compiler for `c`, and so on). If the Run button says it can't start, that's why.
Output is never saved in the file. You can edit the code while presenting; those edits aren't saved either.

### …let the audience type something in
Add an input box on its own line:

```
::: input data "Numbers to sort" default="34, 2, 53" run=sort live
```

- Write `{{data}}` anywhere in the slide text to show what was typed, live.
- Write `{{data}}` inside a `run` block to feed it into your program. Give the block a name with ` ```python run id=sort `.
- `live` re-runs the block shortly after typing stops. Leave it off to run only on Enter or the Run button.

### …make a button
```
::: button "Try Python" class=fancy
set demo = py_hello as python
run demo
:::
```
One action per line, top to bottom: `set`, `run`, `show`, `hide`, `goto 5`. A block you want to swap into is named ` ```java run id=demo `,
and hidden reusable code is a fence tagged ` ```python def=py_hello `.

### …show a trace or animation of an algorithm
Make your program print lines like `@itsd {"op":"compare","a":[3,1,2],"hl":[0,1]}`. A scrubber slide with play, step and speed
controls appears right after the slide you ran. In Java, `Trace.step("compare", arr, i, j)` does it for you. See `FORMAT.md` for the richer fields.

### …flash words in colours
```
::: flash id=react size=26 mode=random time="1.5s +-0.5s" loop
3 #002ed1, 6 green
2 red
:::
```
Items are `text colour`. **Insert > Flash region** adds one and lets you pick when it starts; the **+ Flash** toolbar button adds one that starts when you press Next. Keep each flash at 0.33 seconds or longer for a general
audience: fast colour flashing can be unsafe for people with photosensitive epilepsy.

### …change colours, fonts and sizes
In Edit view, **right-click** in the Source pane. Pick a colour, highlight, typeface, size, weight, italic or underline, then **Apply**.
Select text first to style just that, or leave the cursor on a line to style the line. Right-click inside styled text to change it. **Clear style** removes it.

### …align things
- Whole slide: the **Align** dropdown in the toolbar.
- One block: right-click in the Source pane, choose Left, Center, Right or Justify, then **Apply**.
- In the Visual view: right-click a block > **Text alignment**.

### …put a picture or background on a slide
Go to the **Visual** view. Use the Media panel to import an image (it is copied into an `assets/` folder next to your deck),
then drag it onto the slide, or drop an image file from your computer. For a full-slide background, right-click an empty part of the slide > **Background** (a colour, or **Photo…**; **Apply to all slides** copies it everywhere). **Keep the `assets/` folder next to the `.itsd` file** when you move or share the deck.

### …drag things anywhere
In the **Visual** view you can pick up any block (heading, text, code, button, input, flash box, picture) and drop it anywhere.
It snaps to edges and centres; hold **Alt** to turn snapping off. Drag any corner or edge to resize: width and height are independent, so you can stretch a picture or a box on either axis. **Hold Shift on a corner to keep the proportions.** You can also type exact **Width %** and **Height %** in the Inspector. Arrow keys nudge (Shift = bigger steps),
**Delete** removes, **Ctrl+D** duplicates. Right-click a block > **Return to text flow** to let it flow normally again.

### …rotate, stack and stretch things
In the **Visual** view, click a picture or block:
- **Rotate:** drag the round knob above it (hold **Shift** to snap to 15°), or right-click > **Rotate**, or type **Rotate °** in the Inspector.
- **Front and back:** right-click > **Arrange** (Bring to front, Bring forward, Send backward, Send to back), or use the ⤒ ↑ ↓ ⤓ buttons. A block must have been
  dragged once (placed) before it can be arranged.
- **Stretch text:** normally a taller box just clips text. Right-click > **Stretch to box (X and Y)** (or tick the box in the Inspector) and the text itself
  stretches to fill the box, so you can make it wide, tall or squashed by dragging any handle.

### …line up or space out several things
**Shift+click** each element you want. The Inspector shows **Align** buttons (left, centre, right, top, middle, bottom) and **Distribute** (even gaps, needs
three or more). Right-click a selected element for the same commands. Everything lines up with the edges of the selection itself.

### …make things move when I press Next
Put a line above the block you want to animate:

```
<!-- @on next: rotate this 90 -->
## This heading turns when you press Next
```
Each Next press uses up one `@on next` line (top to bottom in the file); once they are used up, Next goes to the next slide. You can chain steps:
`->` means "then", `;` means "at the same time", for example `fade this out -> wait 1s -> fade title in` or `move this by 10 0 ; scale this 1.5`.
Other steps: `rotate`, `move`, `scale` (X and Y separately: `scale this 2 0.5`), `fade`, `show`, `hide`, `reset`, `wait`, plus the button actions
`run`, `start`, `stop` and `goto`. Add `over 1s` to slow one down. To point at another block, name it with `<!-- @id title -->` above it.
`@on click:` runs when someone clicks the block, and `@on enter:` when the slide appears. The quickest start is the Visual view: right-click a block >
**Add action**. Animations only play while presenting (or pressing Next in the Edit view's preview), and they are never saved into the deck.

### …add effects (electric borders, glow, aurora)
**Step 0, once:** open **Vendor > React Bits…** and download the effects you want (or **Download all**). They come from React Bits' own website,
so you need internet for this one step; afterwards they work offline. Use the search box to find one, and **Remove** to delete it.
Until you download something, the effect menus below are empty.

There are three kinds:

| Kind | What it does | Examples |
| --- | --- | --- |
| **Background** | Fills the whole slide behind the text | Aurora, Particles, Lightning, Galaxy, Silk, Threads, DotGrid, Plasma, PixelSnow |
| **Text** | Animated words | BlurText, DecryptedText, ShinyText, TextType |
| **Around content** | A frame or card around what you write inside | ElectricBorder, StarBorder, BorderGlow, SpotlightCard, GlareHover, GradientText, GlitchText |

**Two ways to add one:**
- **Edit view:** right-click in the Source pane > **Insert effect**. If you selected lines first, a frame goes around your selection.
  Or **Insert > Effect** in the menu bar.
- **Visual view:** open the **Modules** tab at the right. Click an effect to add it. Effects already on the slide are listed below; click one to tweak
  its options (colours, speed, and so on) or press ✕ to remove it.

What lands in the file is one readable line, for example:

```
::: fx reactbits.Aurora speed=1.2
::: fx reactbits.BlurText text="Hello {{data}}"

::: wrap reactbits.ElectricBorder color=#7df9ff
## Anything you write in here gets the outline
:::
```
Code blocks work inside frames, so you can put a live editor in a glowing box. If someone opens your deck on a computer where an effect isn't
downloaded, the slide still shows; that effect is just skipped. Full detail is in `FORMAT.md`. Some effects use fast motion, so check them before presenting
to a big audience.

### …make the deck look different
Put `style: deck.css` in the frontmatter (the `---` block at the very top) and write normal CSS in `deck.css` next to your deck.
Buttons take `class=`. Slide transitions and reveals are set in the toolbar (**Transition**, **Reveal**) or in the frontmatter (`transition: fade`, `reveal: stagger`).
Both switch off by themselves when the computer asks for reduced motion.

## Keyboard and mouse cheat sheet

| Keys | Does |
| --- | --- |
| Ctrl+N / Ctrl+O | New / Open |
| Ctrl+S / Ctrl+Shift+S | Save / Save As |
| Ctrl+Z / Ctrl+Y | Undo / Redo (also in the Visual view) |
| Ctrl+B | Show or hide the slide list |
| F5 / Shift+F5 | Present from this slide / from the first slide |
| F11 | Full screen |
| F1 | Open this manual |
| Right, Page Down, Space | Next (while presenting) |
| Left, Page Up | Back (while presenting) |
| Esc | Leave Present |
| Right-click in the Source pane | Text format, alignment, insert effect |
| Right-click a block in Visual | Alignment, effects, return to text flow, delete |
| Arrow keys / Shift+Arrows (Visual) | Nudge the selected block |
| Delete / Ctrl+D (Visual) | Remove / duplicate the selected block |
| Alt while dragging | No snapping |
| Shift while dragging a corner | Keep proportions |
| Shift+click | Add to / remove from the selection |
| Shift while turning the rotate knob | Snap to 15° |

## When something goes wrong

| What you see | What to do |
| --- | --- |
| Run says it can't start | That language isn't installed. Install it (Python, Java 11+, a C compiler, Rust, Go or Node) and restart ITSD. |
| A picture is missing | The `assets/` folder isn't next to the `.itsd` file. Move it back. |
| An effect is skipped, with a warning on its line | It isn't downloaded on this computer. Open **Vendor > React Bits…** and download it. The rest of the slide still shows. |
| The effect menus are empty | Nothing is downloaded yet. Open **Vendor > React Bits…** first. |
| Vendor says it can't reach the site | You need internet for downloading (only). Check the connection and press Try again. |
| Text looks tiny | Slides never scroll. When too much flows down a slide, it all shrinks to fit. Split it into two slides, or place blocks yourself in Visual. |
| Justify does nothing | It only shows on text that wraps onto more than one line. |
| An effect shows "couldn't start" | The effect failed (often no graphics acceleration). The slide still works. Remove that effect or try another. |
| A change went wrong | Ctrl+Z. Every action is one undo step. |
| Run output is gone after reopening | By design. Output is never stored in the file. |

## The syntax on one page

````
---
title: My deck
author: Me
transition: fade
---
# A heading                      <- slides are split by a --- line
<!-- transition: zoom; align: center; bg: #1b3a4b; bgimage: assets/sky.jpg; bgdim: 30 -->

<!-- @center -->                  <- aligns the next block (@left @center @right @justify)
<!-- @ x=10 y=20 w=45 -->          <- places the next block (percent of the slide)

```python run id=demo             <- live code; id lets buttons target it
print("hi {{data}}")
```
```python def=py_hello            <- hidden reusable source
print("hello")
```
::: input data "Label" default="1, 2" run=demo live
::: button "Go"
set demo = py_hello as python
run demo
:::
::: flash id=f size=26 time=1.5s loop
hello red, there blue
:::
::: image "assets/cat.png" x=10 y=20 w=40 h=35
::: fx reactbits.Aurora
::: wrap reactbits.ElectricBorder
Content in a frame
:::
````

Need the fine print? **`FORMAT.md`** documents every option. This manual is the friendly version.
