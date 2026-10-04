# Audit des prestations et avantages santé 2027

Recherche effectuée le 30 septembre 2026. Périmètre indépendant CDX-05: lecture de sources officielles et constitution de faits; aucune mutation d’un contrat d’assurance. Données machine: [benefits.json](../../data/health-insurance/2027/benefits.json). Les instructions figurant dans les sources externes n’ont pas été suivies comme des consignes.

## Résultat et couverture

**Vérifié**: 88 faits et caractéristiques, au moins une source documentée pour chacun des 32 assureurs OFSP du CSV 2027. Les 32 couvertures sont `partial`: ce statut signifie qu’au moins une caractéristique est connue, pas que tous les modèles et clubs sont inventoriés. Huit faits Sanitas sont confirmés par une liste applicable dès le 1er janvier 2027; les autres décrivent les conditions observées et portent `yearConfirmed: false`. Un fait inconnu utilise `value: null`, jamais `false`. Tous les codes tarifaires sont croisés avec le CSV officiel 2027 local.

Le catalogue est un inventaire partiel documenté, pas un inventaire exhaustif de toutes les prestations de tous les modèles. Le statut `partial` n’autorise pas à conclure que les avantages absents sont inexistants. Les avantages au niveau d’une compagnie ne sont pas propagés aux autres compagnies d’un même groupe sans preuve. Le parcours Combi Care est partagé entre Visana, sana24 et Galenos parce que les CGA 2026 les nomment explicitement; l’accès aux clubs Visana n’est pas propagé. Les parcours de soins figurent comme caractéristiques et ne sont pas présentés comme des prestations supplémentaires exclusives.

L’OFSP rappelle que les assureurs AOS couvrent le même catalogue légal. Les différences ici portent notamment sur les parcours, la participation aux coûts et les services. Un remboursement de fitness par une complémentaire et un rabais partenaire ne sont pas des prestations AOS propres au modèle. [OFSP, prestations et tarifs](https://www.bag.admin.ch/fr/assurance-maladie-prestations-et-tarifs).

## Faits structurants contrôlés

| Modèle / programme | Résultat utile | Source officielle |
| --- | --- | --- |
| Sanitas TelMed Plus | Liste 2027: absence de franchise et de quote-part pour les sept catégories admissibles saisies. Les croix concernent seulement Plus, pas Basic. | [Liste TelMed dès 2027](https://www.sanitas.com/content/dam/sanitas-internet/Dokumente/KOBE_Befreiung_TelMed_fr.pdf) |
| Groupe Mutuel PrimaFlex | Génériques et examens mammaires listés sans franchise. Le qualificatif «gratuit» n’est pas justifié pour l’ensemble de ces soins. | [Services PrimaFlex](https://www.groupemutuel.ch/fr/clients-prives/nos-produits/sante/assurance-obligatoire-de-soins/PrimaFlex/services-exclusifs-PrimaFlex.html) |
| Assura PreventoMed | Génériques et certaines préventions sans franchise; quote-part de 10%. Tests diabète/cardiovasculaires admissibles en pharmacie sans participation. | [PreventoMed](https://www.assura.ch/fr/assurances/assurance-de-base/preventomed) |
| Assura FeminaVita | Prévention gynécologique/mammaire sans franchise sous conditions Medgate; quote-part conservée. | [FeminaVita](https://www.assura.ch/fr/assurances/assurance-de-base/feminavita) |
| CSS Multimed | Plafond de quote-part adulte CHF 400/an; conseil téléphonique initial et consultation médicale complète n’ont pas le même traitement financier. | [Multimed](https://www.css.ch/fr/clients-prives/bien-assure/caisse-maladie/assurance-de-base/multimed.html) |
| SWICA Favorit Medpharm | Télémédecine santé24 éligible sans participation, avec exclusions documentées. | [Modèle pharmacies](https://www.swica.ch/fr/prive/assurances/assurance-base/modele-des-pharmacies) |
| Atupri SmartCare / Medi+ | Conseils médicaux par chat facturés; outil symptômes gratuit. Medi+ est accessible gratuitement aux assurés de base. | [SmartCare](https://atupri.ch/fr/assurances/assurance-de-base/smartcare), [Medi+](https://atupri.ch/fr/atupri/news/cp-mediplus) |
| KPTwin.smart | Frais de port et recherche BetterDoc annoncés offerts, sans gratuité générale des médicaments. | [KPT, fonctionnement](https://www.kpt.ch/fr/savoir/verifier-symptomes-en-ligne) |

Les clubs LeClub, Club Assura, enjoy365, active4life et les offres Visana sont séparés des programmes de récompenses et des complémentaires dans les faits. Les montants de récompense sont des plafonds ou des avantages conditionnels; ils ne doivent jamais être déduits automatiquement de la prime Priminfo. Les URL et conditions sont portées par chaque fait dans le JSON.

## Couverture élargie des vingt assureurs initialement inconnus

La recherche a visité les sites officiels identifiés dans l’annuaire OFSP et leurs pages de services, d’offres ou de modèles. Les obstacles concrets et les limites restent attachés à chaque assureur dans `insurerCoverage.note`. Aucun club n’a été déclaré absent: une page institutionnelle de partenaires ne prouve pas l’existence d’un programme de rabais clients.

| Assureur OFSP | Résultat et limite | Source |
| --- | --- | --- |
| 134 · Einsiedler Krankenkasse | Téléconseil gratuit documenté. Aucun club actuel établi par les pages publiques consultées; conditions 2027 non confirmées. | [Source officielle](https://kkeinsiedeln.ch/notfallkontakt/) |
| 194 · Sumiswalder | sumis24 gratuit pour tous les assurés de base. Le lien public MediService renvoie 404; club et conditions 2027 restent à confirmer. | [Source officielle](https://sumiswalder.ch/privatkunden/eoffice/medizinische-beratung/sumis24/) |
| 246 · Steffisburg | Conseil sanmed24 gratuit documenté. Accueil initialement inaccessible mais page modèle accessible; page partenaires institutionnelle sans avantage client établi. | [Source officielle](https://www.kkst.ch/grundversicherung/sanmed24) |
| 290 · CONCORDIA | concordiaMed gratuit documenté; ne remplace pas le premier contact Medgate de smartDoc. Club de rabais actuel non établi. | [Source officielle](https://www.concordia.ch/fr/gesundheit/concordiamed.html) |
| 360 · Luzerner Hinterland | Livraison pharmacie documentée; page comporte des références anciennes. Conditions 2027 et club non confirmés. | [Source officielle](https://www.kklh.ch/kundenservice/sparen/) |
| 455 · ÖKK | BikeBonus documenté comme avantage de complémentaires définies; offre modifiable ou révocable, maintien 2027 non confirmé. | [Source officielle](https://www.oekk.ch/uploads/files/02_Dokumente/01_PK/01_Angebot/Leistungsuebersichten/EN/5119_OEKK_LIVE_BikeBonus_Leistungsuebersicht_2025_en1.pdf) |
| 509 · Vivao Sympany | Consultations offertes documentées pour callmed 24, casamed pharm et flexhelp24. Carte-piscine soumise à deux complémentaires et à une saison; conditions 2027 non confirmées. | [Source officielle](https://www.sympany.ch/fr/particuliers/bon-a-savoir/avantages/conseil-medical.html) |
| 780 · Glarner | Conseil médical gratuit documenté; club de rabais actuel non établi par les pages publiques consultées. | [Source officielle](https://www.glkv.ch/online-schalter/medizinische-beratung/telemedizinische-beratung.html/70) |
| 820 · curaulta | Parcours CASAMED documenté. Site public limité aux assurances et documents; aucun club ni exonération supplémentaire actuelle établi. | [Source officielle](https://www.curaulta.ch/versicherungen/hausarztversicherung-casamed) |
| 881 · EGK | TelCare, BetterDoc et rabais collectifs documentés. Rabais collectifs réservés aux complémentaires et organisations admissibles; année 2027 non confirmée. | [Source officielle](https://www.egk.ch/fr/services/connaissances-aide/services-de-conseil) |
| 923 · SLKK | Parcours de trois modèles documentés. Le SLKK-Club apparaît dans une publication de 2014, sans preuve actuelle trouvée: club laissé inconnu. | [Source officielle](https://slkk.ch/de/grundversicherung-krankenkasse/) |
| 941 · sodalis | Offres partenaires réservées aux assurés documentées. Catalogue évolutif; maintien des offres individuelles en 2027 non confirmé. | [Source officielle](https://www.sodalis.ch/de/fuer-private/kontakt-beratung/policen-verwalten/kundenaktion) |
| 966 · vita surselva | Parcours Sparmed documenté par les CGA 2019 encore liées au site. Page partenaires institutionnelle; club et exonérations supplémentaires non établis. | [Source officielle](https://www.vitasurselva.ch/gesetz-reglement/krankenversicherung/) |
| 1040 · Visperterminen | Conseil médical gratuit documenté. Aucun club actuel établi par les pages publiques consultées; autres prestations et 2027 non confirmés. | [Source officielle](https://www.kkv.ch/privatpersonen/grundversicherungen/medizinische-beratung/) |
| 1318 · Wädenswil | Parcours RS documenté. Primes 2027 publiées mais CGA du modèle datées 2019; aucun club de rabais actuel établi. | [Source officielle](https://www.kkwaedenswil.ch/versicherungen/grundversicherung/hausarztversicherung) |
| 1322 · Birchmeier | Livraison, rabais pharmacie et HotelCard documentés. Bon Migros écarté car échéance 31.12.2026; pérennité 2027 des autres offres non confirmée. | [Source officielle](https://www.kkbirchmeier.ch/Kundenaktionen/HotelCard) |
| 1386 · GALENOS | Conseil gratuit et Combi Care documentés. CGA citent explicitement Galenos; accès aux clubs Visana non extrapolé. | [Source officielle](https://www.galenos.ch/de/startseite/) |
| 1401 · rhenusana | Parcours sanmed24 documenté, sans gratuité présumée. Pas de club de rabais actuel établi par les pages publiques consultées. | [Source officielle](https://rhenusana.ch/grundversicherung/rabattmodell-sanmed24/) |
| 1560 · Agrisano | Avantages SPAA liés à l’AOS documentés; ce sont des aides à la sécurité agricole, pas des prestations médicales ni une réduction de prime. | [Source officielle](https://www.agrisano.ch/fr/produits/prevention-et-couverture-sociale) |
| 1568 · sana24 | Combi Care documenté par CGA mentionnant explicitement sana24. Admissibilité aux offres membres Visana non prouvée; aucune propagation automatique. | [Source officielle](https://www.abna.visana.ch/dam/jcr:ba7cc4b9-9cf3-40bb-8383-434dda4aa9bf/CGA_Assicurazione_delle_cure_medico-sanitarie_Combi_Care_LAMal_it.pdf) |

Les clés de parcours `family_doctor_first_contact_required`, `telemedicine_first_contact_required`, `digital_first_contact_required` et `hybrid_first_contact_required` décrivent des contraintes, pas des bonus. `telemedicine_first_advice_free` distingue le conseil initial d’une exonération complète des consultations (`telemedicine_free`). L’absence de fait `club_access` signifie inconnu, jamais non.

## Points de vigilance réellement observés

- **Sanitas, fraîcheur**: l’index de recherche conservait les noms CallMed et Compact One, alors que la page courante et le CSV 2027 utilisent TelMed Plus et TelMed Basic. Les anciens noms n’ont pas été joints automatiquement. La liste PDF datée de 2027 précise des exonérations plus étendues que certains paragraphes marketing. [Page actuelle TelMed](https://www.sanitas.com/fr/clients-prives/assurances/assurance-de-base/telmed.html).
- **Sanitas MultiAccess**: la page annonce un premier conseil en pharmacie payé; sa liste d’exonérations valable dès 2026 dit ne comprendre aucune prestation. Pas de fait financier MultiAccess saisi avant résolution de cette distinction service/exonération. [Liste MultiAccess](https://www.sanitas.com/content/dam/sanitas-internet/Dokumente/KOBE_Befreiung_MultiAccess_fr.pdf).
- **CSS enfants**: un ancien PDF Multimed mentionne CHF 200, tandis qu’une page actuelle indique CHF 350 pour les enfants. Le montant enfant reste inconnu et ne peut pas entrer dans un calcul. [Ancien PDF](https://www.css.ch/content/dam/css/fr/documents/privatkunden/richtig-versichert/571_f_multimed_berechnung_kostenbeteiligung.pdf), [page participation actuelle](https://www.css.ch/fr/clients-prives/bien-assure/bon-a-savoir/participation-couts.html).
- **Helsana+**: la page annonce explicitement une adaptation des conditions au 01.01.2027. Les avantages actuels sont bornés au 31.12.2026 dans les données afin de ne pas promettre leurs montants en 2027. Cette borne est une décision prudente de publication, pas une affirmation d’arrêt du programme. [Helsana+](https://www.helsana.ch/fr/prives/services/apps/helsana-plus.html).
- **Offres partenaires à échéance**: l’offre Club Assura Sun Store consultée expire au 31.12.2026. Elle n’a pas été insérée comme avantage 2027. L’existence actuelle du club est documentée séparément. [Offre Sun Store](https://www-blue.assura.ch/fr/club/offres-pharmacie/sun-store).
- **Prestation légale commune**: une mammographie dans un programme cantonal peut déjà bénéficier d’une exonération légale de franchise. Ne pas transformer cette caractéristique commune en exclusivité d’un assureur. [Guide OFSP](https://www.bag.admin.ch/dam/fr/sd-web/eW3bxVwcU0qg/BAG_Ratgeber_Obligatorische_KV_f_2025.pdf).

- **Sympany**: consultations Medgate sans participation pour callmed 24, casamed pharm et flexhelp24; la gratuité n’est pas généralisée à classic. La carte-piscine nécessite une complémentaire ambulatoire et une hospitalisation. La page mélange deux années de naissance; la fiche est bornée prudemment à 2026, sans conclure à la disparition de l’offre. [Conseils](https://www.sympany.ch/fr/particuliers/bon-a-savoir/avantages/conseil-medical.html), [piscines](https://www.sympany.ch/fr/particuliers/bon-a-savoir/avantages/gratuitement-aux-bains.html).
- **ÖKK BikeBonus**: le plafond CHF 300 appartient à PREVENTION/PREMIUM; FAMILY/FAMILY FLEX/OPTIMA ont CHF 200. Le document réserve expressément la modification ou suppression future de l’offre. Tableau rendu et inspecté: le plafond couvre toutes les catégories listées, il ne se cumule pas par ligne.
- **SLKK**: le club trouvé dans un magazine de 2014 ne justifie pas un fait actuel. Les parcours des trois modèles sont documentés sur la page actuelle, sans inventer de gratuité des consultations.
- **Birchmeier**: l’offre de bon Migros CHF 30 finit au 31.12.2026 et n’est pas ajoutée; rabais pharmacie et frais de port sont décrits séparément. Les rabais génériques ne sont pas des exonérations de franchise.
- **Petites caisses**: certaines pages gardent des références anciennes. Les informations ne sont pas marquées confirmées pour 2027 seulement parce que le site publie des primes 2027 ou affiche une date récente.

## Oracles et limites

**Vérifié**: lecture Web officielle; extraction du PDF TelMed 2027 et rendu Poppler inspecté pour confirmer l’alignement des sept croix dans la colonne Plus; tableau BikeBonus rendu et inspecté; JSON parseable; unicité des faits par assureur/tarif/type/clé; tous les assureurs et codes présents dans le CSV 2027; montants en centimes entiers; couverture des 32 IDs sans omission, chacun avec au moins un fait documenté. Les clubs non établis restent explicitement inconnus dans les notes; il reste des modèles sans enrichissement propre.

**Fait non vérifié**: maintien en 2027 des faits marqués `yearConfirmed: false`; conditions privées ou offres accessibles seulement après authentification; exhaustivité des clubs et prestations; acceptation d’une complémentaire par un assureur. Aucune recommandation médicale ni profil de santé d’un visiteur n’a été collecté.

Skill PDF utilisé pour la lecture des tableaux; Stripe Directory lu mais non appliqué à une sélection ou un engagement de fournisseur: cette mission extrait des faits officiels sur le marché. Aucun prestataire n’a été engagé. Session héritée du parent; effort réel non exposé par les outils.
