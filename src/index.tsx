import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/reset.scss";
import "./styles/variable.scss";
import "./styles/commons.scss";
import "./styles/layout.scss";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
