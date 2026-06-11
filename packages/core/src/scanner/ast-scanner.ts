import { parse } from "@babel/parser";
import * as babelTraverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type { CallExpression, NewExpression } from "@babel/types";
import type { WalkedFile } from "./file-walker.js";

// @babel/traverse ships CommonJS; its callable sits on `.default` when
// imported as a namespace. Resolve once and keep the precise (callable)
// type so the calls below typecheck.
const traverse = ((babelTraverse as { default?: unknown }).default ??
  babelTraverse) as typeof import("@babel/traverse").default;

export interface AstCandidateHit {
  playbookId: string;
  ruleId: string;
  file: string;
  line: number;
  lineRange: [number, number];
  match: string;
  context: string;
}

export interface AstScanInput {
  playbookId: string;
  files: WalkedFile[];
  contextLines?: number;
}

/** What a check reports; line is 1-based. */
interface AstEmit {
  ruleId: string;
  line: number;
  snippet: string;
}

type AstCheck = (
  ast: ReturnType<typeof parse>,
  emit: (hit: AstEmit) => void,
) => void;

const JS_TS_EXT = /\.(?:js|jsx|ts|tsx|mjs|cjs)$/;

/**
 * Built-in AST checks keyed by playbook id. AST checks exist for cases
 * where regex is too blunt: here, telling a literal eval argument
 * (benign-ish) apart from a user-controlled one (code injection) needs
 * to look at the argument's node type, which a regex cannot do.
 *
 * Keyed by playbook id (mirrors the built-in regex secrets rules): a
 * type=ast playbook with a matching id runs the corresponding check.
 * Third-party ast playbooks without a built-in check are a no-op for now.
 */
const BUILTIN_AST_CHECKS: Record<string, AstCheck> = {
  "owasp/a03-injection/code-injection-eval": (ast, emit) => {
    traverse(ast, {
      CallExpression(path: NodePath<CallExpression>) {
        const callee = path.node.callee;
        if (callee.type === "Identifier" && callee.name === "eval") {
          const arg = path.node.arguments[0];
          if (arg && arg.type !== "StringLiteral") {
            emit({
              ruleId: "eval-non-literal",
              line: path.node.loc?.start.line ?? 1,
              snippet: "eval called with a non-literal argument",
            });
          }
        }
      },
      NewExpression(path: NodePath<NewExpression>) {
        const callee = path.node.callee;
        if (callee.type === "Identifier" && callee.name === "Function") {
          // The function body is the LAST argument to the constructor.
          const args = path.node.arguments;
          const body = args[args.length - 1];
          if (body && body.type !== "StringLiteral") {
            emit({
              ruleId: "function-constructor-non-literal",
              line: path.node.loc?.start.line ?? 1,
              snippet: "Function constructor with a non-literal body",
            });
          }
        }
      },
    });
  },
};

export function hasBuiltinAstCheck(playbookId: string): boolean {
  return playbookId in BUILTIN_AST_CHECKS;
}

/**
 * Run the built-in AST check for `input.playbookId` over the JS/TS files.
 * Returns [] (not an error) when there is no check for that playbook or
 * when a file fails to parse, so one malformed file never aborts a scan.
 */
export function runAstScan(input: AstScanInput): AstCandidateHit[] {
  const check = BUILTIN_AST_CHECKS[input.playbookId];
  if (!check) return [];
  const contextLines = input.contextLines ?? 10;
  const hits: AstCandidateHit[] = [];

  for (const file of input.files) {
    if (!JS_TS_EXT.test(file.relativePath)) continue;
    let ast: ReturnType<typeof parse>;
    try {
      ast = parse(file.content, {
        sourceType: "unambiguous",
        errorRecovery: true,
        plugins: ["typescript", "jsx", "decorators-legacy"],
      });
    } catch {
      continue;
    }
    const lines = file.content.split(/\r?\n/);
    check(ast, ({ ruleId, line, snippet }) => {
      const startLine = Math.max(1, line - contextLines);
      const endLine = Math.min(lines.length, line + contextLines);
      const context = lines
        .slice(startLine - 1, endLine)
        .map((l, idx) => `${startLine + idx}: ${l}`)
        .join("\n");
      hits.push({
        playbookId: input.playbookId,
        ruleId,
        file: file.relativePath,
        line,
        lineRange: [line, line],
        match: snippet,
        context,
      });
    });
  }
  return hits;
}
