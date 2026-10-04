# Capacité personnelle et liens de travail enregistrés

## Périmètre et parcours

Propriétaire : partner-workspace, brief I.10.2–10.4/12/18/20/21. Partner → Profil → « Capacité personnelle » permet une déclaration privée, son retrait et la consultation de son historique. Candidatures dans la supervision Partner ouvre le même dossier en lecture pour l’Admin habilité. Sa projection dans le [bilan personnel v2](advisor-assessment.md#capacité-personnelle-dans-la-version2) suit un contrat privé distinct depuis980f ; matching, attribution et réservations restent ouverts.

**partner.capacity.1** — Trois notions distinctes : liens de travail observés dans CoverView, appréciation personnelle, décision humaine sur un besoin précis. Aucun compteur, plage, absence, rôle approuvé ou mode de rendez-vous ne suffit à établir une capacité réelle. Aucune limite universelle de dossiers, charge horaire, productivité, classement ou admission automatique n’est introduit.

## Déclaration et validité

**partner.capacity.2** — Le membre choisit personnellement `open` (examiner de nouveaux besoins), `case_by_case` (examiner chaque demande au cas par cas) ou `unavailable` (aucune nouvelle prise en charge), pour l’ensemble des catégories affichées. Il choisit une échéance future explicite et confirme les parties, la portée, la durée et l’audience. Aucune option ni confirmation n’est présélectionnée sans déclaration courante applicable. Aucun texte libre ni quota n’est conservé.

Une version fige membre, organisation, noms, catégories, révision professionnelle monotone, action, appréciation, échéance UTC et date de déclaration. Saisie et affichage de l’échéance en Europe/Zurich ; heures inexistantes ou ambiguës refusées. La validité est demi-ouverte : à `validUntil`, la déclaration devient expirée à la lecture, sans job ou mutation. Les horloges serveur font autorité ; une nouvelle déclaration doit encore avoir une échéance future après acquisition des verrous.

États : aucune déclaration (courant nul), déclaration courante applicable, retirée, expirée, portée modifiée. Le changement ou l’aller-retour d’identité, organisation ou catégories invalide la portée selon la [révision professionnelle](professional-scope.md). Reconfirmer produit une nouvelle version ; aucune ancienne version ne redevient courante. L’interface ne préremplit pas les valeurs retirées, expirées ou inapplicables. Le détail d’une version historique est explicitement présenté comme tel, même si son ancienne échéance n’est pas encore atteinte.

Retirer exige une confirmation personnelle, crée une version sans appréciation ni échéance et conserve les versions précédentes. Candidature ou suspension permettent de déclarer en privé sans droit opérationnel. Fermeture du membre : retrait permis, nouvelle déclaration et rejeu d’une déclaration interdits. Aucun retrait, expiration ou changement de portée ne réattribue les missions existantes.

## Mesure observée

**partner.capacity.3** — Le dossier calcule trois compteurs horodatés, sans détail de client ou de Lead :

- Responsabilités acceptées : `responsible_id=membre`, `assignment=accepted`.
- Responsabilités proposées : même responsable, `assignment=proposed`.
- Contributions : lien non révoqué, `access_scope=advice`, `can_edit=true`, et membre différent du responsable de ce Lead.

Périmètre commun : Leads dont le stade n’est ni `draft` ni `completed`, toutes catégories, y compris hors habilitation actuelle. Chaque Lead est compté une fois par rubrique ; l’existence d’anciens contributeurs révoqués ne multiplie pas les liens actifs. Plusieurs demandes d’un même client et d’une même catégorie restent distinctes. Contributions en lecture seule/progression, révoquées et dossiers clos/brouillons exclus. Les liens résiduels en réattribution ne sont pas une responsabilité acceptée ou proposée.

Les trois compteurs sont lus dans une seule requête SQL et ne sont pas copiés dans la preuve personnelle. Ils ne mesurent pas le travail extérieur, la durée, la complexité, les échéances ou les rendez-vous. Leur évolution ne crée aucune version de capacité. Une perte d’habilitation ne masque pas ces liens enregistrés ; elle ne transforme pas ces compteurs en mandats actuels. Un indicateur séparé décrit l’activité du rôle advisor depuis membre/organisation approuvés et échéance de revue future ou absente. Chaque catégorie et mandat restent à vérifier.

## Droits et cohérence

GET/POST `/partner/capacity/:userId`, historique GET `beforeRevision` facultatif. Lecture personnelle ou Admin avec permission courante et MFA récent. Écriture personnelle seulement. Wallet, voisin et manager de la même organisation refusés. Aucun résumé, historique, échéance ou compteur n’est partagé avec les clients, l’organisation ou le bilan du référent. Le [bilan personnel v2](advisor-assessment.md#capacité-personnelle-dans-la-version2) réemploie ces sources sans élargissement d'audience ; ses contrôles humains restent à vérifier.

Acteur/session verrouillés, puis membre et organisation ; la mutation prend le verrou exclusif membre, les lectures un verrou partagé. Révision de déclaration et révision professionnelle vérifiées sous verrou. Deux nouvelles commandes sur la même révision ne gagnent pas ensemble. Déclaration, commande idempotente et audit sont atomiques. Rejeu exact : droits et état courants relus, y compris après expiration/retrait ; jamais de réactivation. Même clé/autre contenu refusé. Historique par20, courant indépendant du curseur. Les gardes host/origine/CSRF, session et limites de débit existantes s’appliquent.

## Interface et exploitation

Dialogue borné avec vues remplaçantes, RHF/Zod, libellés i18n et confirmation vide. Révisions d’ouverture et première commande/clé figées ; après erreur ambiguë, retry identique, après conflit, retour et nouveau formulaire. La charge se rafraîchit indépendamment de la commande. Cache utilisateur/session/cible, gcTime0, relecture10s et manuelle ; erreurs masquent dossier et historique. Une expiration survenue entre deux lectures apparaît au prochain rafraîchissement.

Migration additive0048 : `partner_capacity_declarations`, FK membre/organisation, version unique par membre, contraintes de portée/catégories et action/appréciation/échéance. Aucun backfill ; SQL/snapshots antérieurs inchangés, journal append seulement. Déploiement0048 → API → UI ; aucun contrat existant modifié. Rollback : fermer les nouvelles entrées/routes, conserver tables et preuves. Migration testée deux fois dans PostgreSQL isolé, aucune application à la base partagée ;0046/0047 y restent également non appliquées.

Audit `capacity.declared.v1`/`capacity.withdrawn.v1`, audience privée, auteur personnel, sujet=version, texte vide, aucun Lead. Aucune notification/job/room/fournisseur/variable ajouté. Préférences, horloges et calendrier inchangés. La projection personnelle v2 n'écrit aucune nouvelle preuve. RLS héritée ; données professionnelles identifiantes, rétention/export/effacement S-130/S-131 ouverts sans nouvelle durée juridique.

## État réel

La [décision personnelle pour un besoin](need-capacity.md) dispose désormais d'un dossier séparé, avec échéance/motif/retrait et portée propre. Elle ne modifie pas cette déclaration globale.0049 est préparée hors catalogue protégé, activation/V3 ouvertes ; les limitations ci-dessous décrivent la livraison397a.

Tests et limites dans le [ledger397a](../../../../../../roadmap/evidence/partner-core.md#relais-397a--capacité-personnelle-et-charge-observée). Deux revues statiques du même agent, aucune indépendance annoncée. V3 rempli/clavier/mobile non effectué faute de nouvel accès WorkOS. Aucun accès privilégié ou dossier réel fabriqué et aucun service partagé modifié. S-110/S-042a et tous tracks du brief restent ouverts, notamment décision de capacité par besoin, conflits, matching, créneaux et réservation multi-Leads.
