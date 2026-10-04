# Admin — accès protégé

## Résumé

Application Admin destinée aux équipes CoverView, avec `admin.coverview.ch` comme sous-domaine cible. Le compte donne accès à la gestion des utilisateurs, de leurs profils et de leurs documents, avec autorisation administrative et MFA côté serveur.

`/partner` ouvre les compteurs du réseau et les liens vers la supervision des candidatures et le pipeline global de [Partner](../partners/README.md), sous les mêmes contrôles administratifs. État partiel et limites : [ledger](../../roadmap/evidence/partner-core.md).

`/partner/continuity` configure l'acceptation et le calendrier des prochaines attributions, avec motif obligatoire et historique des vingt dernières versions dans un panneau. Les règles serveur et les échéances figées sont décrites dans le [module Partner](../api/src/modules/partner-workspace/README.md#paramètres-et-calendrier-de-continuité--relais-fb54). Cache privé par utilisateur/session, actualisation explicite pour préserver la saisie, conflit de révision sans écrasement. Types/build vérifiés ; le compte réel disponible reste refusé, formulaire opérationnel non vérifié en navigateur.

## Périmètre

`/` et `/account` ouvrent le même parcours d’accès à Admin. L’action de connexion et les erreurs arrivent avant les explications secondaires sur mobile. La navigation produit expose Utilisateurs et Mon accès Admin, sans diagnostics ni données de démonstration.

`/users` recherche les comptes applicatifs par nom ou e-mail et remplace les pages de vingt résultats. `/users/$userId` ouvre leur dossier : `profile` et `tab` dans l’URL sélectionnent explicitement le titulaire, une personne ou une société, puis Générales, Finances, Santé ou Documents. L’ajout d’un profil ouvre un dialogue ; aucun compte de connexion, droit familial ou pouvoir de signature n’est créé implicitement. Les champs des sections sont facultatifs et validés par les contrats partagés. Générales du titulaire conserve son stockage canonique dans identity, sans confirmation ni choix de consentement à sa place. Une saisie non enregistrée bloque la navigation avec enregistrer/abandonner/rester ; un conflit conserve les corrections jusqu’au rechargement explicite de la dernière révision.

Documents conserve chaque original sur le profil sélectionné. Un panneau permet le dépôt et la lecture facultative, avec information sur le traitement externe et l’autocomplétion des seuls champs vides. Une création acceptée actualise immédiatement la bibliothèque pour permettre de reprendre un transfert interrompu. Le détail ouvre un autre panneau : traitement réel, téléchargement autorisé par le serveur, sources des champs extraits et reprise explicite d’une lecture. Les traitements en cours sont relus toutes les cinq secondes ; une erreur suspend cette relève automatique. Les corrections restent accessibles dans Générales. Les fichiers, états de traitement et règles d’autocomplétion appartiennent au [module documentaire](../api/src/modules/document-intelligence/README.md).

`/preview`, `/states` et `/diagnostics` restent accessibles uniquement par leur adresse directe en développement : profils fictifs locaux, démonstration explicite des états UI et santé de l’API. Les profils viennent de l’API ; leur sélection est un état React local qui ne crée aucune session. Navigation et détails sur des pages séparées, conformément à FRONT-14.

`/account` demande l’identité puis l’autorisation administrative au serveur. Un refus reste un refus, même si le navigateur déclare un rôle. L’exigence MFA ouvre `/mfa` : démarrage d’un challenge, code à six chiffres de l’application d’authentification, puis relecture de la session et de l’accès après rotation serveur. Un facteur absent mène à `/authenticator`, également accessible depuis le compte sans permission administrative. Un code refusé exige un nouveau challenge.

L’état et l’action d’accès équipe précèdent le lien secondaire vers l’application Authenticator. Les aides à la connexion et à la reconnexion indiquent le choix du code email chez WorkOS ; aucun mot de passe n’est nécessaire pour cette méthode. Le titre Authenticator reste valable après confirmation, sans suggérer de recommencer l’inscription.

`/authenticator` permet au titulaire de démarrer personnellement l’inscription WorkOS, scanner le QR et confirmer son code. La page ne crée aucun facteur à son ouverture. QR et code restent dans l’état local du composant, sans cache TanStack ni stockage navigateur, puis sont effacés à expiration ou sortie. La confirmation de l’inscription ne constitue ni une attribution administrative ni la preuve MFA de `/mfa`. La reprise du même facteur et l’annulation explicite d’une inscription inachevée sont pilotées par l’état serveur ; l’annulation ouvre `/authenticator/cancel`. Les résultats distants incertains restent indiqués sans faux succès.

## Règles métier et invariants

L’onglet Santé est masqué pour les sociétés ; un ancien lien vers cette rubrique revient à Générales pour le même profil.

La présentation utilise le système commun xAI de [UI](../../packages/ui/README.md), conformément à ADR-0007. Le layout de compte partagé reçoit uniquement des textes et icônes ; les décisions d’identité restent dans cette app. Compte, formulaire MFA, déconnexion et états sont des sections ouvertes sans card.

Texte français externalisé dans `src/locales/fr/common.json` et `users.json`. Aucun credential PostgreSQL, aucune lecture DB, room ou job. Réseau via `@coverview/api-client` uniquement. Santé et personas utilisent un cache TanStack Query frais 15 secondes, collecté après une minute. L’identité se vérifie à chaque montage/focus ; les données privées sont masquées pendant cette vérification. Le cache privé, borné à identité/session puis utilisateur/profil pour la gestion, est périmé immédiatement et supprimé sans observateur, au changement de session, au refus d’authentification et à la déconnexion. Les requêtes sont annulées avant retrait, y compris l’identité lors du logout ; aucun retry automatique de mutation.

La frontière Admin relit `/identity/admin` et masque les panneaux avec le reste du dossier pendant la revalidation. Les portails de dialogues, menus et panneaux restent dans cette frontière privée. Les composants sont remontés lors du changement d’utilisateur/profil, ce qui évite de transférer un fichier ou une saisie au dossier suivant. Les commandes conservent leur clé d’idempotence tant que la demande reste identique ; elles sont annulées au démontage. Un refus d’habilitation/MFA déclenche une nouvelle vérification de l’accès ; la protection de saisie n’empêche pas la reconnexion.

Les commandes CSRF et idempotence restent en mémoire. Dès la demande de logout, le profil disparaît et la commande est conservée hors du parcours privé. Une réponse perdue laisse le résultat à confirmer ; une réponse pending confirme la fermeture locale et permet la reprise distante. Recharger/fermer la page abandonne ce contexte de reprise sans prouver l’état distant. Pendant une simple revalidation de la même session, le formulaire MFA reste monté mais masqué/inactif ; le challenge et le code restent utilisables au retour d’un authentificateur. Source du socle : [API platform](../api/src/platform/README.md).

## Permissions

`/configuration/comparateur-maladie` est la configuration privée du comparateur : règles et catalogue versionnés, préparation de retour arrière, simulateur de profils fictifs, couverture documentaire, dossiers opérateur avec responsable/historique et exports JSON/CSV/rapport. Chaque route serveur exige l’habilitation administrative et MFA ; CSRF, révision et idempotence protègent les modifications. Les preuves et limites réelles sont détaillées dans le [module de recommandation](../api/src/modules/health-insurance/recommendation.md). Aucun profil de santé n’est enregistré par ce simulateur.

`/service-requests` est le kanban des mises à jour demandées dans le Centre d’action Wallet. Il utilise la même frontière Admin+MFA, les portails privés, l’audit des lectures et commandes, révisions et idempotence. Les cartes figent compte, profil, compagnie et coordonnées demandées. Une transmission ou confirmation exige date effective et référence de preuve ; une tâche créée ne prouve pas l’envoi. Les demandes devenues obsolètes après modification du profil sont identifiées. Aucun email n’est envoyé automatiquement depuis cet écran. [Contrats et conservation](../api/src/modules/document-intelligence/README.md#revue-simplifiée-et-centre-daction--demande-du-9-septembre).

Le nom `admin` n’accorde aucun droit. Seul le serveur confirme une habilitation explicite et une preuve MFA valide ; aucune permission du DTO `/me` ne remplace `/identity/admin`. L’API décide aussi de l’exposition locale des fixtures. Les routes d’exemples sont désactivées hors build de développement. Une configuration d’identité désactivée présente une connexion indisponible.

## État réel

Parcours d’identité, d’inscription Authenticator et d’accès équipe avec MFA vérifiés avec WorkOS réel en local ; attribution nominative et refus du compte ordinaire consignés dans le [ledger S-000b](../../roadmap/evidence/S-000b.md). Gestion des utilisateurs implémentée dans [l’extension S-042a](../../roadmap/plans/S-042a-admin-users.plan.md) : types, lint et build Admin vérifiés ; les preuves de parcours réel restent à consigner par la recette de cette extension. Les écrans d’exemple isolés conservent leur caractère fictif et ne constituent pas les preuves de cette recette.

## Développement et dépendances

`pnpm --filter admin dev` écoute sur `127.0.0.1:4102`, port strict. `build` produit un bundle Vite indépendant ; `typecheck` applique TypeScript strict. `VITE_API_URL` optionnelle : API locale en développement, origine de la page en build. Une API déployée séparément exige sa propre origine explicite.

Stack et provenance partagées avec [Wallet](../client/README.md#développement-et-dépendances) ; composants et preset dans [UI](../../packages/ui/README.md). Les pages, routes, catalogues et état local restent propres à cette application (ARCH-13).

Les formulaires utilisent la stack imposée react-hook-form, resolver Zod et schémas partagés dans `@coverview/contracts`. Le champ MFA natif utilise les tokens existants, un label, l’autocomplétion OTP, un focus initial et des erreurs accessibles. Les pages Utilisateurs et Dossier se chargent à la navigation. Aucun composant visuel externe ni dépendance ajouté.
