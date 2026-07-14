const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string) {
  return TIME_PATTERN.test(value);
}

export function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function minutesToTime(value: number) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function addMinutesToTime(value: string, minutesToAdd: number) {
  return minutesToTime(timeToMinutes(value) + minutesToAdd);
}

export function isAfterTime(endTime: string, startTime: string) {
  return timeToMinutes(endTime) > timeToMinutes(startTime);
}

export function isTimeWithinRange(value: string, startTime: string, endTime: string) {
  const minutes = timeToMinutes(value);
  return minutes >= timeToMinutes(startTime) && minutes <= timeToMinutes(endTime);
}

export function overlaps(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) {
  return timeToMinutes(firstStart) < timeToMinutes(secondEnd) && timeToMinutes(firstEnd) > timeToMinutes(secondStart);
}
