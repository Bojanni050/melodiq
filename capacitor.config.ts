import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "nl.melodiq.app",
  appName: "MelodIQ",
  // No webDir needed — we point straight at the live server
  server: {
    url: "https://melodiq.nl",
    cleartext: false,
  },
  android: {
    // Allow the WebView to keep running audio when the screen is off
    backgroundColor: "#161621",
  },
};

export default config;
