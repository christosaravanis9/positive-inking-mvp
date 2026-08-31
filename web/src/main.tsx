import React from "react";
import ReactDOM from "react-dom/client";
import { installGlobalErrorHandlers } from "./globalErrors";
import App from "./App";
import "./styles.css";

installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
