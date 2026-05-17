import { PageHeader } from "@/components/trattoria/page-header";
import { BtnLink } from "@/components/trattoria/button";

function Code({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: "#0f0b08",
        border: "2px solid var(--ink)",
        borderRadius: 10,
        padding: "12px 16px",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        color: "#e6d9bf",
        overflowX: "auto",
        margin: "8px 0 0",
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

function Card({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{
        background: "var(--cream)",
        border: "2px solid var(--ink)",
        boxShadow: "3px 3px 0 var(--ink)",
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="text-[13px] font-black text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </div>
        {tag && (
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.1em] uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              background: "var(--parmesan)",
              color: "var(--sauce-dark)",
              border: "1px solid var(--ink)",
            }}
          >
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-4 py-3 mb-6 text-[13.5px] leading-relaxed"
      style={{
        background: "var(--parmesan)",
        border: "2px solid var(--ink)",
        color: "var(--ink-soft)",
      }}
    >
      {children}
    </div>
  );
}

export default function InstallPage() {
  return (
    <div>
      <PageHeader
        kicker="La Guida · 01"
        title="Install"
        sub="Get the CLI on your machine. Node.js 22+ is the only prerequisite."
        actions={
          <BtnLink href="/docs/setup" variant="primary">
            Next: Setup →
          </BtnLink>
        }
      />

      <Note>
        <strong>Prerequisite:</strong> Node.js 22 or later.{" "}
        Install it from{" "}
        <a
          href="https://nodejs.org"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--sauce)", fontWeight: 700 }}
        >
          nodejs.org
        </a>{" "}
        or run{" "}
        <code
          style={{ fontFamily: "var(--font-mono)", background: "var(--cream)", padding: "1px 5px", borderRadius: 4 }}
        >
          brew install node@22
        </code>
        . That&rsquo;s it — no Docker, no Python, no system deps.
      </Note>

      <div className="grid gap-4">
        <Card title="Global install" tag="recommended">
          <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
            Installs the <code style={{ fontFamily: "var(--font-mono)" }}>opt</code> and{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>oh-pen-testing</code> commands globally so you
            can run them from any project.
          </p>
          <Code>npm install -g @oh-pen-testing/cli</Code>
          <p className="text-[13px] text-ink-soft mt-3">Verify the install:</p>
          <Code>opt --version</Code>
        </Card>

        <Card title="Try without installing (npx)">
          <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
            Downloads on first run, caches for subsequent runs. Good for a quick
            trial — switch to the global install once you use it regularly.
          </p>
          <Code>{`cd /path/to/your/project\nnpx @oh-pen-testing/cli@latest setup`}</Code>
          <p className="text-[13px] text-ink-soft mt-3">
            Note: the web wizard will show an install hint if{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>opt</code> is not on your PATH.
          </p>
        </Card>

        <Card title="From source (contributors)">
          <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
            Clone the monorepo, build everything, and link the CLI globally.
            Requires{" "}
            <a
              href="https://pnpm.io"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--sauce)" }}
            >
              pnpm
            </a>{" "}
            10+.
          </p>
          <Code>{`git clone https://github.com/Oh-Pen-Sauce/oh-pen-testing.git
cd oh-pen-testing
pnpm install
pnpm turbo run build
cd packages/cli && npm link`}</Code>
          <p className="text-[13px] text-ink-soft mt-3">
            The{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>opt</code> binary is now linked from your global
            node_modules.
          </p>
        </Card>
      </div>

      <div className="flex justify-end mt-6">
        <BtnLink href="/docs/setup" variant="primary">
          Next: Setup →
        </BtnLink>
      </div>
    </div>
  );
}
