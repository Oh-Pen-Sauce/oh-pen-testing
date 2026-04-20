export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-4xl font-bold">
          <span className="mr-2">🛡️</span>
          Oh Pen Testing
        </h1>
        <p className="text-lg text-gray-600">
          Local pen-testing suite. Your code. Your AI. Your terms.
        </p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>M0 — CLI only.</strong> The web kanban + setup wizard land in
          M1. For now, run{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono">
            oh-pen-testing init
          </code>{" "}
          in your project root.
        </div>
      </div>
    </main>
  );
}
