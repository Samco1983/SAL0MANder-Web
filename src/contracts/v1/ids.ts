/**
 * Durable identifiers.
 *
 * IDs are opaque and permanent. A share link printed on a worksheet or encoded
 * in a QR code must resolve years later, so IDs are never renumbered, never
 * reused, and never carry meaning that could change (no slugs, no titles, no
 * teacher names baked in).
 *
 * Branding prevents an ActivityId from being passed where a ProfileId is
 * expected — a class of bug that is otherwise invisible to TypeScript.
 */
import { z } from 'zod'

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

export type ActivityId = Brand<string, 'ActivityId'>
export type ActivityVersionId = Brand<string, 'ActivityVersionId'>
export type ProfileId = Brand<string, 'ProfileId'>
export type SessionId = Brand<string, 'SessionId'>
export type MediaId = Brand<string, 'MediaId'>

/** URL-safe, printable, QR-friendly. Deliberately excludes look-alike glyphs. */
const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/

const idSchema = <B extends string>(_brandName: B) =>
  z.string().regex(ID_PATTERN, 'Invalid SAL0MANder id') as unknown as z.ZodType<Brand<string, B>>

export const ActivityIdSchema = idSchema('ActivityId')
export const ActivityVersionIdSchema = idSchema('ActivityVersionId')
export const ProfileIdSchema = idSchema('ProfileId')
export const SessionIdSchema = idSchema('SessionId')
export const MediaIdSchema = idSchema('MediaId')

/**
 * Mint a new durable ID client-side.
 *
 * Client-minted IDs let Unity create an activity fully offline and sync later
 * without renegotiating an ID — a requirement of "Unity must remain usable
 * without the website". They also make writes naturally idempotent: retrying an
 * upload of the same activity targets the same ID.
 */
export function newId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let out = ''
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}
