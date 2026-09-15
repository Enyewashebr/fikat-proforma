# PDF branding

`GET /proformas/:id/pdf` (see `backend/src/services/proformaPdf.ts`) prints:

- Company name in Amharic: ፍካት ፊኒሽንግ ማቴሪያልስ አቅራቢ ኃ/የተ/የግ/ማህበር
- Company name in English: FIKAT FINISHING MATERIAL SUPPLIER PLC
- Phone numbers: 0911860605, 0911524938, 0911518961
- Bill To: customer name, **address**, phone, email
- Item table with a **material code** column (e.g. `GR-G640`, `GR-603`,
  `CER-SG`) pulled from the material record the item was added against
- Cutting charge line (only shown when non-zero), Subtotal, VAT, Total

## The Amharic font requirement

pdfkit's built-in PDF standard fonts (Helvetica, Times, Courier) only cover
Latin/WinAnsi text — they **cannot render Ethiopic/Ge'ez glyphs**. To print
the Amharic company name, the PDF needs a Unicode TTF font that includes
Ethiopic coverage.

**To enable it:**

1. Download **Noto Sans Ethiopic** (free, open license) from
   https://fonts.google.com/noto/specimen/Noto+Sans+Ethiopic
2. Save the regular weight `.ttf` file as:
   ```
   backend/assets/fonts/NotoSansEthiopic-Regular.ttf
   ```
3. Restart the backend. No code change needed — `proformaPdf.ts` checks for
   this file at startup and registers it automatically.

**Without the font file**, PDFs still generate correctly — they simply skip
the Amharic line and print the English name only, rather than crashing or
printing broken/missing glyphs (☐☐☐). This was a deliberate fallback, not an
oversight: a PDF endpoint should never 500 just because an optional asset is
missing.
