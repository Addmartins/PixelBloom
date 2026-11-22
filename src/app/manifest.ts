import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PixelBloom",
    short_name: "PixelBloom",
    description: "Gestão operacional para clínicas multidisciplinares.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3fc",
    theme_color: "#693db5",
    icons: [
      { src: "/pixelbloom-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pixelbloom-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
