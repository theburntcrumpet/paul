/** Only allow post-login redirects back into this app, never to another origin. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}
