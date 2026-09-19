# FIXIYI - SPEC PRODUIT

Cette spec decrit CE QUE l'agent doit construire.
Le protocole d'execution est dans 03_AGENT_PROTOCOL.md.
Le scope (MVP/V2/V3) est dans 06_SCOPE.md.

---

# 0. RÔLE DE L'AGENT

Tu es l'**architecte logiciel principal, product engineer, UX/UI designer, backend engineer, frontend engineer, mobile engineer, DevOps engineer, security engineer, QA engineer et AI engineer** responsable de construire intégralement l'application **Fixiyi**.

Tu ne dois pas produire une simple démonstration.

Tu dois construire une **application réelle, cohérente, sécurisée, maintenable, testable, extensible et déployable en production**.

Tu dois raisonner comme une équipe senior complète.

Tu dois :

* analyser le projet existant avant toute modification ;
* comprendre l'architecture existante ;
* conserver ce qui est utile ;
* refactoriser ce qui doit l'être ;
* supprimer le code inutile uniquement lorsqu'il est clairement obsolète ;
* créer les fichiers manquants ;
* installer les dépendances nécessaires ;
* configurer les outils ;
* implémenter frontend + backend + base de données ;
* implémenter les APIs ;
* implémenter l'authentification ;
* implémenter les permissions ;
* implémenter les workflows métier ;
* implémenter le temps réel ;
* implémenter les notifications ;
* implémenter le stockage des médias ;
* implémenter l'IA ;
* implémenter les paiements ;
* implémenter le wallet fournisseur ;
* implémenter les commissions ;
* implémenter le système de vérification ;
* implémenter le système de réputation ;
* implémenter le matching ;
* implémenter le chat ;
* implémenter la géolocalisation ;
* implémenter le back-office ;
* implémenter les logs et audits ;
* implémenter les tests ;
* implémenter CI/CD ;
* documenter le système ;
* préparer le déploiement.

---

# 1. MODE D'EXÉCUTION — AUTONOME

Tu disposes d'une autonomie maximale **dans le workspace/projet qui t'est fourni**.

Tu es autorisé à :

* inspecter tous les fichiers du projet ;
* parcourir l'arborescence ;
* lire les configurations ;
* analyser package.json ;
* analyser les variables d'environnement présentes ;
* analyser les scripts ;
* analyser les dépendances ;
* créer des dossiers ;
* créer des fichiers ;
* modifier des fichiers ;
* supprimer du code obsolète lorsqu'il est clairement identifié ;
* installer les dépendances nécessaires ;
* lancer le serveur de développement ;
* lancer les tests ;
* lancer le lint ;
* lancer le typecheck ;
* lancer le build ;
* lancer Docker/Docker Compose lorsque disponible ;
* lancer les migrations/indexations nécessaires ;
* générer les fichiers de configuration ;
* générer les types ;
* générer la documentation ;
* utiliser Git localement ;
* créer des commits locaux structurés si Git est disponible ;
* corriger automatiquement les erreurs découvertes pendant les validations ;
* recommencer une implémentation jusqu'à obtenir un état cohérent.

## IMPORTANT

Tu ne dois cependant jamais :

* exfiltrer des secrets ;
* envoyer des fichiers privés vers un service externe sans autorisation explicite ;
* afficher des secrets dans les logs ;
* hardcoder des clés API ;
* hardcoder des mots de passe ;
* récupérer ou transmettre des tokens privés ;
* contourner les mécanismes de sécurité du système ;
* désactiver antivirus, firewall ou protections du système ;
* supprimer massivement des fichiers sans nécessité ;
* exécuter volontairement des commandes destructrices irréversibles ;
* supprimer une base de données de production ;
* modifier des credentials de production ;
* publier une application en production sans configuration explicite de déploiement ;
* utiliser des données réelles sensibles dans les tests ;
* inventer des credentials.

Pour toute opération potentiellement destructive ou irréversible, créer d'abord un backup ou demander confirmation si l'opération dépasse le workspace de développement.

---

# 2. RÈGLE ABSOLUE : PAS DE FAUX PRODUIT

INTERDICTION de produire :

* fake backend ;
* mock backend présenté comme backend réel ;
* données statiques à la place de la base de données ;
* boutons sans logique ;
* pages uniquement visuelles ;
* API simulées alors qu'une vraie API est requise ;
* paiement fictif présenté comme paiement réel ;
* authentification fictive ;
* faux système de matching ;
* faux système de chat ;
* faux tracking GPS ;
* fausses notifications ;
* faux wallet ;
* fausses transactions ;
* faux workflow de vérification.

Les mocks sont autorisés **uniquement pour les tests** ou pour les adaptateurs externes explicitement désignés comme sandbox/dev.

---

# 3. OBJECTIF PRODUIT

Construire **Fixiyi**, marketplace de services et interventions à domicile.

Fixiyi connecte :

* particuliers ;
* bricoleurs ;
* techniciens ;
* experts ;
* entreprises ;
* équipes techniques.

L'application doit fonctionner comme une combinaison conceptuelle de :

* marketplace de services ;
* logique de mise en relation rapide ;
* profils de confiance ;
* réservation/intervention ;
* chat ;
* négociation ;
* géolocalisation ;
* IA assistant ;
* portefeuille fournisseur ;
* système de réputation ;
* back-office professionnel.

Les inspirations UX sont :

* rapidité et simplicité opérationnelle inspirées des applications de livraison ;
* confiance, profils, vérification et réservation inspirées des marketplaces de logement ;
* intelligence artificielle et compréhension des problèmes propres à Fixiyi.

Ne jamais copier une identité visuelle propriétaire.

---

# 4. MARCHÉ INITIAL

Marché initial : **Maroc**

Architecture obligatoire : internationale, multi-pays, multi-ville, multi-devise, multi-langue, multi-zone.

Ne jamais hardcoder : Maroc, MAD, Marrakech, Casablanca, une langue, une ville, un fournisseur de paiement, un fournisseur de cartes, un fournisseur SMS, un fournisseur IA.

Le Maroc est uniquement le premier marché.

---

# 5. LANGUES

L'application doit supporter :

1. العربية
2. الدارجة المغربية
3. Français
4. English

La langue de l'interface est indépendante de la langue utilisée avec l'IA.

Un utilisateur peut avoir : interface française, conversation IA en darija, message au technicien en arabe, réponse IA en français.

Support obligatoire : RTL, LTR, formats locaux, dates, heures, nombres, devises, pluriels, accessibilité linguistique.

---

# 6. UTILISATEUR UNIQUE

Un compte personnel unique peut être client, fournisseur, ou les deux.

L'utilisateur peut passer de **Mode Client** à **Mode Fournisseur** sans créer un deuxième compte.

Une entreprise peut être liée au compte personnel d'un représentant.

---

# 7. TYPES DE FOURNISSEURS

Fixiyi doit supporter : bricoleur, technicien, expert, entreprise.

Une personne peut évoluer progressivement : Bricoleur → Technicien → Expert, ou créer/gérer une entreprise.

---

# 8. SERVICE CATALOG

Le catalogue est entièrement administrable.

Architecture logique :

```
Domain
 └── Category
      └── Service
           └── InterventionType
                └── Complexity
                     └── RequiredSkill
```

Exemples : Électricité, Plomberie, Climatisation, Chauffage, Serrurerie, Peinture, Menuiserie, Maçonnerie, Électroménager, Domotique, Informatique, TV / Antenne, Nettoyage, Jardinage, Montage, Réparation, Maintenance, Bricolage, Autres.

Le catalogue doit être modifiable depuis le back-office.

---

# 9. UX PRINCIPALE CLIENT

L'écran d'accueil doit rester extrêmement simple.

Deux actions principales :

### Action 1 — **Décrire mon problème avec l'IA**

### Action 2 — **Choisir un service**

Ne jamais forcer l'utilisateur à comprendre la taxonomie interne.

---

# 10. CRÉATION D'UNE DEMANDE

Le client peut fournir : texte, photo, plusieurs photos, vidéo, audio, urgence, localisation, disponibilité, préférences, informations complémentaires.

L'IA transforme les informations en demande structurée.

Exemple :

```
Domaine: Électricité
Service: Panne électrique
Intervention: Diagnostic / réparation
Complexité: Intervention technique
Urgence: Normale
Informations: Prise de courant ne fonctionne plus depuis hier.
```

L'utilisateur peut corriger la structure produite par l'IA.

L'IA ne doit jamais être la source de vérité finale.

---

# 11. IA MULTIMODALE

Architecture :

```
Client
 ↓
AI Gateway
 ↓
AI Orchestrator
 ↓
Model Adapter
 ↓
Tool Layer
 ↓
Business Rules
 ↓
Application Services
 ↓
Database
```

L'IA doit pouvoir : comprendre texte, darija, arabe, français, anglais ; transcrire audio ; analyser images ; analyser vidéos lorsque techniquement possible ; identifier le domaine ; identifier le problème ; déterminer les informations manquantes ; poser des questions ; structurer la demande ; recommander un service ; proposer une complexité ; recommander des fournisseurs ; générer une estimation indicative ; créer un brouillon de demande ; lancer certaines actions autorisées.

---

# 12. IA — RÈGLE DE SÉCURITÉ

L'IA ne doit jamais avoir un accès SQL/NoSQL direct illimité.

Elle doit uniquement utiliser des tools explicitement autorisés.

Exemples : `identifyService()`, `structureProblem()`, `askClarification()`, `searchProviders()`, `estimatePrice()`, `createRequestDraft()`, `notifyProviders()`, `createOfferDraft()`.

Les actions sensibles nécessitent :

```
AI
 ↓
Tool
 ↓
Authorization
 ↓
Business Rule
 ↓
Validation
 ↓
User confirmation where required
 ↓
Execution
```

L'IA ne peut jamais : modifier un wallet directement ; modifier une commission directement ; modifier une permission ; valider un fournisseur ; modifier une vérification ; accepter un prix final sans autorisation ; supprimer une preuve ; contourner une règle de sécurité.

---

# 13. IA — FALLBACK

L'application doit fonctionner sans IA.

Si l'IA est indisponible : formulaire classique ; sélection manuelle ; recherche classique ; matching classique ; chat classique ; offres classiques.

L'IA est une couche d'amélioration, pas un point unique de défaillance.

---

# 14. MODE DE MATCHING

Fixiyi utilise un matching hybride.

### Mode A — Le client choisit directement un fournisseur.

### Mode B — Le client décrit son problème et Fixiyi cherche les fournisseurs pertinents.

Le matching doit utiliser : compétences ; services ; disponibilité ; zone ; distance ; temps de déplacement ; urgence ; expérience pertinente ; historique ; fiabilité ; charge actuelle ; réputation ; niveau de vérification.

---

# 15. MATCHING PROGRESSIF

Ne jamais envoyer toutes les demandes à tous les fournisseurs.

Processus :

```
Eligibility
↓
Ranking
↓
Small provider batch
↓
Wait
↓
Next batch
↓
Expand radius if necessary
↓
Final matching
```

Le système doit éviter : surcharge des fournisseurs ; spam ; discrimination des nouveaux fournisseurs ; domination permanente des anciens ; dépendance excessive aux étoiles.

Prévoir un mécanisme d'exploration pour les nouveaux fournisseurs.

---

# 16. DISPONIBILITÉ FOURNISSEUR

Statuts :

```
OFFLINE
AVAILABLE
BUSY
ON_THE_WAY
ARRIVED
IN_SERVICE
PAUSED
```

La disponibilité est distincte du GPS.

Un fournisseur peut être `AVAILABLE` sans partager continuellement sa position exacte.

Lorsqu'une intervention active existe, le système peut modifier automatiquement l'état.

---

# 17. GÉOLOCALISATION

Avant acceptation : localisation approximative.

Après confirmation : adresse exacte accessible au fournisseur autorisé.

Pendant le trajet : tracking live.

Après intervention : accès exact expiré selon politique.

Chaque accès sensible à la localisation doit être : autorisé ; temporaire ; journalisé ; auditable.

---

# 18. RAYON

Le système propose automatiquement un rayon initial.

Si aucun fournisseur approprié n'est trouvé : élargissement progressif ; possibilité pour le client d'élargir manuellement.

Le transport dans le rayon par défaut est gratuit pour le client.

Au-delà : calcul automatique de frais ; frais faibles et configurables ; fournisseur ne choisit pas librement ces frais.

---

# 19. CALCUL DU TRANSPORT

Créer : `GeoService`, `DistanceService`, `TravelTimeService`, `TransportPricingService`.

Le fournisseur ne définit pas lui-même les frais de déplacement.

Le moteur utilise : distance ; durée ; zone ; seuil ; configuration administrative.

---

# 20. CARTE

Créer une abstraction :

```typescript
interface MapProvider {
  displayMap()
  geocode()
  reverseGeocode()
  calculateRoute()
  calculateDistance()
  calculateETA()
}
```

Le fournisseur cartographique initial doit être interchangeable.

Toutes les intégrations doivent passer par `GeoService`.

---

# 21. NAVIGATION

Fixiyi affiche : itinéraire ; distance ; ETA ; progression.

Bouton **Naviguer** ouvre l'application externe disponible : Google Maps ; Waze ; Apple Maps.

Fixiyi ne doit pas implémenter son propre système complet de navigation vocale.

---

# 22. PROFIL FOURNISSEUR

Le profil doit présenter : photo/logo ; nom ; type ; vérifications ; compétences ; services ; zones ; expérience ; portfolio ; certifications ; interventions réalisées ; avis ; réputation ; disponibilité ; langues ; statistiques pertinentes.

Ne jamais afficher uniquement `★★★★★ 4.8`.

La confiance doit être multidimensionnelle.

---

# 23. VÉRIFICATION

La vérification est progressive.

## Individu

Peut nécessiter : identité ; téléphone ; profession ; expérience ; documents professionnels ; diplôme/certification lorsqu'approprié ; preuves d'expérience ; entretien support si nécessaire.

Un diplôme n'est pas obligatoirement requis pour tous les métiers.

## Entreprise

Nécessite : documents administratifs ; informations légales ; identité du représentant ; documents du représentant ; informations professionnelles.

---

# 24. ÉTATS DE VÉRIFICATION

```
DRAFT
IN_REVIEW
NEEDS_CORRECTION
VERIFIED
REJECTED
SUSPENDED
EXPIRED
```

Chaque décision doit être historisée.

Le badge doit préciser ce qui a été vérifié. Exemple : Identité vérifiée, Compétences électricité vérifiées, Documents professionnels vérifiés.

---

# 25. ENTREPRISE

Une entreprise peut recevoir une demande.

Elle choisit manuellement le technicien.

Architecture :

```
Company
 ├── Members
 ├── Technicians
 ├── Skills
 └── Interventions
```

L'entreprise reste responsable commercialement.

L'intervention conserve : entreprise ; membre ayant accepté ; technicien assigné ; technicien ayant effectué l'intervention.

---

# 26. CHAT

Chat temps réel avec : texte ; photo ; vidéo ; fichiers ; réponses ; réactions ; modification ; suppression contrôlée ; recherche ; typing indicator ; sent ; delivered ; read ; notifications ; signalement.

Le chat est lié à la demande/intervention.

---

# 27. CHAT — PROTECTION CONTRE LE CONTOURNEMENT

Avant acceptation : pas de téléphone ; pas d'email ; pas de lien externe ; pas de coordonnées de contact.

Mettre en place : `ContactDetectionService`.

Il doit détecter : numéros ; emails ; URLs ; tentatives de contournement ; variantes textuelles évidentes.

Le système doit masquer ou bloquer les informations interdites avant acceptation.

Après acceptation : le numéro autorisé peut être affiché.

Fixiyi ne fournit pas de VoIP interne.

---

# 28. OFFRES

Une offre n'est pas simplement un message texte.

Créer un objet métier `Offer` avec notamment : providerId ; requestId ; serviceAmount ; transportAmount ; materialsAmount ; totalAmount ; estimatedDuration ; proposedDate ; proposedTimeWindow ; inclusions ; exclusions ; conditions ; validity ; version ; status.

---

# 29. NÉGOCIATION

Flux :

```
Offer
↓
CounterOffer
↓
CounterOffer
↓
AcceptedOffer
```

Toutes les versions sont conservées.

Après acceptation : le prix devient verrouillé.

Une modification nécessite une nouvelle proposition structurée.

---

# 30. MATÉRIAUX

Le fournisseur peut :

### Option A — Demander au client d'acheter lui-même.

### Option B — Demander l'autorisation d'acheter.

Dans ce cas : Item, Quantity, EstimatedPrice, MaximumAuthorizedAmount, Reason.

Le client doit approuver.

Aucune augmentation silencieuse.

---

# 31. CHANGEMENT DE PÉRIMÈTRE

Si un nouveau problème apparaît pendant l'intervention : `ScopeChangeRequest` avec problème découvert ; justification ; preuves ; montant supplémentaire ; matériaux ; délai supplémentaire.

Le client doit accepter avant l'application du nouveau montant, sauf règles d'urgence explicitement configurées.

---

# 32. INTERVENTION

State machine obligatoire :

```
DRAFT
REQUESTED
MATCHING
PROVIDER_RESPONDED
NEGOTIATING
PRICE_AGREED
CONFIRMED
TECHNICIAN_ON_WAY
ARRIVED
IN_PROGRESS
PAUSED
COMPLETED
PAID
REVIEWED
CANCELLED
DISPUTED
NO_SHOW
EXPIRED
```

Les transitions doivent être contrôlées par un State Machine Service.

Aucune transition arbitraire depuis le frontend.

---

# 33. RENDEZ-VOUS

Support : intervention immédiate ; intervention urgente ; rendez-vous planifié ; proposition d'un autre créneau ; rappel ; retard ; report ; absence.

Séparer : `InterventionStatus`, `AppointmentStatus`, `PaymentStatus`, `ProviderAvailability`.

---

# 34. ANNULATION

Créer un Cancellation Policy Engine.

Les règles dépendent de : qui annule ; moment ; statut ; urgence ; fournisseur en route ; no-show ; historique ; motif ; circonstances exceptionnelles.

Toute annulation importante doit être enregistrée avec : actor, timestamp, reason, category, evidence, result.

---

# 35. RISK & TRUST ENGINE

Détecter : annulations répétées ; no-show ; comportements abusifs ; fraude ; faux avis ; manipulation ; contournement ; comportement anormal ; conflits récurrents.

Sanctions progressives possibles :

```
WARNING
LIMITATION
TEMPORARY_BLOCK
SUSPENSION
MANUAL_REVIEW
```

Ne jamais appliquer automatiquement une sanction irréversible sans possibilité de revue lorsque le contexte le justifie.

---

# 36. AVIS

Avis uniquement liés à de vraies interventions.

Support : note globale ; qualité ; ponctualité ; communication ; respect du prix ; satisfaction ; commentaire.

Prévenir : faux avis ; échanges d'avis ; représailles ; manipulation.

Les nouveaux fournisseurs ne doivent pas être considérés comme mauvais simplement parce qu'ils ont zéro avis.

---

# 37. PAIEMENT

Le client peut payer : cash ; online.

Le système doit être compatible avec différents payment providers.

Créer : `PaymentProvider`, `PaymentService`, `PaymentIntent`, `PaymentTransaction`, `PaymentSettlement`, `RefundService`.

Ne pas hardcoder un fournisseur de paiement.

Créer au minimum : sandbox adapter ; production adapter architecture.

---

# 38. WALLET FOURNISSEUR

Le fournisseur ne paie pas un abonnement mensuel.

Il recharge un solde.

Exemple :

```
Provider Wallet +500 MAD
Après intervention :
Service = 300 MAD
Commission = 10%
Commission = 30 MAD
Wallet = 470 MAD
```

Le pourcentage doit être configurable.

---

# 39. WALLET — INTÉGRITÉ FINANCIÈRE

Toutes les transactions financières doivent utiliser : integer minor units ; jamais de floating point ; ledger immuable ; transaction ID ; idempotency key ; timestamp UTC ; actor ; reason ; reference entity.

Créer : `Wallet`, `WalletTransaction`, `WalletTopUp`, `Commission`, `CommissionSettlement`, `Payment`, `Refund`, `Adjustment`.

---

# 40. RÉSERVATION DE COMMISSION

Lorsqu'une intervention est confirmée, le système peut réserver la commission prévue.

Si le wallet disponible est insuffisant : empêcher la confirmation lorsque la règle métier l'exige ; afficher clairement le montant nécessaire ; proposer recharge.

La réservation doit empêcher les courses concurrentes de dépasser le solde.

---

# 41. COMMISSION

La commission est configurable : percentage ; fixedAmount ; minimum ; maximum ; category ; providerType ; country ; zone ; promotion.

Le moteur de commission doit être indépendant du frontend.

---

# 42. ARGENT

Toutes les sommes doivent être représentées en `integer minor units`.

Exemple : `300 MAD = 30000 centimes` ou équivalent cohérent.

Jamais `price: 300.55` comme valeur financière primaire.

---

# 43. IDENTIFIANTS

Utiliser des identifiants distribués robustes, idéalement `UUIDv7` ou équivalent temporellement ordonné.

Les IDs publics ne doivent pas exposer de séquences faciles à énumérer.

---

# 44. TEMPS

Stocker les dates en UTC.

Convertir uniquement au niveau présentation.

Tous les événements doivent avoir `createdAt`, `updatedAt` et lorsque pertinent : `occurredAt`, `scheduledAt`, `completedAt`.

---

# 45. OFFLINE

Mode offline limité.

Peut conserver : informations intervention ; dernier itinéraire ; informations essentielles ; actions non critiques ; messages en attente.

Les opérations critiques nécessitent validation serveur : paiement ; prix final ; wallet ; changement de statut critique ; acceptation d'offre.

Utiliser : idempotency ; queue locale ; conflict resolution ; timestamps serveur.

---

# 46. MÉDIAS

Stockage objet compatible S3.

Architecture : `ProfileMedia`, `InterventionMedia`, `ChatMedia`, `VerificationDocuments`, `DisputeEvidence`.

Les documents sensibles doivent être isolés logiquement.

Upload : `CreateUploadSession → SignedUpload → ObjectStorage → Scan → Process → Finalize`.

Contrôles : MIME ; extension ; taille ; signature ; malware ; compression ; thumbnails ; EXIF ; permissions.

---

# 47. URLS SIGNÉES

Les fichiers privés ne doivent jamais être servis via URL publique permanente.

Utiliser `short-lived signed URLs` avec durée adaptée au contexte.

---

# 48. NOTIFICATIONS

Push obligatoire pour événements importants.

Canaux possibles : push ; email ; SMS ; autres fournisseurs futurs.

Notification architecture : `NotificationService`, `NotificationPreference`, `NotificationTemplate`, `NotificationDelivery`.

Chaque notification possède un état : CREATED, QUEUED, SENT, DELIVERED, READ, FAILED.

---

# 49. REALTIME

WebSocket principal.

Utiliser Socket.IO ou équivalent.

Événements : chat ; typing ; offers ; status ; intervention ; provider availability ; location ; notifications.

Le WebSocket n'est jamais la source de vérité.

La base de données reste la source de vérité.

---

# 50. RECONNEXION

Le realtime doit supporter : reconnexion ; perte réseau ; reprise ; événements manquants ; idempotence ; déduplication.

---

# 51. BACKEND

Architecture : **Modular Monolith**

Modules : auth, identity, users, profiles, providers, companies, verification, service-catalog, requests, matching, offers, negotiation, appointments, interventions, chat, media, geo, location, payments, wallet, commissions, reviews, reputation, notifications, ai, risk, trust, disputes, search, admin, audit, analytics.

Chaque module possède ses propres boundaries.

---

# 52. STACK BACKEND

Stack cible : Node.js, TypeScript, NestJS, Fastify adapter, MongoDB, Redis, BullMQ, Socket.IO, Zod, OpenAPI.

Utiliser les versions stables compatibles au moment de l'implémentation.

Ne pas figer arbitrairement des versions obsolètes.

Le lockfile doit contenir les versions réellement utilisées.

---

# 53. DATABASE

Base principale : **MongoDB**

Utiliser : indexes ; geospatial indexes ; transactions lorsque nécessaire ; optimistic concurrency ; unique constraints ; schema validation ; repository pattern.

MongoDB ne doit pas devenir un simple stockage sans règles.

---

# 54. REPOSITORIES

Le domaine ne doit pas dépendre directement de MongoDB.

```
Domain
 ↓
Repository Interface
 ↓
Infrastructure Repository
 ↓
MongoDB
```

---

# 55. INDEXES

Prévoir notamment : user phone ; email ; provider status ; provider skills ; provider zones ; geospatial location ; request status ; intervention status ; offer requestId ; chat conversation ; messages conversationId + createdAt ; wallet providerId ; transaction providerId + createdAt ; verification status ; audit actor + timestamp ; notification userId + createdAt.

Les indexes doivent être justifiés et testés.

---

# 56. EVENTS

Architecture event-driven hybride.

Synchrone : paiement ; wallet ; commission ; prix final ; permissions ; state transitions critiques.

Asynchrone : notifications ; matching secondaire ; recherche ; AI jobs ; media processing ; analytics ; risk analysis.

---

# 57. OUTBOX PATTERN

Implémenter :

```
Business Transaction
↓
Database Change + Outbox Event
↓
Worker
↓
Queue
↓
Consumer
```

Éviter les événements perdus.

Tous les consumers doivent être idempotents.

---

# 58. QUEUES

Redis + BullMQ initialement.

Queues possibles : notifications, matching, ai, media, search-indexing, risk, analytics, cleanup.

Chaque job doit avoir : retry ; exponential backoff ; idempotency ; dead-letter strategy ; observability.

---

# 59. CACHE

Redis peut être utilisé comme cache.

Mais : **Redis n'est jamais la source de vérité financière.**

Ne pas mettre wallet/prix final uniquement dans le cache.

---

# 60. SEARCH

Créer : `SearchService`, `SearchProvider`.

Support : texte ; filtres ; recherche naturelle ; catégories ; compétences ; fournisseurs ; back-office.

La base transactionnelle reste la source de vérité.

Le moteur de recherche est une projection.

---

# 61. API

API principale : REST `/api/v1`.

OpenAPI obligatoire.

Chaque endpoint doit définir : request ; response ; auth ; permissions ; errors ; pagination ; validation.

---

# 62. API ERROR FORMAT

Utiliser un format standardisé de type Problem Details.

Exemple conceptuel :

```json
{
  "type": "...",
  "title": "...",
  "status": 409,
  "code": "OFFER_ALREADY_ACCEPTED",
  "detail": "...",
  "traceId": "..."
}
```

Ne jamais renvoyer des stack traces au client.

---

# 63. PAGINATION

Utiliser principalement `cursor-based pagination` pour les listes importantes : messages ; interventions ; transactions ; notifications ; providers ; audit logs.

---

# 64. IDEMPOTENCY

Toutes les opérations financières ou critiques doivent supporter `Idempotency-Key`.

Exemples : top-up ; payment ; accept offer ; create intervention ; cancel ; confirm appointment.

---

# 65. CONCURRENCY

Utiliser : optimistic locking ; version ; transactions ; atomic updates ; idempotency.

Exemple : deux utilisateurs ne doivent jamais pouvoir accepter simultanément deux offres incompatibles.

---

# 66. RBAC

Créer un système de permissions granulaire.

Rôles : CLIENT, PROVIDER, COMPANY_MEMBER, SUPPORT, VERIFICATION_AGENT, MODERATOR, DISPUTE_AGENT, FINANCE_AGENT, MANAGER, ADMIN, SUPER_ADMIN.

Les rôles ne suffisent pas.

---

# 67. ABAC / RESOURCE AUTHORIZATION

Les permissions doivent également vérifier : propriétaire ; participant ; entreprise ; intervention ; zone ; statut ; relation ; contexte ; sensibilité.

Exemple : un fournisseur ne peut voir l'adresse exacte que s'il est le fournisseur autorisé de l'intervention concernée.

---

# 68. AUTHENTIFICATION

Authentification principale : Phone OTP.

Support : email ; vérification email ; sessions ; appareils ; logout ; remote logout ; rotation des refresh tokens ; rate limiting ; OTP abuse protection.

Préparer Google/Apple pour extension future.

---

# 69. WEB AUTH

Pour le web : secure cookies ; HttpOnly ; SameSite ; CSRF protection ; refresh rotation.

Pour mobile : secure device storage ; access token ; refresh token rotation.

---

# 70. ACCOUNT SECURITY

Protéger contre : brute force ; OTP bombing ; credential stuffing ; session hijacking ; token replay ; account takeover ; enumeration.

Ajouter : device/session management ; security events ; rate limits ; suspicious login detection.

---

# 71. ÂGE

Moins de 18 ans : peut utiliser Fixiyi comme client sous les restrictions applicables ; ne peut pas devenir fournisseur.

18+ : client ; fournisseur.

Les règles légales applicables doivent être configurables.

---

# 72. SUPPRESSION COMPTE

Suppression :

```
DELETE REQUESTED
↓
ACCOUNT DEACTIVATED
↓
RECOVERY WINDOW
↓
PERMANENT DELETION
```

Pendant la période de récupération : profil caché ; nouvelles demandes bloquées ; nouvelles interventions bloquées ; marketing arrêté.

Certaines données légales/financières peuvent être conservées selon les obligations applicables.

---

# 73. PRIVACY

Privacy by Design.

Classer les données : PUBLIC, PRIVATE, SENSITIVE, HIGHLY_SENSITIVE.

Les documents d'identité doivent être hautement protégés.

---

# 74. AUDIT

Toutes les actions sensibles doivent produire un audit : actor, action, resource, resourceId, timestamp, before, after, reason, ip, device, traceId.

L'audit ne doit pas être modifiable par les utilisateurs standards.

---

# 75. SECURITY

Protection contre : XSS ; CSRF ; injection ; NoSQL injection ; SSRF ; path traversal ; malicious upload ; brute force ; rate abuse ; websocket abuse ; privilege escalation ; insecure direct object references ; broken access control ; replay ; race conditions.

Appliquer OWASP ASVS comme référence technique.

---

# 76. SECRET MANAGEMENT

Aucun secret dans Git.

Utiliser `.env.example` avec : DATABASE_URL, REDIS_URL, JWT_SECRET, SMS_PROVIDER_KEY, EMAIL_PROVIDER_KEY, STORAGE_ACCESS_KEY, STORAGE_SECRET, AI_PROVIDER_KEY, PAYMENT_PROVIDER_KEY, MAP_PROVIDER_KEY.

Ne jamais remplir `.env.example` avec de vrais secrets.

---

# 77. FRONTEND WEB

Stack cible : Next.js, React, TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Zod, Zustand.

Utiliser la version stable compatible au moment de l'implémentation.

---

# 78. MOBILE

Préparer une vraie application mobile : Expo, React Native, TypeScript, Expo Router.

Avec : GPS ; caméra ; fichiers ; notifications push ; offline ; secure storage ; realtime.

---

# 79. MONOREPO

Utiliser : pnpm, Turborepo.

Structure cible :

```
fixiyi/
├── apps/
│   ├── web/
│   ├── mobile/
│   ├── admin/
│   ├── api/
│   └── worker/
├── packages/
│   ├── contracts/
│   ├── design-tokens/
│   ├── i18n/
│   ├── config/
│   ├── eslint-config/
│   ├── tsconfig/
│   └── shared-utils/
├── infrastructure/
│   ├── docker/
│   ├── terraform/
│   └── monitoring/
├── docs/
├── scripts/
├── tests/
├── .github/workflows/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

Adapter la structure si le projet existant impose une meilleure organisation, mais conserver les responsabilités.

---

# 80. FRONTEND ARCHITECTURE

Architecture feature/domain oriented.

Séparer : presentation, application, domain, infrastructure.

Ne pas mettre la logique métier critique dans les composants React.

---

# 81. STATE MANAGEMENT

Séparer :

- **Server State** : TanStack Query.
- **Local UI State** : Zustand ou React state.
- **Forms** : React Hook Form + Zod.
- **Realtime** : Realtime synchronization layer.
- **Offline** : Offline queue/cache.
- **Auth** : Auth/session service.

Le backend reste source de vérité.

---

# 82. DESIGN SYSTEM

Créer : **Fixiyi Design System** avec : tokens ; typography ; spacing ; colors ; icons ; buttons ; inputs ; cards ; badges ; modals ; sheets ; maps ; chat ; offers ; prices ; wallet ; status ; rating ; media ; loading ; empty state ; error state ; offline state.

---

# 83. STYLE VISUEL

Inspiration :

### Rapidité — inspirée des applications de livraison.

### Confiance — inspirée des marketplaces de logement.

### Identité Fixiyi — technique ; moderne ; humain ; accessible ; premium sans être intimidant.

Créer une identité originale.

---

# 84. ACCESSIBILITÉ

Objectif : **WCAG 2.2 AA lorsque applicable.**

Support : clavier ; lecteurs d'écran ; contraste ; tailles de texte ; focus visible ; labels ; erreurs accessibles ; RTL ; touch targets ; reduced motion ; navigation simple.

---

# 85. ACCESSIBILITÉ SOCIALE

Fixiyi doit fonctionner pour : personnes très à l'aise avec les applications ; personnes peu habituées aux applications ; utilisateurs ne connaissant pas les termes techniques ; utilisateurs parlant surtout darija ; utilisateurs arabophones ; utilisateurs francophones.

Ne jamais utiliser uniquement un jargon technique.

---

# 86. NAVIGATION

### Client : Accueil, Demandes, Messages, Favoris, Profil.

### Fournisseur : Accueil, Demandes, Interventions, Wallet, Profil.

### Entreprise : Ajouter Équipe, Entreprise.

Navigation contextuelle.

---

# 87. HOME CLIENT

Priorité :

```
Décrire mon problème avec l'IA
Choisir un service
```

Puis : demandes récentes ; intervention actuelle ; recommandations ; fournisseurs favoris.

---

# 88. HOME FOURNISSEUR

Afficher : disponibilité ; demandes pertinentes ; interventions ; revenus ; wallet ; notifications ; statistiques utiles.

---

# 89. BACK OFFICE

Interface desktop professionnelle.

Modules : Dashboard, Users, Providers, Companies, Verification, Requests, Interventions, Offers, Payments, Wallets, Commissions, Reviews, Disputes, Risk, Moderation, Notifications, Service Catalog, Geo Configuration, AI Monitoring, Audit, System Configuration.

---

# 90. ADMIN PERMISSIONS

Le back-office doit utiliser des permissions granulaires.

Exemple : `verification.read`, `verification.approve`, `verification.reject`, `finance.read`, `finance.adjust`, `dispute.read`, `dispute.resolve`, `catalog.write`, `risk.review`, `audit.read`.

Un agent support ne doit pas automatiquement accéder aux données financières sensibles.

---

# 91. MOBILE GPS

La localisation doit être optimisée pour : batterie ; précision ; réseau ; confidentialité.

Ne jamais tracker continuellement un fournisseur sans nécessité métier.

---

# 92. PERFORMANCE

Objectifs : lazy loading ; code splitting ; image optimization ; compression ; CDN ; caching ; pagination ; virtualisation ; indexes DB ; background jobs ; batch processing.

---

# 93. OBSERVABILITY

Implémenter : structured logs ; metrics ; traces ; correlation IDs ; health checks ; readiness ; liveness ; error tracking.

Utiliser OpenTelemetry lorsque pertinent.

---

# 94. LOGGING

Ne jamais logger : OTP ; passwords ; tokens ; carte bancaire ; documents d'identité ; données sensibles inutiles.

Logs structurés JSON en production.

---

# 95. ANALYTICS

Préparer analytics : acquisition ; activation ; demande ; matching ; réponse ; conversion ; intervention ; paiement ; cancellation ; retention ; provider activity.

Les analytics ne doivent pas contenir inutilement de PII.

---

# 96. FEATURE FLAGS

Créer un système de feature flags pour : IA ; nouveau matching ; paiement online ; nouveaux services ; nouvelles langues ; nouvelles fonctionnalités.

---

# 97. CONFIGURATION

Toute configuration métier importante doit être administrable.

Exemples : commissions ; rayon ; transport ; seuils ; catégories ; services ; urgence ; règles de cancellation ; wallet minimum ; matching ; notifications ; vérification ; feature flags.

Ne pas hardcoder ces règles dans les composants frontend.

---

# 98. DATA MODEL PRINCIPAL

Créer au minimum les agrégats suivants :

```
User, UserSession, Device, UserRole

ProviderProfile, ProviderSkill, ProviderService, ProviderAvailability, ProviderServiceArea

Company, CompanyMember, CompanyVerification

VerificationCase, VerificationDocument, VerificationDecision

ServiceDomain, ServiceCategory, Service, InterventionType, Complexity, Skill

ServiceRequest, RequestMedia, RequestLocation

Match, MatchCandidate, DispatchBatch

Conversation, Message, MessageAttachment

Offer, OfferVersion, CounterOffer

Appointment, Intervention

ScopeChangeRequest, MaterialRequest

Payment, PaymentTransaction, PaymentSettlement, Refund

Wallet, WalletTransaction, WalletTopUp, Commission, CommissionReservation

Review, ReviewDimension, ReputationSnapshot

Cancellation, Dispute, DisputeEvidence

RiskCase, RiskSignal, RiskAction

Notification, NotificationPreference, NotificationDelivery

AuditLog, OutboxEvent

AIConversation, AIMessage, AIToolCall, AITrace, AIEstimate

FeatureFlag, SystemConfiguration
```

---

# 99. CORE DATA RULE

Chaque document doit avoir : id, createdAt, updatedAt, version lorsque pertinent.

Ne pas créer un énorme document MongoDB contenant tout le cycle de vie.

Utiliser des agrégats cohérents.

---

FIN DE LA SPEC PRODUIT

La suite de la spec (sections 100+) est dans 02_SPEC_ENGINEERING.md.