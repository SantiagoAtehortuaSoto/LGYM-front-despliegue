import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

const normalizeTarget = (value) =>
  String(value || "").trim().replace(/\/+$/, "");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const proxyTarget =
    normalizeTarget(env.VITE_DEV_PROXY_TARGET) ||
    normalizeTarget(env.VITE_API_BASE_URL) ||
    "http://localhost:3000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "react-hot-toast": "/src/shared/utils/toastAdapter.jsx",
      },
    },
    build: {
      chunkSizeWarningLimit: 4000,
    },
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
