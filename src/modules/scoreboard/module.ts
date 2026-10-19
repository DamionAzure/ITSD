// A live scoreboard as an itsd module. The app finds this folder by itself (see registry.ts); delete the folder and the feature is gone.
//
//   ::: wrap scoreboard.Board title="Finals" keys=true
//   teams: Alpha, Bravo, Charlie
//   0:45 Alpha +3
//   1:30 Bravo +2
//   :::
//
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
    ],
    load: () => import("./Board"),
  }],
};
export default mod;
