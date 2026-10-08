"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
export function AccountLinkForm({
  mode,
}: {
  mode: "verify" | "forgot" | "reset";
}) {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("token") || "";
    setToken(raw);
    setReady(true);
    if (raw) {
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);
  const hasToken = Boolean(token);
  const title = complete
    ? mode === "reset"
      ? "Your password is updated."
      : "Email confirmed."
    : mode === "forgot"
      ? "Let’s get you back in."
      : mode === "reset"
        ? "Choose a fresh password."
        : "Confirm your email.";
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (mode === "reset" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const endpoint =
        mode === "forgot"
          ? "recovery/request"
          : mode === "reset"
            ? "recovery/confirm"
            : hasToken
              ? "email/confirm"
              : "email/request";
      const response = await fetch(`/api/account/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hasToken ? { token, password } : { email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      setMessage(
        data.message ||
          (mode === "reset"
            ? "Password changed. Earlier sessions will end shortly; sign in with your new password."
            : "Email confirmed. You can now sign in."),
      );
      if (hasToken) {
        setComplete(true);
        setPassword("");
        setConfirm("");
        setToken("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen premium-gradient flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Logo size={64} showText={false} />
        <section className="account-link-form mt-7 rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm text-study-ink">
            <ShieldCheck className="h-4 w-4" /> Account security
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{title}</h1>
          <p className="mt-4 text-base text-gray-300">
            {complete
              ? "Return to sign in to continue."
              : mode === "forgot"
                ? "We’ll email a single-use link if an eligible account exists."
                : mode === "reset"
                  ? "Your link expires after 30 minutes and works only once."
                  : hasToken
                    ? "Press the button to confirm. Opening the link alone does not use it."
                    : "Request a new single-use confirmation link for your Averna account."}
          </p>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-300"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="mt-5 rounded-lg border border-averna-cyan/40 bg-averna-cyan/10 p-3 text-sm text-study-ink"
            >
              {message}
            </p>
          )}
          {ready && !complete && (mode !== "reset" || hasToken) && (
            <form className="mt-6 space-y-4" onSubmit={submit}>
              {!hasToken && (
                <div>
                  <label
                    htmlFor="account-email"
                    className="block mb-2 text-sm text-gray-300"
                  >
                    Email address
                  </label>
                  <Input
                    className="min-h-11"
                    id="account-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}
              {mode === "reset" && (
                <>
                  <div>
                    <label
                      htmlFor="new-password"
                      className="block mb-2 text-sm text-gray-300"
                    >
                      New password
                    </label>
                    <Input
                      className="min-h-11"
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="mt-2 text-sm text-gray-400">
                      8+ characters, a letter and a number. Avoid common
                      passwords.
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="block mb-2 text-sm text-gray-300"
                    >
                      Confirm password
                    </label>
                    <Input
                      className="min-h-11"
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                </>
              )}
              <Button className="min-h-11 w-full" disabled={busy} type="submit">
                {busy ? (
                  "Please wait…"
                ) : hasToken ? (
                  mode === "reset" ? (
                    "Save new password"
                  ) : (
                    "Confirm my email"
                  )
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" /> Send me a link
                  </>
                )}
              </Button>
            </form>
          )}
          {ready && mode === "reset" && !hasToken && !complete && (
            <p role="status" className="mt-5 text-gray-300">
              Open the link from your recovery email, or{" "}
              <Link
                href="/auth/forgot-password"
                className="text-study-ink underline"
              >
                request a new link
              </Link>
              .
            </p>
          )}
          <Link
            href={
              mode === "reset" && complete
                ? "/auth/signin?changed=1"
                : "/auth/signin"
            }
            className="inline-flex min-h-11 items-center mt-5 text-sm text-study-ink underline"
          >
            Back to sign in
          </Link>
        </section>
      </div>
    </main>
  );
}
