# Catalogue commercial (offres, plans, entitlements)

> **Résumé** : le catalogue est du **code** (`packages/catalog`), pas un document — il définit ce qui est vendable, à qui, avec quels droits et quelles limites. Les **montants restent chez Stripe** ; le catalogue ne porte que les clés. Toute surface commerciale — page pricing, écran d'upgrade, console admin, contrôles d'accès — en dérive. Un plan ne se supprime jamais : il se déprécie.

`BILL-04` exige que les identifiants de prix soient validés côté serveur « contre le catalogue autorisé ». Ce fichier définit ce catalogue. Sans lui, la validation n'a pas de référence, la matrice plan → entitlements n'existe que dans des conditions éparpillées, et la page pricing dérive de Stripe sans que rien ne le détecte.

## CAT-01 — Le catalogue est exécutable (G-15)

Il vit dans `packages/catalog`, importable par l'API, les apps et le site marketing. Une définition en prose dans un README ne peut ni valider une entrée, ni typer un entitlement, ni échouer en CI. Tout ce qui est mécaniquement vérifiable quitte la documentation.

Une entrée de catalogue porte : `id` stable, `lookupKey` Stripe, clés i18n de nom et description, `catégorie`, `audience`, `entitlements[]`, `limites`, `état`.

## CAT-02 — Les montants n'y sont pas

Stripe est l'autorité des prix (BILL-01). Le catalogue porte **les clés, jamais les nombres** : dupliquer un montant crée deux vérités sur le prix, et c'est la page pricing qui ment. Les prix affichés sont lus depuis Stripe (ou un cache serveur explicitement daté), jamais écrits en dur dans le code ou dans un contenu marketing.

Corollaire : changer un prix ne DOIT jamais exiger un déploiement.

## CAT-03 — Convention de nommage des `lookupKey`

Format imposé : `<produit>_<plan>_<période>` en minuscules — `runiq_pro_monthly`, `runiq_pro_yearly`, `runiq_team_monthly`. Stable à vie : une `lookupKey` ne se renomme pas, elle se déprécie (CAT-06). Une clé qui existe dans le code sans exister dans Stripe est une erreur de build, pas un avertissement (CAT-08).

## CAT-04 — Entitlements : une énumération unique

Les entitlements du catalogue et ceux vérifiés par l'application sont **la même énumération**, exportée par `packages/catalog` et consommée par les policies (PERM-09). Un entitlement présent dans un plan mais absent de l'énumération est une erreur de typage.

La matrice **plan → entitlements** est du code et DOIT être testée (TEST-01) : un test par plan actif vérifiant l'ensemble exact d'entitlements accordés. C'est le test le moins cher et le plus rentable du module billing — il attrape la régression silencieuse où un upgrade cesse d'accorder un droit.

`PERM-09` reste entier : un entitlement n'est ni une permission ni un feature flag. Le catalogue ne définit **que** des entitlements.

## CAT-05 — Toute surface commerciale dérive du catalogue

La page pricing de `www`, l'écran d'upgrade de `client`, les tableaux comparatifs et la console admin lisent le catalogue — ils ne le recopient pas (DOC-10). Les libellés passent par des clés i18n (INTL-01) : le catalogue porte la clé, pas le texte, ce qui rend la traduction possible sans toucher à l'offre.

Un tableau comparatif écrit à la main dans une page marketing est une seconde source de vérité. Il divergera au premier changement d'offre, et c'est la version publique qui sera fausse.

## CAT-06 — Un plan ne se supprime pas, il se déprécie

Retirer un plan du catalogue casse les abonnés qui y sont encore. Cycle imposé :

1. `état: actif` — vendable, affiché ;
2. `état: privé` — non affiché, souscription impossible, abonnés existants intacts (grandfathering) ;
3. `état: déprécié` — plus aucun abonné actif, entrée conservée pour l'historique de facturation.

C'est un expand-contract appliqué à l'offre (EVO). Le passage de `privé` à `déprécié` exige la vérification qu'aucun abonnement ne le référence — sinon la migration est une décision commerciale, pas technique, et relève de G-01.

## CAT-07 — Une persona de preview par plan actif

Toute modification du catalogue DOIT ajouter ou ajuster les personas correspondantes (ENV-07) : un plan dont aucune persona ne porte l'état est un plan dont les entitlements ne sont jamais vérifiés à l'écran. La matrice existante couvre déjà essai et impayé ; les plans s'y ajoutent au même titre.

## CAT-08 — Contrôle de dérive catalogue ↔ Stripe

Un script DEVRAIT comparer, en CI ou en pré-déploiement, les `lookupKey` du catalogue à celles réellement présentes dans le compte Stripe de l'environnement (DEL-04). Écart détecté ⇒ échec, pas avertissement.

Portée honnête : ce contrôle vérifie l'**existence** des clés, pas la cohérence commerciale de l'offre (un prix modifié par erreur dans Stripe passe le contrôle). Il attrape la faute de frappe et la clé oubliée, ce qui est déjà l'essentiel des incidents réels.
