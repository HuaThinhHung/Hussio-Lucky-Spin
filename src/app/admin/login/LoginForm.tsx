"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/_actions/auth";

const inputClass =
  "mt-1 h-11 w-full rounded-xl border border-ivory/20 bg-navy-dark/70 px-3 text-ivory placeholder:text-ivory/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="text-xs font-semibold tracking-wider text-ivory/75">
          EMAIL
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="text-xs font-semibold tracking-wider text-ivory/75">
          MẬT KHẨU
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-gold-light">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="h-11 w-full rounded-full bg-gold text-sm font-semibold tracking-[0.2em] text-navy-dark transition hover:bg-gold-light disabled:opacity-60"
      >
        {isPending ? "ĐANG ĐĂNG NHẬP…" : "ĐĂNG NHẬP"}
      </button>
    </form>
  );
}
