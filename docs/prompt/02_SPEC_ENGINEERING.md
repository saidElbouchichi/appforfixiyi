# FIXIYI - SPEC ENGINEERING

Cette spec decrit COMMENT construire techniquement.
Les phases d'implementation sont dans 06_SCOPE.md.

---

# 100. STATE MACHINES

Créer de vrais state machines pour :

### Request

```
DRAFT
REQUESTED
MATCHING
RESPONDED
NEGOTIATING
PRICE_AGREED
CONFIRMED
CANCELLED
EXPIRED
```

### Intervention

```
CONFIRMED
ON_THE_WAY
ARRIVED
IN_PROGRESS
PAUSED
COMPLETED
DISPUTED
CANCELLED
NO_SHOW
```

### Offer

```
DRAFT
SUBMITTED
COUNTERED
ACCEPTED
REJECTED
EXPIRED
CANCELLED
```

### Payment

```
PENDING
AUTHORIZED
PAID
FAILED
REFUNDED
PARTIALLY_REFUNDED
DISPUTED
```

### Verification

```
DRAFT
IN_REVIEW
NEEDS_CORRECTION
VERIFIED
REJECTED
SUSPENDED
EXPIRED
```

---

# 101. STATE TRANSITION RULE

Une transition doit toujours être validée côté backend.

Exemple :

```
PATCH /interventions/:id/status
```

ne doit pas accepter arbitrairement :

```json
{
  "status": "COMPLETED"
}
```

Le serveur vérifie : état actuel ; rôle ; acteur ; conditions ; paiement ; présence ; permissions ; éventuelle preuve.

---

# 102. TESTING

Utiliser : Unit Tests, Integration Tests, API Tests, E2E Tests, Security Tests, Load Tests.

Stack cible : Vitest, Playwright, Maestro, Supertest, k6.

---

# 103. TDD

Pour chaque module critique :

```
Test
↓
Implementation
↓
Refactor
↓
Validation
```

Priorité TDD : wallet ; commission ; offers ; state machines ; authorization ; matching ; cancellation ; payments ; verification ; risk.

---

# 104. E2E SCENARIO PRINCIPAL

Créer un test complet :

```
Create account
↓
Login OTP
↓
Client creates request
↓
AI structures request
↓
Matching
↓
Provider receives request
↓
Provider submits offer
↓
Client negotiates
↓
Client accepts
↓
Provider confirmed
↓
Provider ON_THE_WAY
↓
GPS tracking
↓
ARRIVED
↓
IN_PROGRESS
↓
Material request
↓
Client approval
↓
COMPLETED
↓
Payment
↓
Commission
↓
Wallet
↓
Review
```

---

# 105. TESTS DE FRAUDE

Tester : double payment ; double offer acceptance ; duplicate wallet recharge ; concurrent cancellation ; forged provider ID ; access to another user's address ; unauthorized document access ; fake completion ; fake review ; repeated contact exchange ; wallet race condition.

---

# 106. SECURITY TESTING

Inclure : dependency scanning ; secret scanning ; SAST ; API authorization tests ; upload security ; rate-limit tests ; OWASP-oriented testing.

---

# 107. CI/CD

GitHub Actions.

Pipeline :

```
Install
↓
Lint
↓
Typecheck
↓
Unit tests
↓
Integration tests
↓
Build
↓
Security checks
↓
E2E
↓
Docker build
↓
Deploy staging
↓
Smoke tests
↓
Production deployment
```

Production doit nécessiter une étape contrôlée.

---

# 108. DOCKER

Fournir : `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`.

Services dev possibles : api, worker, web, admin, mongodb, redis, minio.

---

# 109. INFRASTRUCTURE

Préparer Infrastructure as Code.

Structure :

```
infrastructure/
 └── terraform/
     ├── modules/
     ├── environments/
     │   ├── dev/
     │   ├── staging/
     │   └── production/
```

Ne jamais déployer une ressource cloud réelle sans credentials/configuration explicite.

---

# 110. CLOUD

Architecture cloud-neutral.

Préparer une implémentation de référence compatible avec un cloud majeur.

Composants : compute ; managed MongoDB ; Redis ; object storage ; CDN ; monitoring ; secret manager ; DNS ; TLS.

Ne pas imposer Kubernetes au lancement.

---

# 111. SCALABILITÉ

Architecture initiale : **Modular Monolith** mais chaque module possède des frontières permettant son extraction ultérieure.

Ne pas créer 20 microservices prématurément.

---

# 112. MOBILE + WEB

Le backend est commun.

Les contrats API sont communs.

Créer package : `packages/contracts` pour les schémas partagés.

Ne pas partager aveuglément le code backend avec le frontend.

---

# 113. CONTRACT-FIRST

Créer les contrats avant les implémentations importantes.

Chaque API critique doit disposer de : schema ; endpoint ; authorization ; errors ; tests.

OpenAPI doit rester synchronisé.

---

# 114. DOCUMENTATION

Créer : README.md, ARCHITECTURE.md, SECURITY.md, API.md, DATABASE.md, AI.md, MATCHING.md, PAYMENTS.md, WALLET.md, DEPLOYMENT.md, TESTING.md, CONTRIBUTING.md, ENVIRONMENT.md, PRIVACY.md.

---

# 115. README

Le README doit permettre à un nouveau développeur de : cloner ; installer ; configurer ; lancer MongoDB/Redis ; lancer backend ; lancer frontend ; lancer mobile ; lancer tests ; comprendre architecture.

---

# 116. ENVIRONMENT

Créer : `.env.example`, `.env.test.example`.

Documenter chaque variable.

---

# 117. SEED

Créer des données de démonstration réalistes : utilisateurs ; fournisseurs ; entreprises ; services ; catégories ; compétences ; interventions ; offres ; conversations ; reviews.

Aucune donnée sensible réelle.

---

# 118. DEV MODE

Créer un environnement de développement permettant : OTP dev ; payment sandbox ; storage local ; fake SMS provider ; fake email provider ; fake map provider lorsque nécessaire ; fake AI provider pour tests.

Mais ces adapters doivent être clairement séparés de la production.

---

# 119. PROVIDER ABSTRACTIONS

Les services externes doivent toujours passer par interfaces.

Exemples : AIProvider, SmsProvider, EmailProvider, PushProvider, PaymentProvider, MapProvider, StorageProvider, SearchProvider.

Ainsi Fixiyi ne dépend pas définitivement d'un seul fournisseur.

---

# 120. AI COST CONTROL

Chaque appel IA doit enregistrer : provider ; model ; tokens/input usage when available ; estimated cost when available ; latency ; success ; failure ; confidence ; traceId.

Prévoir limites et budgets.

---

# 121. AI CONFIDENCE

Les résultats IA structurés doivent contenir `confidence`.

Lorsque la confiance est faible : poser une question ; demander confirmation ; fallback manuel.

---

# 122. AI PROMPT INJECTION

Protéger contre : prompt injection ; tool manipulation ; data exfiltration ; malicious files ; malicious instructions inside images/documents.

Les données utilisateur sont des données non fiables.

---

# 123. AI DATA PRIVACY

Ne pas envoyer inutilement : identité ; documents ; adresse exacte ; informations financières ; secrets.

Minimiser les données transmises aux modèles.

---

# 124. SUPPORT

Créer système de support : `SupportTicket`, `SupportMessage`, `SupportAttachment`, `SupportAction`.

Support peut consulter les informations nécessaires selon permission.

---

# 125. DISPUTES

Une dispute doit pouvoir contenir : intervention ; parties ; motif ; preuves ; chat pertinent ; offres ; paiement ; historique ; décision ; compensation ; statut.

---

# 126. EVIDENCE

Ne jamais supprimer automatiquement les preuves nécessaires à une dispute active.

Conserver selon une politique de rétention.

---

# 127. MODERATION

Supporter : signalement utilisateur ; signalement message ; signalement fournisseur ; signalement avis ; contenu interdit ; fraude.

---

# 128. DATA RETENTION

Chaque catégorie de donnée doit avoir : durée ; justification ; suppression ; anonymisation lorsque nécessaire.

Ne pas conserver éternellement toutes les données.

---

# 129. PERFORMANCE TARGETS

Fixer et mesurer : API p95 ; WebSocket latency ; page load ; time to interactive ; database latency ; queue latency ; image upload time ; matching latency.

Ne pas inventer les résultats.

Mesurer réellement.

---

# 130. OBSERVABILITY DASHBOARD

Créer dashboards pour : API ; database ; Redis ; queues ; WebSocket ; payments ; AI ; matching ; errors.

---

# 131. ALERTING

Alertes : API error rate ; payment failures ; wallet inconsistency ; queue failures ; DB issues ; storage failure ; authentication anomalies ; AI outage ; WebSocket outage.

---

# 132. BACKUPS

MongoDB : backups automatiques ; point-in-time recovery lorsque disponible ; restauration testée.

Object storage : versioning lorsque nécessaire ; lifecycle ; backup des documents critiques.

---

# 133. DISASTER RECOVERY

Documenter : RPO ; RTO ; restauration DB ; restauration storage ; reconstruction infrastructure ; rotation secrets ; rollback.

---

# 134. FRONTEND ERROR STATES

Chaque écran important doit prévoir : Loading, Empty, Error, Offline, Unauthorized, Forbidden, Expired, Success, Partial data, Retry.

Pas seulement le happy path.

---

# 135. UX PROGRESSIVE

Ne jamais montrer toutes les options simultanément.

Exemple :

```
Quel est votre problème ?
↓
Informations essentielles
↓
Photos si nécessaire
↓
Localisation
↓
Matching
↓
Offres
```

---

# 136. NO JARGON

Éviter : `Complexité niveau 3`.

Afficher : `Type d'intervention` ou une formulation compréhensible.

La complexité est principalement interne.

---

# 137. ACCESSIBILITY OF AI

L'utilisateur doit pouvoir utiliser : texte ; voix ; boutons ; choix guidés.

L'IA ne doit pas être obligatoire.

---

# 138. VOICE

Préparer une abstraction : `SpeechToTextProvider`.

Support potentiel : darija ; arabe ; français ; anglais.

Si la qualité n'est pas suffisante, permettre la saisie texte.

---

# 139. CONTACT INFORMATION

Avant acceptation :

```
Phone = hidden
Email = hidden
External links = blocked
```

Après acceptation :

```
Authorized phone number visible
```

Appel via le téléphone normal du smartphone.

---

# 140. PRICE DISPLAY

Toujours distinguer : Service price ; Transport ; Materials ; Platform fees where applicable ; Total.

Le client doit comprendre exactement ce qu'il paie.

---

# 141. NO HIDDEN FEES

Aucun frais important ne doit être ajouté silencieusement.

Le système doit afficher : Subtotal, Transport, Materials, Fees, Total selon le cas.

---

# 142. CANCELLATION FAIRNESS

Les règles doivent être : visibles ; compréhensibles ; configurables ; historisées.

Les décisions automatiques doivent pouvoir être réexaminées.

---

# 143. FAIR MATCHING

Ne pas faire du classement un simple : `highest rating wins`.

Le système doit considérer : pertinence ; disponibilité ; distance ; expérience pertinente ; fiabilité ; charge ; nouveaux fournisseurs ; contexte.

Les pondérations doivent être configurables.

---

# 144. ADMIN CONFIGURATION

Créer une configuration centralisée versionnée.

Exemples : defaultSearchRadius, maximumSearchRadius, transportThreshold, transportPriceRules, commissionRules, walletMinimum, matchingWeights, urgentMatchingRules, cancellationRules, verificationRules, notificationRules.

Toute modification importante doit être auditée.

---

# 145. FEATURE FLAG ROLLOUT

Support : global ; country ; city ; provider type ; percentage rollout ; user cohort.

---

# 146. CODE QUALITY

Strict TypeScript.

Interdire autant que possible `any`.

Préférer `unknown` avec validation.

Appliquer : SOLID ; Clean Architecture ; DRY ; KISS ; séparation des responsabilités ; dependency inversion.

---

# 147. BUSINESS LOGIC

Aucune logique métier critique dans : boutons ; pages ; composants ; controllers uniquement.

La logique doit être dans : Use Cases, Domain Services, Policies, State Machines, Application Services.

---

# 148. CONTROLLERS

Les controllers doivent être minces.

```
Controller
↓
Validation
↓
Use Case
↓
Domain
↓
Repository
```

---

# 149. DOMAIN EVENTS

Créer des événements comme : RequestCreated, ProviderMatched, OfferSubmitted, OfferAccepted, InterventionConfirmed, ProviderStartedTrip, ProviderArrived, InterventionStarted, InterventionCompleted, PaymentCompleted, CommissionCharged, WalletTopUpCompleted, ReviewCreated, VerificationCompleted, DisputeOpened.

---

# 150. EVENT VERSIONING

Chaque événement doit avoir : eventId, eventType, version, occurredAt, aggregateId, payload, traceId.

---

# 151. API SECURITY

Chaque endpoint doit être classé : PUBLIC, AUTHENTICATED, ROLE_REQUIRED, RESOURCE_OWNER, ADMIN, SENSITIVE.

Créer une matrice de permissions.

---

# 152. RATE LIMITING

Rate limit par : IP ; user ; endpoint ; device ; opération.

Particulièrement : OTP ; login ; uploads ; messages ; AI ; search ; payment.

---

# 153. ANTI-SPAM

Limiter : demandes répétitives ; messages massifs ; offres massives ; invitations ; notifications.

---

# 154. DATA VALIDATION

Valider : frontend ; backend ; database where appropriate.

Le frontend ne doit jamais être considéré comme sécurisé.

---

# 155. FILE SECURITY

Refuser : executable files ; dangerous MIME ; spoofed extensions ; oversized uploads ; malicious content.

---

# 156. DEPENDENCIES

Avant d'ajouter une dépendance : vérifier maintenance ; licence ; sécurité ; taille ; nécessité.

Éviter les dépendances inutiles.

---

# 157. LICENSE

Documenter les licences des dépendances importantes.

---

# 158. INTERNATIONALIZATION

Tous les textes utilisateur doivent venir des fichiers de traduction.

Interdit :

```tsx
<button>Choose service</button>
```

Préférer :

```tsx
t("home.chooseService")
```

---

# 159. RTL

Tester réellement : arabe ; darija ; RTL ; cartes ; chat ; formulaires ; icônes directionnelles.

---

# 160. DESIGN TOKENS

Centraliser : colors ; spacing ; font sizes ; radius ; shadows ; breakpoints ; z-index ; motion.

---

# 161. DARK MODE

Architecture compatible dark mode même si le lancement peut privilégier le thème clair.

---

# 162. ANIMATIONS

Utiliser uniquement lorsque cela améliore : compréhension ; feedback ; navigation.

Respecter `prefers-reduced-motion`.

---

# 163. MAP UX

Les cartes doivent afficher : providers ; disponibilité ; distance approximative ; vérification ; rating ; type.

Pas de surcharge visuelle.

---

# 164. PROVIDER CARD

Exemple :

```
Ahmed
Électricien
✓ Identité vérifiée
4.8
126 interventions
3.2 km
Disponible
```

---

# 165. PRICE UX

Exemple :

```
Estimation Fixiyi
250–350 MAD

Ahmed
280 MAD

Entreprise X
320 MAD
```

L'estimation IA est clairement indiquée comme indicative.

---

# 166. AI ESTIMATE

Jamais présenter : `Prix garanti`.

Mais : `Estimation indicative`.

---

# 167. SEARCH PROVIDER

Le client peut : rechercher ; filtrer ; voir carte ; voir liste ; voir profil ; sélectionner ; contacter via demande.

---

# 168. FAVORITES

Client peut sauvegarder des fournisseurs.

Provider peut également avoir ses préférences selon évolution future.

---

# 169. NOTIFICATION PREFERENCES

Permettre de configurer : marketing ; rappels ; messages ; nouvelles demandes ; offres ; paiements.

Les notifications opérationnelles critiques restent actives.

---

# 170. ANALYTICS PRIVACY

Analytics anonymisés/pseudonymisés lorsque possible.

Ne jamais envoyer automatiquement toutes les conversations au système analytics.

---

# 171. ADMIN AUDIT

Un admin ne doit pas pouvoir modifier silencieusement : wallet ; verification ; dispute ; commission.

Chaque action sensible doit avoir `reason`.

---

# 172. FINANCE AUDIT

Toutes les corrections financières doivent avoir : actor ; amount ; reason ; before ; after ; reference ; timestamp.

---

# 173. NO FLOATING MONEY

Répétition volontaire : **aucun calcul financier critique en float.**

---

# 174. TIME ZONES

Stockage UTC.

Présentation selon : pays ; ville ; utilisateur.

---

# 175. LOCATION PRECISION

Ne jamais exposer : `exact GPS` avant le moment métier approprié.

---

# 176. LOCATION RETENTION

Limiter la conservation du tracking précis.

Ne conserver que ce qui est nécessaire : preuve ; sécurité ; dispute ; opérations ; obligations applicables.

---

# 177. COMPANY TEAM

Une entreprise peut avoir : Owner, Manager, Technician, Viewer.

Permissions configurables.

---

# 178. COMPANY ASSIGNMENT

Lorsqu'une entreprise accepte :

```
Company accepts
↓
Company assigns technician
↓
Technician receives assignment
↓
Technician operates
```

---

# 179. PROVIDER WALLET UX

Afficher : Solde disponible ; Solde réservé ; Dernières transactions ; Recharger ; Commission ; Historique.

---

# 180. TOP-UP

Le fournisseur choisit le montant.

Possibilité de : montants prédéfinis ; montant personnalisé selon configuration.

---

# 181. PAYMENT ABSTRACTION

Créer :

```typescript
interface PaymentProvider {
  createPaymentIntent(...)
  confirmPayment(...)
  refund(...)
  getPaymentStatus(...)
}
```

---

# 182. STORAGE ABSTRACTION

Créer :

```typescript
interface StorageProvider {
  createUploadSession(...)
  finalizeUpload(...)
  getSignedUrl(...)
  deleteObject(...)
}
```

---

# 183. NOTIFICATION ABSTRACTION

Créer : `interface PushProvider`, `interface SmsProvider`, `interface EmailProvider`.

---

# 184. AI PROVIDER ABSTRACTION

Créer :

```typescript
interface AIProvider {
  generateText(...)
  analyzeImage(...)
  transcribeAudio(...)
  generateStructuredOutput(...)
}
```

---

# 185. GEO ABSTRACTION

Créer :

```typescript
interface GeoProvider {
  geocode(...)
  reverseGeocode(...)
  route(...)
  distanceMatrix(...)
}
```

---

# 186. SEARCH ABSTRACTION

Créer :

```typescript
interface SearchProvider {
  searchProviders(...)
  searchServices(...)
  searchAdmin(...)
}
```

---

# 187. BACKEND TEST DATA

Ne jamais utiliser de production data.

Utiliser factories : UserFactory, ProviderFactory, RequestFactory, OfferFactory, InterventionFactory, WalletFactory.

---

# 188. TEST DATABASE

Tests intégration sur base isolée.

Ne jamais exécuter les tests destructifs sur production.

---

# 189. MIGRATION / INDEX MANAGEMENT

Même avec MongoDB : versionner les changements de schéma ; versionner les indexes ; scripts de migration ; scripts rollback lorsque possible.

---

# 190. DATA MIGRATION

Toute migration doit être : idempotente ; testée ; documentée ; observable.

---

# 191. BUILD GATES

À chaque phase :

```
typecheck
lint
unit tests
integration tests
build
```

Aucune phase ne doit être considérée comme terminée avec des erreurs connues non documentées.

---

FIN DE LA SPEC ENGINEERING

Les phases d'implémentation sont dans 06_SCOPE.md.
Le protocole d'exécution est dans 03_AGENT_PROTOCOL.md.