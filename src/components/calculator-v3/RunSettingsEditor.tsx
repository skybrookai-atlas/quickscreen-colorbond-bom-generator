import { ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCalculator } from "../../context/CalculatorContext";
import { useProductVariables } from "../../hooks/useProductVariables";
import type { CanonicalRun } from "../../types/canonical.types";
import { defaultGateBuildForMovement, gateMovementOrDefault } from "../../lib/gateOptionRules";
import {
  applyProductOptionRules,
  normaliseVariablesForSystem,
} from "../../lib/productOptionRules";
import { GATE_SEGMENT_STUB_KEYS } from "../../lib/segmentTermination";
import {
  POST_FIXING_MATERIALS,
  isPreferredGroutSku,
} from "../../lib/postFixingOptions";
import { getPreferredGroutSku, setPreferredGroutSku } from "../../lib/userPrefs";
import { SchemaDrivenForm, type SchemaField } from "./SchemaDrivenForm";
import { colourName } from "./ColourPalette";
import { SettingsDisclosureRow } from "./SettingsDisclosureRow";
import { CombinedGapSelect } from "./CombinedGapSelect";
import {
  combinedGapLabel,
  normaliseGapMode,
  type GapMode,
} from "../../lib/gapChoices";

interface Props {
  run: CanonicalRun;
  onCollapse?: () => void;
}

const HIDDEN_FIELD_KEYS = new Set([
  "left_boundary_type",
  "right_boundary_type",
  "target_height_mm",
  "slat_stock_length_mm",
  "rail_stock_length_mm",
  "side_frame_stock_length_mm",
  "louvre_treatment",
]);

const VALUE_LABELS: Record<string, string> = {
  standard: "Standard slats",
  economy: "Economy slats",
  alumawood: "Alumawood timber-look",
  spacer: "Preset spacer gaps",
  custom: "Custom gap",
  in_ground: "Concreted in ground",
  base_plate: "Base plated",
  core_drill: "Core drilled",
  xpl: "XPress Plus post",
  standard_50: "50mm Post Standard",
  standard_65: "65mm Post Standard HD",
};

function shapeRunField(field: SchemaField, productCode: string): SchemaField | null {
  if (HIDDEN_FIELD_KEYS.has(field.field_key)) return null;
  if (
    field.field_key === "mounting_method" &&
    field.label.toLowerCase().includes("mounting")
  ) {
    return {
      ...field,
      label: "Post mounting type",
      default_value_json: "in_ground",
      options_json: ["in_ground", "base_plate", "core_drill"],
    };
  }
  if (field.field_key === "mounting_type") {
    return {
      ...field,
      label: "Post mounting type",
      default_value_json: "in_ground",
      options_json: ["in_ground", "base_plate", "core_drill"],
    };
  }
  if (field.field_key === "post_system") {
    return {
      ...field,
      label: "Post size",
      default_value_json: productCode === "XPL" ? "xpl" : "standard_50",
    };
  }
  if (field.field_key === "post_size") {
    return {
      ...field,
      label: "Standard post size",
      default_value_json: "50",
    };
  }
  if (field.field_key === "max_panel_width_mm") {
    return {
      ...field,
      label: "Max Post Spacing",
      default_value_json: 2600,
    };
  }
  return field;
}

function fieldValueLabel(field: SchemaField, variables: Record<string, string | number | boolean>) {
  const raw = variables[field.field_key] ?? field.default_value_json;
  if (field.field_key === "colour_code" || field.field_key === "post_colour_code") {
    return colourName(raw);
  }
  if (raw === true) return "Yes";
  if (raw === false) return "No";
  if (raw === undefined || raw === null || raw === "") return "Default";
  if (VALUE_LABELS[String(raw)]) return VALUE_LABELS[String(raw)];
  return `${raw}${field.unit ? field.unit : ""}`;
}

function postLabel(productCode: string, variables: Record<string, string | number | boolean>) {
  const postSystem = String(variables.post_system ?? (productCode === "XPL" ? "xpl" : "standard_50"));
  if (postSystem === "xpl") return "XPress Plus post";
  if (postSystem === "standard_65" || Number(variables.post_size ?? 50) === 65) return "65mm Post Standard HD";
  return "50mm Post Standard";
}

function getFieldGroup(fieldKey: string): "style" | "posts" | "palings" | "rails" | "extras" {
  const k = fieldKey.toLowerCase();
  if (
    k.includes("colour_code") ||
    k.includes("finish_family") ||
    k.includes("slat_size") ||
    k.includes("slat_gap") ||
    k.includes("louvre") ||
    k.includes("finish") ||
    k === "colour"
  ) {
    return "style";
  }
  if (
    k.includes("post") ||
    k.includes("mounting") ||
    k.includes("substrate") ||
    k.includes("fixing") ||
    k.includes("grout") ||
    k.includes("concrete")
  ) {
    return "posts";
  }
  if (k.includes("paling") || k.includes("blade") || k.includes("infill_type") || k.includes("sheet")) {
    return "palings";
  }
  if (k.includes("rail") || k.includes("capping")) {
    return "rails";
  }
  return "extras";
}

export function RunSettingsEditor({ run, onCollapse }: Props) {
  const { state, dispatch } = useCalculator();
  const [postColourOpen, setPostColourOpen] = useState(() => {
    const colour = String(run.variables?.colour_code ?? "B");
    return Boolean(run.variables?.post_colour_code && run.variables.post_colour_code !== colour);
  });
  const [fixingsOpen, setFixingsOpen] = useState(false);
  const productCode = run.productCode;
  const { data: jobFields = [] } = useProductVariables(productCode, "job");
  const { data: runFields = [] } = useProductVariables(productCode, "run");
  const variables = {
    ...(state.payload?.variables ?? {}),
    ...(run.variables ?? {}),
  } as Record<string, string | number | boolean>;

  const fields = applyProductOptionRules(
    productCode,
    [
      ...jobFields.filter((field) => !HIDDEN_FIELD_KEYS.has(field.field_key)),
      ...runFields
        .map((field) => shapeRunField(field, productCode))
        .filter((field): field is SchemaField => Boolean(field)),
    ],
    variables,
  );
  const mountingType = String(
    variables.mounting_type ?? variables.mounting_method ?? "in_ground",
  );
  const postFixingSku = isPreferredGroutSku(variables.post_fixing_material_sku)
    ? variables.post_fixing_material_sku
    : getPreferredGroutSku();
  const substrate = String(variables.base_plate_substrate ?? "concrete");
  const slatSize = Number(variables.slat_size_mm ?? 65);
  const louvreEnabled = variables.louvre_treatment === true || variables.louvre_treatment === "true";
  const gapMode = normaliseGapMode(productCode, variables.slat_gap_mode);
  const gapMm = Number(variables.slat_gap_mm ?? 9);
  const fieldMap = useMemo(() => new Map(fields.map((field) => [field.field_key, field])), [fields]);

  function renderField(key: string) {
    const field = fieldMap.get(key);
    if (!field) return null;
    return (
      <SchemaDrivenForm
        fields={[field]}
        variables={variables}
        onChange={updateRunVariables}
      />
    );
  }

  function valueFor(key: string, fallback = "") {
    const field = fieldMap.get(key);
    return field ? fieldValueLabel(field, variables) : fallback;
  }

  useEffect(() => {
    if (run.variables?.post_fixing_material_sku) return;
    dispatch({
      type: "UPSERT_RUN",
      run: {
        ...run,
        variables: {
          ...(run.variables ?? {}),
          post_fixing_material_sku: getPreferredGroutSku(),
        },
      },
    });
  }, [dispatch, run]);

  function updateRunVariables(
    key: string,
    value: string | number | boolean,
    nextProductCode = productCode,
    extraVariables: Record<string, string | number | boolean> = {},
  ) {
    const previousColour = String(variables.colour_code ?? "");
    const previousPostColour = String(variables.post_colour_code ?? previousColour);
    const nextVariables: Record<string, string | number | boolean> = {
      ...(run.variables ?? {}),
      [key]: value,
      ...extraVariables,
    };
    if (key === "mounting_type" || key === "mounting_method") {
      nextVariables.mounting_type = value;
      nextVariables.mounting_method = value;
      if (value === "base_plate" && !nextVariables.base_plate_substrate) {
        nextVariables.base_plate_substrate = "concrete";
      }
      if (value === "in_ground" && !nextVariables.post_fixing_material_sku) {
        nextVariables.post_fixing_material_sku = getPreferredGroutSku();
      }
    }
    if (key === "post_fixing_material_sku" && isPreferredGroutSku(value)) {
      setPreferredGroutSku(value);
    }
    if (key === "post_system") {
      nextVariables.post_size = value === "standard_65" ? 65 : 50;
    }
    if (key === "colour_code" && (!run.variables?.post_colour_code || previousPostColour === previousColour)) {
      nextVariables.post_colour_code = value;
    }
    const normalised = normaliseVariablesForSystem(nextProductCode, nextVariables);
    const syncKeys = new Set([
      "finish_family",
      "slat_size_mm",
      "slat_gap_mm",
      "slat_gap_mode",
      "slat_count",
      "colour_code",
      "post_colour_code",
      "post_size",
      "post_system",
      "mounting_type",
      "mounting_method",
      "max_panel_width_mm",
      "louvre_treatment",
    ]);
    const resetSectionKeys = [
      key,
      ...Object.keys(extraVariables),
      ...(key === "colour_code" ? ["colour_code", "post_colour_code"] : []),
      ...(key === "post_system" ? ["post_system", "post_size"] : []),
      ...(key === "mounting_type" || key === "mounting_method" ? ["mounting_type", "mounting_method"] : []),
    ];
    const clearKeys = (vars: Record<string, unknown> | undefined) => {
      const next: Record<string, string | number | boolean> = {};
      for (const [item, value] of Object.entries(vars ?? {})) {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          next[item] = value;
        }
      }
      for (const item of resetSectionKeys) delete next[item];
      return Object.keys(next).length ? next : undefined;
    };

    dispatch({
      type: "UPSERT_RUN",
      run: {
        ...run,
        productCode: nextProductCode,
        variables: normalised,
        segments: syncKeys.has(key)
          ? run.segments.map((segment) => {
            if (segment.segmentKind === "gate_opening") {
              const movement = gateMovementOrDefault(segment.variables?.[GATE_SEGMENT_STUB_KEYS.gateMovement]);
              return {
                ...segment,
                variables: {
                  ...(clearKeys(segment.variables) ?? {}),
                  [GATE_SEGMENT_STUB_KEYS.gateBuild]: defaultGateBuildForMovement(movement, nextProductCode === "VS"),
                  [GATE_SEGMENT_STUB_KEYS.colourCode]: String(normalised.colour_code ?? "B"),
                  [GATE_SEGMENT_STUB_KEYS.slatSizeMm]: Number(normalised.slat_size_mm ?? 65),
                  [GATE_SEGMENT_STUB_KEYS.slatGapMm]: Number(normalised.slat_gap_mm ?? 9),
                  [GATE_SEGMENT_STUB_KEYS.gatePostSizeMm]: Number(normalised.post_size ?? 50),
                },
              };
            }
            return {
              ...segment,
              variables: clearKeys(segment.variables),
            };
          })
          : run.segments,
      },
    });
  }

  function updateRunGap(mode: GapMode, gapMm: number) {
    updateRunVariables("slat_gap_mode", mode, productCode, {
      slat_gap_mm: gapMm,
    });
  }

  const styleFieldsToRender = fields.filter(
    (f) => getFieldGroup(f.field_key) === "style" && f.field_key !== "slat_gap_mm" && f.field_key !== "slat_gap_mode" && f.field_key !== "louvre_treatment"
  );
  const postsFieldsToRender = fields.filter(
    (f) => getFieldGroup(f.field_key) === "posts" && f.field_key !== "post_colour_code" && f.field_key !== "post_fixing_material_sku" && f.field_key !== "base_plate_substrate"
  );
  const palingsFieldsToRender = fields.filter((f) => getFieldGroup(f.field_key) === "palings");
  const railsFieldsToRender = fields.filter((f) => getFieldGroup(f.field_key) === "rails");
  const extrasFieldsToRender = fields.filter((f) => getFieldGroup(f.field_key) === "extras");

  const hasStyle = styleFieldsToRender.length > 0 || fields.some(f => ["slat_gap_mm", "slat_gap_mode"].includes(f.field_key));
  const hasPosts = postsFieldsToRender.length > 0 || fields.some(f => ["post_colour_code", "post_fixing_material_sku", "base_plate_substrate"].includes(f.field_key));
  const hasPalings = palingsFieldsToRender.length > 0;
  const hasRails = railsFieldsToRender.length > 0;
  const hasExtras = extrasFieldsToRender.length > 0;

  const styleSummary = [
    valueFor("finish_family"),
    colourName(variables.colour_code),
    valueFor("slat_size_mm"),
    fields.some(f => f.field_key === "slat_gap_mode") ? combinedGapLabel(gapMode, gapMm) : ""
  ].filter(Boolean).join(" · ");

  const postsSummary = [
    valueFor("post_system", postLabel(productCode, variables)),
    colourName(variables.post_colour_code ?? variables.colour_code),
    valueFor("mounting_method") || valueFor("mounting_type"),
    valueFor("max_panel_width_mm") ? `${valueFor("max_panel_width_mm")} spacing` : ""
  ].filter(Boolean).join(" · ");

  const palingsSummary = palingsFieldsToRender
    .map((f) => fieldValueLabel(f, variables))
    .filter(Boolean)
    .join(" · ");

  const railsSummary = railsFieldsToRender
    .map((f) => fieldValueLabel(f, variables))
    .filter(Boolean)
    .join(" · ");

  const extrasSummary = extrasFieldsToRender
    .map((f) => fieldValueLabel(f, variables))
    .filter(Boolean)
    .join(" · ");

  const palingsLabel = productCode === "AF_TIMBER_PALING" ? "Palings" : (productCode === "AF_COLORBOND" ? "Sheets" : "Slats");

  return (
    <div className="mb-3 space-y-3 p-4 bg-[#FCFBF9] rounded-xl border border-[#E9E5DD]">
      <p className="text-xs font-semibold text-[#6E7681]">
        Sections inherit these settings unless overridden.
      </p>

      {hasStyle && (
        <SettingsDisclosureRow
          id={`${run.runId}-style`}
          label="Style"
          value={styleSummary}
        >
          <div className="space-y-4">
            {styleFieldsToRender.length > 0 && (
              <SchemaDrivenForm
                fields={styleFieldsToRender}
                variables={variables}
                onChange={updateRunVariables}
              />
            )}
            {fields.some(f => f.field_key === "slat_gap_mode") && (
              <CombinedGapSelect
                productCode={productCode}
                mode={variables.slat_gap_mode}
                gapMm={variables.slat_gap_mm}
                onChange={updateRunGap}
              />
            )}
            {productCode === "QSHS" && fields.some(f => f.field_key === "louvre_treatment") && (
              <label className="flex items-start gap-3 rounded-xl border border-[#E9E5DD] bg-white p-3">
                <input
                  type="checkbox"
                  checked={louvreEnabled && slatSize === 65}
                  disabled={slatSize !== 65}
                  onChange={(event) =>
                    updateRunVariables("louvre_treatment", event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-[#E9E5DD] text-[#DD6E1B] focus:ring-[#DD6E1B]/20"
                />
                <span>
                  <span className="block text-sm font-extrabold text-[#11161D]">
                    Louvre treatment
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-[#6E7681]">
                    40 degree slat angle. Available with 65mm slats.
                  </span>
                  {slatSize !== 65 && (
                    <span className="mt-1 block text-xs font-bold text-[#DD6E1B]">
                      Switch run slats to 65mm to use louvre brackets.
                    </span>
                  )}
                </span>
              </label>
            )}
          </div>
        </SettingsDisclosureRow>
      )}

      {hasPosts && (
        <SettingsDisclosureRow
          id={`${run.runId}-posts`}
          label="Posts"
          value={postsSummary}
        >
          <div className="space-y-4">
            {fields.some(f => f.field_key === "post_colour_code") && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPostColourOpen((value) => !value)}
                  className="rounded-lg border border-[#E9E5DD] px-3 py-2 text-sm font-semibold text-[#6E7681] bg-white hover:border-[#DD6E1B]/50 hover:text-[#DD6E1B] transition-colors"
                >
                  {postColourOpen ? "Hide alternate post colour" : "Alternate post colour"}
                </button>
                {postColourOpen && renderField("post_colour_code")}
              </div>
            )}
            {postsFieldsToRender.length > 0 && (
              <SchemaDrivenForm
                fields={postsFieldsToRender}
                variables={variables}
                onChange={updateRunVariables}
              />
            )}
            {fields.some(f => f.field_key === "post_fixing_material_sku") && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setFixingsOpen((value) => !value)}
                  className="rounded-lg border border-[#E9E5DD] px-3 py-2 text-sm font-semibold text-[#6E7681] bg-white hover:border-[#DD6E1B]/50 hover:text-[#DD6E1B] transition-colors"
                >
                  Choose fixings
                </button>
                {fixingsOpen && (
                  <div className="grid gap-3 rounded-xl border border-[#E9E5DD] bg-white p-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-[#6E7681]">Post-fixing material</span>
                      <select
                        value={postFixingSku}
                        onChange={(event) =>
                          updateRunVariables("post_fixing_material_sku", event.target.value)
                        }
                        className="rounded-lg border border-[#E9E5DD] bg-white px-3 py-2 text-sm font-semibold text-[#11161D] shadow-sm outline-none transition-colors focus:border-[#DD6E1B] focus:ring-2 focus:ring-[#DD6E1B]/20"
                      >
                        {POST_FIXING_MATERIALS.map((item) => (
                          <option key={item.sku} value={item.sku}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] font-normal text-[#6E7681]">
                        Defaults apply automatically per mounting method unless changed here.
                      </span>
                    </label>
                    {mountingType === "base_plate" && (
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-[#6E7681]">Substrate</span>
                        <select
                          value={substrate}
                          onChange={(event) =>
                            updateRunVariables("base_plate_substrate", event.target.value)
                          }
                          className="rounded-lg border border-[#E9E5DD] bg-white px-3 py-2 text-sm font-semibold text-[#11161D] shadow-sm outline-none transition-colors focus:border-[#DD6E1B] focus:ring-2 focus:ring-[#DD6E1B]/20"
                        >
                          <option value="concrete">Concrete</option>
                          <option value="timber">Timber</option>
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </SettingsDisclosureRow>
      )}

      {hasPalings && (
        <SettingsDisclosureRow
          id={`${run.runId}-palings`}
          label={palingsLabel}
          value={palingsSummary}
        >
          <div className="space-y-4">
            <SchemaDrivenForm
              fields={palingsFieldsToRender}
              variables={variables}
              onChange={updateRunVariables}
            />
          </div>
        </SettingsDisclosureRow>
      )}

      {hasRails && (
        <SettingsDisclosureRow
          id={`${run.runId}-rails`}
          label="Rails"
          value={railsSummary}
        >
          <div className="space-y-4">
            <SchemaDrivenForm
              fields={railsFieldsToRender}
              variables={variables}
              onChange={updateRunVariables}
            />
          </div>
        </SettingsDisclosureRow>
      )}

      {hasExtras && (
        <SettingsDisclosureRow
          id={`${run.runId}-extras`}
          label="Extras"
          value={extrasSummary}
        >
          <div className="space-y-4">
            <SchemaDrivenForm
              fields={extrasFieldsToRender}
              variables={variables}
              onChange={updateRunVariables}
            />
          </div>
        </SettingsDisclosureRow>
      )}

      {onCollapse && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onCollapse}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E9E5DD] bg-white text-sm font-semibold text-[#6E7681] hover:border-[#DD6E1B]/50 hover:text-[#DD6E1B] transition-colors"
            aria-label="Collapse run settings"
            title="Collapse run settings"
          >
            <ChevronUp size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
