import "./style.css";
import { createRoot } from "react-dom/client";
import { initAspect } from "./aspect";

initAspect();

const root = createRoot(document.getElementById("root")!);
if (new URLSearchParams(location.search).has("presenter")) {
  document.title = "ITSD Presenter View";
  void import("./Presenter").then(({ PresenterWindow }) => root.render(<PresenterWindow />));
} else {
  void Promise.all([import("./monaco"), import("./App")]).then(([, { default: App }]) => root.render(<App />));
}
