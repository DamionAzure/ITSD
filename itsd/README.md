# ITSD — Interactive Tauri Slide Deck

Slides written as plain text, with code you can **run during the talk**. Type Markdown, add a `run` after a code fence's language,
press F5. A desktop app (Tauri 2 + React) that works offline.

- **Runnable code** in C, C++, Rust, Go, Python, Java and Node, with live output, input boxes, buttons and generated step-through trace slides.
- **Visual editor**: drag any block or picture around the slide; alignment, backgrounds, colours and fonts from right-click menus.
- **Effects** from [React Bits](https://reactbits.dev), downloaded on request from the **Vendor** menu: animated backgrounds (Aurora, Particles…),
  animated text, and frames or cards around content (electric borders, glow) that can even hold live code.
- **Plain files**: a deck is one `.itsd` text file (Markdown + a little syntax). Diff it, grep it, put it in git.

> **New here? Read [`MANUAL.md`](MANUAL.md)** (it is also in the app under **Help > Manual**). The exact syntax of every option is in [`FORMAT.md`](FORMAT.md).

## Quick start

You need [Node.js](https://nodejs.org) 18+, [Rust](https://rustup.rs), and Tauri's system packages for your OS
(see <https://tauri.app/start/prerequisites/>; on Linux that includes WebKitGTK).

```sh
npm install
npm run tauri dev      # run the app
npm run tauri build    # make an installer
```

To run code you also need the language's tools on your PATH: `python`, `java` (11+), `node`, `go`, `rustc`, or a C/C++ compiler (`cc`, `c++`).
Only the languages you actually use need to be installed.

## A deck in ten seconds

````
---
title: Hello
---
# Sorting, live

```python run
print(sorted([34, 2, 53]))
```

---
::: fx reactbits.Aurora
# This slide has an aurora behind it
````

Open `example/demo.itsd` for a tour: runnable code, input boxes, buttons, traces, alignment, flash regions and effects.

## Keys

| | |
| --- | --- |
| Ctrl+N / O / S | New / Open / Save (Shift for Save As) |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+B | Slides panel |
| F5 / Shift+F5 | Present from here / from the start |
| Right, Space / Left | Next / Back while presenting; Esc leaves |
| F11 | Full screen |
| F1 | Manual |

## Effects

ITSD ships **no** effects. Open **Vendor > React Bits…** in the app: it lists everything React Bits offers (about 170 of its 216 components can run
inside ITSD), with search, **Download / Remove** per effect, and **Download all / Remove all**. Downloads are kept on your computer, so they work
offline afterwards. Then use them from **Insert > Effect**, the Visual view's **Modules** tab, or by typing `::: fx reactbits.Aurora`.

Why a menu and not a bundle: React Bits is MIT + Commons Clause. You may use the components in your own work, but not redistribute them
"alone, in a bundle, or as a ported version", so the repository and the app don't contain them. (Not legal advice: read their
[license](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md).) A deck that uses an effect you haven't downloaded still opens; the effect is
skipped and the line gets a warning.

Developers can instead build the components into their own copy (needs internet, not committed to git):

```sh
npm run module:reactbits -- add Aurora BlurText    # some
npm run module:reactbits -- add '*'                # all of them (quote the *)
npm run module:reactbits -- remove '*'
npm run module:reactbits -- list
```

Modules are folders in `src/modules/<id>/` that the app finds by itself. Fast flashing or motion can be a problem for some viewers, so check
effects before a big audience.

## Project layout

```
src/                 the React app (App, Visual, SlideView, SourceEditor, …)
src/itsd.ts          deck parser          src/format.ts   text-format and alignment edits
src/layout.ts        block placement      src/modules/    effect modules (+ reactbits/)
src/vendor/          the Vendor menu: downloads effects from their source
src-tauri/src/lib.rs run-code backend: toolchain probes, compile/run, file access
example/demo.itsd    a tour deck          FORMAT.md       full file-format reference
```

Add a language: add one line to `LANGS` in `src-tauri/src/lib.rs`.
Build offline: `npm run vendor` copies the Rust dependencies into `src-tauri/vendor` (run it once while online).

## Notes

- Run output and edits made while presenting are never written to the file.
- Images are copied into an `assets/` folder next to the deck. Keep that folder with the `.itsd` file.
- Slides take the shape of your monitor and never scroll: flowing content shrinks to fit.
