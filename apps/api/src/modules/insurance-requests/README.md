# Demandes d’offre d’assurance maladie

Propriétaire du panier familial et de son traitement, consommés par www, Wallet et Admin. Le catalogue et le calcul des primes appartiennent à [health-insurance](../health-insurance/README.md), l’identité à WorkOS via [identity](../identity/README.md), les dossiers des personnes à [profiles](../profiles/README.md).

## Parcours

Le choix d’accès précède l’email. En invité, seul le brouillon de demande est préparé : aucun appel WorkOS, challenge OTP ou réservation d’envoi. En choisissant Wallet, l’email prépare un utilisateur WorkOS non vérifié via Magic Auth ou retrouve son compte existant. Le code crée ensuite la session CoverView canonique : aucun OTP n’est conservé ni renvoyé au navigateur. Une session canonique déjà connectée avec la même adresse est réutilisée, après vérification serveur ; connaître l’email seul ne suffit jamais. L’envoi indisponible est affiché explicitement et permet de revenir au choix invité. Aucune création de compte de connexion pour les proches : la soumission vérifiée crée un dossier privé par personne du panier, dans la même transaction que la demande. Aucune fusion automatique par nom/email.

Le projet WorkOS doit utiliser l’envoi automatique des emails Magic Auth, et non le mode « custom code » sans transport correspondant. Références officielles contrôlées : [API Magic Auth](https://workos.com/docs/reference/authkit/magic-auth), [distribution des emails](https://workos.com/docs/email). Un succès de création de code ne démontre pas sa réception dans une boîte externe.

Le serveur revalide commune, âge, franchise, accident et modèle sur les primes actives. Prix en centimes, aucun montant envoyé par le client. Le panier accepte 12 personnes. La soumission conserve un instantané, les données utiles de la caisse actuelle et la version des mentions ; elle ne conclut aucun contrat et n’envoie pas automatiquement de demande à un assureur.

Les états sont `submitted → reviewing → insurer_contacted → offer_ready → completed`, ou `cancelled` avant terminaison. L’Admin habilité avec MFA applique chaque transition ; historique daté et commandes avec acteur sont persistés. Le suivi lit la base toutes les 15 secondes quand la page est visible. Aucun événement, room Socket.IO ou job BullMQ supplémentaire ; aucune progression fictive.

## Accès et reprises

Routes `/insurance-requests/{browser,draft,email}`, `/:id/{verify-email,claim,cart,submit}`, `/:id` et liste authentifiée ; listes/détails/transitions administratives sous `/admin/insurance-requests`. Contrats dans le sous-chemin `@coverview/contracts/insurance-requests`, client typé correspondant.

`POST /email` accepte `access: guest | wallet` (défaut `wallet` pour les consommateurs existants). `codeStatus: not_requested` indique le parcours invité ou une session déjà vérifiée ; `verified` reste la preuve serveur indépendante du choix. Le bootstrap renvoie l’adresse du compte de la session courante uniquement, pour proposer « Continuer avec mon Wallet ».

Cookie opaque HttpOnly, SameSite=Lax, Secure et préfixe `__Host-` en HTTPS ; seule son empreinte est stockée. Host, origine, CSRF et clé UUID sont contrôlés sur les mutations. Le cookie invité donne accès au seul navigateur pendant 30 jours ; connaître un identifiant de demande ne suffit pas. La boîte email vérifiée et l’identifiant permettent de rattacher une demande invitée depuis un autre appareil.

Un compte reçoit seulement les personnes dont il possède actuellement le dossier. La projection SQL filtre les demandes **avant pagination**, recalcule les totaux, masque l’email du demandeur et la version de consentement au destinataire d’un transfert. L’Admin conserve le panier original. Les reçus de soumission et de rattachement suivent la même projection.

Sauvegardes avec révision optimiste et clés idempotentes ; soumissions rejouées avant recalcul du catalogue ; transitions ordonnées avec révision et verrou de session/permission. Challenge OTP de 10 minutes, cinq tentatives, réservation par boîte indépendante des changements d’adresse. Les erreurs ne révèlent pas l’existence d’un compte WorkOS.

## Données, maintenance et identité légale

Migrations additives 0021–0023 : demandes, challenges, commandes et réservations email. Une passe bornée à 100 lignes par table, coordonnée par `SKIP LOCKED`, supprime les brouillons après 24 heures et les challenges/réservations expirés. Les commandes d’un brouillon supprimé suivent une cascade. Les demandes soumises ne sont pas effacées par cette maintenance. Une future procédure d’effacement devra traiter les snapshots par personne et révoquer la capacité navigateur ; mettre seulement `user_id` à NULL serait incorrect.

L’identité en vigueur suit la confirmation utilisateur du 3 octobre 2026 dans [PROJECT.md](../../../../../PROJECT.md) : le nom de société remplace la précédente formule de marque. Registre FINMA **F01536662** conservé. Les mentions publiques versionnées sont dans `apps/www/src/content/fr/insurance-legal.ts` et la notice art. 45 réutilise le référentiel existant. La version `insurance-request-2026-10-03` s’applique aux nouvelles soumissions ; les versions des demandes historiques restent intactes. Cette confirmation utilisateur ne constitue pas une validation juridique externe des textes.

Configuration : origines `AUTH_API_ORIGIN`, `AUTH_WWW_ORIGIN`, `AUTH_WALLET_ORIGIN`, `AUTH_ADMIN_ORIGIN`, CORS correspondant ; configuration WorkOS existante pour Magic Auth. Aucune nouvelle variable secrète. Rollback applicatif : revenir au code précédent et conserver les tables, sans suppression des demandes. Les migrations sont reproductibles sur PostgreSQL vide ; aucun reset de la base du projet.

## Vérifier

Raccordement Partner du 2 octobre : la frontière publique `insuranceLeadCandidates` fournit seulement les personnes actuellement possédées, sans email du demandeur ni autres membres du panier. Le [référentiel Partner](../partner-workspace/README.md#demandes-dassurance-existantes--relais-f41b) porte l’accord explicite, le lien unique, la reprise des anciennes demandes et les limites. Submit/claim, cookie invité, projection après transfert et transitions/historique initiaux sont conservés ; aucun traitement Partner ne réécrit la demande source. Les tests PostgreSQL ci-dessous couvrent désormais aussi le raccordement, sa concurrence et le transfert réel via le repository Admin.

`pnpm --filter api test src/platform/insurance-requests.test.ts src/modules/identity/identity.workos.test.ts` utilise PostgreSQL réel isolé et un double HTTP explicite du fournisseur. Ne jamais présenter ces tests comme la preuve d’une livraison d’email WorkOS réelle. Recette et limites : [ledger](../../../../../roadmap/evidence/health-offers.md).

L’[inspection individuelle Partner](../partner-workspace/README.md#inspection-de-la-demande-individuelle--relais-7a52) lit exclusivement la copie autorisée dans partner_insurance_sources. Elle ne relit ni le panier original ni le profil courant ni le catalogue pour reconstruire une preuve historique. Les tests de ce module couvrent immutabilité, transfert réel de profil, confidentialité et révocation ; le parcours Wallet d’origine est conservé.
