export type CashTimezone = 'Asia/Jerusalem' | 'UTC';
export interface CashPeriodInput { from?: string; to?: string; timezone?: CashTimezone; asOf?: string }
export interface CashPeriod {
  from: string;
  toExclusive: string;
  cashToExclusive: string;
  asOf: string;
  timezone: CashTimezone;
  closed: boolean;
}
function localParts(date: Date, timezone: CashTimezone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date).map(p=>[p.type,p.value]));
}
function instant(value: string, timezone: CashTimezone): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('Use a date or timestamp with timezone');
    // Validate the calendar component too: Date.parse normalizes February 30.
    instant(value.slice(0,10), 'UTC');
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid timestamp');
    return date;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const midnight = Date.UTC(year,month-1,day);
  if (new Date(midnight).toISOString().slice(0,10) !== value) throw new Error('Invalid calendar date');
  let utc = midnight;
  for (let i=0;i<3;i++) {
    const parts = localParts(new Date(utc),timezone);
    const displayed = Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
    utc += midnight-displayed;
  }
  return new Date(utc);
}
/** Cash cutoff, not a reconstruction of records as they existed in the past. */
export function resolveCashPeriod(input: CashPeriodInput = {}, clock = new Date()): CashPeriod {
  const timezone = input.timezone ?? 'Asia/Jerusalem';
  if (!['Asia/Jerusalem','UTC'].includes(timezone)) throw new Error('Unsupported timezone');
  const asOf = input.asOf ? instant(input.asOf,'UTC') : clock;
  if (asOf > clock) throw new Error('Future cash cutoff');
  if (Boolean(input.from) !== Boolean(input.to)) throw new Error('Supply both period boundaries');
  const parts = localParts(asOf,timezone);
  const next = new Date(Date.UTC(+parts.year,+parts.month,1));
  const from = instant(input.from ?? `${parts.year}-${parts.month}-01`,timezone);
  const to = instant(input.to ?? next.toISOString().slice(0,10),timezone);
  if (from >= to || to.getTime()-from.getTime() > 366*86400000) throw new Error('Period must be positive and at most 366 days');
  return { from:from.toISOString(), toExclusive:to.toISOString(), cashToExclusive:new Date(Math.min(to.getTime(),asOf.getTime()+1)).toISOString(), asOf:asOf.toISOString(), timezone, closed:asOf>=to };
}
