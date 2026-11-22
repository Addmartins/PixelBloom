import Image from "next/image";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-5 py-12 sm:px-10 md:grid-cols-2 md:gap-20">
      <section aria-label="PixelBloom" className="grid gap-5 md:gap-8">
        <div className="flex items-center gap-3 text-lg font-bold">
          <Image src="/pixelbloom-192.png" alt="" width={42} height={42} className="rounded-lg" />
          PixelBloom
        </div>
        <p className="max-w-sm text-3xl font-semibold leading-tight tracking-tight md:text-5xl">Clínica e família no mesmo lugar</p>
        <p className="max-w-xs text-muted">Acesse a agenda da clínica e as ferramentas do seu perfil.</p>
      </section>
      <section className="panel w-full max-w-md justify-self-center shadow-[var(--shadow)]">{children}</section>
    </main>
  );
}
