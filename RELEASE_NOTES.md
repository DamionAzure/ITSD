## ITSD 0.5.3

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
