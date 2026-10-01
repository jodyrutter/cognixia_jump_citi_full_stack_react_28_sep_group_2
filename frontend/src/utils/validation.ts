// Requires a letter before the @, a letter between the @ and the period, and a letter after the period.
const EMAIL_PATTERN = /^[^\s@]*[A-Za-z][^\s@]*@[^\s@]*[A-Za-z][^\s@]*\.[^\s@]*[A-Za-z][^\s@]*$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}
