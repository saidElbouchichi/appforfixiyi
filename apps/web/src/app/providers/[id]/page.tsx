"use client";

import type { AvailabilitySlot, ProviderAvailabilityStatus, ProviderType, PublicProviderProfile } from "@fixiyi/contracts";
import { Avatar, Badge, Card, Chip, ErrorState, Icon, Skeleton } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { ApiError } from "../../../lib/api-client";
import { CATALOG_TREE_KEY, catalogNames, fetchCatalogTree } from "../../../lib/catalog";
import { fetchPublicProvider, publicProviderKey } from "../../../lib/providers-api";

const TYPE_LABEL: Record<ProviderType, string> = {
  BRICOLEUR: "Bricoleur",
  TECHNICIEN: "Technicien",
  EXPERT: "Expert",
};

const AVAILABILITY_LABEL: Record<ProviderAvailabilityStatus, string> = {
  OFFLINE: "Hors ligne",
  AVAILABLE: "Disponible",
  BUSY: "Occupe",
  ON_THE_WAY: "En route",
  ARRIVED: "Sur place",
  IN_SERVICE: "En intervention",
  PAUSED: "En pause",
};

const DAY_LABEL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function timeOf(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours.toString().padStart(2, "0")}h${rest.toString().padStart(2, "0")}`;
}

function slotLabel(slot: AvailabilitySlot): string {
  return `${DAY_LABEL[slot.dayOfWeek] ?? ""} ${timeOf(slot.startMinute)} – ${timeOf(slot.endMinute)}`;
}

function NamedList({ ids, names, empty }: { ids: readonly string[]; names: Map<string, string>; empty: string }): React.JSX.Element {
  if (ids.length === 0) {
    return <p className="text-[var(--fixiyi-color-text-muted)]">{empty}</p>;
  }
  return (
    <div className="fx-row flex-wrap">
      {ids.map((id) => (
        <Chip key={id} label={names.get(id) ?? "Element retire du catalogue"} />
      ))}
    </div>
  );
}

function ProfileBody({ profile }: { profile: PublicProviderProfile }): React.JSX.Element {
  const treeQuery = useQuery({ queryKey: CATALOG_TREE_KEY, queryFn: fetchCatalogTree });
  const names = treeQuery.data ? catalogNames(treeQuery.data) : new Map<string, string>();

  return (
    <>
      <Card>
        <div className="fx-row mb-2">
          <Avatar name={profile.displayName} size="lg" />
          <div>
            <h1 className="fx-user-text fx-page__title" data-testid="provider-name">
              {profile.displayName}
            </h1>
            <div className="fx-row">
              <Badge variant="neutral">{TYPE_LABEL[profile.type]}</Badge>
              <Badge variant="info">{AVAILABILITY_LABEL[profile.availabilityStatus]}</Badge>
              {/* Only shown when a verification case was really approved; there is no "unverified" badge. */}
              {profile.verified ? (
                <Badge variant="success" testId="provider-verified">
                  <Icon name="shield" size="sm" />
                  Verifie
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        {profile.bio ? <p className="fx-user-text">{profile.bio}</p> : null}
        {profile.experienceYears === null ? null : (
          <p className="fx-text-body-sm text-[var(--fixiyi-color-text-muted)]">
            {profile.experienceYears} an{profile.experienceYears > 1 ? "s" : ""} d&apos;experience
          </p>
        )}
      </Card>

      <Card title="Services" headingLevel={2}>
        <NamedList ids={profile.serviceIds} names={names} empty="Aucun service renseigne." />
      </Card>

      <Card title="Competences" headingLevel={2}>
        <NamedList ids={profile.skillIds} names={names} empty="Aucune competence renseignee." />
      </Card>

      <Card title="Langues" headingLevel={2}>
        {profile.languages.length > 0 ? (
          <div className="fx-row flex-wrap">
            {profile.languages.map((language) => (
              <Chip key={language} label={language} />
            ))}
          </div>
        ) : (
          <p className="text-[var(--fixiyi-color-text-muted)]">Aucune langue renseignee.</p>
        )}
      </Card>

      <Card title="Zone d&apos;intervention" headingLevel={2}>
        {profile.serviceZones.length > 0 ? (
          <ul className="flex flex-col gap-2" data-testid="provider-zones">
            {profile.serviceZones.map((zone) => (
              <li key={`${zone.approximateCenter.coordinates.join()}-${zone.radiusKm.toString()}`}>
                Environ {zone.radiusKm} km autour de {zone.approximateCenter.coordinates[1].toFixed(2)},{" "}
                {zone.approximateCenter.coordinates[0].toFixed(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--fixiyi-color-text-muted)]">Aucune zone renseignee.</p>
        )}
        {/* Said plainly: the position is blurred on purpose, it is not an address (Decision 70). */}
        <p className="fx-text-body-sm text-[var(--fixiyi-color-text-muted)]">
          Zone approximative. L&apos;adresse exacte et les coordonnees de contact ne sont echangees qu&apos;apres accord entre vous.
        </p>
      </Card>

      <Card title="Disponibilites" headingLevel={2}>
        {profile.availability.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {profile.availability.map((slot) => (
              <li key={`${slot.dayOfWeek.toString()}-${slot.startMinute.toString()}`}>{slotLabel(slot)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--fixiyi-color-text-muted)]">Aucun creneau renseigne.</p>
        )}
      </Card>
    </>
  );
}

/** A missing profile is not a failure to retry: it is an answer, and it says so. */
function ProfileError({ error, onRetry }: { error: unknown; onRetry: () => void }): React.JSX.Element {
  const missing = error instanceof ApiError && error.status === 404;
  if (missing) {
    return <ErrorState title="Profil introuvable" message="Ce profil n'existe pas ou n'est plus publie." />;
  }
  return <ErrorState message="Impossible de charger ce profil." onRetry={onRetry} />;
}

/**
 * An artisan's public profile (Decision 70).
 *
 * What it does NOT show, and why: no phone, no e-mail, no exact address —
 * those are released only once an offer is accepted, through
 * `ConversationService.unlockContact`. No photo — no field holds one, so the
 * avatar is initials (D4). No rating, no review count, no job count — none of
 * them exists in the database, and drawing "4,8 (342 avis)" from the design
 * board would be inventing a reputation (D2, 03_AGENT_PROTOCOL §2).
 */
export default function PublicProviderPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const providerQuery = useQuery({
    queryKey: publicProviderKey(id),
    queryFn: () => fetchPublicProvider(id),
    // A profile that does not exist will not start existing: retrying a 404 only delays the answer.
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });

  return (
    <main className="fx-page fx-page--narrow">
      {providerQuery.isPending ? (
        <Card>
          <Skeleton lines={4} label="Chargement du profil…" />
        </Card>
      ) : providerQuery.error ? (
        <ProfileError
          error={providerQuery.error}
          onRetry={() => {
            void providerQuery.refetch();
          }}
        />
      ) : (
        <ProfileBody profile={providerQuery.data} />
      )}
    </main>
  );
}
