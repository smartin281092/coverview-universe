# Reprise de travail — S-000b callback réel puis programme

Créé : 2026-09-06
Contexte observé : non disponible ; nouveau contexte explicitement autorisé, aucun seuil prétendu.

## Mission et autorisation

Dernière demande utilisateur : « Identifie la cause et corrige là. Lance une nouvelle session si besoin pour vider le context et lorsque c'est fait et fonctionnel et que tu peux reprendre le développement complet des slices du projet chacune dans des nouvelles session en Astra Ultra ». Cette nouvelle tâche est propriétaire du diagnostic et de la réparation S-000b ; après preuves réelles suffisantes, reprendre le programme selon execution-policy, une nouvelle tâche gpt-6-astra / ultra par slice, sans GO répété. Ne pas déclarer S-000b done pour débloquer artificiellement le programme.

## État du dépôt

Deux branches à préserver et réconcilier : source de cette reprise `C:/Users/sebm1/.codex/worktrees/9b02/coverview-astra`, branche `codex/s-011-editorial`, commit de preuves `fbc1c79` ; checkout enregistré `D:/Projects/coverview-astra`, main propre à `d6461fb`. Base commune `bdef821733c1c714d50d7712b19562bfe26837f7`. Le commit ultérieur qui contient ce checkpoint sera fourni par le prompt de lancement.

Main contient des changements utilisateur ultérieurs : a1f958f (compte réel/activation), f8e1e07 (design blanc), 0a3dad9 (référence xAI), d6461fb (preset Geist/Montech). NE PAS remplacer ces interfaces par la version ancienne de 9b02. Les trois commits propres à 9b02 (c2d9b0d, 54bf7b9, fbc1c79) sont des preuves/runbooks/roadmap, sans correction applicative. Le worktree 4133 est propre à d6461fb, tâche correspondante idle. Aucun fast-forward main possible entre ces branches divergentes : ne pas reset, stash ou écraser. La nouvelle tâche part par défaut de main ; lire ce checkpoint par son chemin absolu puis récupérer/fusionner les commits locaux de preuves en préservant l’état plus récent de main et en régénérant les vues. Vérifier les ascendances réelles avant mutation.

## Sources à lire

AGENTS → CLAUDE, PROJECT, docs/codex, MEMORY actives ; plan/prompt et ledger S-000b (la version de 9b02 contient les observations actuelles), README identity, auth/security/permissions/environment/testing/backend selon le changement. Lire aussi execution-policy de main et son checkpoint `roadmap/handoffs/S-000b-recovery.md` : demande de vrais parcours, pas d’accumulation de simulations pour prétendre livrer. S-011-review décrit l’éditorial mais ses anciens constats WorkOS ont été remplacés par les observations ci-dessous.

## Décisions acquises

Projet WorkOS coverview, LocalHost / Staging, environnement `environment_01M1KCQBWNWDZKZNVW9R0GH4YM`, application `app_01M1KCQCGN17F8C337FYNTX6M8`, client `client_01M1KCQC9R4RDXEECM62JEZB0V`. Dashboard dans Chrome déjà authentifié. Domaine AuthKit `exquisite-theory-35-localhost.authkit.app`.

Redirect URI enregistré et identique au code : `http://127.0.0.1:4100/auth/callback`. Homepage corrigée/enregistrée `http://127.0.0.1:4103`. Magic Auth activé, MFA Optional enregistré et relu. Initiate-login/signout/signup/invitation/reset URLs vides ; cela ne prouve pas la cause du callback après login démarré dans Wallet. Discovery OIDC public confirme issuer `https://api.workos.com/user_management/client_01M1KCQC9R4RDXEECM62JEZB0V` ; default générique `https://api.workos.com/` est insuffisant.

L’utilisateur a explicitement autorisé tests et emails WorkOS à `sebastien@bmpartners.ch` et `sebastien.martin@hook.sarl`, ainsi que comptes fictifs `.test` et option application Authenticator. Quatre identités ont été créées et vérifiées au dashboard, IDs exacts au ledger de 9b02. Admin/Client .test sont inactifs, non vérifiés ; BMP actif après OTP, Hook créé mais non connecté. Aucun mot de passe ni facteur TOTP n’a été saisi par l’agent, aucune permission admin attribuée. L’utilisateur a proposé un mot de passe commun de preview dans la conversation ; il n’est pas installé. La politique de l’outil navigateur impose l’intervention utilisateur pour un nouveau credential. Ne pas contourner la vérification email des comptes .test. Bénéficiaire admin parmi les deux emails réels demandé mais pas encore désigné ; le nom admin@test n’accorde aucun droit.

## Livraison et preuves

Vérifié avant reprise : API `/health` 200 ready ; `/identity/config` enabled:true ; `/identity/me` anonyme 401. Login Wallet ouvre réellement AuthKit avec le bon client et callback. OTP incorrect refusé ; email réel BMP reçu de `access@workos.dev`, sujet `[STAGING] Sign up for Hook`, puis code accepté. WorkOS affiche BMP Active / compteur1. Ne pas lire/exporter de secrets : recherche email limitée à ces destinataires et messages du test ; OTP manipulé seulement en mémoire et masqué dans les sorties.

ÉCHEC réel : après OTP, retour à `http://127.0.0.1:4101/account?authError=callback`, interface « connexion n’a pas abouti ». SQL local compte zéro identity_users et identity_sessions. Dans identity.service.callback, ce retour est produit APRÈS consommation de la transaction navigateur/state, dans le catch couvrant échange du code, validation token/session fournisseur, réconciliation et création locale. Ce n’est pas une preuve d’une clé API valide. La ligne terminal `Identity callback failed` avec son code a été demandée à l’utilisateur, sans réponse : ne pas rester dépendant de cette seule demande si un diagnostic borné sans secrets peut être ajouté et testé sur le processus vivant.

Tests préexistants relancés avant OTP : 82/82 applicatifs, fournisseur doublé ; aucun oracle tiers remplacé par ces tests. Migrations additives rejouées avec succès sur coverview-s000b. Dernières recherches officielles : https://workos.com/docs/reference/authkit/authentication/get-authorization-url ; callback requis exact, initiate-login pour flux initiés hors app. SDK officiel installé @workos-inc/node ; vérifier son code réel, pas de remplacement de protocole ad hoc.

## Prochaine action bornée

1. Réconcilier sources/main et preuves, identifier exactement le processus API vivant et son répertoire de code sans lire ses secrets. Préserver les dernières UI. Le processus lancé par l’utilisateur vise 9b02 d’après la procédure, tandis que client/admin proviennent d’une preview 4133 ; vérifier cet état, ne pas le supposer. Un worktree neuf ne transporte pas l’environnement du terminal API.
2. Reproduire et identifier la phase et la cause précises de l’échec. Utiliser diagnostics bornés et expurgés (pas d’erreur fournisseur brute, JWT, code, cookie, clé ou environnement complet). La configuration chargée et la valeur attendue d’issuer doivent être comparées sans sortir les secrets. Corriger le plus petit changement cohérent, avec preuve de régression pertinente, puis rejouer le vrai parcours. Ne pas multiplier les emails/essais à l’identique après deux échecs.
3. Une correction dans le nouveau worktree n’affectera PAS automatiquement l’API qui tourne sur 9b02. Organiser le transfert du code testé vers le checkout utilisé par ce processus, sans écrasement, ou un redémarrage par l’opérateur dans son terminal existant. Le watcher Node peut recharger des fichiers en gardant l’environnement ; ne pas tuer le terminal/superviseur qui détient les secrets.
4. Vérifier retour privé/persistance, second compte isolé, continuité www/Wallet, refus, appareils/logout/révocation réels et MFA admin selon les préconditions. Autorisation des comptes ne remplace pas désignation d’une permission ni inscription authenticator utilisateur.
5. Quand S-000b est réellement done, recalculer prochaine slice éligible, commit/checkpoint/préservation puis CRÉER effectivement sa nouvelle tâche gpt-6-astra/ultra. Ordre contact cohérent : S-013 → S-080 (CRM canonique) → reste S-011 → S-012 ; aucune boucle S-012 avant S-011. La bio/source Instagram validées de S-011 manquent encore, ne pas inventer. Continuer toute slice indépendante éligible.

## Obstacles et tentatives

L’ancien conflit Docker était coverview-s011 versus coverview-s000b sur 55432. Réutiliser les services s000b sains ; ne pas lancer un autre compose sur les mêmes ports. L’ancienne API AUTH_ENABLED=false du superviseur 4133 a été arrêtée via son canal de contrôle puis remplacée par l’API utilisateur activée.

PowerShell utilisateur a supprimé les guillemets de node -e ; génération secret via .NET RNG fonctionne. Il lançait pnpm depuis son home et avec une autre version : procédure corrigée cwd9b02 + toolchain. Runtime utilisable `C:/Users/sebm1/.codex/worktrees/10c1/coverview-astra/.planning-local/node-v24.20.0-win-x64/node.exe` et `toolchain/node_modules/pnpm/pnpm.exe`. Pas de pnpm.cjs dans cette distribution. Nouveau worktree : installer dépendances frozen et configuration factice autorisée, jamais secrets dans .env.

Première saisie OTP après code invalide a conservé des chiffres dans six cases ; vider les cases puis saisir le code a déclenché le retour callback en échec. Second navigateur intégré a ouvert « Invitation non valide » avant saisie email ; cause non étudiée, aucune preuve d’isolation. Chrome est le seul parcours OTP réel éprouvé. Ne pas répéter aveuglément ces essais.

## Coordination

Ancienne tâche 9b02 cesse les écritures après création du relais. Aucun sous-agent actif. Tâche 4133 idle lors de l’inventaire ; ses changements main sont à préserver. API utilisateur port4100 (PID observé37376, à revalider), trois frontends4101/4102/4103 et services coverview-s000b restent actifs. Les secrets sont seulement dans le terminal opérateur et ses processus, pas accessibles à l’environnement des outils. Ne jamais les extraire de la mémoire du processus ni du dashboard. Préserver taliq/growth-codex-prod et tous volumes ; aucun DNS, déploiement, push ou autre infrastructure autorisé par défaut. Les onglets seront redécouverts via CUA ; les IDs et variables REPL ne sont pas portables entre tâches.
