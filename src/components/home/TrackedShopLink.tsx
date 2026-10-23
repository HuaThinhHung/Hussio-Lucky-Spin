"use client";

import type { ReactNode } from "react";
import { sendClientEvent } from "@/components/spin/api";

type TrackedShopLinkProps = {
  href: string;
  placement: string;
  className?: string;
  children: ReactNode;
};

/** Link back to hussio.com that records a `shop_now_clicked` event. */
export default function TrackedShopLink({ href, placement, className, children }: TrackedShopLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={className}
      onClick={() => sendClientEvent("shop_now_clicked", placement)}
    >
      {children}
    </a>
  );
}
