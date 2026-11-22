'use client'

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from 'react'

export type FormState = { error?: string; success?: string }
export type Operation = (state: FormState, form: FormData) => Promise<FormState>

export function OperationForm({ action, children, label, compact = false }: {
  action: Operation
  children?: ReactNode
  label: string
  compact?: boolean
}) {
  const [state, submit, pending] = useActionState(action, {})
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) form.current?.reset()
  }, [state])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const values = new FormData(event.currentTarget)
    startTransition(() => submit(values))
  }

  return (
    <form action={submit} onSubmit={handleSubmit} ref={form} className={compact ? 'clinic-inline-form' : 'clinic-form'}>
      {children}
      <button className={compact ? 'button-secondary' : 'button'} type="submit" disabled={pending}>
        {pending ? 'Salvando…' : label}
      </button>
      {state.error && <p role="alert" className="clinic-form-error">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  )
}
