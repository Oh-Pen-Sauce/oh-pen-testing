import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "dark" | "basil";

const VARIANT: Record<Variant, string> = {
  primary: "bg-sauce text-cream shadow-ink",
  ghost: "bg-cream text-ink",
  dark: "bg-ink text-cream",
  basil: "bg-basil text-cream shadow-ink",
};

const BASE =
  "inline-flex items-center gap-2 px-[18px] py-[10px] text-[13px] font-semibold rounded-lg border-2 border-ink cursor-pointer transition-transform hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
}

export function Btn({
  variant = "primary",
  icon,
  children,
  className = "",
  ...rest
}: BtnProps) {
  return (
    <button {...rest} className={`${BASE} ${VARIANT[variant]} ${className}`}>
      {icon ? <span aria-hidden>{icon}</span> : null}
      {children}
    </button>
  );
}

export function BtnLink({
  href,
  variant = "primary",
  icon,
  children,
  className = "",
}: {
  href: string;
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT[variant]} ${className}`}>
      {icon ? <span aria-hidden>{icon}</span> : null}
      {children}
    </Link>
  );
}
