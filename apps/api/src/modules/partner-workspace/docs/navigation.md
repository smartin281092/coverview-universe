# Vues et navigation privées

## Vues prédéfinies, filtres et vues partagées (C5a, brief I.7 et II.10)

Chaque vue et chaque filtre s'ajoutent aux droits existants (`visible(actor)`) : ils ne donnent jamais accès à un Lead autrement invisible.

**Vues prédéfinies** (`view`). La vue par défaut est « Mes Leads » pour un conseiller, le réseau pour l'Admin.

| Vue | Sélection |
|---|---|
| `mine` | Leads attribués à la personne |
| `all` | tous les Leads visibles |
| `team` | Leads dont le responsable appartient à l'organisation du responsable d'équipe (rôle `manager`). Vide sans ce rôle, tout le réseau pour l'Admin |
| `referred` | Leads apportés : créés par la personne |
| `received` | Leads reçus : la personne en est responsable sans les avoir créés |
| `marketplace` | attribution `marketplace` |
| `urgent` | priorité urgente |
| `overdue` | suivi en retard (règle de continuité) |
| `no_action` | sans prochaine action ni échéance |
| `waiting` | attente en cours |
| `appointments_week` | rendez-vous planifié du lundi au dimanche, heure de Zurich |
| `signed` | étape signée, attente compagnie ou contrat émis, ou résultat « contrat » |
| `lost` | résultat perdu, refusé, refus du client, sans solution adaptée, abandonné ou sans réponse |
| `closed` | Leads clôturés |

**Filtres** en plus de catégorie, étape, priorité, attribution, résultat, attente et création :

- conseiller responsable, apporteur (`referrerId`), organisation du responsable ;
- échéance (début inclus, fin exclue), origine (valeur exacte) ;
- présence d'une alerte : retard, sans prochaine action, sans responsable ou tâche en retard. Les conditions SQL sont celles des alertes des cartes.

**Tri.** Trois ordres : plus récents, échéance la plus proche (sans échéance en dernier), plus longtemps dans l'étape. La pagination par curseur suit l'ordre choisi ; un curseur d'un autre ordre est refusé.

**Compteurs.** `counts` donne le total et la répartition par étape de tout l'ensemble filtré, pas seulement de la page. Les colonnes Kanban affichent ces totaux, alors qu'une page montre au plus 60 cartes.

**Vues partagées** (`scope`, migration 0071) :

- `private` : réservée au propriétaire ;
- `team` : publiée par un responsable d'équipe pour les membres approuvés de son organisation. Elle disparaît si son auteur perd ce rôle ou cette organisation ;
- `global` : publiée par un administrateur pour les administrateurs.

Une vue partagée ne transmet que des filtres. Les autres peuvent l'appliquer, jamais la modifier ni la supprimer (`owned: false`). La limite reste de 20 vues actives par propriétaire.

## Vues privées (lot 4)

Lot4 : filtres priorité, attribution, résultat, attente et dates de création, en complément de catégorie/étape/responsable/sujet/recherche. Toutes les conditions sont des intersections avec les droits existants ; la borne temporelle finale est exclue. Une vue sauvegardée ne donne jamais accès à un Lead devenu inaccessible.

Partner conserve jusqu’à20 vues actives par utilisateur dans `partner_lead_views`. Nom, filtres et disposition sont privés, sans copie de dossiers. Création, remplacement des filtres et retrait exigent session et contexte opérationnel courant, clé idempotente et révision ; un autre utilisateur, y compris Admin au titre de son rôle, ne peut pas lire/modifier ces préférences. La limite est sérialisée sur l’utilisateur en application et en SQL. Un retrait conserve un enregistrement inactif ; aucun Lead n’est supprimé. Les recherches enregistrées peuvent être identifiantes et doivent entrer dans le futur export/purge des préférences S-130/S-131.

La position de pagination n’est pas enregistrée dans une vue nommée. Le retour depuis une fiche conserve en mémoire privée de session filtres, recherche, disposition et page. La recherche n’est pas recopiée dans l’URL de retour ; l’état est purgé au changement/perte de session. Rechargement complet du navigateur : la recherche en mémoire est perdue, une vue sauvegardée permet de la réappliquer. Le SDK omet les paramètres `undefined` plutôt que d’envoyer leur texte au serveur. Les dates civiles utilisent le convertisseur partagé Europe/Zurich et refusent une heure ambiguë/inexistante.

Contrats `partner-navigation` ; GET/POST `/partner/lead-views`.0061 hors catalogue,503 si stockage absent ; la liste principale reste filtrable même si les vues sont indisponibles. Schéma généré dans un nouveau catalogue0–60 puis seconde génération sans delta avant guards. [Quatre tests PostgreSQL18 jetable](../../../platform/partner-navigation-integration.test.ts) vérifient vie privée/rejeu/révisions, limite concurrente et libération d’une place, intersection/pagination/bornes et révocations. Aucune migration partagée ni recette V3 revendiquée.
