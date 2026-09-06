# S-000b — attribution administrative locale

## Autorisation et cible

Le 2026-09-06, dans la tâche `01a077bc-b0f8-7630-a4fe-861eec6e71f4`, à la question demandant quel compte habiliter comme administrateur CoverView, l’utilisateur répond explicitement `sebastien@bmpartners.ch`. Cette désignation complète son mandat de préparation et vérification de l’accès administratif S-000b. Opérateur : Codex, agissant pour cet utilisateur dans l’environnement local autorisé.

- Permission unique : `administration.access`.
- Bénéficiaire canonique : `usr_bea1435d-b890-4349-8998-9d75e2b188dc`.
- Identité WorkOS attendue : `user_01M1VKYDZP0R3CT5AAYV6CKZCY`.
- Environnement : WorkOS coverview / LocalHost / Staging, `environment_01M1KCQBWNWDZKZNVW9R0GH4YM` ; base locale `coverview_local` du compose s000b.
- Motif : permettre au titulaire désigné de vérifier le véritable parcours administratif avec challenge MFA distinct (C05).

L’email est la désignation utilisateur ; la mutation contrôle la paire canonique/WorkOS, l’email concordant, l’inscription personnelle confirmée et une session active. Transaction paramétrée, verrou utilisateur et contrôle d’absence de grant actif ; aucune attribution à l’autre identité. Référence persistée dans `identity_admin_permissions.evidence` : `roadmap/evidence/S-000b-admin-grant.md#autorisation-et-cible`.

## Exécution et vérification

**Vérifié** : contrôle préalable de la base/rôle, de la paire canonique/WorkOS et de l’email concordants, session active et inscription confirmed ; aucun grant actif avant opération. Transaction paramétrée exécutée, exactement une ligne insérée et relue avant commit : `iap_b928f034-07cd-499c-a8ca-ad3e283efebc`, créée à `2026-09-06T18:45:33.571Z`, permission et référence de preuve conformes.

**Vérifié V3** : après rechargement du compte équipe dans le navigateur intégré, la page exige « Vérifier votre identité » ; l’habilitation seule n’ouvre donc pas l’accès. Lien `/mfa` suivi, challenge réel démarré puis confirmé personnellement. Retour sur compte BMP avec « Votre accès équipe est confirmé ».

La session `sess_333d4383-2a0d-414b-9e88-276b7e0c2156` porte `mfa_verified_at=2026-09-06T18:46:43.563Z` ; aucun challenge restant. Audit `audit_ecf6a0c7-05ae-47ab-9dcc-af1173fa2da1`, action `mfa.verify` à `18:46:43.565Z`, même utilisateur/session. L’autre appareil BMP exige encore MFA et ne récupère pas cette preuve.

Hook reconnecté par WorkOS dans Chrome reste refusé sur compte équipe, y compris sur `/account?role=admin&app=admin`. Le contrôle HTTP existant couvre le refus 403 de la variante API exacte ; sa lecture JSON directe via navigateur est empêchée par `ERR_BLOCKED_BY_CLIENT` et n’est pas revendiquée comme preuve V3. La session de contrôle Hook est ensuite fermée ; celle de BMP dans le navigateur intégré est conservée. Aucun token, QR, code Authenticator ni hash de session collecté ; l’OTP email Hook est utilisé seulement en mémoire et masqué dans les sorties.
