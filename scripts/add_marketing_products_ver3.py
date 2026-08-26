"""
One-off: process the third batch of AI-generated marketing collage images
("AI Generated Images ver3") and add them as new products (Rs.999 each).
Source images live outside the repo at "<repo root's parent>/AI Generated
Images ver3/" - only the compressed output under backend/static/products/
is committed.

Unlike ver2 (which cropped/resized plain source photos), these source
images are already finished multi-panel marketing collages (Key Highlights
panel, callouts, etc.) - the whole collage is used as-is for the product's
main image, just compressed.

Run locally:
    python add_marketing_products_ver3.py    # processes images -> marketing_products_ver3_seed.json
    python seed_marketing_products_ver3.py    # loads that json into the DB (needs DATABASE_URL env var)
"""
import json
import re
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = REPO_ROOT / "AI Generated Images ver3"
SCRIPT_DIR = Path(__file__).resolve().parent
STATIC_OUT = SCRIPT_DIR.parent / "backend" / "static" / "products"

MANIFEST = json.loads((SCRIPT_DIR / "marketing_products_ver3.json").read_text(encoding="utf-8"))

PRICE = 999
STOCK = 20
MATERIAL = "Ultra Soft Plush"
SIZE = "One Size"
DESCRIPTION = (
    "Ultra soft plush winter footwear with an anti-slip sole and a cozy "
    "plush lining - perfect for winter comfort or gifting."
)
MAX_DIMENSION = 1600
JPEG_QUALITY = 85


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return re.sub(r"-+", "-", value).strip("-")


def main():
    records = []
    for entry in MANIFEST:
        src = SRC_DIR / entry["file"]
        img = Image.open(src).convert("RGB")
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

        slug = slugify(f"{entry['name']}-{entry['color']}")
        dest = STATIC_OUT / f"ai3-{slug}" / "main.jpg"
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True)

        records.append({
            "name": entry["name"],
            "color": entry["color"],
            "category": entry["category"],
            "price": PRICE,
            "stock": STOCK,
            "material": MATERIAL,
            "size": SIZE,
            "description": DESCRIPTION,
            "image_url": f"/static/products/ai3-{slug}/main.jpg",
        })

    out_path = SCRIPT_DIR / "marketing_products_ver3_seed.json"
    out_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Processed {len(records)} images -> {out_path}")


if __name__ == "__main__":
    main()
