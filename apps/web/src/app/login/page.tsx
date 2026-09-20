"use client";

import { OtpRequestOutputSchema, UserSchema } from "@fixiyi/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiFetch } from "../../lib/api-client";
import { useAuthStore } from "../../lib/auth-store";

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const output = OtpRequestOutputSchema.parse(await apiFetch("/api/v1/auth/otp/request", { method: "POST", body: { phone } }));
      setDevCode(output.devCode ?? null);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to request a code — check the phone number.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ accessToken: string; refreshToken: string; user: unknown }>("/api/v1/auth/otp/verify", {
        method: "POST",
        body: { phone, code },
      });
      setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: UserSchema.parse(result.user) });
      router.push("/requests/new");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Fixiyi</h1>

      {step === "phone" ? (
        <form
          className="flex w-full max-w-sm flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void requestOtp();
          }}
        >
          <label className="text-sm text-[var(--fixiyi-color-neutral-600)]" htmlFor="phone">
            Numero de telephone (ex. +212612345678)
          </label>
          <input
            id="phone"
            data-testid="phone-input"
            type="tel"
            required
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
            }}
            className="rounded border border-[var(--fixiyi-color-neutral-300)] px-3 py-2"
            placeholder="+212612345678"
          />
          <button
            type="submit"
            data-testid="request-otp-button"
            disabled={loading}
            className="rounded bg-[var(--fixiyi-color-primary-600)] px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Envoi..." : "Recevoir un code"}
          </button>
        </form>
      ) : (
        <form
          className="flex w-full max-w-sm flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void verifyOtp();
          }}
        >
          {devCode ? (
            <p data-testid="dev-code" className="rounded bg-[var(--fixiyi-color-primary-100)] px-3 py-2 text-sm text-[var(--fixiyi-color-primary-700)]">
              Mode dev — code : <strong>{devCode}</strong>
            </p>
          ) : null}
          <label className="text-sm text-[var(--fixiyi-color-neutral-600)]" htmlFor="code">
            Code recu par SMS
          </label>
          <input
            id="code"
            data-testid="otp-input"
            type="text"
            required
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            className="rounded border border-[var(--fixiyi-color-neutral-300)] px-3 py-2"
            placeholder="123456"
          />
          <button
            type="submit"
            data-testid="verify-otp-button"
            disabled={loading}
            className="rounded bg-[var(--fixiyi-color-primary-600)] px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Verification..." : "Se connecter"}
          </button>
        </form>
      )}

      {error ? (
        <p data-testid="login-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </main>
  );
}
