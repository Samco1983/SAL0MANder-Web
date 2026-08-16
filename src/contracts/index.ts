/**
 * Contract entry point.
 *
 * `current` aliases the version this client speaks today. Code that must pin to
 * a specific version imports `@contracts/v1` directly instead.
 */
export * as v1 from './v1'
export * as current from './v1'
export { CONTRACT_VERSION as CURRENT_CONTRACT_VERSION } from './v1/common'
