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

### …count with buttons (a score, a counter)

Declare a named number with `::: var`, change it from buttons, and show it anywhere with `{{name}}` (it updates as you click):

````
::: var score default=0

Score: {{score}}

::: button "+1"
add score 1
:::
::: button "+2"
add score 2
:::
::: button "Reset"
put score 0
:::
````

`add` and `sub` change the number; `put name value` sets it (a number or any text). A variable is the same thing as an input box's value, just without the box, so a typed-in `::: input` can be changed by a button too.

For a **scoreboard you run by hand**, add `live=true` to the board and give it just the teams. Each team's score is a variable named after the team, so a button can say `add Alpha 3`:

````
::: wrap scoreboard.Board live=true title="Live"
teams: Alpha, Bravo
:::
::: button "Alpha +3"
add Alpha 3
:::
````

### …calculate with variables, and react when a number changes

Anywhere you can write `{{name}}` you can write a calculation, and buttons can use them too:

````
::: var score default=0
::: var bonus default=2

Score {{score}}, doubled {{score * 2}}, rank {{ if(score >= 10, "gold", "keep going") }}

::: button "Bonus"
add score bonus * 2
:::
::: button "Remember"
put best = max(best, score)
:::

::: when score >= 10
play ding
goto 5
:::
````

- Operators: `+ - * / % **`, comparisons `== != < <= > >=` (a single `=` also works), logic `and or not`, brackets, text in quotes (`"Hi " + name`).
- Functions: `min(a, b)`, `max(a, b)`, `round(x)`, `round(x, 1)`, `floor`, `ceil`, `abs`, `sqrt`, `len(text)`, `if(condition, then, else)`.
- `put name = <calculation>` calculates; `put name some text` stores the text as written. `add` and `sub` accept a calculation.
- A variable that has no value yet counts as 0. This is a calculator, not JavaScript: it can't touch files or the computer.
- In slide text, put spaces around `*` (`{{a * b}}`) so Markdown doesn't mistake it for italics.
- `::: when <condition>` runs its actions when the condition **becomes true while that slide is showing** (arriving with it already true does nothing, so pressing Left never bounces you forward). It runs again if the condition goes false and then true again. Rules only act while presenting.
- The editor underlines a calculation or condition it can't read.

### …use timers (reveal after a delay, count down, move on by itself)

Times are written `2s`, `1.5s`, `500ms` or `2m`. Two ways to use them:

- **As actions** (in a button, or inside a `when` block): `after 2s show answer` runs once after the delay; `every 1s sub time 1` repeats until the slide is left or a `cancel` action runs.
- **As blocks that start with the slide** (only while presenting): 

````
::: var time default=10

Time left: {{time}}

::: after 0s
put time = 10
:::
::: every 1s
sub time 1
:::
::: when time <= 0
cancel
goto 5
:::
````

`::: after 3s` runs its lines once, 3 seconds after the slide appears; `::: every 1s` runs them again and again. All of a slide's timers stop when you leave it, so nothing keeps counting in the background. (Put `put time = 10` in an `after 0s` block, as above, so the countdown restarts if you come back to the slide.) The shortest repeat is 50 ms. In the editor the timer blocks stay quiet; a button's `after` / `every` does run when you click it.

### …show something only when a condition is true

Put a `<!-- if: condition -->` line above any block (a paragraph, heading, button, picture ...). It is shown only while the condition holds, and fades in when it does:

````
<!-- if: score >= 10 -->
## You win!

<!-- if: not done -->
::: button "Finish"
put done true
:::
````

The editor always shows everything, so you can still see and move the hidden blocks. Only the block right under the line is affected; repeat the line for the next one.

### …choose between two outcomes in one line

`if score >= 5 then goto 2 else show hint` works anywhere an action does (buttons, `when`, `key`, timers). The `else` part is optional. Text values go without `=`: `if score > 3 then put msg big else put msg small`.

### …use keys instead of buttons

`::: key a` followed by action lines runs them when you press **A** while presenting (on that slide only). Letters, digits, `enter`, `up` and `down` work; Space, Left, Right, PageUp, PageDown and Escape already move through the deck, and Ctrl combinations are the branch keys. A key held down counts once.

````
::: key a
add Alpha 1
:::
::: key b
add Bravo 1
:::
````

### …roll dice, pick a random item, flip a switch, start over

- `put roll = random(6)` is a number from 1 to 6; `random(3, 8)` from 3 to 8; `random()` is 0 to 1. `pick("red", "green", "blue")` picks one of its values.
  Random values can't be used directly in text or in `if:` / `when` conditions (they would change on every look): roll into a variable first, then show `{{roll}}`.
- `toggle lamp` flips a yes/no variable (`lamp` is `true` or `false`; `<!-- if: lamp -->` and `{{lamp}}` work).
- `reset score` puts one variable back to its default; `reset` alone resets all of them. Every time you start presenting, all variables and input boxes start from their defaults.

### …add branch slides (a side path you only open on purpose)

Start a slide with `<!-- branch: 1 -->` and it leaves the main line. It hangs off the main slide above it (its *mother*):

````
# Slide 30            <- the mother

---
<!-- branch: 1 -->
# 30-1  Extra detail

---
<!-- branch: 2 -->
# 30-2  A different detour

---
# Slide 31
````

While presenting: **Ctrl+→** opens branch 1, **Ctrl+Enter** branch 2, **Ctrl+Space** branch 3 of the slide you are on. The ordinary keys never go into a branch. Inside one, **→** continues to slide 31 and **←** returns to the mother (slide 30). Buttons can move you around too: `branch 2`, `proceed` (next slide of the same branch; after the last one, on to the main slide after the mother) and `back`. Slides in a row with the same branch number form one branch (30-1, 30-1.2, ...). The Slides panel shows branches indented with labels like `30-1`.

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
In Edit view, **right-click** in the Source pane. Pick a colour, highlight, typeface, size, weight, italic, underline or strikethrough, letter spacing,
line height, case (UPPERCASE, small caps…) or a shadow, then **Apply**. Select text first to style just that, or leave the cursor on a line to style the line.
Right-click inside styled text to change it. **Clear style** removes it.

### …change the fonts of the whole deck (or one slide)
**Format > Fonts for the whole deck** (or **for this slide**) and pick one each for **Body text**, **Headings** and **Code**.
Want a font that isn't listed? **Format > Add font file…** and choose a `.ttf`, `.otf`, `.woff` or `.woff2`. It is copied into `assets/fonts/` next to your deck
and shows up in every font list. Fonts installed on your computer are listed too, under **Installed fonts** in those menus and in the right-click panel's typeface list. Remember a system font only shows on computers that have it; imported font files travel with the deck.
Keep the `assets/` folder with the deck when you share it, or the fonts fall back to the system font.

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
**Step 0, once:** open **Vendor > React Bits…** (or **Magic UI…**, **Cult UI…**, **Kokonut UI…**, **Eldora UI…**, **Motion Primitives…**, **Animata…**, **Aceternity UI…**) and download the effects you want (or **Download all**). They come from React Bits' own website,
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
| A download says "paid tier" or "isn't published under that name any more" | That component isn't free (Aceternity's Blocks and Pro items) or the vendor renamed it. Nothing to fix on your side. |
| An effect from Magic UI / Cult UI / Kokonut UI / Aceternity looks wrong (white text on white, tiny) | They are made for dark slides and scale with the slide; one that depends on a light background or fixed pixel sizes can look off. Tell the slide's author or pick another. |
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
fonts: assets/fonts/Lobster.ttf
headingfont: Lobster
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

## I want a trace (the sorting bars) on a slide I can edit

Give the code block an id (```` ```python run id=sort ````), then Insert > **Trace (separate parts)**. You get the title, bars, counts, controls, code and operations as
separate pieces: drag, resize or rotate each one in the Visual view, delete the ones you don't want, and click a piece to change its colours, text size and so on in the Inspector.
Set `from=sort` (the Inspector's "Reads from" does it) so they follow your run; they show a sample until you press Run on the code block.
Already have an automatic trace slide after a run? Press **Make editable** on it and it turns into a real slide made of separate pieces. An old one-box `::: trace` can be broken up with right-click > **Split into parts**.

## I want sound effects

1. **Sound > Set sound folder...** and choose your folder (once; change it any time).
2. Use a file's name without the extension: toolbar **Sound** picks one that plays when the slide appears while presenting; a button can
   `play boom`; a trace block can have `sound="swap:pop done:chime"`.
3. No folder yet? These are built in: click, tick, pop, blip, ding, chime, success, error, whoosh, zap, boom.
4. **Don't want it to sound the same every time?** Add a pitch (or volume) with a bit of randomness: `play tick pitch=1+-0.2` (anywhere from 0.8x to 1.2x),
   `pitch=+-2st` (up or down by up to two semitones), `vol=0.8+-0.1`. It works in buttons, timers (`every 1s play tick pitch=+-2st`), a slide's `sound:` comment and
   trace blocks, where each kind of step can have its own sound: `sound="compare:tick swap:pop,pitch=1+-0.3 done:chime"`.
5. **Pitch that follows the bars** in a trace: put a sign on it. `pitch=+1` goes from normal at the shortest bar up an octave at the tallest; `pitch=-0.5` goes down an octave;
   `pitch=+0.2` is a gentle slope. Sorting then sounds like a scale.

## I want to show a live scoreboard (standings that move up)

Write the score updates, one per line, inside a `::: wrap scoreboard.Board` block. Each line is a time, a team and the points:

````
::: wrap scoreboard.Board title="Finals" keys=true
teams: Alpha, Bravo, Charlie
0:45 Alpha +3
1:30 Bravo +2
2:10 Alpha =10
:::
````

`+3` / `-1` change a score; `=10` (or just `10`) sets it. One block gives you all three versions:

- **Just the final result:** add `start=end`. The board opens on the final standings, no clicking needed.
- **A replay with animation:** leave it as is. Press **Play**, **◀ ▶** (one update at a time) or drag the slider; teams slide up and down as they overtake each other. **Sorted / Unsorted** switches between rank order and a fixed team order. Add `keys=true` so each Next key (Space, Right arrow) shows the next update while presenting, and moves to the next slide after the last one.
- **Synced with a video of the real game:** add `video=assets/game.mp4` (copy the video into the `assets` folder next to the deck yourself). The numbers follow the video's clock, so pausing and scrubbing work. If the log's `0:00` is not the start of the video, add `offset=12` (the video second where the log's clock starts).

Team names can't contain `_`, `*`, `#` or `>`. The video is streamed from disk, so long clips are fine. `example/scoreboard.itsd` shows all three.

## I want to play a video or sound on a slide

Insert > **Video…** (or **Audio…**) and choose the file. It is copied into the `assets` folder next to your deck and a block is added; drag it in the Visual view like anything else.
Add `autoplay` to the line so it starts when you reach the slide in Present, `loop` to repeat, `muted` for silent video. Give it `id=intro` and a button can `start intro` / `stop intro`.
Big files are fine: they play straight from disk.

## I want more logic in my deck (scripting)

- Several steps behind one button: put the actions in a `::: macro name` block and use `call name` (with arguments: `call bump 5`, and `$1` inside the macro).
- Do something when a key is pressed or a slide appears: `::: on key r`, `::: on enter once`, `::: on change score` (they run while presenting).
- Choices and repeats: `if score >= 5 then goto 3 else play error`, `repeat 3 add score 2`, `wait 1s`, `toggle flag`, `random roll 1 6`.
- More in calculations: `{{upper(name)}}`, `{{randint(1, 6)}}`, `{{slide}} / {{slides}}`, `{{elapsed}}` seconds.
- When that still isn't enough: a `::: script name` block of JavaScript, run with `script name`. The app asks you to allow scripts once per deck. See FORMAT.md > Scripting.

## Slides panel: right-click, branches, and tidying

Right-click any slide in the Slides panel. **Duplicate** copies it (type a number to make several). Under **Branch**, "New branch 1 slide" adds a branch slide under this slide's
main slide, already holding a **Back** button; "New branch slide + a button here" also adds a "Branch 1" button to this slide so you can reach it while presenting. Branch 1, 2 and 3 are
entered with Ctrl+Right, Ctrl+Enter and Ctrl+Space. **Move** keeps a main slide together with its branch slides. **Copy / Cut / Paste** work between slides and decks in this session.
**Format > Beautify deck** (Shift+Alt+F) tidies spacing in the file and tells you what it changed; Ctrl+Z undoes it.

## I want the trace to look like mine

- Run your code: a trace slide appears as a branch (1-1) with a Show trace button on your slide. It is a normal slide: move and restyle every part, or delete the ones you don't want.
- Don't want it created for you? File > Settings > Trace.
- Your own CSS: put `style: mytrace.css` in the deck's header, or pick one file for every deck in File > Settings > Trace stylesheet. `example/exampletrace.css` shows what you can aim at.
- Other app options (sound folder, volume, scripts) are in File > Settings too (Ctrl+,).

## Home, and where your files live

- **Home** (the first screen; File > Home or Ctrl+Shift+H) lets you start a blank deck or one from a template, reopen recent decks, and browse your folders. Esc or "Back to the deck" returns to what you were editing.
- **Your ITSD folder** is made on the first start: `Documents\ITSD` with `Decks` (your decks; Save As starts here), `Templates` (add your own `.itsd` files and they appear on Home), `Sounds` (the sound folder until you pick another) and `Styles` (`exampletrace.css`). Change it in File > Settings or on Home. In the folder browser you can rename, duplicate, delete (moved to a `.trash` folder, never erased) and make folders there.
- **The installed program** (from the MSI, normally `C:\Program Files\ITSD`) holds the app plus the read-only `example` and `templates` folders. Home > Examples opens those; Home shows where everything is. Updating or reinstalling never touches your ITSD folder.


## I want slide transitions like PowerPoint (and Morph)
Click **Transition** in the toolbar (or the **Transitions** menu). Hover a tile to see it move, click to use it. Choose **Slide N** or **Whole deck** at the top, set the side it comes from and how long
it takes. **Apply to all slides** clears per-slide choices. **Morph** makes the same object on two slides (same name, picture or text) glide to its new place, size and angle. To force a match, put the same
`<!-- @id logo -->` above it on both slides.

## I want things to fly in, pulse or disappear
Click **Animations** in the toolbar. Pick the object, choose how it starts (On click, With previous, After previous, When the slide appears), then click an effect: Entrance, Emphasis or Exit. The pane
underneath lists them in the order Next plays them; use ▲ ▼ to reorder and ✕ to remove. Press Next under the canvas to try it, or Present.
