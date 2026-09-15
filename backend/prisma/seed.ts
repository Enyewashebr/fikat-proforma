import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Size generators — corrected against the client's exact data:
//   Thread & Riser: lengths 120,125,140,150,160,180,200,220. Sold as a SET —
//     one thread piece (34cm wide, 3cm thick) + one riser piece (15cm wide,
//     2cm thick) at the same length, always stocked/sold together. The
//     "120*34/15" notation means thread=120x34, riser=120x15.
//   Window Sill:    same 8 lengths, widths 20/25/28/30, thickness 3cm.
//   Doorsill:       same 8 lengths, widths 15/20/25/30 (different from
//                   Window Sill — do not reuse the same width list), thickness 3cm.
//   Landing:        40x40, 60x60, thickness 2cm.
//   Kitchen Top:    220x63, 240x63, 260x70, thickness 2cm.
// Quantities are seed placeholders — adjust from the Stock dashboard once real
// inventory counts are known.
// ---------------------------------------------------------------------------

const STANDARD_LENGTHS_CM = [120, 125, 140, 150, 160, 180, 200, 220];

interface SeedSize {
  lengthCm: number;
  widthCm: number;
  thickness: number;
  secondaryWidthCm?: number;
  secondaryThickness?: number;
}

const THREAD_RISER_SIZES: SeedSize[] = STANDARD_LENGTHS_CM.map((lengthCm) => ({
  lengthCm,
  widthCm: 34, // thread
  thickness: 3,
  secondaryWidthCm: 15, // riser, same length, sold as one set
  secondaryThickness: 2,
}));

const WINDOW_SILL_WIDTHS = [20, 25, 28, 30];
const WINDOW_SILL_SIZES: SeedSize[] = STANDARD_LENGTHS_CM.flatMap((lengthCm) =>
  WINDOW_SILL_WIDTHS.map((widthCm) => ({ lengthCm, widthCm, thickness: 3 }))
);

const DOORSILL_WIDTHS = [15, 20, 25, 30];
const DOORSILL_SIZES: SeedSize[] = STANDARD_LENGTHS_CM.flatMap((lengthCm) =>
  DOORSILL_WIDTHS.map((widthCm) => ({ lengthCm, widthCm, thickness: 3 }))
);

const LANDING_SIZES: SeedSize[] = [
  { lengthCm: 40, widthCm: 40, thickness: 2 },
  { lengthCm: 60, widthCm: 60, thickness: 2 },
];

const KITCHEN_TOP_SIZES: SeedSize[] = [
  { lengthCm: 220, widthCm: 63, thickness: 2 },
  { lengthCm: 240, widthCm: 63, thickness: 2 },
  { lengthCm: 260, widthCm: 70, thickness: 2 },
];

const GRANITE_PRODUCT_TYPES: { name: string; sizes: SeedSize[] }[] = [
  { name: "Thread & Riser", sizes: THREAD_RISER_SIZES },
  { name: "Window Sill", sizes: WINDOW_SILL_SIZES },
  { name: "Doorsill", sizes: DOORSILL_SIZES },
  { name: "Landing", sizes: LANDING_SIZES },
  { name: "Kitchen Top", sizes: KITCHEN_TOP_SIZES },
];

// Seed quantity + starting price per material. Tweak freely — this is just a
// realistic-looking starting catalog, not real inventory counts.
const GRANITE_MATERIALS: { name: string; code: string; pricePerM2: number; seedQty: number }[] = [
  { name: "603", code: "GR-603", pricePerM2: 5700, seedQty: 8 },
  { name: "602", code: "GR-602", pricePerM2: 5700, seedQty: 8 },
  { name: "651", code: "GR-651", pricePerM2: 5900, seedQty: 6 },
  { name: "654", code: "GR-654", pricePerM2: 5900, seedQty: 6 },
  { name: "G-640", code: "GR-G640", pricePerM2: 6200, seedQty: 6 },
  { name: "Galaxy", code: "GR-GALAXY", pricePerM2: 7500, seedQty: 5 },
  { name: "Juprana", code: "GR-JUPRANA", pricePerM2: 6800, seedQty: 5 },
  { name: "Marquino", code: "GR-MARQUINO", pricePerM2: 8200, seedQty: 4 },
];

const CERAMIC_MATERIALS: {
  name: string;
  code: string;
  pricePerM2: number;
  sizes: { lengthCm: number; widthCm: number; thickness: number; quantityAvailable: number }[];
}[] = [
  // Full ceramic catalog as provided by the client. Names are kept exactly
  // as given (not "corrected") since these are the client's actual product
  // names. "Satin Grey" intentionally appears once as a material with TWO
  // stock sizes — same product, two different physical stock records, never
  // merged. Item #11 had no name given, so it is stored as an explicitly
  // unnamed/unconfigured product rather than inventing one — rename it once
  // the admin provides the real name.
  {
    name: "GLM Polished White",
    code: "CER-GLMPW",
    pricePerM2: 1350,
    sizes: [{ lengthCm: 120, widthCm: 60, thickness: 0.9, quantityAvailable: 14 }],
  },
  {
    name: "Mosic White",
    code: "CER-MW",
    pricePerM2: 1100,
    sizes: [{ lengthCm: 120, widthCm: 60, thickness: 0.9, quantityAvailable: 20 }],
  },
  {
    name: "Satin Grey",
    code: "CER-SG",
    pricePerM2: 1200,
    sizes: [
      { lengthCm: 120, widthCm: 60, thickness: 0.9, quantityAvailable: 18 },
      { lengthCm: 60, widthCm: 60, thickness: 1.5, quantityAvailable: 3 }, // low-stock demo
    ],
  },
  {
    name: "Satinlux",
    code: "CER-SLX",
    pricePerM2: 1150,
    sizes: [{ lengthCm: 60, widthCm: 60, thickness: 0.9, quantityAvailable: 16 }],
  },
  {
    name: "Satin Negro",
    code: "CER-SNG",
    pricePerM2: 1250,
    sizes: [{ lengthCm: 60, widthCm: 60, thickness: 1.5, quantityAvailable: 10 }],
  },
  {
    name: "Aquwa Green",
    code: "CER-AQG",
    pricePerM2: 1150,
    sizes: [{ lengthCm: 60, widthCm: 60, thickness: 0.9, quantityAvailable: 12 }],
  },
  {
    name: "White Rabit",
    code: "CER-WRB",
    pricePerM2: 1400,
    sizes: [{ lengthCm: 80, widthCm: 80, thickness: 0.1, quantityAvailable: 8 }],
  },
  {
    name: "Satin White",
    code: "CER-SWH",
    pricePerM2: 1150,
    sizes: [{ lengthCm: 60, widthCm: 60, thickness: 0.9, quantityAvailable: 15 }],
  },
  {
    name: "Rock Otwa",
    code: "CER-ROT",
    pricePerM2: 1300,
    sizes: [{ lengthCm: 30, widthCm: 60, thickness: 0.9, quantityAvailable: 20 }],
  },
  {
    name: "Ivnone Bone",
    code: "CER-IVB",
    pricePerM2: 1150,
    sizes: [{ lengthCm: 30, widthCm: 60, thickness: 0.9, quantityAvailable: 20 }],
  },
  {
    name: "Unnamed ceramic product (rename me)",
    code: "CER-UNNAMED-01",
    pricePerM2: 1150,
    sizes: [{ lengthCm: 40, widthCm: 80, thickness: 0.1, quantityAvailable: 5 }],
  },
];

async function main() {
  await prisma.setting.upsert({
    where: { key: "vatRate" },
    update: {},
    create: { key: "vatRate", value: "0.15" },
  });
  await prisma.setting.upsert({
    where: { key: "currency" },
    update: {},
    create: { key: "currency", value: "ETB" },
  });

  const passwordHash = await bcrypt.hash("admin1234", 12);
  await prisma.user.upsert({
    where: { email: "admin@fikat.local" },
    update: {},
    create: { name: "Admin", email: "admin@fikat.local", passwordHash, role: "ADMIN" },
  });

  for (const materialDef of GRANITE_MATERIALS) {
    const material = await prisma.material.upsert({
      where: { category_name: { category: "GRANITE", name: materialDef.name } },
      update: {},
      create: { category: "GRANITE", name: materialDef.name, code: materialDef.code },
    });

    const existingPrice = await prisma.price.findFirst({ where: { materialId: material.id, productTypeId: null } });
    if (!existingPrice) {
      await prisma.price.create({ data: { materialId: material.id, pricePerM2: materialDef.pricePerM2 } });
    }

    for (const productTypeDef of GRANITE_PRODUCT_TYPES) {
      const productType = await prisma.productType.upsert({
        where: { materialId_name: { materialId: material.id, name: productTypeDef.name } },
        update: {},
        create: { materialId: material.id, name: productTypeDef.name },
      });

      const existing = await prisma.stockSize.count({ where: { productTypeId: productType.id } });
      if (existing > 0) continue;

      await prisma.stockSize.createMany({
        data: productTypeDef.sizes.map((size) => ({
          materialId: material.id,
          productTypeId: productType.id,
          lengthCm: size.lengthCm,
          widthCm: size.widthCm,
          thickness: size.thickness,
          secondaryWidthCm: size.secondaryWidthCm,
          secondaryThickness: size.secondaryThickness,
          quantityAvailable: materialDef.seedQty,
          lowStockThreshold: 5,
        })),
      });
    }
  }

  for (const materialDef of CERAMIC_MATERIALS) {
    const material = await prisma.material.upsert({
      where: { category_name: { category: "CERAMIC", name: materialDef.name } },
      update: {},
      create: { category: "CERAMIC", name: materialDef.name, code: materialDef.code },
    });

    const existingPrice = await prisma.price.findFirst({ where: { materialId: material.id } });
    if (!existingPrice) {
      await prisma.price.create({ data: { materialId: material.id, pricePerM2: materialDef.pricePerM2 } });
    }

    const existingSizes = await prisma.stockSize.count({ where: { materialId: material.id, productTypeId: null } });
    if (existingSizes === 0) {
      await prisma.stockSize.createMany({
        data: materialDef.sizes.map((size) => ({
          materialId: material.id,
          lengthCm: size.lengthCm,
          widthCm: size.widthCm,
          thickness: size.thickness,
          quantityAvailable: size.quantityAvailable,
          lowStockThreshold: 5,
        })),
      });
    }
  }

  const graniteSizeCount = await prisma.stockSize.count({ where: { material: { category: "GRANITE" } } });
  const ceramicSizeCount = await prisma.stockSize.count({ where: { material: { category: "CERAMIC" } } });

  console.log(
    `Seed complete: ${GRANITE_MATERIALS.length} granite materials (${graniteSizeCount} sizes), ` +
      `${CERAMIC_MATERIALS.length} ceramic materials (${ceramicSizeCount} sizes).`
  );
  console.log("Login with admin@fikat.local / admin1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
