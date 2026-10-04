# Conventions documentées par compagnie et catégorie

Propriétaire : partner-workspace. Décisions déléguées du relais cc1c, brief I.4/10.2–10.4/13/15/19–20 ; [preuves et limites](../../../../../../roadmap/evidence/partner-core.md#relais-cc1c--conventions-documentées).

## Périmètre et sens du constat

**partner.conventions.1** — Une déclaration personnelle référence le membre, son organisation courante, une catégorie Partner et une compagnie du répertoire canonique `insuranceCompanyIdSchema`. Ce répertoire commercial ne prouve pas les parties juridiques d'une convention. La déclaration doit préciser ces parties, le rattachement personnel et les activités couvertes. Une compagnie absente doit être référencée correctement avant dépôt ; aucun alias ou rapprochement libre n'est créé. Priminfo conserve ses identifiants distincts, sans correspondance juridique inventée.

**partner.conventions.2** — Convention déclarée, original examiné et solution réellement distribuable sont trois faits distincts. L'examen interne n'accorde aucun droit de conseil, accès collectif, certification, acceptation compagnie ou accord économique. Il ne fixe aucun taux ni commission. La compagnie et la solution exactes d'un Lead ne sont pas canoniquement identifiées aujourd'hui : le critère global `conventions` demeure manquant, même après examen favorable. Aucun score, attribution, horloge ou notification de Lead ne change.

## Déclaration, examen et historique

**partner.conventions.3** — Le membre ayant une candidature non close déclare un original pour l'une de ses catégories, même avant approbation. La commande compare sous verrou les parties affichées et la révision professionnelle avec la candidature courante et la révision du dossier. L'applicabilité, les changements intermédiaires, la conservation et les anciennes parties inconnues suivent [le périmètre professionnel commun](professional-scope.md). L'historique affiche les parties d'origine ; il ne les réécrit pas avec la candidature actuelle. Cette déclaration n'est pas une vérification juridique.

**partner.conventions.4** — Un autre administrateur avec permission et MFA récents examine explicitement l'original sûr et sa révision. Un examen favorable exige motif, portée, couverture limitée ou catégorie entière pour cette compagnie, confirmation du membre couvert, début et fin documentés, fin future postérieure au début. Une validité future est signalée comme telle ; expiration et portée limitée restent explicites. L'interface choisit par défaut une portée limitée et ne coche aucune confirmation. Complément demandé et refus sont motivés. Aucun auto-examen favorable.

**partner.conventions.5** — Déclarant ou Admin peuvent retirer le constat avec motif. Une nouvelle déclaration remplace immédiatement le constat courant de cette compagnie/catégorie. Retrait interne ne résilie pas la convention auprès de la compagnie. Décisions, déclarations et originaux demeurent conservés ; l'accès privé aux anciens originaux sûrs reste possible. Pagination de 20 décisions, curseur de révision ; la situation courante est toujours projetée indépendamment de la page historique.

## Permissions et documents

**partner.conventions.6** — Lectures et commandes exigent session courante, déclarant ou Admin/MFA ; Wallet, voisin et collègues d'organisation n'ont aucun accès. Les mutations sont transactionnelles, révisionnées, idempotentes par utilisateur/opération/compagnie/catégorie. Le rejeu relit les droits courants. Les verrous sur membre, organisation et source empêchent de valider un état remplacé pendant la transaction.

**partner.conventions.7** — L'original canonique `files` a pour finalité privée `partner_convention`, distincte de la compétence. Réemploi limité au propriétaire, SHA exact et finalité ; même fichier réutilisable dans plusieurs périmètres, sans partager leurs décisions. Limites communes de 20 Mio/fichier et 200 fichiers/compte. L'upload vérifie octets/taille/checksum et l'accès avant/après stockage. Antivirus par outbox/worker documentaire existants, `analysis_requested=false` : aucune lecture IA, affectation ou enrichissement client. Les bibliothèques, commandes documentaires personnelles, pièces d'identité, contrats, offres et références client excluent cette finalité. Le contrat de création documentaire générique ne permet pas de la choisir.

La rétention commence dès la déclaration, y compris un dépôt incomplet. Retrait/remplacement ne supprime pas l'original. La reprise requiert le fichier exact ; retry sur état failed et révision courante, sans contourner une quarantaine. La désactivation documentaire conserve historique/retrait mais masque et refuse dépôt/examen/source. Aucun second worker sur une base partagée.

## API et exploitation

Base privée `/partner/convention/:userId/:category/:companyId` : GET dossier/historique, POST déclaration, POST `/decisions`, POST `/:id/content`, GET `/:id/source`, POST `/:id/retry`. Contrats Zod et client HTTP partagés. Origine/CSRF et limites HTTP existantes ; upload 10/min et téléchargement 30/min. Aucun transport externe ni room.

Audit append-only privé `convention.declared.v1`, `convention.reviewed.v1`, `convention.needs_information.v1`, `convention.rejected.v1`, `convention.withdrawn.v1`, `convention.source_viewed.v1`, sans payload de pièce, PII ou Lead. Audit/outbox documentaires conservent leur rôle existant. Aucune notification client issue de cette preuve professionnelle.

Migrations additives 0040 puis 0041 : déclarations/décisions, portée/validité et finalité files, noms déclarés figés. L'index unique du sujet précède la FK composite. Les valeurs anciennes vides de 0041 rendent le périmètre indisponible, sans reconstituer des parties historiques. Déployer API et worker compatibles avec finalité/rétention avant activation ; rollback applicatif conserve tables, preuves et historique. Aucune nouvelle dépendance ni variable requise.

PII privée : identifiants et noms déclarés du membre/organisation, texte, nom et contenu de la pièce, auteur/motif/date de décision. Le formulaire demande l'absence de données client. Export, effacement et durée de conservation réglementaire restent ouverts avec S-130/S-131 ; aucune conformité juridique revendiquée.

## État réel

Depuis une offre exacte de Lead, la [consultation contextuelle des sources](solution-evidence.md) permet d’ouvrir son dossier à la catégorie du besoin et à une compagnie choisie explicitement. Ce parcours ne confirme pas le rapprochement de l’identité libre de l’offre ; les règles du dossier ci-dessus restent inchangées.

Parcours implémenté depuis Profil et supervision Candidatures : sélecteurs compagnie/catégorie, dépôt/reprise, examen/retrait, historique et téléchargement privé. Vérifications types/lint/build, frontières et PostgreSQL isolé ; les fixtures ne sont pas des conventions réelles. Recette habilitée, clavier/mobile et chaîne MinIO/antivirus réelle restent non vérifiés. L'environnement cc1c ne dispose plus du fichier WorkOS référencé par la configuration partagée ; aucune session artificielle ni permission de recette créée.

Le relais 5944 corrige également le contrôle de compétence et les aller-retour de parties ; migration, preuves et limites dans [le référentiel commun](professional-scope.md). Le dossier convention ne publie aucune synthèse au client ni dans un annuaire.
