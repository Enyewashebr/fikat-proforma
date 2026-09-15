# Fonts

Drop `NotoSansEthiopic-Regular.ttf` here to enable the Amharic company name
on generated proforma PDFs (see `backend/src/services/proformaPdf.ts`).

Download it free from Google Fonts:
https://fonts.google.com/noto/specimen/Noto+Sans+Ethiopic

Without this file, PDFs still generate correctly — they just print the
English company name only (no crash, no missing/broken glyphs).
