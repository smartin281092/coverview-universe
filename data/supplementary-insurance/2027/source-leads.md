# Hôtes et documents de départ

Liste de travail du 18 novembre 2026. Les documents ci-dessous ont servi de points d'entrée ; les sources réellement lues figurent, ligne par ligne, dans `insurers/<clé>.json` (`sourceUrl`) et les méthodes de relevé dans `premiums/<clé>.md`.

## Hôtes utilisés

| Assureur | Pages et PDF | Calculateur |
| --- | --- | --- |
| Assura | `www.assura.ch`, `static.assura.ch` | `calculator.assura.ch`, `cms-blue.assura.ch`, `public-api.assura.ch` |
| Groupe Mutuel | `www.groupemutuel.ch`, `groupemutuel.ch` | `www.groupemutuel.ch/poelGM/`, `offres-sante.groupemutuel.ch`, `datapoel.groupemutuel.ch` |
| CSS | `www.css.ch` | `calculator.css.ch`, `api.css.ch` |
| Helsana | `www.helsana.ch` | `portal.helsana.ch` |
| Sanitas | `www.sanitas.com` | `calculator.sanitas.com`, `api3.sanitas.com`, `static.sanitas.tech` |
| CONCORDIA | `www.concordia.ch`, `concordia.ch` | `www.praemienrechner.concordia.ch` |
| SWICA | `www.swica.ch`, `www4.swica.ch`, `dam.swica.ch` | `calculate.swica.ch`, `rms.swica.ch` |
| AXA | `www.axa.ch` | `www.axa.ch/health-dsn/` |
| Atupri | `atupri.ch`, `www.atupri.ch` | `shop.atupri.ch`, `calculateur-de-primes.atupri.ch` (pare-feu : navigateur automatisé refusé) |
| Visana | `www.visana.ch`, `fit.visana.ch` | `dap.visana.ch` |
| Sympany | `www.sympany.ch` | `calculator.sympany.ch` (parcours suisse avec `?country=ch`), `api-public.sympany.ch` |
| KPT | `www.kpt.ch` | `assistant.kpt.ch` |

## Documents de départ

**Assura** — conditions sous `static.assura.ch/blue/cockpit-assets/…` : Complementa Extra (CSC 07.2015), Denta Plus, Denta Sana (03.2024), Medna, Optima Varia, Ultra Varia, Mondia Plus (06.2017), Natura, assistance touristique (01.2021), CGA LCA 07.2015.

**Groupe Mutuel** — `groupemutuel.ch/doc/jcr:00fadd62-9fae-4cc7-b192-e37df38c4b6b/lang:fr/Apercu-AMB-fr-01-2025.pdf` (aperçu ambulatoire), `www.groupemutuel.ch/doc/jcr:2b9ab9aa-fa15-4458-b627-b8c51e1870f8/Apercu-GMASA-fr-2-2026.pdf` (aperçu GMA SA 2026), brochure « Conditions d'assurances Santé GMA SA » 2023, conditions SO Optimum (`SOGA01-F1.pdf`).

**CSS** — `www.css.ch/content/dam/css/fr/documents/privatkunden/richtig-versichert/` : `zb/416a_f_zb_ambulant_myflex.pdf`, `zb/416s_f_zb_spital_myflex_ausgabe-01.2027.pdf`, `zb/496_f_zb_alternativ_myflex.pdf`, `zb/497_f_zb_zahnpflegeversicherung_myflex.pdf`, `avb/406_f_avb_myflex.pdf`.

**Helsana** — `www.helsana.ch/docs/cahier-de-produits.pdf`, `www.helsana.ch/content/dam/helsana/fr/pdf/prives/brochures/apercu-prestations.pdf`, CSA sous `www.helsana.ch/docs/<produit>-zvb-fr.pdf` (sana, completa, primeo, hospital-flex), `www.helsana.ch/dam/fr/pdf/prives/conditions-assurance/completa-extra.pdf` et `completa-plus.pdf`.

**Sanitas** — `www.sanitas.com/en/private-customers/services/contact-and-help/documents-downloads/terms-of-insurance.html`, page des brochures et fiches produit, `www.sanitas.com/en/private-customers/services/know-how/important.html` (évolution des primes 2027).

**CONCORDIA** — `www.concordia.ch/content/dam/concordia.ch/privatpersonen/leistungen/zusatzversicherungen/A.04_DIVERSA_de.pdf` (version française probable : `A.04_DIVERSA_fr.pdf`), `A.06_NATURA_*.pdf`.

**SWICA** — à lire en premier : `www4.swica.ch/p/021_f_Leistungsuebersicht_online.pdf` (récapitulatif des prestations 2027). Conditions sous `www4.swica.ch/p/` ou `dam.swica.ch/image/upload/…` : `186_f_ZB_Completa_Top.pdf`, `196_f_ZB_Completa_Forte.pdf`, `022_f_ZB_Praevita…`, `188_f_ZB_SUPPLEMENTA.pdf`, `189_f_ZB_optima.pdf`, `190_f_ZB_hospita.pdf`, `191_f_ZB_Denta…`, `192_f_ZB_infortuna.pdf`, `038_f_ZB_Gesundheitsrechtsschutz.pdf`, `030_f_AVB.pdf`. Gamme à confirmer : Vacanza ne serait plus vendue depuis fin 2025, Completa Praeventa serait remplacée par Praevita depuis 2026, Vivia serait un nouveau produit dès le 01.01.2027.

**AXA** — `www.axa.ch/fr/particuliers/offres/sante-accidents/assurance-complementaire/conditions-contractuelles.html`, pages `assurance-complementaire-ambulatoire.html` et `assurance-complementaire-hospitalisation.html` du même dossier.

**Atupri** — `atupri.ch/assets/f/253863/x/701d0d5955/informations-clientele-lca.pdf`, CCA Mivita, Comforta et Denta sous `www.atupri.ch/sites/default/files/2023-10/` (éditions 2007 à 2022, validité à confirmer).

**Visana** — `www.visana.ch/fr/dam/jcr:577ea0a7-5319-4609-bf3a-71fc91d92029/leistungsuebersicht-versicherungsangebot-2026-ohne-viva-fr.pdf` (aperçu des prestations 2026), conditions complémentaires sous `fit.visana.ch/dam/jcr:…` (Basic, Basic Flex, Hôpital, Hôpital Flex, Flex Plus, Managed Care, capital hospitalier, indemnité journalière de soins).

**Sympany** — `sympany.ch/dam/jcr:ffb5edb6-dc12-4d5d-bac1-39c0da228c07/…` (aperçu LCA ambulatoire), `sympany.ch/dam/jcr:5ae96b58-4b64-4d2f-acf5-ca174edc99c7/…` (aperçu LCA hospitalisation), `sympany.ch/dam/jcr:7fc28e5a-95f5-4223-b16c-d5f9ad0f28a8/Primes-2024-supplement-prive-DE-FR-Sympany.pdf` (seul barème de primes publié repéré, édition 2024).

**KPT** — `www.kpt.ch/-/media/kpt/portal/versicherungen/dokumente/zusatzversicherungen/` : `cga-pulse-eco-fr.pdf`, `cga-pulse-top-fr.pdf`, `cga-pulse-premium-fr.pdf`, `cs-assurance-des-frais-d-hospitalisation-flex-eco.pdf`, `cs-assurance-des-frais-d-hospitalisation-flex-top.pdf`, `cs-assurance-des-soins-dentaires.pdf`.
