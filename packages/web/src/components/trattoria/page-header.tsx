import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  sub,
  actions,
}: {
  kicker: string;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex justify-between items-end mb-7 pb-5 dashed-ink">
      <div>
        <div className="kicker mb-2">{kicker}</div>
        <h1
          className="m-0 text-[42px] leading-none font-black text-ink"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        {sub ? (
          <p className="mt-2.5 mb-0 text-[15px] text-ink-soft max-w-[680px]">
            {sub}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
