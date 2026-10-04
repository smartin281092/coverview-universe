# Invitation Wallet d'un nouveau client

C3 du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.6.2 et scénario 3. Une demande transmise sans espace Wallet peut inviter son client à la rattacher à son espace CoverView. L'invitation ne révèle jamais si l'adresse possède déjà un compte. Elle ne vaut ni mandat, ni consentement commercial, ni fusion de membres d'un ménage.

## Qui invite, et quand

`GET|POST /partner/leads/:id/client-invitations`.

- **Peuvent inviter :** l'Admin (avec MFA), le responsable courant habilité, ou un contributeur actif avec le droit de contact. Jamais un simple apporteur ni le client.
- **Aucune information sans habilitation de contact.** Sans ce droit, la lecture répond `blocker: "access"` avec une liste vide : un apporteur ne voit rien des invitations.
- **Blocages, dans l'ordre :**
  - `linked` : demande déjà rattachée ;
  - `draft` : demande non soumise ;
  - `closed` : demande terminée ;
  - `no_email` : email absent ou invalide.
- **Une invitation active par demande** (index unique partiel). Son adresse est celle de la demande au moment de l'envoi, en minuscules.
- **Au plus 3 invitations par destinataire et par 24 heures**, toutes demandes confondues (MAIL-07). Au-delà : `PARTNER_RATE_LIMITED` (429). Un verrou consultatif par adresse rend ce plafond exact sous concurrence.
- **Annulation** d'une invitation en attente ou envoyée, avec un motif de 5 caractères au moins.

La réponse est identique, que l'adresse corresponde ou non à un compte Wallet. La commande est idempotente (`Idempotency-Key`), et une invitation créée produit l'événement `client.invitation_queued`, visible de CoverView seulement.

## Envoi

L'envoi n'a jamais lieu pendant la requête (MAIL-01). Le job `invitations` de la file Partner (`partner.jobs.ts`, chaque minute) traite au plus 20 invitations par passage :

1. Il rend sans objet (`superseded`) les invitations dont la demande a changé :
   - `recipient_changed` : email corrigé ;
   - `request_changed` : demande rattachée par un autre chemin, ou terminée.
2. Il fait expirer les invitations échues, et il marque `failed`/`delivery_unknown` un envoi resté plus de 10 minutes sans issue. Un tel envoi n'est jamais relancé à l'aveugle.
3. Il réserve une invitation : il génère le jeton (32 octets aléatoires), en stocke **uniquement le hachage SHA-256**, puis envoie le message. Le jeton n'existe en clair que dans l'email.
4. Si le fournisseur refuse, l'invitation repart en attente avec un nouveau jeton. La tentative suivante attend 5 minutes par tentative déjà faite. Après 3 refus : `failed`/`send_failed`.

**Adaptateur** (`platform/mailer.ts`, interface `Mailer` unique). En local, `EXTERNAL_ADAPTER_MODE=local` active l'API HTTP de Mailpit (`MAILPIT_URL`), limitée par la configuration au loopback et à un runtime non productif. Sans adaptateur, l'invitation reste « en attente d'envoi » et l'interface l'indique : aucun faux envoi, aucun lien transmis par un autre canal. Aucun fournisseur de production n'est encore choisi.

**Modèle** `client-invitation-v1` (`partner.invitation-template.ts`) :

- textes par langue (français), gabarits HTML et texte fixes, variables validées et échappées ;
- minimum de données personnelles : nom et organisation de l'intervenant, catégorie, lien, échéance — jamais le titre de la demande ni le nom du client ;
- prévisualisation locale : `GET /local/emails/client-invitation[?format=text]`, avec des variables fictives et la même garde loopback que les personas locales ;
- notice versionnée `client-invitation-notice-v1` : auteur de la collecte, finalité, destinataires, droits (collecte indirecte, LPD).

## Activation par le client

1. Le lien ouvre `/activation#token=…` dans Wallet. Le fragment n'est jamais transmis à un serveur. La page le place dans le `sessionStorage` de l'onglet et l'efface de la barre d'adresse.
2. Sans session, la connexion WorkOS utilise la continuation enregistrée `activation`. Le retour se fait vers ce chemin fixe, jamais vers une URL libre.
3. Le jeton est vérifié dans le corps d'un `POST`, jamais dans une URL. L'aperçu (`/wallet/client-invitations/preview`) et la réponse (`/wallet/client-invitations/respond`) sont limités à 10 appels par minute.
4. **Le compte doit porter l'adresse invitée.** AuthKit n'ouvre une session que pour une adresse vérifiée, mise à jour à chaque connexion.
   - Un autre compte apprend seulement que l'invitation est en attente ou indisponible : ni demande, ni intervenant, ni issue. Il ne peut pas répondre (`404`).
5. L'aperçu présente au compte de l'adresse invitée l'intervenant, le titre, la catégorie et le nom enregistré pour le client. Sur une adresse partagée, la personne voit ainsi que la demande concerne quelqu'un d'autre.
6. Le client confirme avoir lu la notice, puis choisit :
   - **« Cette demande me concerne »** : la demande est rattachée à son compte comme sujet personnel (`client_user_id`, sans profil géré). Événement `client.invitation_accepted` ; notification d'information au responsable, ou à CoverView sans responsable.
   - **« Elle ne me concerne pas »** : la demande reste non rattachée. Événement `client.invitation_declined` ; notification « Examiner la réponse », prioritaire, résolue par une nouvelle invitation, un rattachement ou la clôture.

Le jeton est à usage unique : une seconde réponse renvoie `409`, sauf la reprise exacte de la même clé d'idempotence. La réponse est refusée si l'invitation a expiré ou été annulée, ou si la demande a changé : autre email, demande rattachée ou close. La clé d'opération ne contient que le hachage du jeton.

## Données et garde-fous

Table `partner_client_invitations` (0069).

**États :** `queued → sending → sent → accepted | declined`, plus `expired`, `cancelled`, `failed` et `superseded`.

Les contraintes et le déclencheur `partner_client_invitation_guard` imposent :

- un état envoyé porte un jeton haché et sa date d'envoi ;
- une réponse porte son auteur, sa date et la version de notice ;
- une annulation porte son auteur et un motif ;
- `failed` et `superseded` portent leur cause, et seulement eux ;
- l'identité de l'invitation (demande, adresse, auteur, création, échéance) est immuable ;
- les transitions vont seulement vers l'avant, et un état final ne change plus ;
- aucune suppression.

**Constantes réversibles** dans `partner.invitations.ts` : validité de 14 jours, 3 invitations par destinataire et par 24 heures, 3 tentatives d'envoi.

## Limites

- Aucun fournisseur d'email de production : SPF, DKIM, DMARC et le sous-domaine d'envoi relèvent de la slice de déploiement (MAIL-05). Les retours de bounces ou de plaintes (MAIL-09) ne sont pas encore traités.
- Pas de lien de désinscription : l'invitation est un message ponctuel déclenché par un professionnel, et son volume est borné par destinataire.
- Le français est la seule langue du modèle. La langue du client n'est pas encore utilisée pour le choisir.
- Le parcours Wallet complet, avec un vrai compte WorkOS dont l'adresse reçoit l'invitation, reste à observer en recette réelle (phase B).
