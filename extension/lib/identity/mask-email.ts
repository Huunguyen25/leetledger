/**
 * Partially redacts an email for display (popup account line, OTP copy).
 * e.g. skepzie.m@gmail.com → s••••@gmail.com
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return "••••";

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return `${local[0] ?? "•"}••••@${domain}`;
}
