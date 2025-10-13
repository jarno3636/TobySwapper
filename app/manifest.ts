// app/manifest.ts
import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Toby Swapper",
    short_name: "TobySwap",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    icons: [
      { src: "/icons/toby-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/toby-512.png", sizes: "512x512", type: "image/png" }
    ],
  };
}
