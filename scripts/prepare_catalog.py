"""
One-off data pipeline: turn PRODUCT LISTING (1).xlsx + the raw HEIC photo
folders into a seedable product catalog (products_seed.json) plus compressed
web-ready JPEGs under backend/static/products/.

Run locally (not part of the deployed backend):
    pip install openpyxl pillow pillow-heif
    python prepare_catalog.py

Outputs:
    products_seed.json      - one record per sellable product/variant
    CATALOG_REVIEW.txt      - anomalies and the Home Slidders folder->SKU
                              mapping for manual spot-check
    ../backend/static/products/<sku>/<slug>.jpg
"""
import json
import re
from pathlib import Path

import openpyxl
import pillow_heif
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
XLSX_PATH = REPO_ROOT / "PRODUCT LISTING (1).xlsx"
SOCKS_BAGS_PHOTO_DIRS = [
    REPO_ROOT / "E-Com Photos" / "E-Com Photos",
    REPO_ROOT / "1345-1168",
]
SLIDDERS_PHOTO_DIR = REPO_ROOT / "Home Slidders"

SCRIPT_DIR = Path(__file__).resolve().parent
STATIC_OUT = SCRIPT_DIR.parent / "backend" / "static" / "products"
SEED_OUT = SCRIPT_DIR / "products_seed.json"
REVIEW_OUT = SCRIPT_DIR / "CATALOG_REVIEW.txt"

CATEGORY_SLUGS = {
    "HOME SOCKS": "socks",
    "HANDMADE BAGS": "bags",
    "HOME SLIDDERS": "slidders",
}
DEFAULT_STOCK = 20
MAX_DIMENSION = 1600
JPEG_QUALITY = 82

IMAGE_EXTS = {".heic", ".jpg", ".jpeg", ".png"}


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", str(value).strip().lower())
    return re.sub(r"-+", "-", value).strip("-") or "item"


def normalize_color(value: str) -> str:
    value = re.sub(r"\([^)]*\)", "", value)  # drop size codes like (28-31)
    value = re.sub(r"[^a-z0-9 ]", "", value.lower())
    return re.sub(r"\s+", " ", value).strip()


def parse_xlsx():
    """Returns list of dicts: category, colours(list[str]), sku, name, mrp,
    size, weight, settlement_price, material, row_number."""
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    ws = wb.active

    products = []
    current_category = None
    in_data_section = False

    for row in ws.iter_rows(min_row=1):
        values = [c.value for c in row]
        col_a, col_b, col_c = values[0], values[1], values[2]

        if col_c and str(col_c).strip().upper() in CATEGORY_SLUGS:
            current_category = str(col_c).strip().upper()
            in_data_section = False
            continue

        if col_a == "COLOUR" and col_b == "SKU":
            in_data_section = True
            continue

        if not in_data_section or current_category is None:
            continue

        if col_a is None or col_b is None:
            continue  # blank spacer row within the section - keep scanning

        colours = [c.strip() for c in str(col_a).split(",") if c.strip()]
        products.append({
            "row": row[0].row,
            "category": current_category,
            "colours": colours,
            "sku": str(col_b).strip(),
            "name": str(values[2]).strip() if values[2] else "",
            "mrp": values[4],
            "size": values[5],
            "weight": values[6],
            "settlement_price": values[7],
            "material": values[8],
        })

    return products


def index_sku_folders(dirs):
    """Map normalized SKU -> list of folder Paths (duplicates flagged later)."""
    index = {}
    for base in dirs:
        if not base.exists():
            continue
        for entry in sorted(base.iterdir()):
            if not entry.is_dir() or entry.name.startswith((".", "__")):
                continue
            key = entry.name.strip().upper()
            index.setdefault(key, []).append(entry)
    return index


def first_image(folder: Path):
    files = sorted(
        f for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXTS
    )
    return files[0] if files else None


def convert_to_web_jpeg(src: Path, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix.lower() == ".heic":
        heif = pillow_heif.read_heif(str(src))
        img = Image.frombytes(heif.mode, heif.size, heif.data, "raw")
    else:
        img = Image.open(src)
    img = img.convert("RGB")
    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
    img.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True)


def match_color_folders(colours, sku_folder: Path):
    """Returns (matched: list[(colour_name, folder_path)], unmatched_colours, extra_folders)"""
    subfolders = [
        f for f in sku_folder.iterdir()
        if f.is_dir() and not f.name.startswith(".")
    ]
    normalized_folders = {normalize_color(f.name): f for f in subfolders}

    matched = []
    unmatched_colours = []
    used_folders = set()

    for colour in colours:
        norm = normalize_color(colour)
        folder = normalized_folders.get(norm)
        if folder is None:
            for norm_name, f in normalized_folders.items():
                if norm and (norm in norm_name or norm_name in norm):
                    folder = f
                    break
        if folder is not None:
            matched.append((colour, folder))
            used_folders.add(folder)
        else:
            unmatched_colours.append(colour)

    extra_folders = [f for f in subfolders if f not in used_folders]
    return matched, unmatched_colours, extra_folders


def build_socks_bags_records(products, sku_index, review):
    records = []
    seen_skus = {}
    for p in products:
        if p["category"] in ("HANDMADE BAGS", "HOME SLIDDERS"):
            continue  # bags have no photos at all; slidders is handled by build_slidders_records

        key = p["sku"].upper()
        folders = sku_index.get(key)
        if not folders:
            review["missing_sku_folder"].append(f"SKU {p['sku']} ({p['name']}, row {p['row']}) - no photo folder found")
            continue
        if len(folders) > 1:
            review["duplicate_sku_folders"].append(f"SKU {p['sku']}: multiple folders found, using {folders[0]}")
        sku_folder = folders[0]

        if key in seen_skus:
            review["duplicate_sku_rows"].append(
                f"SKU {p['sku']} appears on rows {seen_skus[key]} and {p['row']} "
                f"('{p['name']}') - both kept, sharing the same photo folder"
            )
        seen_skus.setdefault(key, []).append(p["row"])

        matched, unmatched, extra = match_color_folders(p["colours"], sku_folder)
        if unmatched:
            review["unmatched_colours"].append(f"SKU {p['sku']} ({p['name']}): no photo folder for {unmatched}")
        if extra:
            review["extra_photo_folders"].append(
                f"SKU {p['sku']} ({p['name']}): unused photo folders {[f.name for f in extra]}"
            )

        product_slug = f"{slugify(p['sku'])}-{slugify(p['name'])}"[:60]
        for colour, folder in matched:
            src = first_image(folder)
            if not src:
                review["empty_folders"].append(f"SKU {p['sku']} color '{colour}': folder has no images")
                continue

            color_slug = slugify(colour)
            dest = STATIC_OUT / product_slug / f"{color_slug}.jpg"
            convert_to_web_jpeg(src, dest)

            records.append({
                "sku": p["sku"],
                "name": p["name"],
                "category": CATEGORY_SLUGS[p["category"]],
                "color": colour,
                "size": str(p["size"]) if p["size"] else None,
                "material": p["material"],
                "price": p["settlement_price"],
                "compare_at_price": p["mrp"],
                "stock": DEFAULT_STOCK,
                "image_url": f"/static/products/{product_slug}/{color_slug}.jpg",
            })

    return records


def build_slidders_records(products, review):
    slidders_rows = [p for p in products if p["category"] == "HOME SLIDDERS"]
    folders = sorted(
        (f for f in SLIDDERS_PHOTO_DIR.iterdir() if f.is_dir() and not f.name.startswith(".")),
        key=lambda f: f.name
    )

    review["slidders_mapping"].append(
        f"{'Folder':<10} {'SKU':<8} {'Product Name':<30} {'Colours'}"
    )
    records = []
    for i, p in enumerate(slidders_rows):
        if i >= len(folders):
            review["slidders_mapping"].append(f"(no folder left for SKU {p['sku']} row {p['row']})")
            continue
        folder = folders[i]
        review["slidders_mapping"].append(
            f"{folder.name:<10} {p['sku']:<8} {p['name']:<30} {', '.join(p['colours'])}"
        )

        src = first_image(folder)
        if not src:
            review["empty_folders"].append(f"Slidders folder {folder.name} (SKU {p['sku']}): no images")
            continue

        product_slug = f"{slugify(p['sku'])}-{slugify(p['name'])}"[:60]
        dest = STATIC_OUT / product_slug / "main.jpg"
        convert_to_web_jpeg(src, dest)

        records.append({
            "sku": p["sku"],
            "name": p["name"],
            "category": CATEGORY_SLUGS[p["category"]],
            "color": " / ".join(p["colours"]),
            "size": str(p["size"]) if p["size"] else None,
            "material": p["material"],
            "price": p["settlement_price"],
            "compare_at_price": p["mrp"],
            "stock": DEFAULT_STOCK,
            "image_url": f"/static/products/{product_slug}/main.jpg",
        })

    return records


def main():
    review = {
        "missing_sku_folder": [],
        "duplicate_sku_folders": [],
        "duplicate_sku_rows": [],
        "unmatched_colours": [],
        "extra_photo_folders": [],
        "empty_folders": [],
        "slidders_mapping": [],
    }

    products = parse_xlsx()
    bags_count = sum(1 for p in products if p["category"] == "HANDMADE BAGS")

    sku_index = index_sku_folders(SOCKS_BAGS_PHOTO_DIRS)
    socks_records = build_socks_bags_records(products, sku_index, review)
    slidders_records = build_slidders_records(products, review)

    all_records = socks_records + slidders_records
    SEED_OUT.write_text(json.dumps(all_records, indent=2), encoding="utf-8")

    lines = [
        "CATALOG PREP REVIEW",
        "====================",
        "",
        f"Seeded {len(socks_records)} sock variants and {len(slidders_records)} home-slidders products "
        f"({len(all_records)} total product rows) into {SEED_OUT.name}.",
        "",
        f"** {bags_count} 'Handmade Bags' products were SKIPPED - no photo folder exists anywhere in the "
        "provided data for any of their SKUs (BB-100, 650, 651, 652, 1405, 1425, 1426, 1427, 673). "
        "Add real photos before this category can go live. **",
        "",
        "--- Home Slidders folder -> SKU mapping (best-effort, sequential order) ---",
        "Please spot-check that the photo actually matches the product/colour before trusting it.",
    ]
    lines += review["slidders_mapping"]

    for title, key in [
        ("Missing photo folders (product skipped)", "missing_sku_folder"),
        ("Duplicate SKU across multiple folders", "duplicate_sku_folders"),
        ("Duplicate SKU across multiple spreadsheet rows", "duplicate_sku_rows"),
        ("Colours with no matching photo folder", "unmatched_colours"),
        ("Photo folders not used by any listed colour", "extra_photo_folders"),
        ("Folders with no image files", "empty_folders"),
    ]:
        lines += ["", f"--- {title} ---"]
        lines += review[key] if review[key] else ["(none)"]

    REVIEW_OUT.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote {len(all_records)} product records to {SEED_OUT}")
    print(f"Review notes written to {REVIEW_OUT}")


if __name__ == "__main__":
    main()
