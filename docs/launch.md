# Mise en vente : conformité, mesure, exploitation

> **Résumé** : le reste du référentiel mène un SaaS jusqu'à *déployable*. Ce fichier le mène jusqu'à *vendable* : pages légales sans lesquelles on ne peut pas encaisser dans l'UE, droits RGPD réellement exerçables par l'utilisateur, mesure d'activation qui alimente la revue de roadmap, runbooks dont l'exécution est portée par une slice, et boucle de retour utilisateur. Rien ici n'est de l'ingénierie nouvelle — tout est du travail qu'on découvre trop tard.

Ce satellite se charge pour une tâche de **préparation au lancement**, de **conformité** ou de **mesure produit**. Il ne se charge pas pour une slice fonctionnelle ordinaire.

## LAUNCH-01 — Le jalon M-Launch est dans la roadmap, pas dans la tête

Les obligations ci-dessous ne s'improvisent pas la veille de l'ouverture des paiements : plusieurs ont un délai incompressible (propagation DNS d'un sous-domaine d'envoi, vérification DMARC, obtention d'un DPA fournisseur, restauration de backup à tester). Elles DOIVENT exister comme **slices datées** dans `roadmap/backlog.yaml`, sous un jalon `M-Launch`, dès que le produit vise une première vente.

Une obligation sans slice n'est pas planifiée : c'est une intention. Le test est le même que pour les runbooks (LAUNCH-05) — si personne ne peut nommer la slice qui la porte, elle n'existe pas.

## LAUNCH-02 — Pages légales : bloquant pour encaisser

`DATA-14` couvre le RGPD **techniquement** (inventaire PII, rétention, purge) et `MKT-09` le consentement. Aucun des deux ne produit les documents publiés, qui sont une condition de vente dans l'UE.

Requis avant la première transaction :

- **Mentions légales** — éditeur, hébergeur, contact, immatriculation.
- **CGU** (usage du service) et **CGV** (vente) — distinctes : durée, prix et modalités de résiliation, droit de rétractation et son exclusion éventuelle pour un service numérique exécuté immédiatement.
- **Politique de confidentialité** — finalités, bases légales, durées de rétention (cohérentes avec DATA-14, pas inventées), destinataires, transferts hors UE, droits et modalités d'exercice (LAUNCH-03).
- **Politique cookies** — inventaire des traceurs, aligné sur l'inventaire réel de MKT-09. Un tag présent dans le code et absent de la politique est une non-conformité, pas un oubli.
- **DPA et sous-traitants** — liste tenue à jour de tout fournisseur traitant des données personnelles (hébergeur, email, paiement, LLM — LLM-06), avec DPA signé et localisation.

Deux règles de fond. **Ces documents sont du contenu versionné** (`apps/www`, MKT-05), avec date de dernière mise à jour affichée et historique dans Git — une politique dont on ne peut pas prouver la version applicable à une date donnée ne vaut rien en litige. Et **l'agent ne rédige pas de conseil juridique** : il produit une trame à partir des faits techniques du projet (fournisseurs réels, données réellement collectées, rétentions réellement implémentées), qu'un humain valide. Inventer une durée de rétention ou une base légale plausible est une violation de G-01 au même titre qu'inventer une règle métier — avec une conséquence réglementaire en plus.

## LAUNCH-03 — Droits RGPD réellement exerçables

`DATA-14` exige l'accès, la rectification et l'effacement. Il ne dit pas **par quel parcours**, et une obligation sans surface est une obligation non tenue — elle se découvre à la première demande d'utilisateur, en urgence, sans code.

- **Export** (portabilité) : format structuré et lisible par machine, généré en job (JOB-01) parce que c'est long, borné (G-14), livré par presigned URL courte (STOR-05), tracé (SEC-07).
- **Suppression de compte** : parcours self-service dans `client`. Elle DOIT être explicite sur ce qu'elle fait — hard delete, anonymisation, ou soft delete avec délai de grâce (DATA-13) —, se propager au stockage objet (STOR-06), et déclarer ce qu'elle **ne** supprime pas : factures à conservation légale, backups qui expirent selon leur propre rétention. Une suppression qui laisse des données sans le dire est un mensonge à l'utilisateur.
- **Rectification** : couverte par les écrans de profil ordinaires — le vérifier plutôt que le supposer.
- Chaque droit a sa **persona de preview** (ENV-07) : un droit non testable à l'écran est un droit non testé.

## LAUNCH-04 — Mesure produit : PROG-11 en dépend

`PROG-11` impose de relire la roadmap « à la lumière du réel : usage, douleurs, coûts ». `OBS-03` mesure la latence et les DLQ, `MKT-10` les Core Web Vitals. **Rien ne mesure l'usage** — la revue de roadmap n'a donc aucune donnée d'entrée, et se fait à l'intuition.

Le minimum utile à un solo, et il est vraiment minimal :

- **Activation** : la définition du moment où un utilisateur a obtenu la valeur promise, écrite dans `PROJECT.md`, et son taux mesuré. C'est la seule métrique qui arbitre réellement un backlog.
- **Rétention** à J7/J30, **conversion** essai → payant, **churn**.
- Événements produit nommés selon CONV-04 (des faits passés, versionnés), émis **côté serveur** de préférence : un bloqueur de publicité ne doit pas trouer la mesure, et le serveur connaît déjà le tenant.
- Outil respectueux et si possible exempté de consentement (MKT-09) — sinon le bandeau ampute la mesure de la moitié du trafic, ce qui la rend pire qu'absente.
- **Jamais de PII dans les événements** (DATA-14) : identifiants opaques uniquement.

Ce n'est pas de l'analytics d'entreprise. C'est le strict nécessaire pour que PROG-11 cesse d'être une cérémonie.

## LAUNCH-05 — Runbooks : une exigence sans porteur est morte

`DEL-07` exige une restauration « testée régulièrement » et une procédure de rollback « documentée dans le runbook ». Aucun runbook n'existe, et aucune slice ne porte le test. Ce sont exactement les exigences qui semblent tenues jusqu'au jour où on en a besoin.

Chaque runbook tient sur une page, vit dans `docs/runbooks/` du projet, et nomme **qui l'a exécuté et quand** — c'est la seule preuve qu'il fonctionne :

| Runbook | Déclencheur | Preuve d'existence |
|---|---|---|
| Restauration de backup | trimestriel, et après tout changement de schéma majeur | date de la dernière restauration **réussie sur un environnement jetable** — un backup non restauré n'existe pas |
| Rollback de déploiement | incident | date du dernier rollback répété, même sans incident |
| Rotation d'un secret | fuite suspectée, départ, échéance | secrets listés avec leur date de dernière rotation (SEC-03) |
| Mode maintenance / coupure | incident majeur, migration lourde | mécanisme réellement testé, pas une page HTML jamais servie |
| Incident : qui, quoi, dans quel ordre | incident | pour un solo : où regarder d'abord, quoi couper, quoi communiquer |

La restauration de backup DOIT être une **slice récurrente du backlog**, pas une bonne intention : elle revient au calendrier comme une tâche, sinon elle ne revient jamais.

## LAUNCH-06 — Boucle de retour utilisateur

`MEM-03` collecte les apprentissages **de l'agent**. Rien ne collecte ceux **des utilisateurs**, qui sont pourtant l'entrée de PROG-11 au même titre que les métriques.

- Un canal de contact réel et surveillé, annoncé dans les pages légales (LAUNCH-02) et dans l'app.
- Les retours qui impliquent un changement entrent au backlog en `idea` (PROG-04) — jamais traités à chaud, ce qui casserait le WIP = 1.
- Un **changelog produit** public : c'est le pendant utilisateur de DEL-08, et le canal de réactivation le moins cher qui existe.
- Une page de statut, même statique, dès qu'un client paie.

## LAUNCH-07 — Ce qui n'est pas couvert ici

Explicitement hors périmètre, pour que l'absence soit une décision et non un oubli : fiscalité et facturation légale au-delà de ce que Stripe Tax couvre (BILL-08), accessibilité réglementaire (RGAA/EAA) au-delà de FRONT-12 et MKT-07, certifications (SOC 2, ISO 27001), assurance, et droit du contrat au-delà des trames de LAUNCH-02. Chacun relève d'un professionnel, pas d'un référentiel d'ingénierie — et chacun devient une slice le jour où il devient réel.
