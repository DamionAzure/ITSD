// The slide takes the aspect ratio of the monitor it is on (not a fixed 16:9), so a deck fills the screen and what you edit
// is what you present. CSS reads --ar (the monitor) and --vp-ar (the window, used while presenting).
export let AR = 16 / 9;
export function initAspect() {
  const set = () => {
    const s = document.documentElement.style;
    if (screen.width > 0 && screen.height > 0) AR = screen.width / screen.height;
    s.setProperty("--ar", AR.toFixed(5));
    s.setProperty("--vp-ar", (innerWidth / Math.max(1, innerHeight)).toFixed(5));
  };
  set();
  addEventListener("resize", set); // also catches moving the window to another monitor in most cases
}
