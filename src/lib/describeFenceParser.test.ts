import { parseDescription, type Confidence, type ParseResult } from "./describeFenceParser";

type ExpectedAttribute = {
  value?: unknown;
  confidence?: Confidence;
  noteIncludes?: string;
};

type ExpectedGate = {
  kind: "pedestrian" | "sliding" | "double_swing";
  widthMm?: number;
};

type ParserTestCase = {
  id: string;
  input: string;
  expected: Partial<Record<keyof ParseResult["attributes"], ExpectedAttribute>>;
  gates?: ExpectedGate[];
  unparsed?: string[];
};

export const describeFenceParserTestCases: ParserTestCase[] = [
  {
    id: "TC-01",
    input: "I want 30 m of a 1.8 m high aluminum slat fence using 65 mil slats with 9 mil gaps in Monument and one single pedestrian gate.",
    expected: {
      systemType: { value: "QSHS", confidence: "inferred" },
      runLengthMm: { value: 30000, confidence: "stated" },
      heightMm: { value: 1800, confidence: "stated" },
      slatSizeMm: { value: 65, confidence: "stated" },
      gapMm: { value: 9, confidence: "stated" },
      colourCode: { value: "MN", confidence: "stated" },
      mountingMethod: { value: "concreted", confidence: "default" },
      termination: { value: "post_post", confidence: "default" },
      cornerCount: { value: 0, confidence: "default" },
      gates: { confidence: "stated" },
    },
    gates: [{ kind: "pedestrian" }],
  },
  {
    id: "TC-02",
    input: "100 feet of 6 ft fence in black, vertical slats, two gates.",
    expected: {
      systemType: { value: "VS", confidence: "stated" },
      runLengthMm: { value: 30480, confidence: "stated" },
      heightMm: { value: 1829, confidence: "stated" },
      gapMm: { value: 9, confidence: "default" },
      colourCode: { value: "B", confidence: "stated" },
      mountingMethod: { value: "concreted", confidence: "default" },
      gates: { confidence: "stated" },
    },
    gates: [{ kind: "pedestrian" }, { kind: "pedestrian" }],
  },
  {
    id: "TC-03",
    input: "20 metres of 6 ft fence, monument matt, 90 slats, tight gap.",
    expected: {
      systemType: { value: "QSHS", confidence: "inferred" },
      runLengthMm: { value: 20000, confidence: "stated" },
      heightMm: { value: 1829, confidence: "stated" },
      slatSizeMm: { value: 90, confidence: "stated" },
      gapMm: { value: 5, confidence: "stated" },
      colourCode: { value: "MN", confidence: "stated" },
    },
  },
  {
    id: "TC-04",
    input: "Pool fence in black.",
    expected: {
      systemType: { value: "QSHS", confidence: "inferred" },
      runLengthMm: { value: 0, confidence: "default" },
      heightMm: { value: 1800, confidence: "default" },
      slatSizeMm: { value: 65, confidence: "default" },
      gapMm: { value: 9, confidence: "default" },
      colourCode: { value: "B", confidence: "stated" },
      mountingMethod: { value: "concreted", confidence: "default" },
      termination: { value: "post_post", confidence: "default" },
      cornerCount: { value: 0, confidence: "default" },
      gates: { confidence: "default" },
    },
    unparsed: [],
  },
  {
    id: "TC-05",
    input: "Sliding gate 4 metres wide, monument, with motor.",
    expected: {
      systemType: { value: "SLIDING", confidence: "stated" },
      colourCode: { value: "MN", confidence: "stated" },
      gates: { confidence: "stated" },
    },
    gates: [{ kind: "sliding", widthMm: 4000 }],
  },
  {
    id: "TC-06",
    input: "Buy as you go panels, 12 m, 1.8 high, dune.",
    expected: {
      systemType: { value: "BAYG", confidence: "stated" },
      runLengthMm: { value: 12000, confidence: "stated" },
      heightMm: { value: 1800, confidence: "stated" },
      colourCode: { value: "D", confidence: "stated" },
    },
  },
  {
    id: "TC-07",
    input: "umm so I want like 30 metres uhh 1.8 metre high slat fence in monument 65mm slats and a gate yeah",
    expected: {
      systemType: { value: "QSHS", confidence: "inferred" },
      runLengthMm: { value: 30000, confidence: "stated" },
      heightMm: { value: 1800, confidence: "stated" },
      slatSizeMm: { value: 65, confidence: "stated" },
      colourCode: { value: "MN", confidence: "stated" },
      gates: { confidence: "stated" },
    },
    gates: [{ kind: "pedestrian" }],
  },
  {
    id: "TC-08",
    input: "15m fence, 1.8m, 65mm woodland grey, with one pedestrian gate and one sliding gate 3m wide.",
    expected: {
      systemType: { value: "QSHS", confidence: "inferred" },
      runLengthMm: { value: 15000, confidence: "stated" },
      heightMm: { value: 1800, confidence: "stated" },
      slatSizeMm: { value: 65, confidence: "inferred" },
      colourCode: { value: "G", confidence: "stated" },
      gates: { confidence: "stated" },
    },
    gates: [{ kind: "pedestrian" }, { kind: "sliding", widthMm: 3000 }],
  },
  {
    id: "TC-09",
    input: "Fence in black, 65mm.",
    expected: {
      systemType: { value: "QSHS", confidence: "inferred" },
      slatSizeMm: { value: 65, confidence: "inferred" },
      colourCode: { value: "B", confidence: "stated" },
    },
    unparsed: [],
  },
  {
    id: "TC-10",
    input: "Fence around the back yard, three sides, total about 90 feet, 6 ft high.",
    expected: {
      systemType: { value: "QSHS", confidence: "inferred" },
      runLengthMm: { value: 27432, confidence: "stated" },
      heightMm: { value: 1829, confidence: "stated" },
      cornerCount: { value: 2, confidence: "stated" },
    },
    unparsed: [],
  },
  {
    id: "TC-11",
    input: "25m of 90mm slat fence, 1.5m high, 20mm spacing, primrose, base-plated to slab.",
    expected: {
      systemType: { value: "QSHS", confidence: "inferred" },
      runLengthMm: { value: 25000, confidence: "stated" },
      heightMm: { value: 1500, confidence: "stated" },
      slatSizeMm: { value: 90, confidence: "stated" },
      gapMm: { value: 20, confidence: "stated" },
      colourCode: { value: "P", confidence: "stated" },
      mountingMethod: { value: "base_plated", confidence: "stated" },
    },
  },
  {
    id: "TC-12",
    input: "XPress Plus, 18 metres, surfmist, 9mm gap, 1.8m high.",
    expected: {
      systemType: { value: "XPL", confidence: "stated" },
      runLengthMm: { value: 18000, confidence: "stated" },
      heightMm: { value: 1800, confidence: "stated" },
      slatSizeMm: { value: 65, confidence: "inferred" },
      gapMm: { value: 9, confidence: "stated" },
      colourCode: { value: "SM", confidence: "stated" },
    },
  },
  {
    id: "TC-13",
    input: "20m of timber paling fence, 1.8m high",
    expected: {
      systemType: { value: "AF_TIMBER_PALING", confidence: "stated" },
      runLengthMm: { value: 20000, confidence: "stated" },
      heightMm: { value: 1800, confidence: "stated" },
    },
    unparsed: [],
  },
  {
    id: "TC-14",
    input: "Colorbond fence in monument matt, 30m long",
    expected: {
      systemType: { value: "AF_COLORBOND", confidence: "stated" },
      runLengthMm: { value: 30000, confidence: "stated" },
      colourCode: { value: "MN", confidence: "stated" },
    },
    unparsed: [],
  },
  {
    id: "TC-15",
    input: "Retaining wall, 12 meters",
    expected: {
      systemType: { value: "AF_RETAINING_WALL", confidence: "stated" },
      runLengthMm: { value: 12000, confidence: "stated" },
    },
    unparsed: [],
  },
];

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

export function runDescribeFenceParserTestCases() {
  for (const testCase of describeFenceParserTestCases) {
    const result = parseDescription(testCase.input);
    for (const [key, expected] of Object.entries(testCase.expected)) {
      const attribute = result.attributes[key as keyof ParseResult["attributes"]];
      if (expected.confidence) assertEqual(attribute?.confidence, expected.confidence, `${testCase.id} ${key}.confidence`);
      if ("value" in expected) assertEqual(attribute?.value, expected.value, `${testCase.id} ${key}.value`);
      if (expected.noteIncludes && !attribute?.note?.toLowerCase().includes(expected.noteIncludes.toLowerCase())) {
        throw new Error(`${testCase.id} ${key}.note missing "${expected.noteIncludes}"`);
      }
    }
    if (testCase.gates) {
      const gates = result.attributes.gates?.value ?? [];
      assertEqual(gates.length, testCase.gates.length, `${testCase.id} gates.length`);
      testCase.gates.forEach((expectedGate, index) => {
        assertEqual(gates[index]?.kind, expectedGate.kind, `${testCase.id} gates[${index}].kind`);
        if (expectedGate.widthMm) assertEqual(gates[index]?.widthMm, expectedGate.widthMm, `${testCase.id} gates[${index}].widthMm`);
      });
    }
    if (testCase.unparsed) {
      assertEqual(result.unparsed.join("|"), testCase.unparsed.join("|"), `${testCase.id} unparsed`);
    }
  }
}
