# Diagrammes conservés de la source

Les cinq images ont été extraites byte pour byte du DOCX et inspectées visuellement. Leur hash et leur ancrage figurent dans [bible.source.json](bible.source.json). Les synthèses ci-dessous aident à les retrouver ; les images restent les éléments de preuve.

| Image | Ancrage | Lecture vérifiée |
|---|---|---|
| [Écosystème](source-media/image1.png) | [p0214](bible.extracted.md#p0214) | Site/Wallet/Admin/Partners/Intelligence passent par Core API et les services métier ; PostgreSQL commun, stockage documentaire sécurisé et jobs/événements/email ; Exchange futur par intégrations autorisées. |
| [Cycle de vie](source-media/image2.png) | [p0389](bible.extracted.md#p0389) | Admin crée/corrige/source ; validation vers données communes, consommation autorisée et moteurs ; snapshot immuable puis historique reproductible, mises à jour datées. |
| [Récupération de contrats](source-media/image3.png) | [p0813](bible.extracted.md#p0813) | Client/compagnies → procuration → workflow/références → emails/réponses → rattachement → classification/extraction → contrats Wallet → audit ; exceptions/corrections Admin et retour client. |
| [Parcours principal](source-media/image4.png) | [p0889](bible.extracted.md#p0889) | Découvrir → comprendre → évaluer → se projeter → comparer → faire valider → suivre → adapter, avec boucle continue. |
| [Moteurs communs](source-media/image5.png) | [p2334](bible.extracted.md#p2334) | Catalogue/contrats/profils/hypothèses communs → moteurs analyse/scoring/retraite/simulation/stratégie/benchmark → résultats versionnés réutilisables Site/Wallet/Intelligence/Admin. |

Les cinq diagrammes synthétisent des exigences présentes aussi dans le texte ; aucun nouveau moteur autonome ou accès direct à la base par un frontend n’en a été déduit. Les couleurs des diagrammes ne remplacent pas la charte fournie séparément par le porteur du projet.
