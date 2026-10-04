# Préférences de conseil par besoin

Le [bilan minimal du référent](referent-assessment.md) précise les comparaisons autorisées dans les audiences actuelles du Lead et les sources qui restent privées.

## Portée et choix

Le [bilan personnel d'adéquation](advisor-assessment.md) rapproche désormais ces souhaits des déclarations du conseiller affecté. Il conserve l'audience actuelle des sources et les critères manquants de la continuité partagée.

Ce parcours couvre langue, mode et canton souhaités pour un Lead, selon I.6/10.2–10.4/12/18/20 et II.2/7/16 du [brief](../../../../../../references/coverview-partner-2026-10-02.md). Le propriétaire Wallet courant confirme ses souhaits pour la personne et le besoin affichés. Partner et Admin les consultent selon leur accès opérationnel courant ; ils ne les confirment pas au nom du client.

Une langue facultative utilise le catalogue canonique de [professional-practice](professional-practice.md). Un mode facultatif reprend le même enum que les rendez-vous : téléphone, visioconférence, bureau, domicile. Le canton souhaité est facultatif pour bureau/domicile et doit être absent pour téléphone/visio ou mode non renseigné. Il désigne le souhait de lieu d'intervention, jamais tout le territoire accepté ni une adresse exacte. Zone partielle ou hors Suisse reste à préciser humainement ; adresse et créneau sont convenus dans le rendez-vous.

Chaque champ vide signifie non renseigné, pas indifférent ni indisponible. Effacer les trois choix exige aussi confirmation et conserve l'historique. Aucun choix initial n'est tiré de la langue libre de contact, de l'interface, du domicile tarifaire, d'une demande d'assurance ou du conseiller choisi. La création existante explique où confirmer ensuite ; elle n'enregistre aucune préférence implicite.

## Propriété et portée du besoin

Le sujet canonique est `self:userId` ou `profile:profileId`. Aucun nouveau Client ou profil n'est créé. Une confirmation fige sujet, propriétaire confirmant, révision du profil, révision de portée du Lead, titre/catégorie/objet/contexte, date et version de confirmation. La révision personnelle vaut zéro pour le titulaire non transférable ; le profil géré utilise sa révision canonique.

La migration0044 ajoute `advice_scope_revision`, avancée par un trigger pour chaque changement de sujet, titre, catégorie, objet ou contexte, y compris un aller-retour écrit par une ancienne API. Changer le propriétaire d'un même profil géré conserve son sujet ; sa nouvelle révision de profil impose néanmoins une reconfirmation, même après retour au propriétaire initial. Renommer le profil géré invalide aussi la confirmation, selon le défaut conservateur déjà retenu pour les référents. Modifier contacts, langue libre, notes, attributions, échéances ou préférences ne change pas la portée.

La dernière confirmation n'est courante que pour le sujet actuel. Elle vaut `confirmed` si propriétaire, profil et portée correspondent ; sinon `confirmation_required`. Aucune confirmation du sujet actuel donne `unset`, aucun rattachement donne `unlinked`. Une clôture rend le parcours non modifiable. L'historique paginé et les événements de confirmation visibles restent limités au sujet actuel : un rattachement à une autre personne ne lui transmet pas les choix ou besoins historiques précédents.

## API et concurrence

GET `/wallet|partner/leads/:id/advice-preferences?beforeRevision=…` retourne état courant et vingt confirmations historiques ; la pagination ne change pas le courant. POST `/wallet/leads/:id/advice-preferences` reçoit langue/mode/canton, trois révisions présentées et `confirmed:true`. Les contrats Zod, le client HTTP et les contrôles d'origine/CSRF/idempotence existants sont communs. La route Partner n'accepte aucune mutation.

Les transactions verrouillent acteur/session, habilitation professionnelle si nécessaire, Lead puis profil canonique. Admin exige sa permission et un MFA récent ; une vue de progression ne révèle aucune préférence. L'écriture exige le propriétaire Wallet courant et un Lead ouvert. Les trois révisions empêchent une confirmation sur un ancien besoin ou profil ; elles sont indépendantes de la révision générale du Lead. Une même clé/contenu reprojette l'état actuel après contrôle des droits, sans nouvel enregistrement. Une clé réutilisée différemment est refusée ; deux nouvelles clés concurrentes sur la même révision ne gagnent pas toutes deux.

## Effets et interfaces

`partner_advice_preferences` possède son historique immuable et sa révision par Lead. La confirmation ne met pas à jour le Lead, ses horloges, tâches, rendez-vous, référents, affectations, notifications ou examens professionnels. L'événement minimal `client.advice_preferences_confirmed.v1` porte l'identifiant de confirmation, avec texte vide et audience client ; aucune notification n'est déclenchée. La timeline filtre cet événement par sujet canonique courant.

Wallet propose un dialogue depuis la demande : état, édition RHF/Zod avec confirmation non précochée, puis historique distinct. Les révisions sont capturées à l'ouverture, une réponse incertaine conserve le contenu et la clé de réessai, un conflit demande une relecture. Les anciens choix invalidés ne préremplissent pas une nouvelle confirmation. Les détails historiques sont toujours dérivés de la réponse actuellement autorisée. Partner propose la même consultation dans la synthèse opérationnelle du Lead, accessible également depuis la supervision Admin. Caches privés par utilisateur/session/Lead/page, suppression à fermeture et masquage sur erreur d'accès.

Ces souhaits et les déclarations du professionnel ne constituent pas un matching vérifié. Langue, région, préférences, disponibilités et conflits restent dans les contrôles manquants de continuité. La demande client de changement d'interlocuteur et la clôture conservent leur priorité ; aucune réservation ou attribution automatique.

## Persistance et exploitation

0044 est additive : table, références canoniques, index unique Lead/révision, index Lead/sujet/révision, contraintes de sujet, versions et codes, colonne/trigger de portée. Aucun backfill des données libres ni modification des migrations précédentes. Appliquer0044 avant la nouvelle API ; les anciens lecteurs n'offrent pas ce parcours. Rollback applicatif : fermer l'entrée nouvelle, conserver table/historique/trigger et corriger en avant. Le trigger maintient la monotonie avec les anciennes écritures ; ne jamais le retirer pour réactiver une confirmation.

Contrat export/rétention S-130/S-131 : métadonnées personnelles de conseil et instantanés de besoins, référencés au sujet canonique, Lead et acteur ; conserver les preuves de confirmation et de changement de propriétaire dans leurs périmètres autorisés. Aucun effacement automatique ou durée juridique nouvelle promis ; ces services restent ouverts. Aucun paquet, variable, fournisseur, job, room ou transport ajouté.

## Vérification et limites

V0/V1 : types/lint, builds API/Partner/Wallet/Admin, frontières et Knip ciblé.0044 appliquée localement sans reset, migrations exécutées deux fois dans la nouvelle base de test, génération suivante sans delta. V2 :87 tests PostgreSQL/8 fichiers, dont six nouveaux scénarios de droits, transferts réels de profils, changements aller-retour, isolation par sujet, contraintes, concurrence/rejeu, historique et absence d'effets secondaires. Les identités de test sont synthétiques dans Testcontainers uniquement. [Commandes et revues](../../../../../../roadmap/evidence/partner-core.md#relais-6469--préférences-de-conseil-par-besoin).

V3 rempli, clavier/mobile non vérifiés : fichier WorkOS configuré et trois valeurs nécessaires absents ; aucun callback refusé retenté. Base locale sans membre Partner/Lead/offre/préférence, aucun runtime6469 ni donnée client/grant/accord de recette réel créé. Matching complet et tous les autres tracks, brief/S-110/S-042a, restent ouverts.
