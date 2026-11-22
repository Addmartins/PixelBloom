import type { Metadata } from "next";
import Link from "next/link";
import { AvatarWardrobe } from "@/features/experience/avatar-shop/wardrobe";

export const metadata: Metadata = { title: "Demo da loja de avatares" };

export default function AvatarDemoPage() {
  return <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-8">
    <Link className="button-secondary justify-self-start" href="/login?app=kids">Voltar ao PixelBloom Kids</Link>
    <header className="grid gap-2">
      <h1 className="text-3xl font-bold">PixelBloom Kids</h1>
      <p className="text-muted">Experimente a loja com 40 pontos fictícios. A demonstração reinicia ao recarregar.</p>
    </header>
    <AvatarWardrobe />
  </main>;
}
