// A live scoreboard as an itsd module. The app finds this folder by itself (see registry.ts); delete the folder and the feature is gone.
//
//   ::: wrap scoreboard.Board title="Finals" keys=true
//   teams: Alpha, Bravo, Charlie
//   0:45 Alpha +3
//   1:30 Bravo +2
//   :::
//
// Look: look= picks a preset (classic, minimal, broadcast, neon, retro, glass, paper); accent= bg= rowbg= text= border= bar= gain= colors=, bars= rank= hot= leader= font= case= shadow=,
// size= rowh= gap= radius= pad= width= bw= top= anim=, prefix= suffix=, and head= clock= delta= step= controls= turn parts on or off. See FORMAT.md.
// With  video=assets/game.mp4 offset=12  the board follows the video's clock instead (offset = the video second that is 0:00 in the log).
import type { ItsdModule } from "../types";

const mod: ItsdModule = {
  id: "scoreboard",
  name: "Scoreboard",
  hint: "Write one score update per line inside the block: time, team, points (0:45 Alpha +3).",
  effects: [{
    id: "Board", label: "Scoreboard", kind: "wrap", plain: true,
    starter: { attrs: { title: "Finals" }, body: "teams: Alpha, Bravo, Charlie\n0:10 Alpha +3\n0:20 Bravo +5\n0:30 Charlie +4\n0:40 Alpha +4\n0:50 Bravo +2" },
    props: [
      { key: "title", type: "string" },
      { key: "src", type: "string" },
      { key: "video", type: "string" },
      { key: "offset", type: "number", def: 0 },
      { key: "speed", type: "number", def: 1 },
      { key: "start", type: "select", def: "begin", options: ["begin", "end"] },
      { key: "sorted", type: "boolean", def: true },
      { key: "autoplay", type: "boolean", def: false },
      { key: "keys", type: "boolean", def: false },
      { key: "live", type: "boolean", def: false },
      // ---- look: a preset first, then anything below overrides it ----
      { key: "look", type: "select", def: "classic", options: ["classic", "minimal", "broadcast", "neon", "retro", "glass", "paper"] },
      { key: "accent", type: "color" },
      { key: "bg", type: "color" },
      { key: "rowbg", type: "color" },
      { key: "text", type: "color" },
      { key: "border", type: "color" },
      { key: "bar", type: "color" },
      { key: "gain", type: "color" },
      { key: "colors", type: "colors" },
      { key: "teamcolor", type: "select", def: "bar", options: ["bar", "rank", "name", "edge", "all", "off"] },
      { key: "bars", type: "select", def: "fill", options: ["fill", "thin", "gradient", "none"] },
      { key: "rank", type: "select", def: "circle", options: ["circle", "square", "plain", "none"] },
      { key: "hot", type: "select", def: "border", options: ["border", "glow", "flash", "none"] },
      { key: "leader", type: "select", def: "badge", options: ["badge", "crown", "off"] },
      { key: "font", type: "select", def: "default", options: ["default", "sans", "serif", "mono", "rounded", "condensed"] },
      { key: "case", type: "select", def: "normal", options: ["normal", "upper"] },
      { key: "titlealign", type: "select", def: "left", options: ["left", "center", "right"] },
      { key: "shadow", type: "select", def: "none", options: ["none", "soft", "hard"] },
      { key: "size", type: "number", def: 1 },
      { key: "rowh", type: "number", def: 1 },
      { key: "gap", type: "number", def: 1 },
      { key: "radius", type: "number", def: 1 },
      { key: "pad", type: "number", def: 1 },
      { key: "width", type: "number", def: 100 },
      { key: "bw", type: "number", def: 1 },
      { key: "top", type: "number", def: 0 },
      { key: "anim", type: "number", def: 1 },
      { key: "prefix", type: "string" },
      { key: "suffix", type: "string" },
      { key: "head", type: "boolean", def: true },
      { key: "clock", type: "boolean", def: true },
      { key: "delta", type: "boolean", def: true },
      { key: "step", type: "boolean", def: true },
      { key: "controls", type: "select", def: "full", options: ["full", "min", "none"] },
    ],
    load: () => import("./Board"),
  }],
};
export default mod;
