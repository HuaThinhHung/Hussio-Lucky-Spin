/** Result returned by admin server actions to `useActionState`. */
export type ActionResult = {
  ok: boolean;
  message: string;
  /** Optional payload for forms that display what was created (e.g. a lucky code). */
  data?: Record<string, string | number | null>;
} | null;

export type FormAction = (state: ActionResult, formData: FormData) => Promise<ActionResult>;
