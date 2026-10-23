## Next

### Added
- **Run limit is now 60 seconds**, so the first .NET build fits.
- **C# and Odin run blocks.** ```` ```csharp run ```` (also `cs`; needs the .NET 10+ SDK, runs the file with `dotnet run`) and ```` ```odin run ```` (needs `odin` on the PATH). C# gets the same `Trace.State(...)` / `Trace.Step(...)` helper as Java, so a C# run can drive trace slides and trace parts.
- **More run languages.** `typescript` (Deno), `zig`, `nim`, `kotlin`, `swift`, `dart`, `ruby`, `lua`, `php`, `perl`, `r`, `julia`, `elixir`, `haskell`, `ocaml`, `bash`, `powershell` and `sql` (SQLite) now run, next to the existing C, C++, Rust, Go, Python, Java and Node. Short fence names (`py`, `ts`, `rs`, `c++`, `cs`, `rb`, `sh`, ...) work, and the Source pane colours them. Lint no longer warns about them.
- **Settings > Languages (manual language finding).** Every language with a found / missing dot and version. **Find** searches PATH and the usual install folders, **Find all missing** does it for every missing one, **Browse…** or a pasted path points at a program (or the folder holding it) by hand, **Test** checks it, **Clear** goes back to PATH. Paths are kept in Settings and used by every run; no restart needed.
- C and C++ also try `gcc` / `g++` / `clang` / `clang++` when `cc` / `c++` are missing, and Python tries `python3` then `python` (`python` then `py` on Windows).
- Every run has 60 seconds.
- The status bar lists only the languages that work, with one "+N missing" chip.
- **Open `.itsdpak` and `.zip` packages on the desktop.** File > Open (and the Home screen, and double-clicking an `.itsdpak`) unpacks the package into a folder beside it, named like the package, and opens the deck inside. Files already in that folder are kept, never overwritten, so your edits survive reopening the package.
- **Table element** (`::: table`, Insert > Table): rows written as `Name | Score`, seven looks (plain, zebra, grid, lines, bold, card, neon), optional `sort=` / `dir=`, row numbers, highlighted rows, alignment and a caption. Rows, looks and colours are editable in the Visual Inspector.
- **Trace table** (`::: trace-table`, Insert > Trace table): the same table inside the trace. Every row keeps its identity from step to step, so swaps make rows slide past each other and the table sorts itself as the run plays. Choose columns (`index value bar state was`), headings, colours and speed.
- Lint checks for tables (missing closing `:::`, unknown look, bad `sort`, uneven rows).

### Added
- **Looks on almost every element.** One `<!-- @look neon round=2 -->` line above a block styles it. Works on text, code blocks, buttons, input boxes, pictures, video and audio, slideshows, effects and trace parts.
- **16 look presets:** card, glass, neon, outline, paper, terminal, soft, ghost, pill, gradient, frame, polaroid, label, headline, circle, mono. Any key written after the preset overrides it.
- **New style options:** fonts, text size, text and box gradients, text outline and shadow, glow, frosted-glass blur, shapes (circle, ellipse, diamond, hex, triangle), picture fit, grayscale / sepia / brightness / contrast / saturation / hue / soften, hover lift / grow / glow, and a CSS class hook.
- **Look panel in the Visual Inspector** for every block and picture, plus right-click > Look and Insert > Look in the Edit view.
- **Slideshow element** (`::: slideshow`, Insert > Slideshow…): cycles through pictures in *loop*, *random*, *staggered* (several frames changing one after another) or *once* mode.
- **Ten slideshow change effects:** fade, slide, slide up, zoom, blur, flip, wipe, iris, none, or random per change. Timing, fit, frame count, columns and gap are editable in the Inspector.
- **Slideshow controls:** optional slow zoom (`pan`), shuffle, and `start` / `stop` from a button.
- **Wiki:** 17 new entries in new "Looks" and "Slideshows" categories.

### Mobile, `.itsdpak` and `.zip`
- Looks and slideshows play in the Phone Player. Slideshow pictures are included in `.itsdpak` and `.zip` packages.
- `itsd.json` in a package now lists the features a deck uses, for example `"features": ["look", "slideshow"]`.
- Older versions ignore a look line and show a slideshow line as text, so update the Player first.

### Fixed
- **Phone Player showed a blank screen** for every deck: the Player was rendered outside the deck context, so slides crashed on load.

### Polish
- Slideshow pictures preload, so a change never shows an empty frame.
- Reduced-motion settings are respected (short fade only).
- Trace parts gain the new look options; a trace part's `size` still means its own text multiplier.

### Docs
- `FORMAT.md`, `MANUAL.md`, `README.md` and `Session.md` updated.

### Not yet verified on a real device
- Android build, `.itsdpak` round trip on a phone, and the updater. Tested headless in a browser only.
