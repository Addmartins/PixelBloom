"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { login, recover, register, resetPassword, type AuthResult } from "./actions";
import type { LoginAccess } from "./login-access";
import { loginSchema, recoverySchema, registrationSchema, resetSchema } from "./schema";

const modes = {
  login: { title: "Entrar no PixelBloom", button: "Entrar", schema: loginSchema, action: login },
  register: { title: "Crie sua conta", button: "Criar conta", schema: registrationSchema, action: register },
  recovery: { title: "Recuperar senha", button: "Enviar link", schema: recoverySchema, action: recover },
  reset: { title: "Definir nova senha", button: "Salvar senha", schema: resetSchema, action: resetPassword },
};

const fieldKeys = ["displayName", "email", "password"] as const;
const labels = { displayName: "Nome", email: "E-mail", password: "Senha" };

export function AuthForm({ mode, invalidLink, access = "corporativo" }: { mode: keyof typeof modes; invalidLink?: boolean; access?: LoginAccess }) {
  const active = modes[mode];
  const [result, setResult] = useState<AuthResult>();
  const { register: registerField, handleSubmit, formState } = useForm({
    resolver: zodResolver(active.schema),
  });
  const fields = fieldKeys.filter((key) => key in active.schema.shape);

  const title = mode === "login" && access === "kids" ? "Entrar no PixelBloom Kids"
    : mode === "login" && access === "familia" ? "Entrar na área da família" : active.title;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {mode === "login" && access !== "kids" && <nav aria-label="Tipos de conta" className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/login?acesso=corporativo" aria-current={access === "corporativo" ? "page" : undefined}
          className={access === "corporativo" ? "button px-3 text-center" : "button-secondary px-3 text-center"}>
          Conta corporativa
        </Link>
        <Link href="/login?acesso=familia" aria-current={access === "familia" ? "page" : undefined}
          className={access === "familia" ? "button px-3 text-center" : "button-secondary px-3 text-center"}>
          Conta de paciente ou responsável
        </Link>
      </nav>}
      {invalidLink && <p role="alert" className="mt-4 text-muted">O link expirou ou é inválido.</p>}
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit(async (values) => {
        setResult(undefined);
        setResult(await (mode === "login" ? login(values, access) : active.action(values)));
      })} noValidate>
        {fields.map((key) => {
          const error = formState.errors[key as keyof typeof formState.errors]?.message;
          const autoComplete = key === "password" ? (mode === "login" ? "current-password" : "new-password") : key === "email" ? "email" : "name";
          return (
            <div key={key}>
              <label htmlFor={key} className="mb-1 block font-medium">{labels[key]}</label>
              <input id={key} type={key === "displayName" ? "text" : key} className="field"
                autoComplete={autoComplete} aria-invalid={!!error}
                aria-describedby={error ? `${key}-error` : undefined}
                {...registerField(key as Parameters<typeof registerField>[0])} />
              {error && <p id={`${key}-error`} className="mt-1 text-sm text-muted">{String(error)}</p>}
            </div>
          );
        })}
        {result && <p role={result.kind === "error" ? "alert" : "status"}>{result.message}</p>}
        <button className="button" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Aguarde…" : active.button}</button>
      </form>
      <nav aria-label="Opções da conta" className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-primary">
        {mode !== "login" && <Link href="/login">Entrar</Link>}
        {mode === "login" && <Link href="/register">Criar conta</Link>}
        {mode === "login" && <Link href="/forgot-password">Esqueci minha senha</Link>}
      </nav>
    </>
  );
}
