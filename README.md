# ITSD — Interactive Tauri Slide Deck

Slides written as plain text, with code you can **run during the talk**. Type Markdown, add a `run` after a code fence's language,
press F5. A desktop app (Tauri 2 + React) that works offline.

- **Runnable code** in C, C++, Rust, Go, Python, Java and Node, with live output, input boxes, buttons and generated step-through trace slides.
- **Visual editor**: drag any block or picture around the slide; alignment, backgrounds, colours, text formatting and fonts (Format menu, or import your own font files).
- **Effects** from [React Bits](https://reactbits.dev), [Magic UI](https://magicui.design), [Cult UI](https://www.cult-ui.com),
  [Kokonut UI](https://kokonutui.com), [Eldora UI](https://www.eldoraui.site), [Motion Primitives](https://motion-primitives.com), [Animata](https://animata.design) and [Aceternity UI](https://ui.aceternity.com), downloaded on request from the **Vendor** menu: animated
  backgrounds (Aurora, Particles…), animated text, and frames or cards around content (electric borders, glow) that can even hold live code.
- **Looks and slideshows**: one `<!-- @look neon -->` line styles any block (16 presets, fonts, gradients, glass, shapes, filters); `::: slideshow` cycles pictures in loop, random, staggered or once modes with ten change effects. Both travel in `.itsdpak` packages and play in the Phone Player.
- **Counters and branches**: `::: var` numbers that buttons change (`add score 1`), and branch slides (`<!-- branch: 1 -->`) you open with Ctrl+→, Ctrl+Enter or Ctrl+Space while the normal arrows stay on the main line (inside a branch they step through its slides, then rejoin the main line).
- **Calculations and rules**: `{{score * 2}}`, `put total = a + b`, and `::: when score >= 10` blocks that run actions when a number crosses a line; a built-in calculator, not JavaScript.
- **Timers**: `after 2s show answer`, `every 1s sub time 1`, and `::: after` / `::: every` blocks that start with the slide, for reveals and countdowns.
- **Logic**: show-if lines (`<!-- if: score > 3 -->`), one-line `if ... then ... else ...`, `::: key a` keyboard actions, `random()` / `pick()`, `toggle` and `reset`.
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

## Updates

ITSD uses Tauri's signed updater. Releases should publish the installer artifacts,
their `.sig` signature files, and `latest.json` to a GitHub Release. The
`bundle.createUpdaterArtifacts` setting in `src-tauri/tauri.conf.json` is required
for Tauri to produce the updater artifacts. Before publishing the first release:

Installer metadata identifies **Damion Azure** as the publisher and includes
`Copyright © 2026 Damion Azure`. These values are configured in the Tauri bundle
metadata and are applied when the release workflow builds installers.

### Android presentation view

ITSD `0.5.3` also targets Android as a presentation-only mobile experience.
Android users get the dashboard and can open decks into a touch-friendly
presentation view; the desktop editing interface is hidden on mobile-sized or
touch devices. The Android app is locked to landscape orientation and uses immersive
fullscreen mode, hiding the Android status and navigation areas. Swipe left or
right, or use the on-screen controls, to change slides. Presenter View remains
optional and depends on whether the Android environment can create a second
window.

The release workflow builds and signs an ARM64 Android APK alongside the
desktop installers. Add these GitHub repository secrets before creating the
first Android release:

- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_BASE64` (the base64-encoded `.jks` file)

Create a keystore locally with Java's `keytool`, keep the `.jks` file private,
and encode it for the secret:

```powershell
keytool -genkey -v -keystore "$env:USERPROFILE\itsd-upload-keystore.jks" -keyalg RSA -keysize 2048 -validity 10000 -alias upload
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\itsd-upload-keystore.jks")) | Set-Clipboard
```

Paste the clipboard contents into `ANDROID_KEY_BASE64`. Never commit the
keystore, `keystore.properties`, or passwords. The workflow configures signing
in the generated Android project and uploads a signed APK; keep this same
keystore for every future Android update.

### Phone Player and deck bundles

The Android app opens decks in the offline Phone Player. On a computer, use
**File > Export > ITSD package (.itsdpak)** to create a bundle containing the deck and
the local pictures, sounds, videos, fonts, and styles it references. An
`.itsdpak` file is a ZIP internally. Open it in the Player; ordinary `.zip`
bundles remain supported for compatibility. Imported decks are kept in an on-device library using
IndexedDB and reopen at the last slide.

JavaScript (`js` or `node`) blocks can run locally in the Player. Other code
blocks need recorded output; leave **Settings > Record runs** enabled and save
the deck before packaging it. The Player can replay recorded runs without a
compiler.

1. Create a signing key with `npx tauri signer generate`.
2. Keep the private key outside the repository (for example, as the
   `TAURI_SIGNING_PRIVATE_KEY` GitHub Actions secret).
3. Replace the updater public-key placeholder and the `OWNER/REPOSITORY` endpoint
   in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json).
4. Add the matching `TAURI_SIGNING_PRIVATE_KEY` and optional
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets to GitHub.
5. Create a version tag such as `v0.2.0` to build and publish an update.

Installed copies check for updates when they start. Users can also use
**Help > Check for Updates…**. Updates are downloaded only after the user confirms
and the app restarts to finish installation.

The release workflow must run for `latest.json` to exist. If the current GitHub
Release was created manually, or was created before `includeUpdaterJson: true`
was added to `.github/workflows/release.yml`, it will not contain that file.
Push the workflow changes and create a new tag (for example `v0.2.1`); the
workflow signs the installers and publishes `latest.json` alongside them.
Verify that `latest.json` and matching `.sig` files appear under the GitHub
Release's **Assets** before testing the Vercel `/api/latest` endpoint. If the
release contains only installers and no `.sig` files, the signing secret was not
loaded by Actions or updater artifacts were not enabled.

The [`updates/`](updates/) folder is a separate Vercel deployment for the branded
download page and update-manifest proxy. Deploy it as its own Vercel project,
configure `GITHUB_REPOSITORY=owner/repository`, and replace the updater endpoint
placeholder in `src-tauri/tauri.conf.json` with the deployed `/api/latest` URL.
Vercel serves the manifest; GitHub Releases still stores the signed installers.

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

ITSD ships **no** effects. Open **Vendor > React Bits…** in the app: it lists everything React Bits offers (all 216 components run
inside ITSD), with search, **Download / Remove** per effect, and **Download all / Remove all**. Downloads are kept on your computer, so they work
offline afterwards. Then use them from **Insert > Effect**, the Visual view's **Modules** tab, or by typing `::: fx reactbits.Aurora`.

Other vendors work the same way (**Vendor > Magic UI…**, **Cult UI…**, **Kokonut UI…**, **Eldora UI…**, **Motion Primitives…**, **Animata…**, **Aceternity UI…**) and their effects are written
`::: fx magicui.marquee`. What each one allows:

| Vendor | Licence | What you can get here |
|---|---|---|
| React Bits | MIT + Commons Clause | all 216 components |
| Magic UI | MIT | the free components (about 68 of 78 run in ITSD) |
| Cult UI | MIT | its `ui` components (about 70 run) |
| Kokonut UI | MIT | all 51 that run |
| Eldora UI | MIT | its `ui` components (28 run) |
| Motion Primitives | MIT (`LICENCE.md` in its repo) | all 33 |
| Animata | MIT | read as source files from its GitHub repository (it publishes no registry); 116 of the 145 single-file components install |
| Aceternity UI | Aceternity License (free components) | a hand-picked set of free components. **Its Blocks are paid (Aceternity UI Pro) and aren't available here.** |

Magic UI, Cult UI, Kokonut UI and Aceternity publish "shadcn registry" items styled with Tailwind. ITSD has no Tailwind, so when you download
one, Tailwind's own compiler (loaded only then) builds the stylesheet it needs and stores it with the component. A component that needs a
library ITSD doesn't include, a surrounding provider, or data a deck can't write (a list of logos, a callback) is listed as "can't run here" or
refused with the reason. Tailwind's output needs a modern web view (Chrome/Edge 111+, Safari 16.4+).

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

- **Scoreboard**: standings from a log of score updates, as a static board, an animated replay, or synced to a video of the real game (`::: wrap scoreboard.Board`, see the manual).

## Tidying the file, and the Slides panel menu

- **Format > Beautify deck** (Shift+Alt+F in the Source pane), and **Beautify this slide**, tidy the `.itsd` file itself (not the code inside code blocks):
  trailing spaces, runs of blank lines, frontmatter spacing, `---` separators, `::: kind attributes` lines, one-line `<!-- key: value -->` options and `#   Heading` spacing.
  It never reflows or reorders what you wrote, never puts a blank line between a placement marker and its block, and copies fenced code and `::: script` bodies exactly.
  Every result is checked by parsing the deck again; if it would differ in any way that matters, nothing is changed. One Ctrl+Z undoes it.
- **Right-click a slide in the Slides panel**: show in editor, duplicate (or duplicate N times, or with its branch slides), new slide after / before / from a template, **Branch**
  (new branch 1-3 slide with a Back button, optionally with a "Branch N" button on this slide; copy this slide as a branch; turn a slide into a branch or back), move (a main slide travels
  with its branches; a branch slide stays inside its own branch), slide settings, copy / cut / paste slides, rename, tidy this slide, delete (with or without its branch slides).
  Right-click the empty part of the panel for new slide at the end, paste, and beautify the deck.
- **Format menu**: Transition, Reveal and Align can each be set for the whole deck or for this slide, plus fonts and moving the slide.
- **Format text panel** (right-click text in the Source pane) also has superscript/subscript, text outline, opacity, word spacing, underline style and colour, gradient text, and a rounded box.

## Installing (Windows MSI) and folders

`npm run bundle:msi` builds the MSI (WiX, on Windows). It installs the app, `example\` and `templates\` under Program Files. On first start the app creates your own folder, `Documents\ITSD` (Decks, Templates, Sounds, Styles), copies the templates and `exampletrace.css` into it without overwriting anything, and shows the Home dashboard. Details: MANUAL.md, "Home, and where your files live".
