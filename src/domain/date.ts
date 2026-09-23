import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  getDay,
  isValid,
  parse,
  startOfDay,
  subDays,
} from "date-fns";

import type { DateKey, Weekday } from "./types";

const DATE_KEY_FORMAT = "yyyy-MM-dd";

/** Converte um Date local para a chave usada no banco, sem deslocamento UTC. */
export function toDateKey(date: Date): DateKey {
  return format(date, DATE_KEY_FORMAT);
}

/** Faz parse estrito de yyyy-MM-dd no fuso local do dispositivo. */
export function fromDateKey(value: DateKey): Date {
  const parsed = parse(value, DATE_KEY_FORMAT, new Date(2000, 0, 1));
  if (!isValid(parsed) || toDateKey(parsed) !== value) {
    throw new RangeError(`Data invalida: ${value}`);
  }
  return startOfDay(parsed);
}

export function isDateKey(value: string): value is DateKey {
  try {
    fromDateKey(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retorna a data civil atual. Quando um fuso IANA e informado, a chave nao
 * depende do fuso configurado no dispositivo (importante perto da meia-noite).
 */
export function todayKey(now = new Date(), timeZone?: string): DateKey {
  if (!timeZone) return toDateKey(now);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!value.year || !value.month || !value.day) {
    throw new RangeError(`Fuso horario invalido: ${timeZone}`);
  }
  return `${value.year}-${value.month}-${value.day}`;
}

export function addDaysToKey(date: DateKey, amount: number): DateKey {
  return toDateKey(addDays(fromDateKey(date), amount));
}

export function daysBetween(start: DateKey, end: DateKey): number {
  return differenceInCalendarDays(fromDateKey(end), fromDateKey(start));
}

export function weekdayOf(date: DateKey): Weekday {
  return getDay(fromDateKey(date)) as Weekday;
}

export function dateKeysBetween(start: DateKey, end: DateKey): DateKey[] {
  const startDate = fromDateKey(start);
  const endDate = fromDateKey(end);
  if (startDate > endDate) return [];
  return eachDayOfInterval({ start: startDate, end: endDate }).map(toDateKey);
}

/** Retorna exatamente `count` dias, em ordem cronologica e incluindo end. */
export function lastNDateKeys(end: DateKey, count: number): DateKey[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("count precisa ser um inteiro maior que zero");
  }
  const endDate = fromDateKey(end);
  return eachDayOfInterval({
    start: subDays(endDate, count - 1),
    end: endDate,
  }).map(toDateKey);
}

export function isDateWithin(
  date: DateKey,
  startsOn?: DateKey,
  endsOn?: DateKey,
): boolean {
  return (!startsOn || date >= startsOn) && (!endsOn || date <= endsOn);
}

// Aliases legiveis para consumidores que preferem os verbos parse/format.
export const formatDateKey = toDateKey;
export const parseDateKey = fromDateKey;
