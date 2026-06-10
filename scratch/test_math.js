import { create, all } from "https://esm.sh/mathjs@13";
const math = create(all);

function equalStrings(a, b) {
  return String(a) === String(b);
}
math.import({ equalStrings }, { override: false });

try {
  console.log("Test 9 (nested ternary expression for double swing with Magna Latch):");
  const ctx1 = { gate_movement: "double_swing", latch_type: "dd-magna-latch-top-pull", leaf_count: 2 };
  console.log(math.evaluate('(equalStrings(gate_movement, "single_swing") or equalStrings(gate_movement, "double_swing")) ? (equalStrings(latch_type, "dd-magna-latch-top-pull") ? leaf_count - 1 : leaf_count) : 0', ctx1));
} catch (e) {
  console.error("Test 9 failed:", e.message);
}

try {
  console.log("Test 10 (nested ternary expression for double swing with LokkLatch):");
  const ctx2 = { gate_movement: "double_swing", latch_type: "dd-magna-latch-lock-box", leaf_count: 2 };
  console.log(math.evaluate('(equalStrings(gate_movement, "single_swing") or equalStrings(gate_movement, "double_swing")) ? (equalStrings(latch_type, "dd-magna-latch-top-pull") ? leaf_count - 1 : leaf_count) : 0', ctx2));
} catch (e) {
  console.error("Test 10 failed:", e.message);
}

try {
  console.log("Test 11 (nested ternary expression for sliding gate):");
  const ctx3 = { gate_movement: "sliding", latch_type: "dd-magna-latch-top-pull", leaf_count: 1 };
  console.log(math.evaluate('(equalStrings(gate_movement, "single_swing") or equalStrings(gate_movement, "double_swing")) ? (equalStrings(latch_type, "dd-magna-latch-top-pull") ? leaf_count - 1 : leaf_count) : 0', ctx3));
} catch (e) {
  console.error("Test 11 failed:", e.message);
}
