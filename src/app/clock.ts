/** Now in Unix seconds, the "now" every view model takes. Request-time only: callers render per request. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
