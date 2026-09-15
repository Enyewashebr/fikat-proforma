import test from "node:test";
import assert from "node:assert/strict";
import { optimizeStock } from "../stockOptimizer";
import { StockSizeDTO } from "../../types/domain";

// Minimal fake stock size, only the fields the optimizer actually reads.
function stock(id: string, lengthCm: number, widthCm: number, quantityAvailable: number): StockSizeDTO {
  return {
    id,
    materialId: "m1",
    productTypeId: "pt1",
    lengthCm,
    widthCm,
    thickness: 1.5,
    unit: "pcs",
    quantityAvailable,
    quantityReserved: 0,
    lowStockThreshold: 5,
  };
}

test("TEST 1 — one stock piece cut into multiple identical customer pieces", () => {
  const result = optimizeStock(
    { lengthCm: 67, widthCm: 25, quantity: 2 },
    [stock("s140", 140, 25, 1)]
  );
  assert.equal(result.mode, "CUT");
  assert.equal(result.feasible, true);
  assert.equal(result.combination.length, 1);
  assert.equal(result.combination[0].stockPiecesUsed, 1);
  assert.equal(result.combination[0].customerPiecesProduced, 2);
  assert.equal(result.combination[0].wasteLengthCm, 6); // 140 - 2*67 = 6
});

test("TEST 2 — equal yield: smaller suitable stock (1.40) consumed before larger (1.60)", () => {
  const result = optimizeStock(
    { lengthCm: 67, widthCm: 25, quantity: 9 },
    [stock("s140", 140, 25, 4), stock("s160", 160, 25, 10)]
  );
  assert.equal(result.mode, "CUT");
  assert.equal(result.feasible, true);
  assert.equal(result.combination[0].stockSizeId, "s140");
  assert.equal(result.combination[0].stockPiecesUsed, 4);
  assert.equal(result.combination[0].customerPiecesProduced, 8);
  assert.equal(result.combination[1].stockSizeId, "s160");
  assert.equal(result.combination[1].stockPiecesUsed, 1);
  assert.equal(result.combination[1].customerPiecesProduced, 1);
});

test("TEST 3 — higher yield (1.40, yield 2) preferred over smaller-but-lower-yield stock (1.25, yield 1)", () => {
  const result = optimizeStock(
    { lengthCm: 67, widthCm: 25, quantity: 9 },
    [stock("s140", 140, 25, 3), stock("s125", 125, 25, 10)]
  );
  assert.equal(result.combination[0].stockSizeId, "s140");
  assert.equal(result.combination[0].stockPiecesUsed, 3);
  assert.equal(result.combination[0].customerPiecesProduced, 6); // 3 x 2
  assert.equal(result.combination[1].stockSizeId, "s125");
  assert.equal(result.combination[1].stockPiecesUsed, 3);
  assert.equal(result.combination[1].customerPiecesProduced, 3); // 3 x 1
  assert.equal(result.feasible, true);
});

test("TEST 4 — long requirement assembles whole stock pieces, preferring fewer pieces over zero waste", () => {
  const result = optimizeStock(
    { lengthCm: 405, widthCm: 23, quantity: 1 },
    [stock("s125", 125, 25, 10), stock("s140", 140, 25, 10), stock("s200", 200, 25, 10), stock("s220", 220, 25, 10)]
  );
  assert.equal(result.mode, "ASSEMBLE");
  assert.equal(result.feasible, true);
  // Expect the 2-piece 200+220=420 plan (waste 15), not the 3-piece 140+140+125=405 (waste 0) —
  // production preference favors fewer stock pieces over pure waste minimization.
  const usedIds = result.combination.map((c) => c.stockSizeId).sort();
  assert.deepEqual(usedIds, ["s200", "s220"]);
  assert.equal(result.totalStockPiecesUsed, 2);
  assert.equal(result.totalWasteLengthCm, 15);
});

test("TEST 5 — stock narrower than the customer requirement is rejected", () => {
  const tooNarrow = optimizeStock({ lengthCm: 67, widthCm: 23, quantity: 1 }, [stock("s20", 140, 20, 5)]);
  assert.equal(tooNarrow.feasible, false);

  const wideEnough = optimizeStock({ lengthCm: 67, widthCm: 23, quantity: 1 }, [stock("s25", 140, 25, 5)]);
  assert.equal(wideEnough.feasible, true);
});

test("TEST 6 — waste from one stock piece is never combined with another to fabricate an extra piece", () => {
  const result = optimizeStock(
    { lengthCm: 67, widthCm: 25, quantity: 4 },
    [stock("s140", 140, 25, 2)] // 2 stock pieces, each yields exactly 2 -> 4 total, 0 left for a "bonus" piece
  );
  assert.equal(result.feasible, true);
  assert.equal(result.combination[0].customerPiecesProduced, 4);
  // Each stock piece independently wastes 6cm; 12cm total waste can't and doesn't
  // get treated as a 5th producible piece.
  assert.equal(result.combination[0].wasteLengthCm, 12);
  assert.equal(result.totalCustomerPiecesProduced, 4);
});

test("shortage is reported explicitly rather than silently under-filling", () => {
  const result = optimizeStock({ lengthCm: 67, widthCm: 25, quantity: 20 }, [stock("s140", 140, 25, 2)]);
  assert.equal(result.feasible, false);
  assert.equal(result.shortfall?.requestedPieces, 20);
  assert.equal(result.shortfall?.producedPieces, 4);
  assert.equal(result.shortfall?.shortagePieces, 16);
});
