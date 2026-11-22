import type { Metadata } from "next";
import Link from "next/link";
import { Flower2 } from "lucide-react";
import { logoutFromKids } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Kids", manifest: "/kids/manifest.webmanifest" };

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-6 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-white px-5 py-4">
      <Link href="/kids" className="flex items-center gap-2 text-xl font-bold text-primary">
        <Flower2 aria-hidden="true" size={28} /> PixelBloom Kids
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard" className="button-secondary">Voltar à clínica</Link>
        <form action={logoutFromKids}><button className="button-secondary">Sair</button></form>
      </div>
    </header>
    {children}
  </main>;
}
