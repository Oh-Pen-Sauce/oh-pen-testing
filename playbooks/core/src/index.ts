import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the bundled playbooks directory (the root of this
 * package, not the `dist/`).
 *
 * Consumers should pass this into `loadPlaybooks([BUNDLED_PLAYBOOKS_DIR])`.
 */
export const BUNDLED_PLAYBOOKS_DIR = path.resolve(here, "..");
