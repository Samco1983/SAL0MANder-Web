/** Wording only: a hostname is not evidence of deployment or message delivery. */
export function giftOriginCopy(origin: string) {
  const hostname = new URL(origin).hostname.toLowerCase().replace(/\.$/, '')
  const loopback =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    /^127\./.test(hostname) ||
    hostname === '[::1]'

  return {
    summary: `${loopback ? 'Local preview · ' : ''}Nine pieces · No account needed`,
    notice: loopback
      ? 'Links from this local preview only open on this computer.'
      : 'Share the full link. Recipients need access to this website to open the gift.',
  }
}
