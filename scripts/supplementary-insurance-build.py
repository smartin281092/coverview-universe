#!/usr/bin/env python3
"""Consolide la recherche sur les complémentaires santé (LCA).

Lit data/supplementary-insurance/<année>/insurers/*.json, contrôle chaque
fichier contre la taxonomie, puis écrit products.json, benefits.csv,
premiums.csv et quality.json dans le même dossier.

Usage : python3 scripts/supplementary-insurance-build.py [année]
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
YEAR = sys.argv[1] if len(sys.argv) > 1 else "2027"
BASE = ROOT / "data" / "supplementary-insurance" / YEAR

BENEFIT_COLUMNS = [
    "insurer", "product_key", "product_name", "product_category", "variant",
    "family", "tag", "secondary_tags", "label", "coverage", "rate_percent",
    "max_amount_chf", "max_period", "unlimited", "waiting_period",
    "conditions", "verification", "source_url",
]
PREMIUM_COLUMNS = [
    "insurer", "product_key", "product_name", "variant", "option", "year",
    "birth_year", "age", "sex", "postal_code", "locality", "accident",
    "monthly_chf", "source_type", "source_url", "retrieved_at", "notes",
]


def text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return " ".join(str(value).split())


def main() -> int:
    taxonomy = json.loads((BASE / "taxonomy.json").read_text(encoding="utf-8"))
    tag_family = {tag["key"]: tag["family"] for tag in taxonomy["tags"]}
    categories = {item["key"] for item in taxonomy["productCategories"]}

    insurers, products, benefit_rows, premium_rows, issues = [], [], [], [], []
    stats = {}

    for path in sorted((BASE / "insurers").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        insurer = data["insurer"]
        key = insurer["key"]
        insurers.append({**insurer, "retrievedAt": data.get("retrievedAt")})
        counts = Counter()
        seen = set()

        for product in data.get("products", []):
            product_key = product["key"]
            if product_key in seen:
                issues.append(f"{key}: clé produit en double {product_key}")
            seen.add(product_key)
            category = product.get("category")
            if category not in categories:
                issues.append(f"{key}/{product_key}: catégorie inconnue {category!r}")
            variants = {v["key"] for v in product.get("variants") or []}
            benefits = product.get("benefits") or []
            if not benefits:
                issues.append(f"{key}/{product_key}: aucune prestation")
            if not product.get("sourceUrls"):
                issues.append(f"{key}/{product_key}: aucune source")
            counts["products"] += 1

            tags_in_product = Counter()
            for benefit in benefits:
                tags = benefit.get("tags") or []
                if not tags:
                    issues.append(f"{key}/{product_key}: prestation sans tag « {benefit.get('label')} »")
                    continue
                for tag in tags:
                    if tag not in tag_family and not tag.startswith("other:"):
                        issues.append(f"{key}/{product_key}: tag inconnu {tag!r}")
                variant = benefit.get("variant")
                if variant and variants and variant not in variants:
                    issues.append(f"{key}/{product_key}: variante inconnue {variant!r}")
                primary = tags[0]
                tags_in_product[primary] += 1
                counts["benefits"] += 1
                counts[f"verification:{benefit.get('verification')}"] += 1
                benefit_rows.append({
                    "insurer": key,
                    "product_key": product_key,
                    "product_name": product["name"],
                    "product_category": category,
                    "variant": text(variant),
                    "family": tag_family.get(primary, "other"),
                    "tag": primary,
                    "secondary_tags": "|".join(tags[1:]),
                    "label": text(benefit.get("label")),
                    "coverage": text(benefit.get("coverage")),
                    "rate_percent": text(benefit.get("ratePercent")),
                    "max_amount_chf": text(benefit.get("maxAmountChf")),
                    "max_period": text(benefit.get("maxPeriod")),
                    "unlimited": text(benefit.get("unlimited")),
                    "waiting_period": text(benefit.get("waitingPeriod")),
                    "conditions": text(benefit.get("conditions")),
                    "verification": text(benefit.get("verification")),
                    "source_url": text(benefit.get("sourceUrl")),
                })

            pricing = product.get("pricing") or {}
            for price in pricing.get("publishedPrices") or []:
                if price.get("monthlyChf") is None:
                    continue
                counts["prices"] += 1
                premium_rows.append({
                    "insurer": key,
                    "product_key": product_key,
                    "product_name": product["name"],
                    "variant": text(price.get("variant")),
                    "option": text(price.get("option")),
                    "year": text(price.get("year")),
                    "birth_year": text(price.get("birthYear")),
                    "age": text(price.get("age") if price.get("age") is not None else price.get("ageBand")),
                    "sex": text(price.get("sex")),
                    "postal_code": text(price.get("postalCode")),
                    "locality": text(price.get("region")),
                    "accident": text(price.get("accident")),
                    "monthly_chf": text(price.get("monthlyChf")),
                    "source_type": text(price.get("sourceType") or "official_published"),
                    "source_url": text(price.get("sourceUrl")),
                    "retrieved_at": text(data.get("retrievedAt")),
                    "notes": text(price.get("profile") or price.get("notes")),
                })

            products.append({
                "insurer": key,
                "key": product_key,
                "name": product["name"],
                "category": category,
                "audience": product.get("audience"),
                "summary": product.get("summary"),
                "variants": product.get("variants") or [],
                "prerequisites": product.get("prerequisites"),
                "pricing": {k: v for k, v in pricing.items() if k != "publishedPrices"},
                "conditionsDoc": product.get("conditionsDoc"),
                "sourceUrls": product.get("sourceUrls") or [],
                "tags": sorted(tags_in_product),
                "benefitCount": sum(tags_in_product.values()),
            })
        stats[key] = dict(counts)

    known_products = {(p["insurer"], p["key"]) for p in products}
    for path in sorted((BASE / "premiums").glob("*.csv")):
        with path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            missing = [c for c in PREMIUM_COLUMNS if c not in (reader.fieldnames or [])]
            if missing:
                issues.append(f"premiums/{path.name}: colonnes manquantes {missing}")
                continue
            count = 0
            unmatched = Counter()
            for row in reader:
                try:
                    float(row["monthly_chf"])
                except (TypeError, ValueError):
                    issues.append(f"premiums/{path.name}: prime illisible {row['monthly_chf']!r}")
                    continue
                # Le fichier porte le nom de la clé assureur ; elle fait foi.
                row["insurer"] = path.stem
                if row["product_key"] and (row["insurer"], row["product_key"]) not in known_products:
                    unmatched[row["product_key"]] += 1
                premium_rows.append({c: row[c] for c in PREMIUM_COLUMNS})
                count += 1
            stats.setdefault(path.stem, {})["calculatorPrices"] = count
            for product_key, n in unmatched.items():
                issues.append(f"premiums/{path.name}: product_key inconnu {product_key!r} ({n} lignes)")

    def write_csv(name, columns, rows):
        with (BASE / name).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)

    write_csv("benefits.csv", BENEFIT_COLUMNS, benefit_rows)
    write_csv("premiums.csv", PREMIUM_COLUMNS, premium_rows)
    (BASE / "products.json").write_text(
        json.dumps({"year": int(YEAR), "insurers": insurers, "products": products},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (BASE / "quality.json").write_text(
        json.dumps({"year": int(YEAR), "perInsurer": stats, "issues": issues},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"{len(insurers)} assureurs, {len(products)} produits, "
          f"{len(benefit_rows)} prestations, {len(premium_rows)} primes, {len(issues)} anomalies")
    for issue in issues[:60]:
        print(" -", issue)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
