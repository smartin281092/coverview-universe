# Production — attribution administrative du 20 octobre 2026

## Autorisation et cible

Le 16 octobre 2026, l’utilisateur demande que les commandes horizon3 soient « visibles par moi : sebastien@coverview.ch Sébastien Martin dans Partner et Admin », puis « tout déployer maintenant » ([plan deploy-full](../plans/deploy-full-2026-10-16.plan.md), D-8 : premier administrateur `sebastien@coverview.ch` par attribution tracée). Invité à se connecter, inscrire son Authenticator et demander l’accès, il écrit le 20 octobre : « Dans Admin quand je me connecte avec mon compte Google sebastien@coverview.ch je n’ai accès à aucune page bien que j’ai configuré mon app authenticator. » Opérateur : Claude Code, agissant pour cet utilisateur sur le serveur de production.

- Permission unique : `administration.access`.
- Environnement : production, WorkOS coverview / Production, base `coverview` de la pile `/opt/coverview-astra`.
- Bénéficiaire canonique : `usr_dea9051c-527a-41dd-9106-6b53517995ff`, identité WorkOS `user_01M5CX702WREV3WWVXAXSNF6MB`, email `sebastien@coverview.ch`, créé le 2026-10-20 à 14:59:57 UTC.
- Motif : accès administratif du titulaire, avec son challenge MFA distinct, pour suivre ses commandes horizon3 et administrer CoverView.

La mutation contrôle ensemble la paire canonique/WorkOS, l’email, l’absence de révocation globale, une session active, l’inscription Authenticator confirmée et l’absence d’habilitation active ; elle n’insère qu’une ligne ou annule tout. Référence persistée dans `identity_admin_permissions.evidence` : `roadmap/evidence/production-admin-grant-2026-10-20.md#autorisation-et-cible`.

## Exécution et vérification

**Vérifié** avant mutation, en lecture seule : un seul compte, `usr_dea9051c-527a-41dd-9106-6b53517995ff` lié à `user_01M5CX702WREV3WWVXAXSNF6MB` et à `sebastien@coverview.ch`, sans révocation globale ; session active ouverte depuis Admin ; inscription Authenticator `confirmed` (15:00:42 UTC) ; aucune habilitation existante.

**Vérifié** : transaction paramétrée sous verrou du compte, exactement une ligne insérée puis validée : `iap_ba8a4930-1382-470a-ad65-0331008ec83a`, créée le 2026-10-20 à 16:09:49 UTC, permission et référence de preuve conformes. Aucune autre ligne d’habilitation.

**À vérifier par le titulaire (V5)** : ouverture d’Admin, challenge MFA distinct, puis accès aux pages ; la session n’a pas encore de preuve MFA (`mfa_verified_at` vide).
