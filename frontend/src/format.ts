const timeFormat = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' });
const dayFormat = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatTime = (iso: string): string => timeFormat.format(new Date(iso));
export const formatDateTime = (iso: string): string => dateTimeFormat.format(new Date(iso));
export const formatDate = (iso: string): string => dateFormat.format(new Date(iso));
export const formatDay = (date: Date): string => dayFormat.format(date);

const pad = (n: number): string => String(n).padStart(2, '0');

/** "YYYY-MM-DD" del día local. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DDTHH:mm" local, para <input type="datetime-local">. */
export function toDateTimeInput(date: Date): string {
  return `${toDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Inicio y fin del día local que representa "YYYY-MM-DD". */
export function dayRange(dateInput: string): { from: Date; to: Date } {
  const [year, month, day] = dateInput.split('-').map(Number);
  const from = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return { from, to };
}

/** Próximo cuarto de hora a partir de `date`. */
export function nextQuarter(date: Date): Date {
  const quarter = 15 * 60_000;
  return new Date(Math.ceil(date.getTime() / quarter) * quarter);
}
