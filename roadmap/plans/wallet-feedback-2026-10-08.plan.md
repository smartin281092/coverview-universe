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
| W-11 | Réactiver le circuit des demandes du comparateur ? | **Question ouverte.** En local il est actif ; seule la production le masque (`PUBLIC_REQUESTS_ENABLED=false`, HOST-04) faute de WorkOS production, de fournisseur d’email et de Wallet déployé. Rien n’est changé avant la réponse de l’utilisateur. | Retours du 8 octobre, deuxième série |
| W-12 | Où vont les autorisations ? | Quatrième onglet du profil de chaque personne (notice, procuration, mandat). `/account?tab=authorizations` et un lien d’autorisation sans personne mènent à `/profile?person=self&tab=authorizations`. | « Mettre l’onglet Autorisations de Mon compte dans la page Profil » |
| W-13 | Que devient le menu ⋯ de Demandes ? | Retiré. Les notifications restent à leur adresse, les référents s’ouvrent depuis une demande ; le dialogue de coordination des rendez-vous, sans autre accès, est supprimé de Wallet (API inchangée). | « Pas utile pour le moment » |
| W-14 | Quelle carte dans Mes offres ? | La carte de la fenêtre de demande, partagée (`OfferCard`). Logo de la compagnie quand l’API la reconnaît dans le nom de l’offre (`companyId`, affichage seul), sinon le nom. Choisir ou poser une question depuis la carte ouvre la demande sur ce choix. | « Format de card comme dans Voir et choisir », « logo à la place du nom » |
| W-15 | Offre sélectionnée et document ? | Contour vert épais (bordure et anneau, sans décalage), étiquette verte « Sélectionnée » avec coche, coche dans « Choix enregistré ». « Document original » ouvre la prévisualisation dans l’application, le rendu étant choisi par le type détecté côté serveur (`sourceMime`) ; « Télécharger » reste proposé. | Retours du 8 octobre, deuxième série |
| W-16 | Réponse à W-11 | **b)** la production reste telle quelle : circuit de demandes du comparateur coupé tant que WorkOS production, email et Wallet ne sont pas en place. | Réponse de l’utilisateur, 8 octobre |
| W-17 | Offre sélectionnée ? | Bordure aux couleurs des CTA (#111e38, #3567b2, #6366f1, #5955a3) qui tournent (`@property` animée, 4 s), étiquette au dégradé des CTA ; fixe si l’utilisateur réduit les animations. Remplace le vert de W-15. | « La même nuance que les CTA, animée pour que les couleurs tournent » |
| W-18 | Boutons et mentions retirés ? | Plus de question, modification ni refus sur les cartes ; la question passe par l’onglet Commentaires de la page d’offre. Les six offres de démonstration perdent « (offre fictive) » et leur résumé de démonstration (base locale et script) ; les PDF déjà stockés gardent leur texte, leur empreinte faisant foi. | « Enlever les mentions Offre fictive de démonstration et les boutons » |
| W-19 | Page d’une offre ? | Voir le README Offres. Défauts posés : points et balayage entre les offres du même bloc ; IA = orientation automatique existante ; Commentaires = messages du client sur l’offre (la réponse du conseiller arrive par contact, d’où « Réponse attendue ») ; signature affichée mais désactivée ; prime mensuelle maladie = prime annuelle / 12 ; couleurs lues dans les logos, palette CoverView sinon. Démonstration complétée : capital projeté et prime des offres 3a, demande d’assurance maladie de base (3 offres). | Retours du 8 octobre, troisième série, maquette fournie |

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
| 16 | Logo et type de l’original | 9 fichiers de tests API manipulant des offres, dont `partner-wallet-offers.test.ts` étendu (`companyId: "axa"`, `sourceMime: "application/pdf"`, nom inconnu sans logo) | 9/9 fichiers, 190/190 tests | — |
| 17 | Wallet et autres apps | `tsc` Wallet/UI/Partner/Admin/api-client/API, ESLint Wallet et paquets, `vitest` Wallet, build | 0 erreur ; 15/15 ; build OK | Redirection renvoyée par `beforeLoad` : vérifiée dans le code du routeur installé (1.171.27) |
| 18 | Carte d’offre | page temporaire avec des valeurs d’exemple (AXA sélectionnée, Allianz, Generali, compagnie inconnue refusée) | contour vert, étiquette et coches conformes ; logos ; nom en texte pour l’inconnue | Données d’exemple, pas une preuve de parcours |
| 19 | Parcours connectés | recette utilisateur : onglet Autorisations du profil, cartes de Mes offres, choix depuis une carte, prévisualisation d’un original réel | non effectuée : connexion requise | Liste de contrôle dans le compte rendu |
| 20 | Données de démonstration | sauvegarde `coverview-local-before-demo-labels-20261008.dump` (29,2 Mo), puis mises à jour SQL relues | 6 offres sans mention fictive ; 2 offres 3a avec capital et prime | Demande maladie ajoutée par le script après fusion |
| 21 | Chiffres du bandeau | `offer-metrics.test.ts` | 4/4 (3a, maladie, autres, lecture des montants) | — |
| 22 | Page d’offre (parties) | page temporaire avec le vrai bandeau, les onglets et les cartes, valeurs d’exemple, bureau et mobile 375 px | shader WebGL rendu aux couleurs Bâloise et AXA ; balayage et points vérifiés par événements simulés ; quatre onglets tenant en 343 px ; bordure animée active | Page complète connectée à voir en recette |
| 23 | Contrôles | `tsc` Wallet et API, ESLint, `vitest` Wallet 19/19, build, knip identique à `main`, dependency-cruiser 0 erreur | verts ; shader dans son propre fichier (1,15 Mo, 288 Ko compressés), chargé seulement sur la page d’offre | Dépendances : mêmes versions que le site, lockfile réparé par `pnpm install --fix-lockfile` |

## Suite

- Partner (69) et Admin (5) gardent des `<select>` natifs : prochaine slice, même `SelectField` et même règle ESLint.
- `.env` local : `OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS` à 16000 (ou ligne retirée), puis redémarrage de l’API.
- V5 sur téléphone réel : pincer et glisser la carte du comparateur.
