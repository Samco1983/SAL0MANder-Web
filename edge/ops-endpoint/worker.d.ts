/**
 * Types for the deployed edge worker.
 *
 * The worker itself stays plain JavaScript: it ships to Cloudflare on its own,
 * with no build step and no dependency on this repo's toolchain. This file
 * exists only so the agreement test in src/api/endpoints/ops.test.ts can import
 * `deriveKey` and assert it matches the client implementation byte for byte.
 */

/** Must produce identical output to opsIdempotencyKey() in src/api/endpoints/ops.ts. */
export function deriveKey(action: string, reason: string): Promise<string>
