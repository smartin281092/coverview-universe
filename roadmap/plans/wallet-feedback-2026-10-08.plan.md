# Retours du 8 octobre 2026 — comparateur et Wallet

Entrée : retours utilisateur du 8 octobre 2026 (captures et console). Mandat PROG-23 : meilleurs défauts consignés, enchaînement sans GO répété. Session réelle : Claude Code, Claude Opus 5.5, effort max.

## Diagnostic

| Retour | Cause établie |
|---|---|
| Listes du volet produit qui ne s'ouvrent pas | `HealthSelect` lit `ref.current` au rendu : `null` au premier rendu, la liste part dans `body`, derrière le `<dialog>` modal (couche supérieure, reste du document inerte) |
| Pincer sans déplacer la carte | `SwissPremiumMap` applique le rapport des distances, jamais le déplacement du point milieu |
| Lecture IA interrompue | OpenAI rend `incomplete` : plafond de sortie de 6000 jetons, raisonnement compris (corrigé, `925483e`) |
| 503 dans la console | Vérification de session WorkOS au-delà de 3 s (`IDENTITY_UNAVAILABLE`), sans lien avec la lecture IA |
| « No queryFn » sur `["identity","me"]` | Deux lectures passives sans fonction de requête (`use-action-count.ts`, `WalletProfileSwitcher.tsx`) |
| Menus visibles déconnecté | La coque Wallet n'interroge jamais l'identité ; Partner affiche un état nu sans cadre |

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| W-1 | Comment stocker le sujet d'une demande ? | Colonne `request_kind` (nouvelle assurance, modification, question, annulation, sinistre), « nouvelle assurance » par défaut. Hors nouvelle assurance, catégorie « autre ». Partner affiche le sujet. | Parcours décrit par l'utilisateur ; aucun sujet n'existe dans les contrats |
| W-2 | Que liste la page Offres ? | Les offres publiées par le courtier, avec leur document, regroupées par objet (même objet et même catégorie = un bloc) ; une lecture serveur dédiée, bornée. | « Cette page ne doit que lister les offres (avec document) transmis par le courtier » |
| W-3 | Que garde la fenêtre d'une demande ? | Conseiller, complément demandé, offres et leurs actions, contrat actuel. Le reste passe dans un seul menu « Autres actions » ; le bloc référent sort de la fenêtre. | « Enlever et cacher tout ce qui est superflu » |
| W-4 | Où vont les boutons retirés d'Offres ? | Page Demandes : « Nouvelle demande » en action principale ; notifications, référents habituels et coordination des rendez-vous dans un menu secondaire. « Reprendre une demande du comparateur » disparaît : la page les liste déjà. | Les fonctions restent atteignables, sans encombrer Offres |
| W-5 | Que montre la page Demandes ? | Les demandes Wallet et les demandes du comparateur. | Une demande créée doit rester visible |
| W-6 | Quels CTA ? | Ceux du comparateur : principal en dégradé bleu nuit, secondaire blanc bordé, rayon 10 px. Sans le calque WebGL décoratif, trop coûteux répété sur chaque bouton. | « Les CTA doivent être identiques » |
| W-7 | Quelles listes déroulantes ? | Le `Select` partagé du menu partout dans les fenêtres Wallet. | Règle générale demandée |
| W-8 | Autorisation de transmission ? | Implicite à l'envoi ; la case disparaît. | « Ça coule de source » |
| W-9 | Que voit-on après l’envoi d’une demande ? | Un écran de confirmation seul : badge vert animé avec confettis (Lottie `SuccessCheck` dans `@coverview/ui`, lecteur déjà présent, chargé à la demande), le message en grand et « Fermer ». La fenêtre de la demande ne s’ouvre plus. Mouvement réduit : image finale, sans confettis. « délais » au pluriel. | Retour du 8 octobre, capture de la fenêtre ouverte après l’envoi |
| W-10 | Comment présenter Demandes ? | Une seule liste, de la plus récente à la plus ancienne, sans séparer Wallet et comparateur. Les deux sources restent paginées : un élément attend la page suivante quand une demande plus récente peut encore y figurer ; « Afficher plus » charge la suite. | « Ne pas faire de séparation » |

## Definition of Done — oracles

- [x] Comparateur : liste « Franchise » ouverte dans le volet après retour à l'onglet couverture (V3, journal 3) ; pincer et glisser à deux doigts déplace la carte (gestes synthétiques, journal 4 ; téléphone réel en V5).
- [ ] Wallet : boutons au style du comparateur ; aucun `<select>` natif (imposé par ESLint, journal 9) ; menus absents déconnecté (Wallet et Partner, V3 journal 5) ; sélecteur de profil à la hauteur des CTA. Styles connectés à confirmer en recette (journal 12).
- [ ] Offres : liste des offres groupées par objet, documents téléchargeables. Demande : fenêtre épurée, fonctions secondaires dans un menu. Demandes : nouvelle demande en trois étapes, sans case de transmission. Lecture serveur testée (journal 7) ; écrans connectés en recette (journal 12).
- [x] Données fictives pour le compte de l'utilisateur (`db:demo-wallet`, `eb5497c`, journal 1).
- [x] Typecheck, lint, tests touchés, migration 0082 sauvegardée et appliquée (journal 6–8, 10–11).

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | Données fictives | script local puis relecture des 9 originaux dans le stockage | 3 demandes, 6 offres publiées, 3 contrats ; 9/9 empreintes identiques | Sauvegarde 29,2 Mo avant écriture |
| 2 | Lecture IA interrompue | `llm-provider.test.ts` : réponse `incomplete` → `ai_incomplete`, diagnostic `output_limit` | passe ; plafond par défaut 16 000 jetons (`925483e`) | `.env` local de l'utilisateur à aligner, puis redémarrage de l'API |
| 3 | Liste « Franchise » | navigateur intégré : volet produit, retour à l'onglet couverture, ouverture de la liste | la liste s'ouvre dans le `<dialog>` (`1cdab2f`) | — |
| 4 | Pincer et glisser | gestes synthétiques à deux pointeurs dans le navigateur intégré | 1er essai : zoom parasite 1 → 1,09 à l'échelle minimale ; geste recalculé depuis son début (`1ed086e`), déplacement sans zoom parasite | V5 sur téléphone réel |
| 5 | Pages déconnectées | navigateur intégré sur Wallet et Partner sans session | Wallet : connexion seule, aucun lien de menu ; Partner : cadre avec logo | — |
| 6 | Types et frontières | `tsc` des 7 espaces, dependency-cruiser, knip | 0 erreur ; knip identique à `main` | — |
| 7 | Lecture `GET /wallet/offers` | `partner-wallet-offers.test.ts`, PostgreSQL réel | 1/1 passe | — |
| 8 | Migration 0082 | sauvegarde `coverview-local-before-0082-20261008.dump`, puis migration locale | 83 migrations appliquées | — |
| 9 | Un seul select | fichier sonde avec `<select>` natif dans `apps/client` | ESLint le refuse avec le message prévu ; sonde supprimée | Partner (69) et Admin (5) gardent des `<select>` natifs |
| 10 | Wallet | `vitest` client, `tsc`, ESLint pages et offres, build Vite, après retrait de 19 libellés orphelins | 13/13 ; 0 erreur ; build OK | Co-conseillers et état de chaque offre (refusée, expirée, à signer…) rétablis : retirés par erreur en `7d9e30f` |
| 11 | Suite API complète | `vitest run` sur `7d9e30f`, worktree figé `coverview-astra-suite3` | 80 fichiers, 787 tests passent (17 min 37 s) | `daf2f49` ne touche que Wallet et la documentation |
| 12 | Écrans Wallet connectés | recette utilisateur : Offres, fenêtre de demande, « Nouvelle demande », styles | non effectuée : connexion WorkOS requise, réservée à l’utilisateur | Liste de contrôle dans le compte rendu |
| 13 | Erreur Vite « partner-wallet-offers is not exported » | requête du module aux 3 serveurs Vite, puis Wallet et Partner dans le navigateur intégré | serveurs lancés avant le nouvel export, cache des `exports` ; Wallet, Partner et Admin relancés : module servi en 200, pages chargées sans erreur | Recharger l’onglet ouvert avant la relance |
| 14 | Écran de confirmation | vrai composant monté sur une page temporaire avec les styles Wallet, images pilotées par l’API Lottie, bureau et mobile 375 px | une animation de 150 images jouée une fois, repli statique masqué, focus sur « Fermer », message dans la région annoncée, pas de défilement horizontal ; lecture continue non observée : volet masqué, animations suspendues par le navigateur | Lecture réelle à voir lors de la recette connectée |
| 15 | Liste unique et contrôles | `request-timeline.test.ts`, `tsc` Wallet/UI/Partner/Admin, ESLint, `vitest` Wallet, build, knip, dependency-cruiser | 2/2 ; 0 erreur ; 15/15 ; build OK, animation à part (61 Ko, 4,8 Ko compressés) ; knip identique à `main` ; 0 erreur de frontières | Liste mélangée à vérifier connecté |

## Suite

- Partner (69) et Admin (5) gardent des `<select>` natifs : prochaine slice, même `SelectField` et même règle ESLint.
- `.env` local : `OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS` à 16000 (ou ligne retirée), puis redémarrage de l’API.
- V5 sur téléphone réel : pincer et glisser la carte du comparateur.
