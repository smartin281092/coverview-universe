"""Extract the retained product Bible, without modifying the DOCX (stdlib only).

Usage: python scripts/extract-bible.py [--check]
Anchors are ordinal within this SHA256-pinned revision; do not reuse across revisions.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "references/CoverView_Bible_Produit_Plateforme_v1.5.docx"
OUT = ROOT / "docs/product"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{" + NS["w"] + "}"


def text_of(element: ET.Element) -> str:
    output = []
    for node in element.iter():
        if node.tag == W + "t":
            output.append(node.text or "")
        elif node.tag == W + "tab":
            output.append("\t")
        elif node.tag in (W + "br", W + "cr"):
            output.append("\n")
    return "".join(output)


def extract() -> dict:
    with ZipFile(SOURCE) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
        paragraphs = root.findall(".//w:p", NS)
        ids = {id(p): f"p{i:04d}" for i, p in enumerate(paragraphs, 1)}
        tables = []
        locations = {}
        for index, table in enumerate(root.findall(".//w:tbl", NS), 1):
            anchor = f"t{index:03d}"
            rows = []
            for ri, row in enumerate(table.findall("w:tr", NS), 1):
                cells = []
                for ci, cell in enumerate(row.findall("w:tc", NS), 1):
                    ps = cell.findall(".//w:p", NS)
                    refs = [ids[id(p)] for p in ps]
                    cells.append({"column": ci, "paragraphs": refs})
                    for ref in refs:
                        locations[ref] = {"table": anchor, "row": ri, "column": ci}
                rows.append({"row": ri, "cells": cells})
            tables.append({"anchor": anchor, "rows": rows})
        blocks = []
        for p in paragraphs:
            style = p.find("w:pPr/w:pStyle", NS)
            blocks.append({
                "anchor": ids[id(p)],
                "style": style.get(W + "val") if style is not None else None,
                "text": text_of(p),
                "location": locations.get(ids[id(p)]),
            })
        ancillary = {}
        for part in archive.namelist():
            if part.startswith("word/") and part.endswith(".xml") and any(
                name in part for name in ("header", "footer", "footnotes", "endnotes", "comments")
            ):
                other = ET.fromstring(archive.read(part))
                ancillary[part] = [text_of(p) for p in other.findall(".//w:p", NS)]
        relns = "{http://schemas.openxmlformats.org/package/2006/relationships}"
        rels = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
        targets = {r.get("Id"): r.get("Target") for r in rels.findall(relns + "Relationship")}
        media = []
        for p in paragraphs:
            for node in p.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}blip"):
                target = targets.get(node.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"))
                if target:
                    part = "word/" + target
                    media.append({"paragraph": ids[id(p)], "part": part,
                                  "sha256": hashlib.sha256(archive.read(part)).hexdigest(),
                                  "file": "source-media/" + Path(target).name})
        return {
            "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            "anchor_policy": "Ordinal anchors, stable only for the pinned source SHA256.",
            "counts": {
                "paragraphs": len(blocks),
                "nonempty_paragraphs": sum(bool(b["text"].strip()) for b in blocks),
                "tables": len(tables),
                "table_rows": sum(len(t["rows"]) for t in tables),
                "media": sum(p.startswith("word/media/") for p in archive.namelist()),
                "tracked_insertions": len(root.findall(".//w:ins", NS)),
                "tracked_deletions": len(root.findall(".//w:del", NS)),
                "text_characters": sum(len(b["text"]) for b in blocks),
            },
            "ancillary_text": ancillary,
            "media": media,
            "paragraphs": blocks,
            "tables": tables,
        }


def domain_for(section: str, subsection: str) -> str:
    if section.startswith("R") and re.match(r"R\d+\.", section):
        return "retire"
    match = re.match(r"(\d+)", section)
    if not match:
        return "source-context"
    n = int(match.group(1))
    if n <= 6: return "positioning"
    if n <= 12: return "platform" if n != 12 else "exchange"
    if n <= 20: return "catalog-governance"
    if n <= 29: return "public-site"
    if n <= 31: return "identity-profile"
    if n <= 34: return "documents-signature"
    if n == 35: return "saved-results"
    if n == 36: return "lpp-search"
    if n == 37: return "contract-retrieval"
    if n == 38: return "document-intelligence"
    if n == 39: return "contract-analysis"
    if n == 40: return "operations-audit"
    if n <= 49: return "contract-analysis"
    if n <= 60: return "retirement-strategy"
    if n <= 65: return "engagement-monitoring"
    if n == 66: return "public-site"
    if n == 67:
        if re.match(r"67\.[3-6]\b", subsection): return "coverage-support"
        if subsection.startswith("67.7"): return "digital-pass"
        if subsection.startswith("67.8"): return "miles"
        if subsection.startswith("67.9"): return "rewards"
        if subsection.startswith("67.11"): return "retire"
        return "wallet"
    if n == 68:
        if re.match(r"68\.(1[0-6])\b", subsection): return "admin-copilot"
        if subsection.startswith("68.19"): return "retire"
        return "admin-operations"
    if n == 69: return "partners"
    if n == 70: return "intelligence"
    if n == 71 or n == 90: return "exchange"
    if n <= 76: return "platform-engines-api"
    if n <= 79: return "quality-security"
    if n <= 89: return "end-to-end-workflows"
    if n == 91: return "source-roadmap"
    if n == 92: return "measurement"
    if n == 93: return "acceptance"
    if n == 94: return "open-decisions"
    if n == 95: return "glossary"
    return "source-context"


def inventory(data: dict) -> dict:
    """All text units, not an invented count of atomic validated requirements."""
    headings = []
    context = {}
    path = []
    for block in data["paragraphs"]:
        style = block["style"] or ""
        if style.startswith("Heading"):
            level = int(style.removeprefix("Heading"))
            path = path[:level - 1]
            path.append({"anchor": block["anchor"], "title": block["text"]})
            headings.append({"anchor": block["anchor"], "level": level, "title": block["text"]})
        context[block["anchor"]] = list(path)
    by_id = {p["anchor"]: p for p in data["paragraphs"]}
    table_rows = {}
    table_members = set()
    for table in data["tables"]:
        for row in table["rows"]:
            refs = [ref for cell in row["cells"] for ref in cell["paragraphs"]]
            if not any(by_id[ref]["text"].strip() for ref in refs):
                continue
            table_rows[refs[0]] = (table["anchor"], row, refs)
            table_members.update(refs)
    units = []
    for block in data["paragraphs"]:
        anchor = block["anchor"]
        if anchor in table_members and anchor not in table_rows:
            continue
        if not block["text"].strip() and anchor not in table_rows:
            continue
        section_path = context[anchor]
        section = section_path[0]["title"] if section_path else "Préambule"
        subsection = section_path[-1]["title"] if section_path else ""
        if anchor in table_rows:
            table_anchor, row, refs = table_rows[anchor]
            unit_id = f"bible.v15.{table_anchor}r{row['row']:03d}"
            cells = ["\n".join(by_id[ref]["text"] for ref in cell["paragraphs"]) for cell in row["cells"]]
            statement = " | ".join(cells)
            kind = "table_header" if row["row"] == 1 else "table_row"
        else:
            refs = [anchor]
            unit_id = f"bible.v15.{anchor}"
            statement = block["text"]
            kind = "heading" if (block["style"] or "").startswith("Heading") else "paragraph"
            cells = None
        domain = domain_for(section, subsection)
        if domain in ("open-decisions", "glossary", "source-roadmap", "source-context") and kind not in ("heading", "table_header"):
            kind = domain.replace("-", "_")
        if section.startswith("R16") and kind not in ("heading", "table_header"):
            kind = "open_decisions"
        units.append({
            "id": unit_id, "kind": kind, "domain": domain,
            "source_anchors": refs,
            "source_link": "bible.extracted.md#" + anchor,
            "section_path": section_path,
            "source_statement": statement,
            **({"source_cells": cells} if cells is not None else {}),
        })
    source_nonempty = {p["anchor"] for p in data["paragraphs"] if p["text"].strip()}
    covered = {ref for u in units for ref in u["source_anchors"] if by_id[ref]["text"].strip()}
    assert source_nonempty == covered, "Uncovered or foreign text anchor"
    assert len({u["id"] for u in units}) == len(units), "Duplicate unit ID"
    return {
        "source": data["source"], "sha256": data["sha256"],
        "status": "Derived inventory for complete v1 planning; not implementation or validated atomic acceptance criteria.",
        "policy": "Every nonempty source paragraph is retained. Table cells remain grouped by row with exact column order. Source qualifiers (possible, proposed, future, indicative, to validate) remain verbatim and are not silently promoted or excluded. Domain labels are navigation aids, not decided architecture ownership.",
        "coverage": {"nonempty_source_paragraphs": len(source_nonempty), "covered_nonempty_paragraphs": len(covered),
                     "uncovered_nonempty_paragraphs": 0, "units": len(units), "headings": len(headings),
                     "numbered_sections": sum(bool(re.match(r"(?:\d+(?: bis| ter)?|R\d+)\.", h["title"])) for h in headings if h["level"] == 1)},
        "sections": headings, "units": units,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify retained extraction without writing")
    args = parser.parse_args()
    data = extract()
    requirements = inventory(data)
    markdown = [
        "# Bible v1.5 — extraction dérivée", "",
        "> Généré par `scripts/extract-bible.py`. La source DOCX demeure la référence maître.",
        "> Texte OOXML du corps, ordre des paragraphes et coordonnées des tableaux conservés.",
        "> Aucun rendu ni transcription des images ; ancrages attachés au SHA256 ci-dessous.", "",
        f"Source : `{data['source']}`", f"SHA256 : `{data['sha256']}`", "",
    ]
    for block in data["paragraphs"]:
        location = block["location"]
        coordinate = f" — {location['table']}/r{location['row']}/c{location['column']}" if location else ""
        markdown.extend([f"<a id=\"{block['anchor']}\"></a>",
                         f"**{block['anchor']}{coordinate}** ({block['style'] or 'Normal'})", "",
                         block["text"] or "[Paragraphe vide]", ""])
    markdown.extend(["## Texte annexe (en-tête / pied / notes)", ""])
    for part, texts in data["ancillary_text"].items():
        markdown.extend([f"### {part}", "", *texts, ""])
    outputs = {
        "bible.source.json": json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        "bible.extracted.md": "\n".join(markdown),
        "requirements.json": json.dumps(requirements, ensure_ascii=False, indent=2) + "\n",
    }
    index_lines = ["# Index généré des sections de la bible", "",
                   "> Dérivé de la source maître ; charger uniquement la section utile puis ses ancrages.", "",
                   "| Section source | Domaine indicatif | Ancrage |", "|---|---|---|"]
    current_section = ""
    for heading in requirements["sections"]:
        if heading["level"] == 1:
            current_section = heading["title"]
        index_lines.append(f"| {heading['title']} | {domain_for(current_section, heading['title'])} | [{heading['anchor']}](bible.extracted.md#{heading['anchor']}) |")
    outputs["sections.md"] = "\n".join(index_lines) + "\n"
    if args.check:
        for filename, expected in outputs.items():
            path = OUT / filename
            if not path.exists() or path.read_text(encoding="utf-8") != expected:
                raise SystemExit(f"Stale or missing extraction: {path}")
        with ZipFile(SOURCE) as archive:
            for media in data["media"]:
                if (OUT / media["file"]).read_bytes() != archive.read(media["part"]):
                    raise SystemExit(f"Stale source media: {media['file']}")
        print("Extraction verified against retained DOCX SHA256 and complete OOXML paragraph/table structure.")
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        for filename, content in outputs.items():
            (OUT / filename).write_text(content, encoding="utf-8", newline="\n")
        with ZipFile(SOURCE) as archive:
            for media in data["media"]:
                target = OUT / media["file"]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(media["part"]))
        print(json.dumps({"source": data["counts"], "inventory": requirements["coverage"]}))
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
