import {
  Pencil,
  Building2,
  CircleDot,
  Type,
  PenLine,
  GitMerge,
  Landmark,
  Move,
  Undo2,
  Redo2,
  Trash2,
  Minus,
  CircleHelp,
  ArrowRight,
  Layers,
  Camera,
  TreePine,
  Compass,
} from "lucide-react";
import { useRef, useState, useEffect, type RefObject } from "react";
import type { initCanvasEngine } from "./canvasEngine";
import { TOOL_HOTKEYS } from "../../lib/canvasShortcuts";
import type {
  CanonicalMapLayerId,
  CanonicalMapSnapshotLayer,
} from "../../types/canonical.types";

type Engine = ReturnType<typeof initCanvasEngine>;
export type CanvasTool =
  | "draw"
  | "gate"
  | "move"
  | "boundary"
  | "building"
  | "text"
  | "post"
  | "pillar"
  | "freehand"
  | "arrow"
  | "photo"
  | "tree"
  | "north";
type FreehandStyle = {
  color: string;
  width: number;
  lineStyle: "solid" | "dashed" | "dotted";
  opacity: number;
  arrow: boolean;
};

type MapLayerUpdates = Partial<
  Record<
    CanonicalMapLayerId,
    Partial<Pick<CanonicalMapSnapshotLayer, "visible" | "opacity">>
  >
>;

type CachedMapLayerState = Partial<
  Record<
    CanonicalMapLayerId,
    Pick<CanonicalMapSnapshotLayer, "visible" | "opacity">
  >
>;

interface CanvasToolbarProps {
  engineRef: RefObject<Engine | null>;
  activeTool: CanvasTool;
  onToolChange: (t: CanvasTool) => void;
  snapEnabled: boolean;
  onSnapToggle: (v: boolean) => void;
  gateSnap100: boolean;
  onGateSnap100Toggle: (v: boolean) => void;
  showGrid: boolean;
  onToggleGrid: (v: boolean) => void;
  expanded: boolean;
  onToggleExpand: (v: boolean) => void;
  onHelpOpen: () => void;
  onPrintMap: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  freehandStyle: FreehandStyle;
  onFreehandStyleChange: (style: Partial<FreehandStyle>) => void;
  mapLayers?: Partial<Record<CanonicalMapLayerId, CanonicalMapSnapshotLayer>> | null;
  onMapLayerChange?: (
    layerId: CanonicalMapLayerId,
    updates: Partial<Pick<CanonicalMapSnapshotLayer, "visible" | "opacity">>,
  ) => void;
  onMapLayersChange?: (updates: MapLayerUpdates) => void;
}

export function CanvasToolbar({
  engineRef,
  activeTool,
  onToolChange,
  snapEnabled,
  onSnapToggle,
  gateSnap100,
  onGateSnap100Toggle,
  showGrid,
  onToggleGrid,
  onHelpOpen,
  onPrintMap,
  canUndo = false,
  canRedo = false,
  freehandStyle,
  onFreehandStyleChange,
  mapLayers,
  onMapLayerChange,
  onMapLayersChange,
}: CanvasToolbarProps) {
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const sheetTouchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "o") {
        e.preventDefault();
        handleTool("photo");
      } else if (key === "r") {
        e.preventDefault();
        handleTool("tree");
      } else if (key === "n") {
        e.preventDefault();
        handleTool("north");
      } else if (key === "c") {
        e.preventDefault();
        engineRef.current?.fitToContent();
      } else if (key === "p") {
        e.preventDefault();
        onPrintMap();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTool]);

  const handleTool = (t: CanvasTool) => {
    const nativeTools = ["draw", "gate", "move", "boundary", "building", "text", "post", "pillar", "freehand", "arrow"];
    if (nativeTools.includes(t)) {
      engineRef.current?.setTool(t as any);
    } else {
      engineRef.current?.setTool("move");
    }
    onToolChange(t);
  };

  const btnCls = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-brand-accent bg-brand-accent/20 text-brand-accent"
        : "border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-accent/50"
    }`;

  const iconBtnCls = (disabled = false) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
      disabled
        ? "cursor-not-allowed border-brand-border/60 text-brand-muted/40"
        : "border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-accent/50"
    }`;

  const keyBadge = (key: string) => (
    <span className="rounded border border-current/30 px-1 font-mono text-[10px] opacity-75">
      {key}
    </span>
  );

  const layerRows = (["satellite", "roadmap"] as const)
    .map((layerId) => ({ layerId, layer: mapLayers?.[layerId] }))
    .filter(
      (
        row,
      ): row is {
        layerId: CanonicalMapLayerId;
        layer: CanonicalMapSnapshotLayer;
      } => Boolean(row.layer),
    );
  const availableLayerRows = layerRows.filter(({ layer }) => Boolean(layer.url));
  const mapVisible = availableLayerRows.some(({ layer }) => layer.visible);
  const canChangeMapLayers = Boolean(onMapLayerChange || onMapLayersChange);
  const previousMapLayerStateRef = useRef<CachedMapLayerState | null>(null);
  const applyMapLayerUpdates = (updates: MapLayerUpdates) => {
    if (onMapLayersChange) {
      onMapLayersChange(updates);
      return;
    }
    if (!onMapLayerChange) return;
    (Object.entries(updates) as Array<[CanonicalMapLayerId, MapLayerUpdates[CanonicalMapLayerId]]>)
      .forEach(([layerId, layerUpdates]) => {
        if (layerUpdates) onMapLayerChange(layerId, layerUpdates);
      });
  };
  const handleMapVisibilityToggle = () => {
    if (!canChangeMapLayers) return;
    if (mapVisible) {
      previousMapLayerStateRef.current = Object.fromEntries(
        availableLayerRows.map(({ layerId, layer }) => [
          layerId,
          { visible: layer.visible, opacity: layer.opacity },
        ]),
      ) as CachedMapLayerState;
      applyMapLayerUpdates(
        Object.fromEntries(
          availableLayerRows.map(({ layerId }) => [layerId, { visible: false }]),
        ) as MapLayerUpdates,
      );
      return;
    }

    const fallback: Required<CachedMapLayerState> = {
      satellite: { visible: true, opacity: 1 },
      roadmap: { visible: true, opacity: 0.5 },
    };
    applyMapLayerUpdates(
      Object.fromEntries(
        availableLayerRows.map(({ layerId }) => [
          layerId,
          previousMapLayerStateRef.current?.[layerId] ?? fallback[layerId],
        ]),
      ) as MapLayerUpdates,
    );
  };

  const renderLayerControls = (mode: "desktop" | "sheet") =>
    layerRows.length > 0 && canChangeMapLayers ? (
      <div
        className={
          mode === "desktop"
            ? "inline-flex shrink-0 items-center gap-2 rounded-lg border border-brand-border/70 bg-brand-card/80 px-2 py-1 text-xs text-brand-muted"
            : "space-y-4 text-sm text-brand-muted"
        }
      >
        <div className={mode === "desktop" ? "contents" : "flex items-center justify-between gap-3"}>
          <span className="font-bold uppercase tracking-wide text-brand-text">Layers</span>
          <button
            type="button"
            aria-label={mapVisible ? "Hide map underlay" : "Show map underlay"}
            title={mapVisible ? "Hide map underlay" : "Show map underlay"}
            className={btnCls(mapVisible)}
            onClick={handleMapVisibilityToggle}
          >
            {mapVisible ? "Map off" : "Map on"}
          </button>
        </div>
        {layerRows.map(({ layerId, layer }) => {
          const label = layerId === "satellite" ? "Satellite" : "Roadmap";
          const layerAvailable = Boolean(layer.url);
          return (
            <div
              key={layerId}
              className={
                mode === "desktop"
                  ? "inline-flex items-center gap-1.5"
                  : "grid grid-cols-[5.75rem_1fr_2.5rem] items-center gap-3"
              }
            >
              <label
                className={[
                  "inline-flex items-center gap-1.5 font-semibold",
                  !layerAvailable ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                ].join(" ")}
                title={
                  layerAvailable
                    ? `Show ${label} layer`
                    : `${label} layer was not captured`
                }
              >
                <input
                  type="checkbox"
                  checked={layer.visible}
                  disabled={!layerAvailable}
                  aria-label={`Show ${label} layer`}
                  onChange={(event) =>
                    applyMapLayerUpdates({
                      [layerId]: { visible: event.currentTarget.checked },
                    })
                  }
                  className="accent-brand-accent disabled:cursor-not-allowed"
                />
                {label}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(layer.opacity * 100)}
                aria-label={`${label} layer opacity`}
                title={`${label} opacity`}
                disabled={!layer.visible || !layerAvailable}
                onInput={(event) =>
                  applyMapLayerUpdates({
                    [layerId]: {
                      opacity: Number(event.currentTarget.value) / 100,
                    },
                  })
                }
                className="h-1.5 w-full accent-brand-accent disabled:cursor-not-allowed disabled:opacity-40 md:w-20"
              />
              <span className="w-8 text-right tabular-nums">
                {Math.round(layer.opacity * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    ) : null;

  const clearCanvas = () => {
    engineRef.current?.clear();
    handleTool("draw");
    setClearConfirmOpen(false);
  };

  const mobileBtnCls = (active: boolean) =>
    `flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-1 text-[10px] font-semibold leading-tight ${
      active
        ? "border-brand-accent bg-brand-accent/20 text-brand-accent"
        : "border-brand-border bg-brand-card/95 text-brand-muted"
    }`;

  return (
    <>
    <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-brand-border/80 bg-brand-bg/95 p-1 shadow-xl backdrop-blur md:hidden">
      <button type="button" className={mobileBtnCls(activeTool === "draw")} onClick={() => handleTool("draw")}>
        <Pencil size={17} /> Draw
      </button>
      <button type="button" className={mobileBtnCls(activeTool === "gate")} onClick={() => handleTool("gate")}>
        <GitMerge size={17} /> Gate
      </button>
      <button type="button" className={mobileBtnCls(activeTool === "move")} onClick={() => handleTool("move")}>
        <Move size={17} /> Move/Edit
      </button>
      <button type="button" className={mobileBtnCls(false)} disabled={!canUndo} onClick={() => engineRef.current?.undo()}>
        <Undo2 size={17} /> Undo
      </button>
      <button type="button" className={mobileBtnCls(false)} disabled={!canRedo} onClick={() => engineRef.current?.redo()}>
        <Redo2 size={17} /> Redo
      </button>
      <button type="button" aria-label="Clear canvas" className={mobileBtnCls(false)} onClick={() => setClearConfirmOpen(true)}>
        <Trash2 size={17} /> Clear
      </button>
      <button
        type="button"
        aria-label="Open map layers"
        className={mobileBtnCls(mobileLayersOpen)}
        onClick={() => setMobileLayersOpen(true)}
      >
        <Layers size={17} /> Layers
      </button>
    </div>

    {clearConfirmOpen && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Clear canvas confirmation"
        onClick={() => setClearConfirmOpen(false)}
      >
        <div
          className="w-full max-w-sm rounded-lg border border-brand-border bg-brand-card p-4 text-brand-text shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 className="text-base font-semibold">Are you sure?</h2>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            This will delete all runs and gates. The map snapshot will be kept. This can be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-brand-border px-3 py-1.5 text-sm font-medium text-brand-muted transition-colors hover:text-brand-text"
              onClick={() => setClearConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-red-500/60 bg-red-500/15 px-3 py-1.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/25"
              onClick={clearCanvas}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    )}

    {mobileLayersOpen && (
      <div className="fixed inset-0 z-50 bg-black/45 md:hidden" onClick={() => setMobileLayersOpen(false)}>
        <div
          data-testid="layers-bottom-sheet"
          className="absolute inset-x-0 bottom-0 flex min-h-[45dvh] max-h-[45dvh] flex-col overflow-y-auto rounded-t-2xl border border-brand-border bg-brand-card p-4 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
          onTouchStart={(event) => {
            sheetTouchStartYRef.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            const startY = sheetTouchStartYRef.current;
            const endY = event.changedTouches[0]?.clientY;
            sheetTouchStartYRef.current = null;
            if (startY !== null && endY !== undefined && endY - startY > 40) {
              setMobileLayersOpen(false);
            }
          }}
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-brand-border" />
          {renderLayerControls("sheet")}
        </div>
      </div>
    )}

    <div className="hidden flex-nowrap items-center gap-2 overflow-x-auto border-b border-brand-border/60 bg-brand-card p-2 [scrollbar-width:thin] md:flex md:flex-wrap md:gap-3 md:border-b-0">
      <div className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-brand-border/70 bg-brand-bg/50 px-2 py-1.5">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-brand-muted">Draw</span>
      <button
        type="button"
        title={`Draw fence run (${TOOL_HOTKEYS.draw})`}
        className={btnCls(activeTool === "draw")}
        onClick={() => handleTool("draw")}
      >
        <Pencil size={16} /> Draw Fence {keyBadge(TOOL_HOTKEYS.draw)}
      </button>
      <button
        type="button"
        title={`Place gate on section (${TOOL_HOTKEYS.gate})`}
        className={btnCls(activeTool === "gate")}
        onClick={() => handleTool("gate")}
      >
        <GitMerge size={16} /> Gate {keyBadge(TOOL_HOTKEYS.gate)}
      </button>
      <button
        type="button"
        title={`Move the drawing, drag nodes, or edit section lengths (${TOOL_HOTKEYS.move})`}
        className={btnCls(activeTool === "move")}
        onClick={() => handleTool("move")}
      >
        <Move size={16} /> Move/Edit {keyBadge(TOOL_HOTKEYS.move)}
      </button>
      <button
        type="button"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        className={iconBtnCls(!canUndo)}
        onClick={() => engineRef.current?.undo()}
      >
        <Undo2 size={16} /> Undo
      </button>
      <button
        type="button"
        title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
        disabled={!canRedo}
        className={iconBtnCls(!canRedo)}
        onClick={() => engineRef.current?.redo()}
      >
        <Redo2 size={16} /> Redo
      </button>
      <button
        type="button"
        title="Clear canvas"
        aria-label="Clear canvas"
        className={iconBtnCls()}
        onClick={() => setClearConfirmOpen(true)}
      >
        <Trash2 size={16} /> Clear
      </button>
      </div>

      <div className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-brand-border/70 bg-brand-bg/50 px-2 py-1.5">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-brand-muted">Site</span>
      <button
        type="button"
        title={`Draw a dotted context line (${TOOL_HOTKEYS.boundary})`}
        className={btnCls(activeTool === "boundary")}
        onClick={() => handleTool("boundary")}
      >
        <Minus size={16} /> Dotted line {keyBadge(TOOL_HOTKEYS.boundary)}
      </button>
      <button
        type="button"
        title={`Draw a straight arrow annotation (${TOOL_HOTKEYS.arrow})`}
        className={btnCls(activeTool === "arrow")}
        onClick={() => handleTool("arrow")}
      >
        <ArrowRight size={16} /> Arrow {keyBadge(TOOL_HOTKEYS.arrow)}
      </button>
      <button
        type="button"
        title={`Draw a building or fixed structure line (${TOOL_HOTKEYS.building})`}
        className={btnCls(activeTool === "building")}
        onClick={() => handleTool("building")}
      >
        <Building2 size={16} /> Building {keyBadge(TOOL_HOTKEYS.building)}
      </button>
      <button
        type="button"
        title={`Free draw site notes (${TOOL_HOTKEYS.freehand})`}
        className={btnCls(activeTool === "freehand")}
        onClick={() => handleTool("freehand")}
      >
        <PenLine size={16} /> Free Draw {keyBadge(TOOL_HOTKEYS.freehand)}
      </button>
      {activeTool === "freehand" && (
        <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-brand-border/70 bg-brand-card px-2 py-1 text-xs text-brand-muted">
          <input
            type="color"
            value={freehandStyle.color}
            title="Free draw colour"
            onChange={(event) => onFreehandStyleChange({ color: event.target.value })}
            className="h-6 w-7 rounded border border-brand-border bg-transparent"
          />
          <select
            value={freehandStyle.width}
            title="Free draw line width"
            onChange={(event) => onFreehandStyleChange({ width: Number(event.target.value) })}
            className="rounded border border-brand-border bg-brand-bg px-1 py-1"
          >
            <option value={1}>1px</option>
            <option value={2}>2px</option>
            <option value={4}>4px</option>
            <option value={8}>8px</option>
          </select>
          <select
            value={freehandStyle.lineStyle}
            title="Free draw line style"
            onChange={(event) => onFreehandStyleChange({ lineStyle: event.target.value as "solid" | "dashed" | "dotted" })}
            className="rounded border border-brand-border bg-brand-bg px-1 py-1"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
          <select
            value={freehandStyle.opacity}
            title="Free draw opacity"
            onChange={(event) => onFreehandStyleChange({ opacity: Number(event.target.value) })}
            className="rounded border border-brand-border bg-brand-bg px-1 py-1"
          >
            <option value={0.25}>25%</option>
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
          </select>
        </div>
      )}
      <button
        type="button"
        title={`Place an existing post marker (${TOOL_HOTKEYS.post})`}
        className={btnCls(activeTool === "post")}
        onClick={() => handleTool("post")}
      >
        <CircleDot size={16} /> Existing post {keyBadge(TOOL_HOTKEYS.post)}
      </button>
      <button
        type="button"
        title={`Place an existing pillar marker (${TOOL_HOTKEYS.pillar})`}
        className={btnCls(activeTool === "pillar")}
        onClick={() => handleTool("pillar")}
      >
        <Landmark size={16} /> Pillar {keyBadge(TOOL_HOTKEYS.pillar)}
      </button>
      <button
        type="button"
        title={`Place a text note on the map (${TOOL_HOTKEYS.text})`}
        className={btnCls(activeTool === "text")}
        onClick={() => handleTool("text")}
      >
        <Type size={16} /> Text {keyBadge(TOOL_HOTKEYS.text)}
      </button>
      <button
        type="button"
        title="Place a photo pin marker (O)"
        className={btnCls(activeTool === "photo")}
        onClick={() => handleTool("photo")}
      >
        <Camera size={16} /> Photo pin {keyBadge("O")}
      </button>
      <button
        type="button"
        title="Place a tree marker (R)"
        className={btnCls(activeTool === "tree")}
        onClick={() => handleTool("tree")}
      >
        <TreePine size={16} /> Tree {keyBadge("R")}
      </button>
      <button
        type="button"
        title="Place a north arrow bearing marker (N)"
        className={btnCls(activeTool === "north")}
        onClick={() => handleTool("north")}
      >
        <Compass size={16} /> North {keyBadge("N")}
      </button>
      </div>

      <div className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-brand-border/70 bg-brand-bg/50 px-2 py-1.5">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-brand-muted">View</span>
        {renderLayerControls("desktop")}
        <div className="w-px h-4 bg-brand-border/60 mx-1" />
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-brand-muted">
          <input
            type="checkbox"
            aria-label="Angle snap"
            checked={snapEnabled}
            onChange={(e) => {
              onSnapToggle(e.target.checked);
              engineRef.current?.setSnapToGrid(e.target.checked);
            }}
            className="accent-brand-accent"
          />
          Angle snap
        </label>

        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-brand-muted">
          <input
            type="checkbox"
            aria-label="Gate snap 100mm"
            checked={gateSnap100}
            onChange={(e) => {
              onGateSnap100Toggle(e.target.checked);
              engineRef.current?.setGateSnapTo100mm(e.target.checked);
            }}
            className="accent-brand-accent"
          />
          Gate snap 100mm
        </label>

        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-brand-muted">
          <input
            type="checkbox"
            aria-label="Show grid"
            checked={showGrid}
            onChange={(e) => onToggleGrid(e.target.checked)}
            className="accent-brand-accent"
          />
          Grid
        </label>
      </div>

      <button
        type="button"
        onClick={onHelpOpen}
        title="Layout map help (?)"
        aria-label="Layout map help"
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-primary/50 bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary/20"
      >
        <CircleHelp size={16} /> Help
      </button>
    </div>
    </>
  );
}
