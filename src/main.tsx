import "./monaco";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import { initAspect } from "./aspect";

initAspect();

createRoot(document.getElementById("root")!).render(<App />);
