# Hébergement CoverView

## HOST-01 — Cible et périmètre protégé

Décision utilisateur du 2026-09-05 : hébergement sur **Infomaniak Public Cloud**, via le projet accessible dans **Horizon**. Domaine **coverview.ch**, géré chez Infomaniak. L'utilisateur indique être connecté ; l'accès, les IDs de projet et la région n'ont pas été vérifiés pendant l'initialisation documentaire.

**Ne toucher à aucune instance déjà présente.** Cette protection inclut leurs disques, snapshots, interfaces, adresses IP, règles réseau, clés et services partagés : aucune suppression, redimensionnement, reboot, réinstallation, migration ou changement indirect. Une ressource existante inconnue est protégée, même si son nom contient CoverView. Aucun script ne sélectionne une cible par nom approximatif ni « première instance disponible ».

## HOST-02 — Futur déploiement isolé

Avant la slice de déploiement : inventaire en lecture seule, identification explicite du projet/région et liste des IDs protégés. Préparer un plan de nouvelles ressources dédiées à CoverView (convention proposée `coverview-<env>-<rôle>`), avec réseau, stockage, exposition, sauvegarde, restauration, coûts estimés et rollback. Les IDs effectivement créés seront enregistrés sans secrets. Aucune réutilisation d'un composant partagé si elle peut modifier les instances présentes.

Images Docker et Caddy restent la cible du harness (DEL-06/07). Aucun choix prématuré de taille d'instance, région, adresse IP, stockage managé ou sous-domaines. Ces choix appartiennent à la slice de déploiement et à son plan concret. Ne rien provisionner pendant le cadrage. L'autorisation de préparer le projet n'est pas une autorisation de facturer des ressources cloud.

## HOST-03 — DNS et intégrations

Avant toute mutation DNS : relever les enregistrements concernés en lecture seule, préparer le diff minimal vers les nouvelles ressources et conserver les valeurs permettant le retour arrière. Préserver les autres enregistrements et services (dont MX, SPF, DKIM, DMARC). Ne pas transférer le domaine, changer les nameservers, ni publier une application de démonstration sur le domaine de production pendant le bootstrap.

Les credentials restent dans les mécanismes sûrs du compte ; le dépôt ne reçoit que des exemples factices (G-04). Le provisioning ne passe pas par Sites ni par un autre hébergeur par défaut : la cible est explicitement imposée par l'utilisateur.

Référence technique, consultée le 2026-09-05 : [Infomaniak — accès au projet via Horizon ou CLI](https://docs.infomaniak.cloud/getting_started/first_project/connect_project/). Cette documentation établit le mécanisme d'accès, pas l'état du compte de l'utilisateur.
