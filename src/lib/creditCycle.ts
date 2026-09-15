export const CREDIT_RESET_TIME_ZONE = "America/Sao_Paulo";
export const CREDIT_REFRESH_INTERVAL_MS = 15_000;

const creditDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CREDIT_RESET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getCreditDayKey(at: Date = new Date()): string {
  const parts = creditDayFormatter.formatToParts(at);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("credit_reset_date_unavailable");
  }

  return `${year}-${month}-${day}`;
}
