"use client";

import { useContext, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { FormPendingContext } from "@/components/admin/form-pending";
import { cn } from "@/lib/cn";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "md" | "sm";
  className?: string;
  name?: string;
  value?: string;
};

const VARIANTS = {
  primary: "bg-navy text-ivory hover:bg-navy-soft",
  secondary: "border border-navy/25 bg-white text-navy hover:border-navy",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  ghost: "text-navy underline-offset-4 hover:underline",
} as const;

export default function SubmitButton({
  children,
  pendingLabel = "Đang xử lý…",
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: SubmitButtonProps) {
  const { pending: actionPending } = useFormStatus();
  const transitionPending = useContext(FormPendingContext);
  const pending = actionPending || transitionPending;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold tracking-wide transition disabled:cursor-wait disabled:opacity-60",
        size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-xs",
        VARIANTS[variant],
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
