# Langues et cantons d'intervention déclarés

Le [bilan minimal du référent](referent-assessment.md) précise les comparaisons autorisées dans les audiences actuelles du Lead et les sources qui restent privées.

## Résumé et portée

Le [bilan personnel d'adéquation](advisor-assessment.md) permet au conseiller affecté de comparer ses déclarations au besoin courant. Le résumé de continuité partagé reste déclaratif ; aucun matching global n'est déduit.

Cette capacité couvre la déclaration structurée personnelle des langues de conseil et des cantons suisses entiers d'intervention, selon I.4/10.2–10.4/18/20 du [brief](../../../../../../references/coverview-partner-2026-10-02.md). Elle complète les textes de candidature sans les convertir ni les remplacer. Les [modes, disponibilités et absences déclarés](professional-availability.md) ont leur dossier distinct. Zones partielles ou hors Suisse, capacité, conflits et raccordement à la réservation restent ouverts. Aucun matching, droit opérationnel ou certification n'en découle.

## Règles métier

- Une première candidature est nécessaire. Le membre peut déclarer ses propres choix, y compris après approbation, rejet ou suspension ; un compte Partner fermé ne peut plus déclarer. Ces métadonnées ne sont pas un accès opérationnel. Admin ne déclare jamais pour autrui.
- Le formulaire commence sans sélection si aucune déclaration n'existe. Une liste vide signifie « non renseigné », jamais toutes les possibilités ou incapacité. La confirmation des parties affichées est explicite et non précochée.
- Les identifiants sont canoniques dans `packages/contracts/src/professional-practice.ts` : 183 codes de langue issus de la canonicalisation Intl/CLDR lors de l'introduction et 26 codes de canton. Le catalogue est figé, non recalculé par le moteur du navigateur ; seuls les noms utilisent `Intl.DisplayNames`. Une extension nécessite une évolution explicite contrat/contrainte SQL. Aucune locale d'interface ne devient une compétence.
- Les 26 libellés français ont été déplacés depuis la présentation www vers `packages/ui/src/swiss-cantons.ts`, sans duplication. Ils correspondent aux cantons du référentiel géographique existant, pas à des régions de prime ou à un lieu d'intervention déduit du domicile tarifaire. Cocher un canton déclare tout son territoire ; une zone partielle reste à préciser avec CoverView.
- Maximum 20 langues et 26 cantons distincts par déclaration. Le serveur trie les codes, fige parties, organisation interne, révision professionnelle et date, et ajoute une version immuable ; aucun endpoint de modification/suppression historique. L'acteur est le membre lui-même, aussi consigné dans l'événement privé.
- Une modification des parties ou catégories suit la [révision professionnelle](professional-scope.md) : même après aller-retour, nouvelle confirmation requise. Les anciens choix restent consultables avec leurs parties d'origine, mais le résumé courant ne les expose plus comme applicables. Modifier langues/cantons ne change ni cette révision, ni une preuve, ni un examen de compétence/convention.

## API, isolation et concurrence

GET `/partner/practice/:userId?beforeRevision=…` retourne le dossier courant et vingt versions ; le curseur ne change jamais le courant. POST sur la même route reçoit révisions de déclaration/professionnelle, listes et confirmation. Contrats Zod et client HTTP partagés ; limites et codes inconnus/dupliqués rejetés.

Session WorkOS courante et contrôles d'origine/CSRF existants. Lecture par le membre ou Admin `administration.access` avec MFA récent ; ni collègue, ni responsable d'organisation, ni acteur Wallet n'obtient le dossier privé. Écriture personnelle seulement, fermée après clôture du compte ; aucune habilitation ou session créée pour ce parcours.

La transaction verrouille acteur et membre, puis contrôle les deux révisions. Les lectures privées verrouillent le membre en partage pour éviter un assemblage de générations. Réessai de la même clé/contenu reprojette le dossier actuel après nouvelle vérification des droits, sans nouvel événement ; clé réutilisée avec contenu différent refusée. Deux commandes concurrentes sur la même version ne créent pas deux déclarations.

## Projection et interfaces

Partner : Profil → « Langues et zones d'intervention », et lecture Admin depuis Candidatures. Dialogue avec courant, parties d'origine, anciens textes et historique paginé ; édition RHF/Zod, recherche des langues sans dépendre des accents, choix confirmés et commande figée au réessai. Une modification pendant l'édition impose relecture ; erreur de requête masque le contenu, cache privé par session avec suppression à fermeture.

Le résumé de continuité du référent est limité à `status`, `languageCodes`, `cantons`, `declaredAt`. Une seule lecture PostgreSQL associe déclaration et membre courant. Aucun historique, partie privée, texte de candidature, justificatif ou examen n'est projeté. Seuls les lecteurs déjà autorisés du Lead le reçoivent ; le formulaire annonce cette visibilité. Partner et Wallet présentent ce résumé comme une déclaration, jamais comme une adéquation vérifiée.

Les [préférences de conseil du besoin](advice-preferences.md) possèdent désormais leur confirmation distincte. `missingChecks` conserve `language` et `region` tant que l'adéquation n'est pas examinée : ni ces souhaits ni la déclaration professionnelle ne prouvent à eux seuls un matching. La langue libre du Lead et le domicile ne fournissent aucune préférence implicite. Demande de changement client et clôture restent prioritaires. Aucun changement d'affectation, profil/référent, horloge, notification ou rendez-vous.

## Persistance et exploitation

Migration additive0043 : `partner_practice_declarations`, index unique membre/révision, références aux membres/organisations canoniques, contraintes de portée et listes de codes autorisés. Aucun backfill des textes libres et aucune modification de0042. L'unicité des codes est validée à l'entrée API. `practice.declared.v1` utilise le journal privé existant, sans contenu de la déclaration. Aucun nouveau job, room, transport, paquet, variable ou fournisseur.

Appliquer0043 avant l'API/les interfaces qui la consomment. Le champ de résumé est optionnel pour la compatibilité des lecteurs ; une ancienne API ne sait pas servir le nouveau formulaire. Rollback applicatif : fermer cette entrée, conserver tables/historique/trigger0042, corriger en avant sans suppression. La table contient des métadonnées professionnelles personnelles ; rétention/export/effacement demeurent dans S-130/S-131, pas de nouvelle promesse de suppression.

## Vérification et limites

V0/V1 : types/lint ciblés, builds API/Partner/Wallet/Admin/www, frontières et Knip ciblé passent. Migration appliquée à la base locale sans reset, rejouée deux fois en PostgreSQL isolé ; génération suivante sans delta. V2 : 58 tests dans les cinq fichiers Partner/practice/professional-scope/competence/convention, dont sept scénarios ajoutés. Droits, révisions, rejeu, concurrence, historique, parties modifiées et maintien des examens/droits/horloges sont couverts. Détail des commandes et deux revues du même agent au [ledger](../../../../../../roadmap/evidence/partner-core.md#relais-ce17--langues-et-cantons-déclarés).

V3 rempli, clavier/mobile non vérifiés : configuration WorkOS source absente, base locale sans membre Partner/Lead/offre/déclaration. Aucun runtime ce17, compte/grant/accord/justificatif de recette réel créé. Les acteurs des tests sont synthétiques dans Testcontainers. Brief/S-110/S-042a restent ouverts.
