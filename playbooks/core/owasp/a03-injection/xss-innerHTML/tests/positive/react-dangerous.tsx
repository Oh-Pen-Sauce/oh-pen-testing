// Fixture: React dangerouslySetInnerHTML with non-literal. Should flag.
export function Bio({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
