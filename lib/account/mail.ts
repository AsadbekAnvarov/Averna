/** Transactional email is explicit configuration; never use a request Host for reset links. */
export function accountMailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY &&
    process.env.ACCOUNT_MAIL_FROM &&
    process.env.ACCOUNT_APP_URL,
  );
}
export function verificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
}
export function accountLink(path: string, token: string): string {
  const raw = process.env.ACCOUNT_APP_URL;
  if (!raw) throw new Error("Account mail origin is not configured");
  const origin = new URL(raw);
  if (
    origin.username ||
    origin.password ||
    !["https:", "http:"].includes(origin.protocol) ||
    (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
  )
    throw new Error("Invalid account mail origin");
  const url = new URL(path, origin.origin);
  url.searchParams.set("token", token);
  return url.toString();
}
export async function sendAccountMail(
  email: string,
  purpose: "verify" | "reset",
  token: string,
) {
  if (!accountMailConfigured())
    throw new Error("Account mail is not configured");
  const link = accountLink(
    purpose === "verify" ? "/auth/verify-email" : "/auth/reset-password",
    token,
  );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.ACCOUNT_MAIL_FROM,
      to: [email],
      subject:
        purpose === "verify"
          ? "Confirm your Averna email"
          : "Reset your Averna password",
      text: `${purpose === "verify" ? "Confirm your email" : "Choose a new password"} using this single-use link:\n\n${link}\n\nIt expires in ${purpose === "verify" ? "24 hours" : "30 minutes"}. If you did not request this, ignore this email.`,
    }),
  });
  if (!response.ok) throw new Error("Account mail delivery failed"); // never log link, token, or provider body
}
