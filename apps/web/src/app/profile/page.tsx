"use client";

import { UserSchema, type User } from "@fixiyi/contracts";
import { Button, Card, ErrorState, Icon, Skeleton } from "@fixiyi/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ApiError, apiFetch } from "../../lib/api-client";
import { useAuthHydrated, useAuthStore } from "../../lib/auth-store";
import { signOut } from "../../lib/session";

async function fetchMe(): Promise<User> {
  return UserSchema.parse(await apiFetch("/api/v1/auth/me", { auth: true }));
}

/**
 * Minimal profile (Decision 67): the account's email, signing out, and a way
 * back. Nothing else — editing, sessions and the provider's own profile come
 * with their later phase. `email` is nullable because sign-in is phone OTP,
 * so an account with none says so instead of showing an empty field.
 */
export default function ProfilePage(): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, enabled: hydrated && user !== null });

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      router.push("/login");
    },
  });

  if (!hydrated || !user) {
    return null;
  }

  return (
    <main className="fx-page fx-page--narrow">
      <h1 className="fx-page__title">Profil</h1>

      <Card>
        {meQuery.isPending ? (
          <Skeleton lines={1} label="Chargement du profil…" />
        ) : meQuery.error ? (
          <ErrorState
            message={meQuery.error instanceof ApiError ? meQuery.error.message : "Impossible de charger le profil."}
            onRetry={() => {
              void meQuery.refetch();
            }}
          />
        ) : (
          <p data-testid="profile-email">
            <Icon name="mail" size="sm" /> {meQuery.data.email ?? "Aucun e-mail renseigne"}
          </p>
        )}

        <div className="fx-row mt-4">
          <Button
            variant="secondary"
            loading={signOutMutation.isPending}
            onClick={() => {
              signOutMutation.mutate();
            }}
            testId="sign-out-button"
          >
            <Icon name="arrow-back" size="sm" />
            Se deconnecter
          </Button>
          <Link href="/" data-testid="back-home-link">
            Retour a l&apos;accueil
          </Link>
        </div>
      </Card>
    </main>
  );
}
