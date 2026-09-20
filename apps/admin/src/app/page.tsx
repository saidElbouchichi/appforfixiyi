export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="rounded-full bg-[var(--fixiyi-color-primary-100)] px-3 py-1 text-sm font-medium text-[var(--fixiyi-color-primary-700)]">
        apps/admin — Phase 1 (Foundation)
      </span>
      <h1 className="text-2xl font-semibold text-[var(--fixiyi-color-neutral-900)]">
        Fixiyi Admin
      </h1>
      <p className="max-w-md text-[var(--fixiyi-color-neutral-600)]">
        Ce socle technique (Next.js, Tailwind CSS, design tokens partagés) est
        fonctionnel. Aucune fonctionnalité produit n&apos;est encore
        implémentée : elle arrivera dans les phases suivantes.
      </p>
    </main>
  );
}
