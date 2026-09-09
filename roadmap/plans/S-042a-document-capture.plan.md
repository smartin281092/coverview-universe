# S-042a — Lecture du passeport et capture de plusieurs photos

Mandat : demande utilisateur du 9 septembre 2026. Extension autorisée ; reprendre S-042a en cours sans redemander GO. Session GPT-6, effort effectif non exposé.

## Objectif et décisions

Diagnostiquer et corriger l’échec réel `ai_invalid_result` du passeport, puis permettre depuis Documents de prendre/importer plusieurs photos du même document, les prévisualiser et les retirer avant dépôt.

- L’original signalé est déjà conservé et contrôlé par antivirus. Ajouter d’abord des diagnostics techniques bornés sans citation, valeur, image ni réponse fournisseur dans les logs ; une relecture explicite du document signalé est couverte par la correction demandée. Ne pas assouplir la validation d’identité sans cause démontrée.
- Pour plusieurs photos : un PDF multipage préparé localement, une image par page, dans l’ordre choisi. Joindre aussi les fichiers source exacts au PDF pour ne perdre ni original ni métadonnée. Un seul fichier choisi reste inchangé. Les PDF et autres fichiers seuls gardent leur parcours ; ne pas fusionner arbitrairement des PDF signés ni supprimer leurs signatures/formulaires.
- Préparation avant dépôt : ajout répété par appareil photo ou fichiers, miniatures, ouverture dans une prévisualisation avec zoom/déplacement existants, suppression et ordre. Aucun envoi avant Enregistrer. Conservation de la sélection après une erreur ; modification d’une sélection crée une nouvelle commande, jamais un rejeu avec d’autres octets.
- Limites cohérentes : maximum vingt photos et vingt Mio pour le document final ; erreur visible si le regroupement dépasse la limite. Aucune réduction silencieuse de qualité. Annulation et démontage libèrent les URL locales ; aucune image dans localStorage ou les logs.
- Réutiliser les primitives du preset, les portails privés et le canvas existant. Textes externalisés. La capture native privilégie l’appareil arrière sur mobile ; vérifier les capacités réellement accessibles du navigateur avant de promettre un accès caméra sur ordinateur.

## Vérification et bornes

V0/V1 : types, lint et builds API/Wallet. V2 ciblé sur la cause de rejet, maintien du refus d’une citation inventée et conservation exacte des fichiers joints du PDF ; aucune batterie de tests de surface. V3 : relecture du passeport signalé, rendu et interactions du nouveau dépôt dans la preview ; caméra physique à déclarer non exercée si aucun périphérique disponible.

Les limites de livraison déjà consignées restent explicites. Pas de nouvelle permission, migration, signature ou notification externe ; le circuit serveur chiffré/antivirus/stockage/consentement est conservé. Une bibliothèque PDF cliente se justifie par l’assemblage et les originaux joints, chargée à la demande, après contrôle DEP-01. Aucun parseur ni moteur fourni par le runtime de l’agent ne devient une dépendance produit.

Lire : README Wallet/document-intelligence, frontend/design/i18n, dépendances, tests, observabilité et documentation OpenAI pour l’extraction. Journal d’exécution : roadmap/evidence/document-capture.md. Sources métier et décisions précédentes restent liées depuis le plan S-042a ; cette extension ne clôt pas à elle seule C01–C07.
