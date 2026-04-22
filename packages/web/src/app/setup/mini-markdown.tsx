import { Fragment, type ReactNode } from "react";

/**
 * Tiny markdown renderer for assistant bubbles.
 *
 * Supports a deliberately small subset:
 *   - newlines (`\n`) become hard line breaks
 *   - `**text**` → bold
 *   - `` `code` `` → inline code
 *   - `[label](url)` → external link
 *
 * Lists aren't parsed as block elements — the model is instructed to
 * emit `1. `, `2. ` literal prefixes inside its string, and the `\n`
 * treatment takes care of the layout.
 *
 * Why not a real markdown library: the set of things we need is tiny,
 * the input is trusted-ish (it's the model's output, and we want to
 * escape URLs / reject dangerous protocols), and pulling in `marked` or
 * `remark` adds ~40kb to the setup bundle for no meaningful upside.
 */

const SAFE_LINK_PROTOCOLS = /^(https?:|mailto:)/i;

/** Render markdown-lite content. Returns React nodes. */
export function renderMiniMarkdown(source: string): ReactNode {
  // Split into lines so newlines become hard breaks without us needing
  // to parse block-level paragraphs.
  const lines = source.split("\n");
  return lines.map((line, i) => (
    <Fragment key={i}>
      {renderInline(line)}
      {i < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

/**
 * Inline pass. Walks the string once, emitting spans for each matched
 * formatter. Bold > code > link in order of "outer" markup.
 *
 * The captured content of bold and link-label is recursed through this
 * same function so nesting works. The AI very commonly emits
 * `**[label](url)**` — a link inside bold — and both the link and the
 * bold need to render. Code spans are NOT recursed; their content is
 * literal by design.
 */
function renderInline(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let rest = line;
  let keyIdx = 0;
  const pushPlain = (text: string) => {
    if (text.length > 0) parts.push(text);
  };
  const pushNode = (node: ReactNode) => {
    parts.push(<Fragment key={`m-${keyIdx++}`}>{node}</Fragment>);
  };

  // Combined regex — whichever formatter matches first wins, and the
  // outer loop keeps going on the remainder.
  //   group 1: **bold** — non-greedy so consecutive **a** **b** don't merge
  //   group 2: `code`
  //   group 3: [text](url)
  //   group 4: url (capture inside group 3)
  const re =
    /\*\*([^\n]+?)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)/;

  while (rest.length > 0) {
    const m = re.exec(rest);
    if (!m) {
      pushPlain(rest);
      break;
    }
    pushPlain(rest.slice(0, m.index));
    if (m[1] !== undefined) {
      pushNode(
        <strong style={{ fontWeight: 700, color: "inherit" }}>
          {renderInline(m[1])}
        </strong>,
      );
    } else if (m[2] !== undefined) {
      pushNode(
        <code
          style={{
            background: "rgba(34,26,20,0.08)",
            padding: "1px 6px",
            borderRadius: 3,
            fontFamily: "var(--font-mono)",
            fontSize: "0.92em",
          }}
        >
          {m[2]}
        </code>,
      );
    } else if (m[3] !== undefined && m[4] !== undefined) {
      const href = m[4];
      if (SAFE_LINK_PROTOCOLS.test(href)) {
        pushNode(
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              color: "var(--sauce)",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            {renderInline(m[3])}
          </a>,
        );
      } else {
        // Unsafe / relative link — render as plain text so we don't
        // ever emit a javascript: href.
        pushPlain(`${m[3]} (${href})`);
      }
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return parts;
}
