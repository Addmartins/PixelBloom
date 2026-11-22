export const clinicTimezones = {
  'America/Recife': 'Recife',
  'America/Sao_Paulo': 'São Paulo',
  'America/Fortaleza': 'Fortaleza',
  'America/Manaus': 'Manaus',
  'America/Rio_Branco': 'Rio Branco',
  'America/Porto_Velho': 'Porto Velho',
  'America/Boa_Vista': 'Boa Vista',
  'America/Cuiaba': 'Cuiabá',
  'America/Campo_Grande': 'Campo Grande',
  'America/Belem': 'Belém',
  'America/Araguaina': 'Araguaína',
  'America/Bahia': 'Salvador',
  'America/Maceio': 'Maceió',
  'America/Noronha': 'Fernando de Noronha',
  'America/Santarem': 'Santarém',
  'America/Eirunepe': 'Eirunepé',
} as const

export type ClinicTimezone = keyof typeof clinicTimezones
const defaultTimezone: ClinicTimezone = 'America/Recife'
const isoDay = /^\d{4}-\d{2}-\d{2}$/

export function isClinicTimezone(value: unknown): value is ClinicTimezone {
  return typeof value === 'string' && Object.hasOwn(clinicTimezones, value)
}

export function configuredTimezone(settings: unknown): string {
  if (typeof settings !== 'object' || !settings || !('timezone' in settings) || typeof settings.timezone !== 'string') {
    return defaultTimezone
  }
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: settings.timezone })
    return settings.timezone
  } catch {
    return defaultTimezone
  }
}

export function timezoneLabel(timezone: string) {
  return isClinicTimezone(timezone) ? clinicTimezones[timezone] : timezone
}

export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string' || !isoDay.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function clinicSchedule(timeZone: string = defaultTimezone) {
  const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const clock = new Intl.DateTimeFormat('sv-SE', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { timeZone, dateStyle: 'short', timeStyle: 'short' })
  const offsetFormat = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
  const day = (date = new Date()) => dayFormat.format(date)
  const time = (value: string) => clock.format(new Date(value))
  const dateTime = (value: string) => dateTimeFormat.format(new Date(value))
  const offsetAt = (value: Date) => offsetFormat.formatToParts(value).find(part => part.type === 'timeZoneName')?.value.slice(3) || '+00:00'

  function dateAt(value: string): Date | null {
    const approximate = Date.parse(`${value}:00Z`)
    if (!Number.isFinite(approximate)) return null
    const offsets = new Set([offsetAt(new Date(approximate - 86400000)), offsetAt(new Date(approximate + 86400000))])
    const exactMatches = [...offsets]
      .map(offset => new Date(`${value}:00${offset}`))
      .filter(candidate => Number.isFinite(candidate.getTime()) && `${day(candidate)}T${clock.format(candidate)}` === value)
    if (!exactMatches.length) return null
    return new Date(Math.min(...exactMatches.map(item => item.getTime())))
  }

  function dayStart(value: string): string {
    // Some historic Brazilian DST transitions skipped local midnight.
    const firstHour = dateAt(`${value}T00:00`) ?? dateAt(`${value}T01:00`)
    return firstHour?.toISOString() ?? `${value}T00:00:00Z`
  }

  function resolveDay(value: string | string[] | undefined): string {
    return isCalendarDay(value) ? value : day()
  }

  return { day, time, dateTime, dateAt, dayStart, resolveDay }
}

const recife = clinicSchedule()
export const dateAtRecife = recife.dateAt
export const recifeDay = recife.day
export const resolveDay = recife.resolveDay
