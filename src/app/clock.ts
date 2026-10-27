/**
 * Now in Unix seconds, the "now" every view model takes. Request-time only: callers render per request.
 * FIXED_NOW (Unix seconds) pins it for the design checks' screenshots (WEB-30); never set on the live site.
 */
export function nowSeconds(): number {
  const fixed = Number(process.env.FIXED_NOW);
  return Number.isInteger(fixed) && fixed > 0 ? fixed : Math.floor(Date.now() / 1000);
}
