import React from "react";
import ReactDOM from "react-dom/client";
import LoginPage from "./LoginPage";
import "./login.css";

const theme =
  window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
document.documentElement.dataset.theme = theme;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LoginPage />
  </React.StrictMode>,
);
