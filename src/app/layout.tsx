import type { Metadata } from "next";
import { PwaRegistration } from "./pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PixelBloom", template: "%s | PixelBloom" },
  description: "Gestão operacional para clínicas multidisciplinares.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}<PwaRegistration /></body></html>;
}
