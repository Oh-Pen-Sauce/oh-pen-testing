This finding comes from an AST check: a call to `eval(...)` or `new Function(...)` whose argument is not a string literal, so it may carry attacker-controlled input.

Confirm it is a real code-injection risk by checking whether the argument can be influenced by user input (request bodies, query params, headers, file contents, message payloads). A constant built entirely from local literals is lower risk; a value derived from any external source is critical. Reject hits where the argument is provably a trusted constant.
