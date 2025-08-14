import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service worker registration disabled temporarily
// TODO: Re-enable after fixing blank page issue

createRoot(document.getElementById("root")!).render(<App />);
