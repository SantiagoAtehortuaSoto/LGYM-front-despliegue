import { getEnv } from "./appEnv";

// Environment configuration
const baseUrl =
  getEnv("VITE_API_BASE_URL") ||
  String(getEnv("VITE_API_URL", ""))
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

const config = {
  api: {
    url: `${baseUrl || "http://localhost:3000"}/api`,
    // Add other API-related environment variables here
  },
  // Add other environment variables here
};

export default config;
