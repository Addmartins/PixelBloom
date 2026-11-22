"use client";

import { useActionState, type ReactNode } from "react";
import type { Result } from "./actions";

export function ActionForm({ action, label, children, secondary }: {
  action: (state: Result | null, form: FormData) => Promise<Result>;
  label: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  const [result, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="grid gap-3">
      {children}
      <button className={secondary ? "button-secondary justify-self-start" : "button justify-self-start"} disabled={pending}>
        {pending ? "Aguarde…" : label}
      </button>
      {result && <p role={result.ok ? "status" : "alert"}>{result.message}</p>}
      {result?.token && <code className="select-all break-all rounded-lg bg-background p-3">{result.token}</code>}
    </form>
  );
}
