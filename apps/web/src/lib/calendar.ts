/** Local civil dates: do not convert date-only API values through UTC. */
export function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthCalendar(year: number, month: number) {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0, 12).getDate();
  const cells = Math.ceil((offset + days) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const date = new Date(year, month, 1 - offset + index, 12);
    return {
      key: calendarDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      date,
    };
  });
}
