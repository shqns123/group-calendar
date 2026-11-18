import test from "node:test";
import assert from "node:assert/strict";
import { readEquipmentCategories, sanitizeEquipmentCategories } from "../lib/equipmentCategories.ts";
import * as mobile from "../mobile/src/lib/equipment.ts";

for (const [name, api] of [["web", { readEquipmentCategories, sanitizeEquipmentCategories }], ["mobile", mobile]] as const) {
  test(`${name}: legacy targets become a quantity category`, () => {
    const categories = api.readEquipmentCategories({ trackerOptions: "T-01", targetCount: 3 });
    assert.deepEqual(categories.find((category) => category.id === "target"), { id: "target", name: "타겟", items: [], quantity: 3 });
  });
  test(`${name}: saved quantity categories and aliases survive sanitization`, () => {
    const categories = api.sanitizeEquipmentCategories([{ id: "c1", name: "삼각대", quantity: 5, aliases: ["기존 삼각대"], items: ["unused"] }]);
    assert.deepEqual(categories, [{ id: "c1", name: "삼각대", items: [], quantity: 5, aliases: ["기존 삼각대"] }]);
    assert.equal(api.readEquipmentCategories({ equipmentCategories: JSON.stringify(categories), targetCount: 0 }).length, 1);
  });
}
