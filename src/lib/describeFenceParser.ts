import { stripVoiceFillers } from "./voiceFillers";
import { extractMeasurementCandidates } from "./measurementParser";

export type Confidence = "stated" | "inferred" | "default";
export type ColourCode = "B" | "MN" | "G" | "SM" | "W" | "BS" | "D" | "M" | "P" | "PB" | "S";
export type ParsedSystemType = "QSHS" | "VS" | "XPL" | "BAYG" | "SLIDING" | "PEDESTRIAN" | "AF_TIMBER_PALING" | "AF_COLORBOND" | "AF_RETAINING_WALL";

export type ParsedAttribute<T> = {
  value: T;
  confidence: Confidence;
  note?: string;
};

export type ParsedGate = {
  kind: "pedestrian" | "sliding" | "double_swing";
  widthMm?: number;
  position?: "unknown";
};

export type ParseResult = {
  description: string;
  attributes: {
    systemType?: ParsedAttribute<ParsedSystemType>;
    runLengthMm?: ParsedAttribute<number>;
    heightMm?: ParsedAttribute<number>;
    slatSizeMm?: ParsedAttribute<65 | 90>;
    gapMm?: ParsedAttribute<5 | 9 | 20>;
    colourCode?: ParsedAttribute<ColourCode>;
    mountingMethod?: ParsedAttribute<"concreted" | "base_plated" | "core_drilled">;
    termination?: ParsedAttribute<"post_post" | "post_wall" | "wall_wall">;
    cornerCount?: ParsedAttribute<number>;
    gates?: ParsedAttribute<ParsedGate[]>;
  };
  unparsed: string[];
};

const LENGTH_RE = /(\d+(?:\.\d+)?)\s*(mm|mil|mils|cm|m|metres?|meters?|ft|feet|'|in|inch|inches|")\b/gi;

const COLOUR_ALIASES: Array<[RegExp, ColourCode, Confidence]> = [
  [/\b(?:monument|monument matt|mn)\b/i, "MN", "stated"],
  [/\b(?:dark grey|dark gray)\b/i, "MN", "inferred"],
  [/\bcharcoal\b/i, "BS", "inferred"],
  [/\b(?:black|black satin|b)\b/i, "B", "stated"],
  [/\b(?:woodland|woodland grey|woodland gray|wg|g)\b/i, "G", "stated"],
  [/\b(?:surfmist|sm)\b/i, "SM", "stated"],
  [/\b(?:light grey|light gray)\b/i, "SM", "inferred"],
  [/\b(?:pearl white|white gloss|white|w)\b/i, "W", "stated"],
  [/\b(?:basalt|bs)\b/i, "BS", "stated"],
  [/\bdune\b|\bd\b/i, "D", "stated"],
  [/\b(?:cream|beige)\b/i, "D", "inferred"],
  [/\b(?:mill|raw aluminium|raw aluminum|unfinished|m)\b/i, "M", "stated"],
  [/\b(?:primrose|p)\b/i, "P", "stated"],
  [/\b(?:paperbark|pb)\b/i, "PB", "stated"],
  [/\b(?:palladium silver|palladium|silver|s)\b/i, "S", "stated"],
];

function attr<T>(value: T, confidence: Confidence, note?: string): ParsedAttribute<T> {
  return note ? { value, confidence, note } : { value, confidence };
}

function applyDefaults(attributes: ParseResult["attributes"]) {
  attributes.systemType ??= attr("QSHS", "default");
  attributes.runLengthMm ??= attr(0, "default");
  attributes.heightMm ??= attr(1800, "default");
  attributes.slatSizeMm ??= attr(65, "default");
  attributes.gapMm ??= attr(9, "default");
  attributes.colourCode ??= attr("B", "default");
  attributes.mountingMethod ??= attr("concreted", "default");
  attributes.termination ??= attr("post_post", "default");
  attributes.cornerCount ??= attr(0, "default");
  attributes.gates ??= attr([], "default");
}

function mmFromLength(value: number, unit: string) {
  const normalised = unit.toLowerCase();
  if (normalised === "mm" || normalised === "mil" || normalised === "mils") return Math.round(value);
  if (normalised === "cm") return Math.round(value * 10);
  if (/ft|feet|'/.test(normalised)) return Math.round(value * 304.8);
  if (/in|inch|inches|"/.test(normalised)) return Math.round(value * 25.4);
  return Math.round(value * 1000);
}

function systemFromText(text: string): ParsedAttribute<ParsedSystemType> | undefined {
  if (/\bretaining\s*wall\b/i.test(text)) return attr("AF_RETAINING_WALL", "stated");
  if (/\btimber\s*paling|paling\s*fence|timber\s*fence|pine\s*paling|hardwood\s*paling|lapped\s*capped/i.test(text)) return attr("AF_TIMBER_PALING", "stated");
  if (/\bcolorbond|colourbond|sheet\s*metal|steel\s*fence\b/i.test(text)) return attr("AF_COLORBOND", "stated");

  if (/\bbay[-\s]?g\b|buy as you go|infill panel|infill screen/i.test(text)) return attr("BAYG", "stated");
  if (/\bxpress|x-?press|xpl|premium\b/i.test(text)) return attr("XPL", "stated");
  if (/\bvertical\b/i.test(text)) return attr("VS", "stated");
  if (/\bsliding gate|driveway gate\b/i.test(text) && !/\bfence\b/i.test(text)) return attr("SLIDING", "stated");
  if (/\bpedestrian gate|single gate|swing gate\b/i.test(text) && !/\bfence\b/i.test(text)) return attr("PEDESTRIAN", "stated");
  if (/\bpool|boundary|aluminium|aluminum|slat|screen|fence|quickscreen|quick screen\b/i.test(text)) return attr("QSHS", "inferred");
  return undefined;
}

function lengthsFromText(text: string) {
  const explicit = [...text.matchAll(LENGTH_RE)].map((match) => ({
    raw: match[0],
    value: Number(match[1]),
    unit: match[2],
    mm: mmFromLength(Number(match[1]), match[2]),
    index: match.index ?? 0,
  }));
  const fuzzy = extractMeasurementCandidates(text).map((match) => ({
    raw: match.raw,
    value: match.metres,
    unit: "m",
    mm: match.mm,
    index: match.index,
  }));
  const seen = new Set<string>();
  return [...explicit, ...fuzzy]
    .filter((match) => {
      const key = `${match.index}|${match.mm}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.index - b.index);
}

function textWithoutCatalogueSlatSizes(text: string) {
  return text
    .replace(/\b(?:65|90)\s*(?:mm|mil|mils)?\s*slats?\b/gi, " ")
    .replace(/\b(?:65|90)\s*(?:mm|mil|mils)\b(?=[^.]{0,24}\b(?:fence|screen|slat))/gi, " ")
    .replace(/\b(?:5|9|20)\s*(?:mm|mil|mils)?\s*(?:gaps?|spacing)\b/gi, " ");
}

function parseGateCount(text: string) {
  const gatePhrase = /\b(?:with|and|plus|including)?\s*(a|one|1|two|2)?\s*(pedestrian|single|double|swing|sliding)?\s*gates?\b/gi;
  const gates: ParsedGate[] = [];
  for (const match of text.matchAll(gatePhrase)) {
    const countWord = (match[1] ?? "one").toLowerCase();
    const count = countWord === "two" || countWord === "2" ? 2 : 1;
    const kindWord = (match[2] ?? "").toLowerCase();
    const kind: ParsedGate["kind"] =
      kindWord === "sliding"
        ? "sliding"
        : kindWord === "double"
          ? "double_swing"
          : "pedestrian";
    for (let i = 0; i < count; i += 1) gates.push({ kind, position: "unknown" });
  }

  if (gates.length === 0 && /\bgate\b/i.test(text)) {
    gates.push({ kind: /\bsliding\b/i.test(text) ? "sliding" : "pedestrian", position: "unknown" });
  }

  const widthMatch = text.match(/(\d+(?:\.\d+)?)\s*(m|metres?|meters?|mm|mil|mils|cm|ft|feet|')\b[^.]{0,24}\b(?:wide|sliding|opening|gate)/i);
  if (widthMatch && gates.length > 0) {
    const widthMm = mmFromLength(Number(widthMatch[1]), widthMatch[2]);
    const slidingOnly = gates.some((gate) => gate.kind === "sliding");
    gates.forEach((gate) => {
      if (!slidingOnly || gate.kind === "sliding") gate.widthMm = widthMm;
    });
  }
  return gates;
}

function parseCornerCount(text: string): ParsedAttribute<number> {
  const sides = text.match(/\b(two|three|four|five|2|3|4|5)[-\s]+sided|\b(two|three|four|five|2|3|4|5)\s+sides\b/i);
  if (sides) {
    const word = (sides[1] ?? sides[2]).toLowerCase();
    const n = { two: 2, three: 3, four: 4, five: 5 }[word as "two"] ?? Number(word);
    return attr(Math.max(0, n - 1), "stated");
  }
  if (/\bl[-\s]?shaped\b/i.test(text)) return attr(1, "inferred");
  if (/\bu[-\s]?shaped\b/i.test(text)) return attr(2, "inferred");
  if (/\baround the yard|around yard|wrap around/i.test(text)) {
    return attr(2, "inferred", "Likely needs redraw on the layout map.");
  }
  return attr(0, "default");
}

function unparsedTokens(cleaned: string) {
  const stripped = cleaned
    .replace(LENGTH_RE, " ")
    .replace(/\b(65|90)\s*(mm|mil|mils)?\s*slats?\b/gi, " ")
    .replace(/\b(5|9|20)\s*(mm|mil)?\s*(gap|spacing)\b/gi, " ")
    .replace(/\b(monument|black|woodland|surfmist|white|basalt|dune|cream|beige|mill|primrose|paperbark|palladium|silver|dark grey|dark gray|matt|gloss)\b/gi, " ")
    .replace(/\b(qshs|quick\s*screen|quickscreen|vertical|bay[-\s]?g|buy as you go|xpress|xpl|slat|fence|screen|pool|boundary|aluminium|aluminum|panels?|timber|paling|retaining|colorbond|colourbond)\b/gi, " ")
    .replace(/\b(concreted|concrete|base[-\s]?plated|bolted|core[-\s]?drilled|wall|post|gate|pedestrian|single|double|swing|sliding|l[-\s]?shaped|u[-\s]?shaped|sides?|total|about|around|back|with|and|of|high|wide|in|to|a|one|two|three|four|five|the|yard|want|long|length)\b/gi, " ")
    .replace(/[^\w\s-]/g, " ");
  return stripped.split(/\s+/).map((token) => token.trim()).filter((token) => token.length > 2).slice(0, 8);
}

export function parseDescription(input: string): ParseResult {
  const cleaned = stripVoiceFillers(input);
  const lower = cleaned.toLowerCase();
  const attributes: ParseResult["attributes"] = {};

  const systemType = systemFromText(cleaned);
  if (systemType) attributes.systemType = systemType;

  const dimensionText = textWithoutCatalogueSlatSizes(cleaned);
  const lengths = lengthsFromText(dimensionText);
  const firstRunLength = lengths.find((length) => length.mm >= 5000);
  if (firstRunLength) attributes.runLengthMm = attr(firstRunLength.mm, "stated");
  const heightLength =
    lengths.find((length) => length !== firstRunLength && length.mm < 3000) ??
    (!firstRunLength ? lengths.find((length) => length.mm < 3000) : undefined);
  if (heightLength) {
    attributes.heightMm = attr(heightLength.mm, "stated");
  } else {
    const bareHeight = cleaned.match(/\b(\d+(?:\.\d+)?)\s*(?:high|height)\b/i);
    if (bareHeight) {
      const value = Number(bareHeight[1]);
      if (value > 0 && value < 3) attributes.heightMm = attr(Math.round(value * 1000), "stated");
    }
  }

  const slat = lower.match(/\b(65|90)\s*(?:mm|mil|mils)?\s*slats?\b/) ?? lower.match(/\b(65|90)\s*(?:mm|mil)\b/);
  if (slat) {
    const explicit = /\bslats?\b/i.test(slat[0]);
    attributes.slatSizeMm = attr(Number(slat[1]) as 65 | 90, explicit ? "stated" : "inferred");
  }
  if (attributes.systemType?.value === "XPL") attributes.slatSizeMm = attr(65, "inferred");

  const gap = lower.match(/\b(5|9|20)\s*(?:mm|mil)?\s*(?:gaps?|spacing)\b/);
  if (gap) attributes.gapMm = attr(Number(gap[1]) as 5 | 9 | 20, "stated");
  else if (/\btight|privacy|near privacy\b/i.test(cleaned)) attributes.gapMm = attr(5, "stated");
  else if (/\bwide|open\b/i.test(cleaned)) attributes.gapMm = attr(20, "inferred");
  else if (/\bstandard\b/i.test(cleaned)) attributes.gapMm = attr(9, "inferred");
  else if (attributes.systemType?.value && attributes.systemType.value !== "XPL") attributes.gapMm = attr(9, "default");

  const colour = COLOUR_ALIASES.find(([pattern]) => pattern.test(cleaned));
  if (colour) attributes.colourCode = attr(colour[1], colour[2]);

  if (/\bbase[-\s]?plated|bolted to slab|base plate\b/i.test(cleaned)) {
    attributes.mountingMethod = attr("base_plated", "stated");
  } else if (/\bcore[-\s]?drilled|core drill\b/i.test(cleaned)) {
    attributes.mountingMethod = attr("core_drilled", "stated");
  } else if (/\bconcreted|concrete(?:d)? in ground\b/i.test(cleaned)) {
    attributes.mountingMethod = attr("concreted", "stated");
  } else {
    attributes.mountingMethod = attr("concreted", "default");
  }

  if (/\bwall to wall|between walls\b/i.test(cleaned)) attributes.termination = attr("wall_wall", "stated");
  else if (/\bto a wall|into a wall|post to wall|wall end\b/i.test(cleaned)) attributes.termination = attr("post_wall", "stated");
  else attributes.termination = attr("post_post", "default");

  attributes.cornerCount = parseCornerCount(cleaned);
  const gates = parseGateCount(cleaned);
  if (gates.length > 0) attributes.gates = attr(gates, "stated");
  applyDefaults(attributes);

  return {
    description: input,
    attributes,
    unparsed: unparsedTokens(cleaned),
  };
}
