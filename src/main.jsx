import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./shared/styles/restructured/index.css";
import "react-toastify/dist/ReactToastify.css";
import { CarritoProvider } from "./shared/components/Carrito/carritoContext";
import { installFetchErrorTracker } from "./shared/utils/fetchErrorTracker";
import {
  ensureAuthFreshness,
  normalizeStoredToken,
} from "./features/dashboard/hooks/Acceder_API/authService";

normalizeStoredToken();
ensureAuthFreshness();
installFetchErrorTracker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
      <CarritoProvider>
        <App />
      </CarritoProvider>
  </React.StrictMode>
);
