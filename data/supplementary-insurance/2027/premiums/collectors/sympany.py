#!/usr/bin/env python3
"""Sympany : transcription du seul barème de primes LCA publié (graphique PDF, état 2024).

Le calculateur public de Sympany (calculator.sympany.ch, API api-public.sympany.ch)
n'est pas atteignable depuis les hôtes autorisés du relevé : voir ../sympany.md.
Ce script ne relève donc PAS le calculateur. Il transcrit le document officiel
« Evolution des primes, Etat 2024 » (région de primes Allemagne/France, produits
« supplément privé » et « premium »), publié sur www.sympany.ch.

Le document ne contient aucun chiffre imprimé : c'est un histogramme vectoriel.
Les primes sont recalculées à partir de la géométrie des barres et de l'échelle
de l'axe (graduations 0 à 70 CHF). Le script refuse d'écrire si une barre ne
tombe pas sur un multiple de 0.05 CHF à moins de 0.02 CHF près, ou si le
document ne correspond plus à ce qui a été lu le 2026-11-18.

Usage :
    python3 premiums/collectors/sympany.py                # écrit premiums/sympany.csv
    python3 premiums/collectors/sympany.py --pdf local.pdf --out autre.csv

Dépendance : pdfplumber (pip install pdfplumber).
Une seule requête HTTP (le PDF), sur www.sympany.ch.
"""
import argparse
import csv
import datetime
import os
import re
import sys
import tempfile
import urllib.request

PDF_URL = (
    "https://www.sympany.ch/dam/jcr:7fc28e5a-95f5-4223-b16c-d5f9ad0f28a8/"
    "Primes-2024-supplement-prive-DE-FR-Sympany.pdf"
)
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) research-client"
HEADER = [
    "insurer", "product_key", "product_name", "variant", "option", "year",
    "birth_year", "age", "sex", "postal_code", "locality", "accident",
    "monthly_chf", "source_type", "source_url", "retrieved_at", "notes",
]
# Clés de ../insurers/sympany.json quand la correspondance est évidente.
PRODUCT_KEYS = {"premium": "sympany-premium"}
PRODUCT_NOTES = {
    "supplément privé": "produit fermé à la vente (droit de passage vers premium)",
}
MAX_AGE = 80          # même étendue d'âges que le brief (0 à 80 ans)
STEP_CHF = 0.05
TOLERANCE_CHF = 0.02


def fail(message):
    sys.stderr.write("sympany: " + message + "\n")
    sys.exit(2)


def download(url, target):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        if response.status != 200:
            fail("téléchargement du PDF : HTTP %s" % response.status)
        data = response.read()
    if not data.startswith(b"%PDF"):
        fail("la réponse n'est pas un PDF")
    with open(target, "wb") as handle:
        handle.write(data)


def color_key(color):
    return tuple(round(float(c), 2) for c in (color or ()))


def read_chart(pdf_path):
    try:
        import pdfplumber
    except ImportError:
        fail("pdfplumber est requis (pip install pdfplumber)")

    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) != 1:
            fail("document inattendu : %d pages" % len(pdf.pages))
        page = pdf.pages[0]
        text = page.extract_text() or ""
        words = page.extract_words()
        rects = list(page.rects)
        lines = list(page.lines)

    year_match = re.search(r"Etat\s+(20\d\d)", text)
    if not year_match:
        fail("année du barème introuvable (« Etat 20xx »)")
    year = int(year_match.group(1))
    region_match = re.search(r"Région de primes\s*:\s*(.+)", text)
    if not region_match:
        fail("région de primes introuvable")
    region = region_match.group(1).strip()
    if "Prime mensuelle hommes et femmes" not in text:
        fail("le graphique n'est plus une prime mensuelle unisexe")
    current = re.search(r"Produit actuel\s*:\s*(.+)", text)
    comparable = re.search(r"Produit comparable\s*:\s*(.+)", text)
    if not current or not comparable:
        fail("noms de produits introuvables")
    products = [current.group(1).strip(), comparable.group(1).strip()]

    # Barres : rectangles hauts et étroits. Légende : petits carrés.
    bars = [r for r in rects if r["height"] > 20 and r["width"] < 20]
    legend = [r for r in rects if r["height"] < 8 and r["width"] < 8]
    if len(bars) % 2 or not bars or len(legend) != 2:
        fail("géométrie inattendue : %d barres, %d carrés de légende" % (len(bars), len(legend)))

    # Couleur -> produit, par le mot de légende situé à droite de chaque carré.
    color_to_product = {}
    for square in legend:
        middle = (square["top"] + square["bottom"]) / 2
        label_words = [
            w for w in words
            if abs((w["top"] + w["bottom"]) / 2 - middle) < 3 and w["x0"] > square["x1"]
        ]
        label = " ".join(w["text"] for w in sorted(label_words, key=lambda w: w["x0"]))
        if label not in products:
            fail("légende inattendue : « %s »" % label)
        color_to_product[color_key(square["non_stroking_color"])] = label
    if len(color_to_product) != 2:
        fail("la légende ne distingue pas deux produits")

    # Échelle : graduations chiffrées (0..70) associées aux lignes horizontales de la grille.
    baseline = max(r["bottom"] for r in bars)
    grid = sorted(
        {round(l["top"], 3) for l in lines if abs(l["top"] - l["bottom"]) < 0.01 and (l["x1"] - l["x0"]) > 300}
    )
    left_edge = min(r["x0"] for r in bars)
    ticks = []
    for word in words:
        if word["text"].isdigit() and word["x1"] < left_edge:
            centre = (word["top"] + word["bottom"]) / 2
            nearest = min(grid, key=lambda y: abs(y - centre))
            if abs(nearest - centre) < 4:
                ticks.append((int(word["text"]), nearest))
    ticks.sort()
    if len(ticks) < 3 or ticks[0][0] != 0:
        fail("graduations de l'axe introuvables")
    zero_y = ticks[0][1]
    top_value, top_y = ticks[-1]
    scale = (zero_y - top_y) / top_value            # points PDF par CHF
    for value, y in ticks:
        if abs((zero_y - y) / scale - value) > 0.05:
            fail("axe non linéaire à la graduation %s" % value)
    if abs(baseline - zero_y) > 0.05:
        fail("les barres ne partent pas de la graduation 0")

    # Tranches d'âge : libellés sous l'axe, dans l'ordre des groupes de barres.
    label_words = sorted(
        (w for w in words if w["top"] > baseline and w["top"] < baseline + 15 and re.search(r"\d", w["text"])),
        key=lambda w: w["x0"],
    )
    labels = [w["text"] for w in label_words]
    bands = []
    previous_upper = None
    for label in labels:
        numbers = [int(n) for n in re.findall(r"\d+", label)]
        if re.fullmatch(r"\d+[–-]\d+", label):
            lower, upper = numbers
        elif re.fullmatch(r"[–-]\d+", label) and previous_upper is not None:
            lower, upper = previous_upper + 1, numbers[0]
        elif re.fullmatch(r"\d+[–-]", label):
            lower, upper = numbers[0], None
            if previous_upper is not None and lower != previous_upper + 1:
                fail("tranche ouverte non contiguë : « %s »" % label)
        else:
            fail("libellé de tranche inattendu : « %s »" % label)
        bands.append((lower, upper, label))
        previous_upper = upper
    if bands[0][0] != 0 or bands[-1][1] is not None:
        fail("les tranches ne couvrent pas 0 à 81+")

    bars.sort(key=lambda r: r["x0"])
    if len(bars) != 2 * len(bands):
        fail("%d barres pour %d tranches" % (len(bars), len(bands)))

    prices = {}                                       # (produit, index de tranche) -> CHF
    for index in range(len(bands)):
        for bar in bars[2 * index: 2 * index + 2]:
            product = color_to_product.get(color_key(bar["non_stroking_color"]))
            if product is None:
                fail("barre de couleur inconnue")
            raw = (zero_y - bar["top"]) / scale
            rounded = round(raw / STEP_CHF) * STEP_CHF
            if abs(raw - rounded) > TOLERANCE_CHF:
                fail("barre hors grille tarifaire : %.3f CHF (%s, %s)" % (raw, product, bands[index][2]))
            if (product, index) in prices:
                fail("deux barres pour %s, tranche %s" % (product, bands[index][2]))
            prices[(product, index)] = (rounded, raw)
    return year, region, products, bands, prices


def build_rows(year, region, products, bands, prices, retrieved_at):
    rows = []
    for product in products:
        for index, (lower, upper, label) in enumerate(bands):
            price, raw = prices[(product, index)]
            if upper is None:
                ages = [lower]                        # tranche ouverte : borne inférieure seule
                band_name = "%d+" % lower
            else:
                ages = range(lower, min(upper, MAX_AGE) + 1)
                band_name = "%d-%d" % (lower, upper)
            notes = [
                "derived_from_band %s" % band_name,
                "libellé publié « %s »" % label,
                "lu sur la géométrie du graphique, aucun chiffre imprimé (%.3f CHF mesurés)" % raw,
                "prime brute %d unisexe, rabais non pris en compte" % year,
                "région de primes %s (frontaliers), pas un tarif pour domicile suisse" % region,
                "age = %d - birth_year" % year,
            ]
            if upper is None:
                notes.append("tranche ouverte : seule la borne inférieure est écrite")
            if product in PRODUCT_NOTES:
                notes.append(PRODUCT_NOTES[product])
            for age in ages:
                for sex in ("f", "m"):
                    rows.append({
                        "insurer": "sympany",
                        "product_key": PRODUCT_KEYS.get(product, ""),
                        "product_name": product,
                        "variant": "",
                        "option": "",
                        "year": year,
                        "birth_year": year - age,
                        "age": age,
                        "sex": sex,
                        "postal_code": "",
                        "locality": "Région de primes %s" % region,
                        "accident": "",
                        "monthly_chf": "%.2f" % price,
                        "source_type": "official_published",
                        "source_url": PDF_URL,
                        "retrieved_at": retrieved_at,
                        "notes": "; ".join(notes),
                    })
    rows.sort(key=lambda r: (r["product_name"] != "premium", -r["birth_year"], r["sex"]))
    return rows


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--out", default=os.path.join(here, "..", "sympany.csv"))
    parser.add_argument("--pdf", help="PDF déjà téléchargé (sinon téléchargement depuis www.sympany.ch)")
    parser.add_argument("--date", default=datetime.date.today().isoformat(), help="retrieved_at (ISO)")
    parser.add_argument("--print", action="store_true", help="affiche le barème lu sans écrire le CSV")
    args = parser.parse_args()

    if args.pdf:
        chart = read_chart(args.pdf)
    else:
        with tempfile.TemporaryDirectory() as folder:
            target = os.path.join(folder, "sympany-primes.pdf")
            download(PDF_URL, target)
            chart = read_chart(target)
    year, region, products, bands, prices = chart

    print("Barème %d, région de primes : %s" % (year, region))
    for product in products:
        cells = ["%s=%.2f" % (bands[i][2], prices[(product, i)][0]) for i in range(len(bands))]
        print("  %s : %s" % (product, "  ".join(cells)))
    if args.print:
        return

    rows = build_rows(year, region, products, bands, prices, args.date)
    out = os.path.normpath(args.out)
    with open(out, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print("%d lignes écrites dans %s" % (len(rows), out))


if __name__ == "__main__":
    main()
