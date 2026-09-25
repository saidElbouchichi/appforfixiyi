"use client";

import { Button, Card, Icon, Input } from "@fixiyi/ui";

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Where the job is. Extracted from the form in the ECC hardening pass
 * (Decision 78): the screen kept 11 pieces of state and four unrelated
 * sections in one 379-line function, and the sections do not share anything
 * but the form that owns them.
 *
 * Presentational on purpose — the browser's Geolocation call and every piece
 * of state stay with the form. Moving them here would only have hidden the
 * length somewhere else.
 *
 * There is no interactive map: `MAP_PROVIDER=dev`, and no provider is wired.
 */
export function LocationCard({
  address,
  onAddressChange,
  coordinates,
  onUseMyLocation,
  error,
}: {
  address: string;
  onAddressChange: (value: string) => void;
  coordinates: Coordinates | null;
  onUseMyLocation: () => void;
  error: string | null;
}): React.JSX.Element {
  return (
    <Card title="Ou se trouve l'intervention ?" headingLevel={2}>
      <div className="flex flex-col gap-3">
        <Input
          label="Adresse (optionnel)"
          value={address}
          onChange={onAddressChange}
          placeholder="12 rue des Fleurs, Casablanca"
          testId="address-input"
        />
        <div>
          <Button variant="secondary" onClick={onUseMyLocation} testId="use-my-location-button">
            <Icon name="map" size="sm" />
            Utiliser ma position
          </Button>
        </div>
        {coordinates ? (
          <p className="fx-text-muted fx-animate-fade-in" data-testid="coordinates-display">
            <Icon name="check" size="sm" /> Position : {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
          </p>
        ) : null}
        {error === null ? null : <p className="fx-field__error">{error}</p>}
      </div>
    </Card>
  );
}
