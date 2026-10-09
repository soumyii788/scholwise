export function minutesToClock(totalMinutes) {
  const minutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const [hours, mins] = [Math.floor(minutes / 60), minutes % 60];
  const period = hours < 12 ? "AM" : "PM";
  const display = hours % 12 || 12;
  return `${display}:${String(mins).padStart(2, "0")} ${period}`;
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function daysLeftLabel(days) {
  if (days === null || days === undefined) return "No exam date";
  if (days < 0) return "Exam passed";
  if (days === 0) return "Exam today!";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

export function urgencyBadgeClass(days) {
  if (days === null || days === undefined) return "badge badge-neutral";
  if (days <= 3) return "badge badge-danger";
  if (days <= 7) return "badge badge-warning";
  if (days <= 14) return "badge badge-info";
  return "badge badge-neutral";
}

export function todayISO(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function monthLabel(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function shiftMonth(monthStr, delta) {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function firstName(name) {
  return (name || "there").trim().split(/\s+/)[0];
}
