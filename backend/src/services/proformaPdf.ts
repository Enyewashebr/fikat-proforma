import PDFDocument from "pdfkit";
import { Response } from "express";
import fs from "fs";
import path from "path";
import { Proforma, ProformaItem, Customer, Material } from "@prisma/client";

type ProformaWithRelations = Proforma & {
  items: (ProformaItem & { material: Material })[];
  customer: Customer;
};

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COMPANY_NAME_AMHARIC = "ፍካት ፊኒሽንግ ማቴሪያልስ አቅራቢ ኃ/የተ/የግ/ማህበር";
const COMPANY_NAME_ENGLISH = "FIKAT FINISHING MATERIAL SUPPLIER PLC";
const COMPANY_PHONES = "Tel: 0911860605, 0911524938, 0911518961";



// pdfkit's built-in PDF standard fonts (Helvetica etc.) only cover Latin/
// WinAnsi text — they cannot render Amharic/Ge'ez glyphs. To print the
// Amharic company name, drop a Unicode font that includes Ethiopic coverage
// (e.g. "Noto Sans Ethiopic", free on Google Fonts) at:
//   backend/assets/fonts/NotoSansEthiopic-Regular.ttf
// If it's not present, the PDF still generates correctly — it just skips
// the Amharic line and prints the English name only, rather than crashing
// or printing broken glyphs.

const ETHIOPIC_FONT_PATH = path.join(__dirname, "..", "..", "assets", "fonts", "NotoSerifEthiopic-Regular.ttf");
const hasEthiopicFont = fs.existsSync(ETHIOPIC_FONT_PATH);
/**
 * Streams a printable proforma PDF straight to the HTTP response. Deliberately
 * simple/dependency-light (pdfkit, no headless browser) so it runs anywhere
 * Node runs.
 */
export function streamProformaPdf(proforma: ProformaWithRelations, res: Response) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  if (hasEthiopicFont) {
    doc.registerFont("Ethiopic", ETHIOPIC_FONT_PATH);
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${proforma.number || "proforma-draft"}.pdf"`
  );
  doc.pipe(res);

  // --- Header: company identity ---
  let headerY = 45;
  if (hasEthiopicFont) {
    doc.font("Ethiopic").fontSize(13).fillColor("#000").text(COMPANY_NAME_AMHARIC, 50, headerY, { width: 350 });
    headerY += 20;
  }
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#000").text(COMPANY_NAME_ENGLISH, 50, headerY, { width: 350 });
  headerY += 16;
  doc.font("Helvetica").fontSize(9).fillColor("#555").text(COMPANY_PHONES, 50, headerY, { width: 350 });

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#000")
    .text("PROFORMA INVOICE", 300, 45, { align: "right", width: 245 });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#333")
    .text(`No: ${proforma.number || "DRAFT"}`, 300, 68, { align: "right", width: 245 })
    .text(`Date: ${proforma.finalizedAt ? formatDate(proforma.finalizedAt) : formatDate(new Date())}`, {
      align: "right",
      width: 245,
    });

  doc.moveTo(50, 115).lineTo(545, 115).strokeColor("#ccc").stroke();

  // --- Bill to (customer address, per the client's spec) ---
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#000").text("Bill to", 50, 128);
  doc.font("Helvetica").fontSize(10).fillColor("#333");
  let billY = 143;
  doc.text(proforma.customer.name, 50, billY);
  billY += 14;
  if (proforma.customer.address) {
    doc.text(proforma.customer.address, 50, billY, { width: 350 });
    billY += 14;
  }
  if (proforma.customer.phone) {
    doc.text(proforma.customer.phone, 50, billY);
    billY += 14;
  }
  if (proforma.customer.email) {
    doc.text(proforma.customer.email, 50, billY);
    billY += 14;
  }

  // --- Item table (includes material code, e.g. "GR-G640", "GR-603") ---
  const tableTop = Math.max(230, billY + 15);
  const cols = {
    item: 50,
    code: 195,
    dims: 245,
    unit: 320,
    qty: 355,
    unitPrice: 400,
    total: 475,
  };

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
  doc.text("Item", cols.item, tableTop, { width: 140 });
  doc.text("Code", cols.code, tableTop, { width: 45 });
  doc.text("L x W (m)", cols.dims, tableTop, { width: 70 });
  doc.text("Unit", cols.unit, tableTop, { width: 30 });
  doc.text("Qty", cols.qty, tableTop, { width: 40 });
  doc.text("Unit price", cols.unitPrice, tableTop, { width: 70, align: "right" });
  doc.text("Total", cols.total, tableTop, { width: 70, align: "right" });
  doc.moveTo(50, tableTop + 13).lineTo(545, tableTop + 13).strokeColor("#ccc").stroke();

  let y = tableTop + 20;
  doc.font("Helvetica").fontSize(8).fillColor("#333");

  for (const item of proforma.items) {
    if (y > 700) {
      doc.addPage();
      y = 60;
    }
    const dims =
      item.pricingMode === "AREA_TOTAL"
        ? `${item.requestedAreaM2?.toFixed(2)} m² total`
        : `${(item.customerLengthCm / 100).toFixed(2)} x ${(item.customerWidthCm / 100).toFixed(2)}`;

    doc.text(item.itemLabel, cols.item, y, { width: 140 });
    doc.text(item.material.code || "—", cols.code, y, { width: 45 });
    doc.text(dims, cols.dims, y, { width: 70 });
    doc.text(item.pricingMode === "PIECE" ? "pc" : item.unit, cols.unit, y, { width: 30 });
    doc.text(String(item.quantity), cols.qty, y, { width: 40 });
    doc.text(money(item.unitPrice), cols.unitPrice, y, { width: 70, align: "right" });
    doc.text(money(item.totalPrice), cols.total, y, { width: 70, align: "right" });
    y += 18;
  }

  y += 8;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#ccc").stroke();
  y += 12;

  doc.font("Helvetica").fontSize(10);
  if (proforma.cuttingCharge > 0) {
    totalsLine(doc, "Cutting charge", proforma.cuttingCharge, y);
    y += 16;
  }
  totalsLine(doc, "Subtotal", proforma.subtotal, y);
  y += 16;
  totalsLine(doc, `VAT (${(proforma.vatRate * 100).toFixed(0)}%)`, proforma.vatAmount, y);
  y += 16;
  doc.font("Helvetica-Bold");
  totalsLine(doc, "Total", proforma.grandTotal, y);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#999")
    .text(`This proforma was generated by ${COMPANY_NAME_ENGLISH}.`, 50, 780, { width: 495, align: "center" });

  doc.end();
}

function totalsLine(doc: PDFKit.PDFDocument, label: string, value: number, y: number) {
  doc.text(label, 380, y, { width: 100, align: "right" });
  doc.text(money(value), 480, y, { width: 65, align: "right" });
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
