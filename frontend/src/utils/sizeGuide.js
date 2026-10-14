// Size & Fit Guide data and parsing.
//
// Product "size" strings come from the supplier catalogue as free text and
// are genuinely messy (e.g. "Peach Pink(36-37)(38-39)(40-41), Pistachio
// Green(36-37)(38-39)" or "One Size (2-4)yrs"). Rather than inventing a
// fixed-format field, we parse the existing string into a best-guess
// category (footwear / kids / sock-length) so we can show a standard,
// clearly-labelled reference chart next to it. The raw text is always
// preserved and shown too, so nothing is ever hidden or overridden.
//
// The conversion numbers below are the commonly published general
// shoe-size/foot-length approximations used across the industry (brands
// vary by a few mm either way) - never a claim specific to this seller's
// own lab-tested measurements.

export const FOOTWEAR_SIZE_CHART = [
  { eu: '36', uk: '3.5', us: '5', cm: '23.0' },
  { eu: '37', uk: '4', us: '6', cm: '23.5' },
  { eu: '38', uk: '5', us: '7', cm: '24.0' },
  { eu: '39', uk: '6', us: '7.5', cm: '24.5' },
  { eu: '40', uk: '6.5', us: '8', cm: '25.0' },
  { eu: '41', uk: '7.5', us: '9', cm: '25.5' },
  { eu: '42', uk: '8', us: '9.5', cm: '26.5' },
  { eu: '43', uk: '9', us: '10', cm: '27.0' },
  { eu: '44', uk: '9.5', us: '10.5', cm: '27.5' },
  { eu: '45', uk: '10.5', us: '11.5', cm: '29.0' },
];

export const KIDS_AGE_CHART = [
  { age: '0-1', label: 'Newborn - 12 months', foot: '~9-12 cm' },
  { age: '0-2', label: 'Newborn - 2 years', foot: '~9-14 cm' },
  { age: '2-4', label: '2 - 4 years', foot: '~14-17 cm' },
  { age: '0-4', label: 'Newborn - 4 years (wide stretch-fit)', foot: '~9-17 cm' },
];

const FOOTWEAR_RANGE_RE = /\((\d{2})\s*-\s*(\d{2})\)/g;
const AGE_RE = /\(?(\d)\s*-\s*(\d)\)?\s*yrs?/gi;
const CM_RE = /(\d{2}(?:\.\d+)?(?:\s*-\s*\d{2}(?:\.\d+)?)?)\)?\s*cm/gi;

/**
 * Figures out which reference chart (if any) fits a product's raw `size`
 * string, and which rows of that chart the listing actually covers, so the
 * guide can highlight them instead of showing a generic table.
 */
export const parseProductSize = (product) => {
  const raw = (product && product.size) || '';

  if (!raw.trim()) {
    return { kind: 'raw', raw: 'One Size', tokens: [] };
  }

  if (/\byrs?\b/i.test(raw)) {
    const tokens = new Set();
    let m;
    AGE_RE.lastIndex = 0;
    while ((m = AGE_RE.exec(raw))) {
      tokens.add(`${m[1]}-${m[2]}`);
    }
    return { kind: 'kids', raw, tokens: Array.from(tokens) };
  }

  if (/cm/i.test(raw)) {
    const tokens = new Set();
    let m;
    CM_RE.lastIndex = 0;
    while ((m = CM_RE.exec(raw))) {
      tokens.add(m[1]);
    }
    return { kind: 'sock', raw, tokens: Array.from(tokens) };
  }

  if (FOOTWEAR_RANGE_RE.test(raw)) {
    const tokens = new Set();
    let m;
    FOOTWEAR_RANGE_RE.lastIndex = 0;
    while ((m = FOOTWEAR_RANGE_RE.exec(raw))) {
      tokens.add(`${m[1]}-${m[2]}`);
    }
    return { kind: 'footwear', raw, tokens: Array.from(tokens) };
  }

  return { kind: 'raw', raw, tokens: [] };
};

/** Whether a chart row's EU size falls inside a matched "36-37" style token. */
export const euInRange = (eu, token) => {
  const [lo, hi] = token.split('-').map(Number);
  const n = Number(eu);
  return n >= lo && n <= hi;
};
