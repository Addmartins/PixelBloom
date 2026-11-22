import Link from "next/link";
import { AuthForm } from "@/features/auth/form";
import { parseLoginPortal } from "@/features/auth/login-access";

export default async function Login({ searchParams }: { searchParams: Promise<{ link?: string; app?: string; acesso?: string }> }) {
  const query = await searchParams;
  const access = query.app === "kids" ? "kids" : parseLoginPortal(query.acesso) ?? "corporativo";
  return <>
    <nav aria-label="Demonstração sem login" className="mb-6 grid gap-3 border-b border-border pb-6">
      <p className="font-semibold">Demonstração sem login</p>
      {access === "kids"
        ? <Link href="/demo/avatares" className="button text-center">Experimentar a loja de avatares</Link>
        : <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/demo/corporativo" className="button text-center">Acesso corporativo</Link>
        <Link href="/demo/familia" className="button text-center">Pacientes e responsáveis</Link>
      </div>}
    </nav>
    <AuthForm key={access} mode="login" invalidLink={query.link === "invalid"} access={access} />
  </>;
}
