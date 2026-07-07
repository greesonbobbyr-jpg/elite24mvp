import type { MetadataRoute } from "next";

// Web app manifest — lets the app be installed to the home screen (PWA). The icon
// is the Elite24 basketball mark (public/logo.png, 500x500; declared at 192/512
// so browsers accept it as installable). Black theme per the brand.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elite24MVP",
    short_name: "Elite24",
    description: "Most Valuable Process — your daily basketball development.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/logo.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
