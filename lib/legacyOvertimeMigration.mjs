const KOREA_DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function hasUtcMidnight(date) {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

function getSeoulDateKey(date) {
  return KOREA_DATE_FORMATTER.format(date);
}

export function normalizeLegacyOvertimeDate(date) {
  return new Date(`${getSeoulDateKey(date)}T00:00:00.000Z`);
}

export function isLegacyOvertimeMigrationCandidate(event) {
  if (!event.allDay || !event.isOvertimeOnly) {
    return false;
  }

  return !hasUtcMidnight(event.startDate) || !hasUtcMidnight(event.endDate);
}
