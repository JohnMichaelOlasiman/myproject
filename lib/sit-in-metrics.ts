const MINUTES_PER_HOUR = 60;

export function parseClockTimeToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
  if (!match) {
    return null;
  }

  const hourValue = Number(match[1]);
  const minuteValue = Number(match[2]);
  if (!Number.isInteger(hourValue) || !Number.isInteger(minuteValue) || minuteValue < 0 || minuteValue > 59) {
    return null;
  }

  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    if (hourValue < 1 || hourValue > 12) {
      return null;
    }
    const normalizedHour = hourValue % 12;
    const hour = meridiem === "PM" ? normalizedHour + 12 : normalizedHour;
    return hour * MINUTES_PER_HOUR + minuteValue;
  }

  if (hourValue < 0 || hourValue > 23) {
    return null;
  }
  return hourValue * MINUTES_PER_HOUR + minuteValue;
}

export function calculateDurationMinutes(timeIn: string, timeOut: string | null): number {
  if (!timeOut) {
    return 0;
  }

  const startMinutes = parseClockTimeToMinutes(timeIn);
  const endMinutes = parseClockTimeToMinutes(timeOut);
  if (startMinutes === null || endMinutes === null) {
    return 0;
  }

  let duration = endMinutes - startMinutes;
  if (duration < 0) {
    duration += 24 * MINUTES_PER_HOUR;
  }
  return duration;
}

export function formatMinutesAsDuration(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / MINUTES_PER_HOUR);
  const minutes = safeMinutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function toHours(totalMinutes: number): number {
  return Math.max(0, totalMinutes) / MINUTES_PER_HOUR;
}

export function computeLeaderboardScore(points: number, totalMinutes: number, tasksCompleted: number): number {
  return points * 0.6 + toHours(totalMinutes) * 0.2 + tasksCompleted * 0.2;
}
