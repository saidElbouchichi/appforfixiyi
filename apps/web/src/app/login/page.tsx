"use client";

import { OtpRequestOutputSchema, UserSchema } from "@fixiyi/contracts";
import { Badge, Button, Card, Input } from "@fixiyi/ui";
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
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer le code — verifiez le numero.");
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
      setError(err instanceof ApiError ? err.message : "Code invalide ou expire.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">Fixiyi</h1>

        <Card title={step === "phone" ? "Connexion" : "Verification"} headingLevel={2}>
          {step === "phone" ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void requestOtp();
              }}
            >
              <Input
                label="Numero de telephone"
                hint="Format international, par exemple +212612345678"
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="+212612345678"
                autoComplete="tel"
                required
                testId="phone-input"
              />
              <Button type="submit" block loading={loading} testId="request-otp-button">
                Recevoir un code
              </Button>
            </form>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void verifyOtp();
              }}
            >
              {devCode ? (
                <p data-testid="dev-code">
                  <Badge variant="info">Mode dev — code : {devCode}</Badge>
                </p>
              ) : null}
              <Input
                label="Code recu par SMS"
                type="text"
                value={code}
                onChange={setCode}
                placeholder="123456"
                autoComplete="one-time-code"
                required
                testId="otp-input"
              />
              <Button type="submit" block loading={loading} testId="verify-otp-button">
                Se connecter
              </Button>
            </form>
          )}

          {error === null ? null : (
            <p className="fx-field__error mt-4" role="alert" data-testid="login-error">
              {error}
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
