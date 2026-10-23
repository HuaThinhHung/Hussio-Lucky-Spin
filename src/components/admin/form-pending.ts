"use client";

import { createContext } from "react";

/**
 * Pending state for forms submitted via `onSubmit` + `startTransition`
 * (used instead of `<form action>` so React doesn't wipe the inputs when the
 * server returns a validation error). SubmitButton reads it.
 */
export const FormPendingContext = createContext(false);
