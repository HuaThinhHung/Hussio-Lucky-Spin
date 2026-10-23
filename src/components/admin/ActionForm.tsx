"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { FormPendingContext } from "@/components/admin/form-pending";
import type { FormAction } from "@/lib/action-result";
import { cn } from "@/lib/cn";

type ActionFormProps = {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Asks for confirmation before submitting (destructive actions). */
  confirmMessage?: string;
  /** Hide the inline success message (e.g. row actions that re-render the row). */
  quietSuccess?: boolean;
  /** Clear the inputs after a successful submit ("add new" forms). */
  resetOnSuccess?: boolean;
};

/**
 * Server action + pending state + inline result message. Submits through
 * startTransition so inputs are kept when the server rejects the data.
 */
export default function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  quietSuccess,
  resetOnSuccess,
}: ActionFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const showMessage = state && (!state.ok || !quietSuccess);

  return (
    <FormPendingContext.Provider value={isPending}>
      <form ref={formRef} onSubmit={handleSubmit} className={className} aria-busy={isPending}>
        {children}
        {showMessage ? (
          <p
            role={state.ok ? "status" : "alert"}
            className={cn("mt-2 text-xs font-medium", state.ok ? "text-emerald-700" : "text-red-700")}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </FormPendingContext.Provider>
  );
}
