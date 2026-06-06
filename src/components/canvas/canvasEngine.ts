// canvasEngine.ts — Pure TypeScript canvas engine (no React imports)
// All drawing, interaction, snap, undo logic lives here.

import { computePrintViewport } from "./printMap";

export interface CanvasSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  lengthMM: number; // real-world length in mm (user-editable)
  angleDeg: number; // angle from horizontal
  contextType?: "boundary" | "building";
  startTermination?: CanvasStructureTermination;
  endTermination?: CanvasStructureTermination;
}

export type GateAnchor = "start" | "center" | "end";
export type CanvasGateVariableValue = string | number | boolean;
export type CanvasGateVariables = Record<string, CanvasGateVariableValue>;

export interface CanvasGate {
  segmentIndex: number;
  positionOnSegment: number; // 0-1 fraction along segment
  anchor?: GateAnchor;
  widthMM: number;
  gateId?: string;
  useGatePostsAsFenceTermination?: boolean;
  gateType?: CanvasGateType;
  swingDirection?: CanvasGateSwingDirection;
  slidingSide?: CanvasGateSlidingSide;
  variables?: CanvasGateVariables;
}

export interface CanvasRunSummary {
  label: string;
  totalLengthM: number;
  cornerCount: number;
  gates: CanvasGate[];
  sections?: Array<{
    label: string;
    lengthM: number;
    panelCount: number;
    gateCount: number;
  }>;
}

export interface CanvasPrintSectionSummary {
  label: string;
  lengthM: number;
  heightMm?: number;
  panelCount?: number;
  gateCount?: number;
}

export interface CanvasPrintRunSummary {
  label: string;
  systemType?: string;
  colour?: string;
  totalLengthM?: number;
  postCount?: number;
  gateCount?: number;
  sections?: CanvasPrintSectionSummary[];
}

export interface CanvasPrintMapOptions {
  includeSatellite?: boolean;
  jobName?: string;
  propertyAddress?: string;
  runs?: CanvasPrintRunSummary[];
}

export interface CanvasLayout {
  segments: CanvasSegment[];
  gates: CanvasGate[];
  totalLengthM: number;
  cornerCount: number; // count of ~90° angles between adjacent segments
  runs: CanvasRunSummary[];
  /** Non-product boundary lines (neighbouring fences, property lines, etc.). Ignored by canonicalAdapter. */
  boundaries: CanvasSegment[];
  /** Free text notes placed by the user on the map. Ignored by canonicalAdapter. */
  textNotes?: CanvasTextNote[];
  /** Existing posts and pillars placed as site context. Ignored by canonicalAdapter. */
  siteMarkers?: CanvasSiteMarker[];
  /** Hand-drawn site notes/features. Ignored by canonicalAdapter. */
  freehandStrokes?: CanvasFreehandStroke[];
  /** Straight arrow annotations placed on the map. */
  arrows?: CanvasArrowAnnotation[];
}

export interface CanvasEngineConfig {
  snapToGrid: boolean;
  gridSize: number; // px
  showGrid: boolean;
  /** Interior corner angles (degrees) permitted at post junctions. Empty = no constraint. */
  allowedAngles?: number[];
  onLayoutChange?: (layout: CanvasLayout) => void;
  onHistoryChange?: (history: CanvasHistoryState) => void;
  /** Called immediately when the user places a NEW gate marker on a segment */
  onGatePlaced?: (
    segIdx: number,
    gateIdx: number,
    defaultWidthMM: number,
    gateType?: CanvasGateType,
    slidingSide?: CanvasGateSlidingSide,
  ) => void;
  /** Called when the user clicks (not drags) an existing gate marker — open its editor */
  onGateEdit?: (
    flatSegIdx: number,
    gateIdx: number,
    gateId: string | undefined,
    currentWidthMM: number,
    gate?: CanvasGate,
  ) => void;
}

export type CanvasGateType = "single-swing" | "double-swing" | "sliding";
export type CanvasGateSwingDirection = "in" | "out" | "left" | "right";
export type CanvasGateSlidingSide = "front" | "back";

export interface CanvasHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}

const MIN_CANVAS_ZOOM = 0.5;
const MAX_CANVAS_ZOOM = 10;

export interface CanvasGateVisual {
  gateType: CanvasGateType;
  swingDirection?: CanvasGateSwingDirection;
  slidingSide?: CanvasGateSlidingSide;
  leafWidthsMM?: number[];
  variables?: CanvasGateVariables;
}

export interface CanvasTextNote {
  x: number;
  y: number;
  text: string;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  bullets?: boolean;
  align?: "left" | "center" | "right";
}

export interface CanvasSiteMarker {
  x: number;
  y: number;
  markerType: "post" | "pillar";
  label?: string;
  widthMM?: number;
  depthMM?: number;
}

export type CanvasStructureTermination = "existing_post" | "pillar";

export interface CanvasFreehandStroke {
  points: Point[];
  color?: string;
  width?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  opacity?: number;
  arrow?: boolean;
}

export interface CanvasArrowAnnotation {
  kind: "arrow";
  from: Point;
  to: Point;
  color?: string;
  weight?: number;
}

// ── Internal state types ──────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

interface CanvasPointerLike {
  button: number;
  clientX: number;
  clientY: number;
  pointerType?: "mouse" | "touch" | "pen";
  preventDefault: () => void;
}

export function snapRadiusForPointerType(pointerType?: string): number {
  return pointerType === "touch" ? 44 : 8;
}

interface Segment {
  p1: Point;
  p2: Point;
  lengthMM: number; // mm; defaults derived from pixel distance × scale
  gates: GateMarker[];
}

interface SegmentMapLabel {
  text: string;
  t: number;
  tStart: number;
  tEnd: number;
  kind: "panel" | "gate";
}

interface LabelCollisionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GateMarker {
  t: number; // 0-1 along segment
  anchor?: GateAnchor;
  widthMM: number;
  gateId?: string; // matches the GateConfig.id in GateContext once the gate is saved
  useGatePostsAsFenceTermination?: boolean;
  gateType?: CanvasGateType;
  swingDirection?: CanvasGateSwingDirection;
  slidingSide?: CanvasGateSlidingSide;
  variables?: CanvasGateVariables;
}

type Tool = "draw" | "gate" | "move" | "boundary" | "building" | "text" | "post" | "pillar" | "freehand" | "arrow";

type SelectedCanvasItem =
  | { kind: "segment"; runIdx: number; segIdx: number; flatIdx: number }
  | { kind: "gate"; runIdx: number; segIdx: number; gateIdx: number; flatSegIdx: number }
  | { kind: "building" | "boundary"; runIdx: number }
  | { kind: "text"; index: number }
  | { kind: "marker"; index: number }
  | { kind: "freehand"; index: number }
  | null;

type DragAction =
  | { kind: "move-building"; runIdx: number; start: Point; original: Point[] }
  | { kind: "resize-building"; runIdx: number; handle: number; original: Point[] }
  | { kind: "move-text"; index: number; start: Point; original: CanvasTextNote }
  | { kind: "resize-text"; index: number; start: Point; original: CanvasTextNote }
  | { kind: "move-marker"; index: number; start: Point; original: CanvasSiteMarker }
  | null;

type UndoAction =
  | { type: "ADD_POINT"; runIdx: number }
  | { type: "FINISH_RUN"; runIdx: number }
  | { type: "RESUME_RUN"; runIdx: number }
  | { type: "ADD_RUN" }
  | { type: "ADD_GATE"; segIdx: number; gateIdx: number }
  | { type: "CLEAR"; runs: Run[]; scale: number }
  | { type: "CHAIN_POINT"; prevRunIdx: number; newRunIdx: number }
  | { type: "SNAPSHOT"; snapshot: CanvasSnapshot };

interface CanvasSnapshot {
  runs: Run[];
  scale: number;
  activeRunIdx: number;
  textNotes: CanvasTextNote[];
  siteMarkers: CanvasSiteMarker[];
  freehandStrokes: CanvasFreehandStroke[];
  arrows: CanvasArrowAnnotation[];
}

interface RedoEntry {
  action: UndoAction;
  snapshot: CanvasSnapshot;
}

interface Run {
  points: Point[];
  finished: boolean;
  segments: Segment[];
  isBoundary?: boolean;
  boundaryType?: "boundary" | "building";
}

// ── Scale constant: pixels per metre ──────────────────────────────────────────
// Default: 100px = 1 metre. User can adjust with the scale input.
const DEFAULT_SCALE = 100; // px per metre

// ── Corner detection angle threshold ─────────────────────────────────────────
// Legacy threshold (30°) replaced by angleBetween() with 2°–175° range per HTML spec

// ── Gate default width ────────────────────────────────────────────────────────
const DEFAULT_GATE_WIDTH_MM = 900;
const TOUCH_MULTI_COOLDOWN_MS = 150;
const TOUCH_DOUBLE_TAP_MS = 300;
const TOUCH_DOUBLE_TAP_DISTANCE_PX = 30;
const TOUCH_SINGLE_TAP_DEBOUNCE_MS = 250;
const TOUCH_DUPLICATE_TAP_DISTANCE_PX = 6;
const TOUCH_SINGLE_TAP_MAX_MS = 250;
const TOUCH_VERTEX_LONG_PRESS_MS = 500;
const TOUCH_TAP_MOVE_TOLERANCE_PX = 16;
const HISTORY_STACK_LIMIT = 20;

// ── Colours ───────────────────────────────────────────────────────────────────
const COLOR = {
  grid: "rgba(0, 0, 0, 0.1)",
  gridAxis: "rgba(255,255,255,0.22)",
  segment: "#3b82f6",
  segmentHover: "#60a5fa",
  point: "#3b82f6",
  pointFill: "#1a1d2e",
  activePoint: "#60a5fa",
  preview: "rgba(96,165,250,0.5)",
  gate: "#f59e0b",
  gateFill: "rgba(245,158,11,0.2)",
  label: "#e5e7eb",
  labelBg: "rgba(26,29,46,0.85)",
  snap: "rgba(96,165,250,0.4)",
};

// Distinct run colors (dark-theme palette, cycling for >8 runs)
const RUN_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f43f5e", // rose
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#eab308", // yellow
  "#84cc16", // lime
];
const RUN_COLORS_HOVER = [
  "#60a5fa",
  "#34d399",
  "#fb7185",
  "#c084fc",
  "#fb923c",
  "#22d3ee",
  "#fde047",
  "#a3e635",
];

function getRunColor(nonBoundaryRunIdx: number) {
  return RUN_COLORS[nonBoundaryRunIdx % RUN_COLORS.length];
}
function getRunColorHover(nonBoundaryRunIdx: number) {
  return RUN_COLORS_HOVER[nonBoundaryRunIdx % RUN_COLORS_HOVER.length];
}

// ── Utility ───────────────────────────────────────────────────────────────────

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function angleDeg(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function snapToGrid(p: Point, gridSize: number): Point {
  return {
    x: Math.round(p.x / gridSize) * gridSize,
    y: Math.round(p.y / gridSize) * gridSize,
  };
}

function snapBearingFrom(origin: Point, candidate: Point, stepDeg: number): Point {
  const d = dist(origin, candidate);
  if (d === 0 || stepDeg <= 0) return candidate;
  const bearing = angleDeg(origin, candidate);
  const snapped = Math.round(bearing / stepDeg) * stepDeg;
  const rad = (snapped * Math.PI) / 180;
  return {
    x: origin.x + d * Math.cos(rad),
    y: origin.y + d * Math.sin(rad),
  };
}

function fiveDegreeAngles(): number[] {
  const values: number[] = [];
  for (let a = 5; a <= 180; a += 5) values.push(a);
  return values;
}

/**
 * Snap `candidate` so the interior corner angle at `junctionPoint`
 * (between the incoming segment prevPoint→junctionPoint and the outgoing
 * segment junctionPoint→candidate) equals the nearest value in `angles`.
 * Returns `candidate` unchanged if `angles` is empty or distance is zero.
 */
function snapToAllowedAngle(
  prevPoint: Point,
  junctionPoint: Point,
  candidate: Point,
  angles: number[],
): Point {
  if (angles.length === 0) return candidate;
  const d = dist(junctionPoint, candidate);
  if (d === 0) return candidate;

  const current = angleBetween(prevPoint, junctionPoint, candidate);

  const nearest = angles.reduce((best, a) =>
    Math.abs(a - current) < Math.abs(best - current) ? a : best,
  );

  // Direction from junction toward prev point (B→A)
  const phi_BA = Math.atan2(
    prevPoint.y - junctionPoint.y,
    prevPoint.x - junctionPoint.x,
  );
  const nearestRad = (nearest * Math.PI) / 180;

  // Two candidate directions: rotate phi_BA by ±nearest degrees
  const phi1 = phi_BA + nearestRad;
  const phi2 = phi_BA - nearestRad;

  // Actual direction from junction toward candidate (B→M)
  const phi_BM = Math.atan2(
    candidate.y - junctionPoint.y,
    candidate.x - junctionPoint.x,
  );

  // Angular distance normalised to [0, π]
  function angDiff(a: number, b: number): number {
    const diff = Math.abs(a - b) % (2 * Math.PI);
    return diff > Math.PI ? 2 * Math.PI - diff : diff;
  }

  const chosen =
    angDiff(phi1, phi_BM) <= angDiff(phi2, phi_BM) ? phi1 : phi2;

  return {
    x: junctionPoint.x + d * Math.cos(chosen),
    y: junctionPoint.y + d * Math.sin(chosen),
  };
}

function screenToCanvas(screen: Point, pan: Point, zoom: number): Point {
  return {
    x: (screen.x - pan.x) / zoom,
    y: (screen.y - pan.y) / zoom,
  };
}

function canvasToScreen(canvas: Point, pan: Point, zoom: number): Point {
  return {
    x: canvas.x * zoom + pan.x,
    y: canvas.y * zoom + pan.y,
  };
}

function pixelsToMM(px: number, scale: number): number {
  // scale = px per metre
  return (px / scale) * 1000;
}

function buildSegmentsFromPoints(points: Point[], scale: number): Segment[] {
  const segs: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const px = dist(points[i], points[i + 1]);
    segs.push({
      p1: points[i],
      p2: points[i + 1],
      lengthMM: pixelsToMM(px, scale),
      gates: [],
    });
  }
  return segs;
}

function rebuildSegmentsPreservingGates(run: Run, scale: number) {
  const previousGates = run.segments.map((seg) =>
    seg.gates.map((gate) => ({ ...gate })),
  );
  run.segments = buildSegmentsFromPoints(run.points, scale);
  run.segments.forEach((seg, idx) => {
    seg.gates = previousGates[idx] ?? [];
  });
}

function angleBetween(a: Point, b: Point, c: Point): number {
  // Returns interior angle at b (in degrees) formed by segments a→b and b→c
  const dx1 = a.x - b.x,
    dy1 = a.y - b.y;
  const dx2 = c.x - b.x,
    dy2 = c.y - b.y;
  const dot = dx1 * dx2 + dy1 * dy2;
  const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  if (mag1 === 0 || mag2 === 0) return 180;
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

function countCorners(runs: Run[]): number {
  let count = 0;
  for (const run of runs) {
    const pts = run.points;
    for (let i = 1; i < pts.length - 1; i++) {
      const angle = angleBetween(pts[i - 1], pts[i], pts[i + 1]);
      if (angle > 2 && angle < 175) count++;
    }
  }
  return count;
}

function totalLengthM(runs: Run[]): number {
  let total = 0;
  for (const run of runs) {
    for (const seg of run.segments) {
      total += seg.lengthMM;
    }
  }
  return total / 1000;
}

function closestPointOnSegment(
  p: Point,
  s: Segment,
): { point: Point; t: number; d: number } {
  const dx = s.p2.x - s.p1.x;
  const dy = s.p2.y - s.p1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { point: s.p1, t: 0, d: dist(p, s.p1) };
  const t = Math.max(
    0,
    Math.min(1, ((p.x - s.p1.x) * dx + (p.y - s.p1.y) * dy) / len2),
  );
  const proj = lerp(s.p1, s.p2, t);
  return { point: proj, t, d: dist(p, proj) };
}

function gateAnchorForPlacement(seg: Segment, t: number, gateWidthMM: number): GateAnchor {
  if (seg.lengthMM <= 0) return "center";
  const halfGateT = Math.min(0.5, gateWidthMM / seg.lengthMM / 2);
  if (t <= halfGateT) return "start";
  if (t >= 1 - halfGateT) return "end";
  return "center";
}

function snapGatePositionTo100mm(seg: Segment, t: number, enabled: boolean): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (!enabled || seg.lengthMM <= 0) return clamped;
  const snappedMM = Math.round((clamped * seg.lengthMM) / 100) * 100;
  return Math.max(0, Math.min(1, snappedMM / seg.lengthMM));
}

function gateRange(seg: Segment, gate: Pick<GateMarker, "t" | "widthMM" | "anchor">) {
  if (seg.lengthMM <= 0) {
    return { tStart: gate.t, tEnd: gate.t, tMid: gate.t };
  }
  const gateT = Math.min(1, gate.widthMM / seg.lengthMM);
  if (gate.anchor === "start") {
    return { tStart: 0, tEnd: gateT, tMid: gateT / 2 };
  }
  if (gate.anchor === "end") {
    return { tStart: 1 - gateT, tEnd: 1, tMid: 1 - gateT / 2 };
  }
  const halfT = gateT / 2;
  const tStart = Math.max(0, gate.t - halfT);
  const tEnd = Math.min(1, gate.t + halfT);
  return { tStart, tEnd, tMid: (tStart + tEnd) / 2 };
}

function offsetPointFromSegment(seg: Segment, t: number, offset: number): Point {
  const base = lerp(seg.p1, seg.p2, t);
  const ang = Math.atan2(seg.p2.y - seg.p1.y, seg.p2.x - seg.p1.x);
  return {
    x: base.x - Math.sin(ang) * offset,
    y: base.y + Math.cos(ang) * offset,
  };
}

// ── Label editing overlay ─────────────────────────────────────────────────────

function createLabelInput(
  container: HTMLElement,
  screenPos: Point,
  initialValue: string,
  onCommit: (v: string) => void,
  onCancel: () => void,
  width = 80,
): HTMLInputElement {
  const inp = document.createElement("input");
  inp.type = "text";
  inp.value = initialValue;
  inp.style.cssText = `
    position: absolute;
    left: ${screenPos.x - width / 2}px;
    top: ${screenPos.y - 13}px;
    width: ${width}px;
    padding: 2px 6px;
    font-size: 12px;
    background: #1a1d2e;
    color: #e5e7eb;
    border: 1px solid #3b82f6;
    border-radius: 4px;
    outline: none;
    z-index: 100;
    text-align: center;
  `;
  container.appendChild(inp);
  inp.focus();
  inp.select();

  const commit = () => onCommit(inp.value);
  const cancel = () => {
    onCancel();
    cleanup();
  };
  const cleanup = () => {
    inp.removeEventListener("keydown", onKey);
    inp.removeEventListener("blur", onBlur);
    if (inp.parentNode) inp.parentNode.removeChild(inp);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      commit();
      cleanup();
    }
    if (e.key === "Escape") {
      cancel();
    }
  };
  const onBlur = () => {
    commit();
    cleanup();
  };

  inp.addEventListener("keydown", onKey);
  inp.addEventListener("blur", onBlur);
  return inp;
}

// ── Main engine factory ───────────────────────────────────────────────────────

export function initCanvasEngine(
  canvas: HTMLCanvasElement,
  config: CanvasEngineConfig,
) {
  const ctx = canvas.getContext("2d")!;
  const container = canvas.parentElement as HTMLElement;

  // ── Mutable state ──────────────────────────────────────────────────────────
  let runs: Run[] = [];
  let activeRunIdx = -1; // index of the run currently being drawn
  let tool: Tool = "draw";
  let zoom = 1;
  let pan: Point = { x: 0, y: 0 };
  let scale = DEFAULT_SCALE; // px per metre
  let snap = config.snapToGrid;
  let orthoMode = false;
  let gateSnap100 = true;
  let showGrid = config.showGrid;
  let gridSize = config.gridSize;
  let allowedAngles: number[] = config.allowedAngles ?? [];
  let shiftDown = false;
  let spacePanPreviousTool: Tool | null = null;

  /**
   * Compute the effective snap angle set for the current context.
   * - Shift held: only 180° (straight continuation) — locks to straight line.
   * - Snap on: nearest 5° turn so the user can draw at any practical angle.
   * - Snap off: no angle constraint; the clicked point lands exactly where placed.
   */
  function effectiveSnapAngles(shiftHeld: boolean): number[] {
    if (!snap) return [];
    if (shiftHeld) return [180];
    const angles = fiveDegreeAngles();
    return allowedAngles.length > 0
      ? Array.from(new Set([...angles, ...allowedAngles]))
      : angles;
  }
  let mouseCanvas: Point = { x: 0, y: 0 };
  let segmentPreviewEndpoint: Point | null = null;
  let isPanning = false;
  let panStart: Point = { x: 0, y: 0 };
  let panOrigin: Point = { x: 0, y: 0 };
  let undoStack: UndoAction[] = [];
  let redoStack: RedoEntry[] = [];
  let gateVisuals: Record<string, CanvasGateVisual> = {};
  let pendingGatePlacement: CanvasGateVisual & { widthMM: number } = {
    gateType: "single-swing",
    swingDirection: "out",
    slidingSide: "front",
    widthMM: DEFAULT_GATE_WIDTH_MM,
  };
  let canvasHintsDismissed = false;
  let highlightedMapLabel: string | null = null;
  let labelCollisionBoxes: LabelCollisionBox[] = [];
  let textNotes: CanvasTextNote[] = [];
  let siteMarkers: CanvasSiteMarker[] = [];
  let freehandStrokes: CanvasFreehandStroke[] = [];
  let arrows: CanvasArrowAnnotation[] = [];
  let pendingTextNote: { start: Point; current: Point } | null = null;
  let pendingBuildingRect: { start: Point; current: Point } | null = null;
  let pendingFreehandStroke: CanvasFreehandStroke | null = null;
  let pendingArrow: { from: Point; to: Point } | null = null;
  let mapLayers: Array<{ image: HTMLImageElement; opacity: number }> = [];
  let mapLoadVersion = 0;
  let mapWorldOriginX = 0; // world px — centre of the tile
  let mapWorldOriginY = 0; // world px — centre of the tile
  let mapWorldWidth = 0; // world px
  let mapWorldHeight = 0; // world px
  let editingLabel = false;
  let hoveredSegIdx = -1; // flat index into all segments across all runs
  let animFrame = 0;
  let draggingNode: { runIdx: number; ptIdx: number } | null = null;
  let draggingGate: {
    runIdx: number;
    segIdx: number;
    gateIdx: number;
    flatSegIdx: number;
    startScreenPt: Point;
  } | null = null;
  let selectedItem: SelectedCanvasItem = null;
  let dragAction: DragAction = null;
  let clipboardItem: SelectedCanvasItem = null;
  let contextMenuEl: HTMLDivElement | null = null;
  let currentFreehandStyle: Required<Pick<CanvasFreehandStroke, "color" | "width" | "lineStyle" | "opacity" | "arrow">> = {
    color: "#0ea5e9",
    width: 3,
    lineStyle: "solid",
    opacity: 0.95,
    arrow: false,
  };
  let lastTouchPointer: CanvasPointerLike | null = null;
  let lastTapTime = 0;
  let lastTapScreen: Point | null = null;
  let lastPlacedTouchTapTime = 0;
  let lastPlacedTouchTapScreen: Point | null = null;
  let activePointerCount = 0;
  let isMultiTouching = false;
  let multiTouchCooldownUntil = 0;
  let touchTapCandidate: {
    pointer: CanvasPointerLike;
    screenPt: Point;
    startedAt: number;
    moved: boolean;
  } | null = null;
  let touchVertexLongPress: {
    timer: number;
    pointer: CanvasPointerLike;
    screenPt: Point;
    node: { runIdx: number; ptIdx: number };
  } | null = null;
  let pinchZoom: { lastDistance: number; lastCenter: Point } | null = null;
  // Post positions from BOM result. In canvas world coordinates — the same
  // coordinate space as the drawn nodes (canvas pixels before pan/zoom transform).
  // null = nothing to render.
  let postPositions: Array<{ x: number; y: number; label?: string }> | null =
    null;
  // Per-segment max panel widths (flat array, index = flat segment index from allSegmentsFlat).
  // Used by drawComputedPosts to show live post-position preview.
  let segmentPanelWidths: number[] = [];
  // Job-level default panel width — used to draw post previews on the in-progress segment.
  let jobPanelWidthMm: number | null = null;
  let cssCanvasWidth = 0;
  let cssCanvasHeight = 0;
  let devicePixelRatioScale = 1;
  let defaultViewportTransform: { pan: Point; zoom: number; scale?: number } | null = null;

  // Resize canvas to fill its CSS size
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const nextDpr = Math.max(1, window.devicePixelRatio || 1);
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    const backingWidth = Math.round(nextWidth * nextDpr);
    const backingHeight = Math.round(nextHeight * nextDpr);
    if (
      canvas.width !== backingWidth ||
      canvas.height !== backingHeight ||
      cssCanvasWidth !== nextWidth ||
      cssCanvasHeight !== nextHeight ||
      devicePixelRatioScale !== nextDpr
    ) {
      cssCanvasWidth = nextWidth;
      cssCanvasHeight = nextHeight;
      devicePixelRatioScale = nextDpr;
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
  }

  // ── Layout helpers ─────────────────────────────────────────────────────────

  function allSegmentsFlat(): Array<{
    seg: Segment;
    runIdx: number;
    segIdx: number;
    flatIdx: number;
  }> {
    const result: Array<{
      seg: Segment;
      runIdx: number;
      segIdx: number;
      flatIdx: number;
    }> = [];
    let flat = 0;
    for (let r = 0; r < runs.length; r++) {
      if (runs[r].isBoundary) continue; // boundary runs excluded from flat index (no gates/hover)
      for (let s = 0; s < runs[r].segments.length; s++) {
        result.push({
          seg: runs[r].segments[s],
          runIdx: r,
          segIdx: s,
          flatIdx: flat++,
        });
      }
    }
    return result;
  }

  function siteTerminationAtPoint(point: Point): CanvasStructureTermination | undefined {
    const tolerance = Math.max(2, scale * 0.01);
    const marker = siteMarkers.find((item) => dist(item, point) <= tolerance);
    if (!marker) return undefined;
    return marker.markerType === "pillar" ? "pillar" : "existing_post";
  }

  function segmentWithSiteTerminations(seg: Segment): CanvasSegment {
    return {
      startX: seg.p1.x,
      startY: seg.p1.y,
      endX: seg.p2.x,
      endY: seg.p2.y,
      lengthMM: seg.lengthMM,
      angleDeg: angleDeg(seg.p1, seg.p2),
      startTermination: siteTerminationAtPoint(seg.p1),
      endTermination: siteTerminationAtPoint(seg.p2),
    };
  }

  function closestFenceSegment(point: Point) {
    let best:
      | {
          seg: Segment;
          runIdx: number;
          segIdx: number;
          point: Point;
          t: number;
          d: number;
        }
      | undefined;
    for (const item of allSegmentsFlat()) {
      const hit = closestPointOnSegment(point, item.seg);
      if (!best || hit.d < best.d) {
        best = { ...item, point: hit.point, t: hit.t, d: hit.d };
      }
    }
    return best;
  }

  function addIntegratedSiteMarker(
    markerType: CanvasSiteMarker["markerType"],
    point: Point,
    label: string,
    widthMM?: number,
    depthMM?: number,
  ) {
    const exists = siteMarkers.some(
      (marker) => marker.markerType === markerType && dist(marker, point) <= Math.max(2, scale * 0.01),
    );
    if (exists) return;
    siteMarkers.push({ x: point.x, y: point.y, markerType, label, widthMM, depthMM });
  }

  function placeSiteMarkerOnFence(
    markerType: CanvasSiteMarker["markerType"],
    clickPoint: Point,
    label: string,
    widthMM?: number,
    depthMM?: number,
  ): boolean {
    const target = closestFenceSegment(clickPoint);
    const snapDistance = Math.max(scale * 0.1, 16 / zoom);
    if (!target || target.d > snapDistance) {
      window.alert("Place the existing post or pillar directly on a fence section so it can become a termination point.");
      return false;
    }

    const run = runs[target.runIdx];
    const endpointTolerance = Math.max(0.02, Math.min(0.08, 100 / Math.max(1, target.seg.lengthMM)));
    if (target.t <= endpointTolerance || target.t >= 1 - endpointTolerance) {
      const snapPoint = target.t <= endpointTolerance ? target.seg.p1 : target.seg.p2;
      addIntegratedSiteMarker(markerType, snapPoint, label, widthMM, depthMM);
      return true;
    }

    const splitPoint = target.point;
    const oldSegment = run.segments[target.segIdx];
    const oldLength = oldSegment.lengthMM;
    const oldGates = oldSegment.gates.map((gate) => ({ ...gate }));
    run.points.splice(target.segIdx + 1, 0, splitPoint);
    run.segments = buildSegmentsFromPoints(run.points, scale);
    const left = run.segments[target.segIdx];
    const right = run.segments[target.segIdx + 1];
    left.lengthMM = Math.round(oldLength * target.t);
    right.lengthMM = Math.round(oldLength * (1 - target.t));
    left.gates = [];
    right.gates = [];
    for (const gate of oldGates) {
      if (gate.t < target.t) {
        left.gates.push({ ...gate, t: Math.max(0, Math.min(1, gate.t / target.t)) });
      } else {
        right.gates.push({
          ...gate,
          t: Math.max(0, Math.min(1, (gate.t - target.t) / (1 - target.t))),
        });
      }
    }
    addIntegratedSiteMarker(markerType, splitPoint, label, widthMM, depthMM);
    return true;
  }

  function cloneRuns(): Run[] {
    return JSON.parse(JSON.stringify(runs)) as Run[];
  }

  function snapshot(): CanvasSnapshot {
    return {
      runs: cloneRuns(),
      scale,
      activeRunIdx,
      textNotes: JSON.parse(JSON.stringify(textNotes)) as CanvasTextNote[],
      siteMarkers: JSON.parse(JSON.stringify(siteMarkers)) as CanvasSiteMarker[],
      freehandStrokes: JSON.parse(JSON.stringify(freehandStrokes)) as CanvasFreehandStroke[],
      arrows: JSON.parse(JSON.stringify(arrows)) as CanvasArrowAnnotation[],
    };
  }

  function restoreSnapshot(next: CanvasSnapshot) {
    runs = JSON.parse(JSON.stringify(next.runs)) as Run[];
    scale = next.scale;
    activeRunIdx = next.activeRunIdx;
    textNotes = JSON.parse(JSON.stringify(next.textNotes ?? [])) as CanvasTextNote[];
    siteMarkers = JSON.parse(JSON.stringify(next.siteMarkers ?? [])) as CanvasSiteMarker[];
    freehandStrokes = JSON.parse(JSON.stringify(next.freehandStrokes ?? [])) as CanvasFreehandStroke[];
    arrows = JSON.parse(JSON.stringify(next.arrows ?? [])) as CanvasArrowAnnotation[];
    segmentPreviewEndpoint = null;
  }

  function pushUndo(action: UndoAction) {
    undoStack.push(action);
    if (undoStack.length > HISTORY_STACK_LIMIT) {
      undoStack.shift();
    }
    redoStack = [];
    notifyHistoryChange();
  }

  function pushSnapshotUndo() {
    pushUndo({ type: "SNAPSHOT", snapshot: snapshot() });
  }

  function getHistoryState(): CanvasHistoryState {
    return {
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoDepth: undoStack.length,
      redoDepth: redoStack.length,
    };
  }

  function notifyHistoryChange() {
    config.onHistoryChange?.(getHistoryState());
  }

  function gateVisualFor(gate: GateMarker): CanvasGateVisual {
    return gate.gateId && gateVisuals[gate.gateId]
      ? {
          gateType: gateVisuals[gate.gateId].gateType,
          swingDirection: gateVisuals[gate.gateId].swingDirection,
          slidingSide: gateVisuals[gate.gateId].slidingSide ?? gate.slidingSide ?? "front",
          leafWidthsMM: gateVisuals[gate.gateId].leafWidthsMM,
        }
      : {
          gateType: gate.gateType ?? "single-swing",
          swingDirection: gate.swingDirection ?? "out",
          slidingSide: gate.slidingSide ?? "front",
        };
  }

  function drawHighlightedMapLabel(seg: Segment, label: SegmentMapLabel) {
    const start = lerp(seg.p1, seg.p2, label.tStart);
    const end = lerp(seg.p1, seg.p2, label.tEnd);
    ctx.save();
    ctx.strokeStyle = "rgba(245,158,11,0.88)";
    ctx.lineWidth = 9 / zoom;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3 / zoom;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }

  function labelBox(center: Point, width: number, height: number): LabelCollisionBox {
    return {
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
    };
  }

  function overlapRatio(a: LabelCollisionBox, b: LabelCollisionBox): number {
    const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const overlapArea = overlapX * overlapY;
    if (overlapArea === 0) return 0;
    const smallerArea = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
    return overlapArea / smallerArea;
  }

  function adjustedLabelCenter(center: Point, width: number, height: number, push: Point): Point {
    let next = { ...center };
    let nextBox = labelBox(next, width, height);
    for (const existing of labelCollisionBoxes) {
      if (overlapRatio(nextBox, existing) <= 0.5) continue;
      next = {
        x: next.x + push.x * (16 / zoom),
        y: next.y + push.y * (16 / zoom),
      };
      nextBox = labelBox(next, width, height);
      break;
    }
    labelCollisionBoxes.push(nextBox);
    return next;
  }

  function normaliseVector(vector: Point): Point {
    const length = Math.hypot(vector.x, vector.y);
    if (length === 0) return { x: 0, y: -1 };
    return { x: vector.x / length, y: vector.y / length };
  }

  function drawPillLabel(
    text: string,
    center: Point,
    options: {
      fontPx: number;
      color: string;
      bold?: boolean;
      italic?: boolean;
      padX?: number;
      padY?: number;
      radius?: number;
      push?: Point;
    },
  ) {
    const fontPx = options.fontPx / zoom;
    const padX = (options.padX ?? 6) / zoom;
    const padY = (options.padY ?? 2) / zoom;
    const radius = (options.radius ?? 6) / zoom;
    const push = normaliseVector(options.push ?? { x: 0, y: -1 });
    ctx.save();
    ctx.font = `${options.italic ? "italic " : ""}${options.bold ? "800 " : ""}${fontPx}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textWidth = ctx.measureText(text).width;
    const width = textWidth + padX * 2;
    const height = fontPx + padY * 2;
    const adjusted = adjustedLabelCenter(center, width, height, push);
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 2 / zoom;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(adjusted.x - width / 2, adjusted.y - height / 2, width, height, radius);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = options.color;
    ctx.fillText(text, adjusted.x, adjusted.y);
    ctx.restore();
  }

  function cornerLabelPoint(prev: Point, vertex: Point, next: Point): { center: Point; push: Point } {
    const intoPrev = normaliseVector({ x: prev.x - vertex.x, y: prev.y - vertex.y });
    const intoNext = normaliseVector({ x: next.x - vertex.x, y: next.y - vertex.y });
    const bisector = normaliseVector({ x: intoPrev.x + intoNext.x, y: intoPrev.y + intoNext.y });
    const perpendicular = normaliseVector({ x: -bisector.y, y: bisector.x });
    const center = {
      x: vertex.x + perpendicular.x * (18 / zoom),
      y: vertex.y + perpendicular.y * (18 / zoom),
    };
    return { center, push: perpendicular };
  }

  function setSegmentLength(flatIdx: number, lengthMM: number) {
    const info = allSegmentsFlat()[flatIdx];
    if (!info || lengthMM <= 0) return;

    const run = runs[info.runIdx];
    const start = run.points[info.segIdx];
    const end = run.points[info.segIdx + 1];
    if (!start || !end) return;

    const currentWorldLength = dist(start, end);
    if (currentWorldLength === 0) return;

    const targetWorldLength = (lengthMM / 1000) * scale;
    const unitX = (end.x - start.x) / currentWorldLength;
    const unitY = (end.y - start.y) / currentWorldLength;
    const nextEnd = {
      x: start.x + unitX * targetWorldLength,
      y: start.y + unitY * targetWorldLength,
    };
    const delta = {
      x: nextEnd.x - end.x,
      y: nextEnd.y - end.y,
    };

    // Move the edited endpoint and everything downstream so connected
    // segments keep their shape, similar to professional plan editors.
    for (let i = info.segIdx + 1; i < run.points.length; i++) {
      run.points[i] = {
        x: run.points[i].x + delta.x,
        y: run.points[i].y + delta.y,
      };
    }
    rebuildSegmentsPreservingGates(run, scale);
    info.seg.lengthMM = lengthMM;
    notifyChange();
    scheduleRedraw();
  }

  function snapDrawingPoint(candidate: Point): Point {
    if (activeRunIdx < 0 || !runs[activeRunIdx] || runs[activeRunIdx].finished) {
      return candidate;
    }
    const run = runs[activeRunIdx];
    if (run.points.length === 0) return candidate;
    const lastPt = run.points[run.points.length - 1];
    let snapped = snap ? snapToGrid(candidate, gridSize) : candidate;
    if (orthoMode) {
      return snapBearingFrom(lastPt, snapped, shiftDown ? 45 : 90);
    }
    if (snap && shiftDown && run.points.length >= 2) {
      const prev = run.points[run.points.length - 2];
      return snapToAllowedAngle(prev, lastPt, snapped, [180]);
    }
    if (snap) return snapBearingFrom(lastPt, snapped, 5);
    const angles = effectiveSnapAngles(false);
    if (run.points.length >= 2 && angles.length > 0) {
      const prev = run.points[run.points.length - 2];
      snapped = snapToAllowedAngle(prev, lastPt, snapped, angles);
    }
    return snapped;
  }

  function getLayout(): CanvasLayout {
    const allSegs = allSegmentsFlat(); // excludes boundary runs
    const segments: CanvasSegment[] = allSegs.map(({ seg }) => segmentWithSiteTerminations(seg));
    const gates: CanvasGate[] = [];
    allSegs.forEach(({ seg, flatIdx }) => {
      seg.gates.forEach((g) => {
        gates.push({
          segmentIndex: flatIdx,
          positionOnSegment: g.t,
          anchor: g.anchor,
          widthMM: g.widthMM,
          gateId: g.gateId,
          useGatePostsAsFenceTermination:
            g.useGatePostsAsFenceTermination ?? true,
          gateType: g.gateType,
          swingDirection: g.swingDirection,
          slidingSide: g.slidingSide,
          variables: g.variables,
        });
      });
    });

    // Boundary segments (non-product context lines)
    const boundaries: CanvasSegment[] = [];
    for (const run of runs) {
      if (!run.isBoundary) continue;
      for (const seg of run.segments) {
        boundaries.push({
          startX: seg.p1.x,
          startY: seg.p1.y,
          endX: seg.p2.x,
          endY: seg.p2.y,
          lengthMM: seg.lengthMM,
          angleDeg: angleDeg(seg.p1, seg.p2),
          contextType: run.boundaryType ?? "boundary",
        });
      }
    }

    // Build per-run summaries (non-boundary runs only)
    const nonBoundaryRuns = runs.filter((r) => !r.isBoundary);
    const runSummaries: CanvasRunSummary[] = nonBoundaryRuns.map((run, ri) => {
      const runLengthM =
        run.segments.reduce((sum, s) => sum + s.lengthMM, 0) / 1000;
      const runCorners = countCorners([run]);
      const runGates: CanvasGate[] = [];
      // Compute the flat segment index offset for this run's first segment
      let flatOffset = 0;
      for (let r = 0; r < ri; r++) {
        flatOffset += nonBoundaryRuns[r].segments.length;
      }
      run.segments.forEach((seg, si) => {
        seg.gates.forEach((g) => {
          runGates.push({
            segmentIndex: flatOffset + si,
            positionOnSegment: g.t,
            anchor: g.anchor,
            widthMM: g.widthMM,
            gateId: g.gateId,
            useGatePostsAsFenceTermination:
              g.useGatePostsAsFenceTermination ?? true,
            gateType: g.gateType,
            swingDirection: g.swingDirection,
            slidingSide: g.slidingSide,
            variables: g.variables,
          });
        });
      });
      return {
        label: `Run ${ri + 1}`,
        totalLengthM: runLengthM,
        cornerCount: runCorners,
        gates: runGates,
        sections: run.segments.map((seg, si) => ({
          label: `Section ${si + 1}`,
          lengthM: seg.lengthMM / 1000,
          panelCount: Math.max(1, Math.ceil(seg.lengthMM / 2600)),
          gateCount: seg.gates.length,
        })),
      };
    });

    return {
      segments,
      gates,
      totalLengthM: totalLengthM(nonBoundaryRuns),
      cornerCount: countCorners(nonBoundaryRuns),
      runs: runSummaries,
      boundaries,
      textNotes: [...textNotes],
      siteMarkers: [...siteMarkers],
      freehandStrokes: [...freehandStrokes],
      arrows: [...arrows],
    };
  }

  function notifyChange() {
    config.onLayoutChange?.(getLayout());
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  function draw() {
    resizeCanvas();
    const W = cssCanvasWidth || canvas.getBoundingClientRect().width || 800;
    const H = cssCanvasHeight || canvas.getBoundingClientRect().height || 420;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      devicePixelRatioScale,
      0,
      0,
      devicePixelRatioScale,
      0,
      0,
    );

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    labelCollisionBoxes = [];

    // Map underlay — drawn inside the pan/zoom transform so the image scales
    // with the canvas coordinate system and stays correctly georeferenced.
    if (mapLayers.length > 0 && mapWorldWidth > 0) {
      for (const layer of mapLayers) {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(
          layer.image,
          mapWorldOriginX - mapWorldWidth / 2,
          mapWorldOriginY - mapWorldHeight / 2,
          mapWorldWidth,
          mapWorldHeight,
        );
        ctx.restore();
      }
    }

    // Grid
    if (showGrid) {
      drawGrid(W, H);
    }

    // All segments — coloured by run
    const allSegs = allSegmentsFlat();
    // Build runIdx → non-boundary run index (for color lookup)
    const runColorIdx = new Map<number, number>();
    {
      let nbIdx = 0;
      for (let ri = 0; ri < runs.length; ri++) {
        if (!runs[ri].isBoundary) runColorIdx.set(ri, nbIdx++);
      }
    }
    const segmentCounters = new Map<number, { panel: number; gate: number }>();
    for (const { seg, flatIdx, runIdx } of allSegs) {
      const colorIdx = runColorIdx.get(runIdx) ?? 0;
      const runNumber = colorIdx + 1;
      const startNumbers = segmentCounters.get(runIdx) ?? { panel: 1, gate: 1 };
      const { labels, nextPanelNumber, nextGateNumber } = segmentLabelsForMap(
        seg,
        runNumber,
        startNumbers.panel,
        startNumbers.gate,
      );
      segmentCounters.set(runIdx, { panel: nextPanelNumber, gate: nextGateNumber });
      drawSegment(
        seg,
        flatIdx === hoveredSegIdx,
        getRunColor(colorIdx),
        getRunColorHover(colorIdx),
        labels,
      );
    }
    drawRunPointMarkers(runColorIdx);

    // Boundary runs — dashed gray lines (non-product context lines)
    {
      const suppressTouchPreview = isTouchInteractionSuppressed();
      const hasActiveBoundary =
        !suppressTouchPreview &&
        segmentPreviewEndpoint !== null &&
        (tool === "boundary" || tool === "building") &&
        activeRunIdx >= 0 &&
        runs[activeRunIdx]?.isBoundary &&
        !runs[activeRunIdx].finished;
      for (const run of runs) {
        if (!run.isBoundary) continue;
        if (run.segments.length === 0) continue;
        ctx.save();
        const isBuilding = run.boundaryType === "building";
        if (isBuilding && run.points.length >= 4) {
          ctx.beginPath();
          ctx.moveTo(run.points[0].x, run.points[0].y);
          for (let i = 1; i < run.points.length; i++) {
            ctx.lineTo(run.points[i].x, run.points[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = "rgba(30,64,175,0.14)";
          ctx.fill();
        }
        ctx.setLineDash(isBuilding ? [] : [8 / zoom, 4 / zoom]);
        ctx.strokeStyle = isBuilding ? "rgba(30,64,175,0.88)" : "#6b7280";
        ctx.lineWidth = isBuilding ? 3 / zoom : 2 / zoom;
        for (const seg of run.segments) {
          ctx.beginPath();
          ctx.moveTo(seg.p1.x, seg.p1.y);
          ctx.lineTo(seg.p2.x, seg.p2.y);
          ctx.stroke();
        }
        if (
          isBuilding &&
          selectedItem?.kind === "building" &&
          selectedItem.runIdx === runs.indexOf(run)
        ) {
          ctx.fillStyle = "#f59e0b";
          const handles = buildingHandles(run);
          for (const handle of handles) {
            const size = 7 / zoom;
            ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
          }
        }
        ctx.setLineDash([]);
        ctx.restore();
      }
      // Preview line for active boundary run
      if (hasActiveBoundary) {
        const run = runs[activeRunIdx];
        const lastPt = run.points[run.points.length - 1];
        const target = segmentPreviewEndpoint ?? lastPt;
        ctx.save();
        const isBuilding = run.boundaryType === "building";
        ctx.setLineDash(isBuilding ? [] : [6 / zoom, 4 / zoom]);
        ctx.strokeStyle = isBuilding ? "rgba(30,64,175,0.5)" : "rgba(107,114,128,0.5)";
        ctx.lineWidth = isBuilding ? 3 / zoom : 2 / zoom;
        ctx.beginPath();
        ctx.moveTo(lastPt.x, lastPt.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    drawFreehandStrokes();
    drawArrowAnnotations();
    drawTextNotes();
    drawSiteMarkers();
    drawPendingTextNote();
    drawPendingBuildingRect();
    drawPendingFreehandStroke();
    drawPendingArrow();

    // Preview line (while drawing)
    const suppressTouchPreview = isTouchInteractionSuppressed();
    if (
      tool === "draw" &&
      activeRunIdx >= 0 &&
      !suppressTouchPreview &&
      segmentPreviewEndpoint !== null
    ) {
      const run = runs[activeRunIdx];
      if (run && run.points.length > 0 && !run.finished) {
        const lastPt = run.points[run.points.length - 1];
        const target = snapDrawingPoint(segmentPreviewEndpoint);
        const previewDistance = dist(lastPt, target);
        const isBuilding = run.boundaryType === "building";
        drawActiveEndpoint(lastPt, "last point");
        if (previewDistance > 0.5 / zoom) {
          ctx.save();
          ctx.setLineDash(isBuilding ? [] : [6, 4]);
          ctx.strokeStyle = isBuilding ? "rgba(30,64,175,0.72)" : COLOR.preview;
          ctx.lineWidth = isBuilding ? 3 / zoom : 2 / zoom;
          ctx.beginPath();
          ctx.moveTo(lastPt.x, lastPt.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.restore();

          drawActiveEndpoint(target, "next point", true);
        }

        // Post position preview along the in-progress segment
        const segDist = previewDistance;
        if (!isBuilding && jobPanelWidthMm && jobPanelWidthMm > 0 && segDist > 0) {
          const previewLengthMm = pixelsToMM(segDist, scale);
          const numPanels = Math.ceil(previewLengthMm / jobPanelWidthMm);
          const sq = 5 / zoom;
          const half = sq / 2;
          const bw = 1.5 / zoom;
          ctx.save();
          for (let i = 0; i <= numPanels; i++) {
            const t = i / numPanels;
            const px = lastPt.x + t * (target.x - lastPt.x);
            const py = lastPt.y + t * (target.y - lastPt.y);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(px - half - bw, py - half - bw, sq + bw * 2, sq + bw * 2);
            ctx.fillStyle = "#f59e0b";
            ctx.fillRect(px - half, py - half, sq, sq);
          }
          ctx.restore();
        }

        // Distance label on active preview line
        if (segDist > 0) {
          const mm = pixelsToMM(segDist, scale);
          const label =
            mm >= 1000
              ? `${(mm / 1000).toFixed(2)}m`
              : `${Math.round(mm)}mm`;
          const mid: Point = {
            x: (lastPt.x + target.x) / 2,
            y: (lastPt.y + target.y) / 2,
          };
          const ang = Math.atan2(target.y - lastPt.y, target.x - lastPt.x);
          drawPillLabel(label, mid, {
            fontPx: 12,
            color: "#2563eb",
            bold: true,
            push: { x: -Math.sin(ang), y: Math.cos(ang) },
          });
        }
      }
    }

    // Gate preview (while in gate mode, hovering a segment)
    if (tool === "gate" && hoveredSegIdx >= 0 && !suppressTouchPreview) {
      const info = allSegs[hoveredSegIdx];
      if (info) {
        const proj = closestPointOnSegment(mouseCanvas, info.seg);
        drawGatePreview(info.seg, proj.t);
      }
    }

    // Snap indicator
    if (
      tool === "draw" &&
      activeRunIdx >= 0 &&
      !suppressTouchPreview &&
      segmentPreviewEndpoint !== null
    ) {
      const snapped = snapDrawingPoint(segmentPreviewEndpoint);
      ctx.save();
      ctx.beginPath();
      ctx.arc(snapped.x, snapped.y, 4 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
    }

    // Node labels (A, B, C…) and corner angle annotations
    if (zoom > 0.3) {
      let nbLabelIdx = 0;
      for (const run of runs) {
        if (run.isBoundary) continue;
        const colorIdx = nbLabelIdx++;
        const pts = run.points;
        if (pts.length < 2) continue;
        // Node labels
        for (let i = 0; i < pts.length; i++) {
          drawPillLabel(
            String.fromCharCode(65 + i),
            { x: pts[i].x - 10 / zoom, y: pts[i].y - 10 / zoom },
            {
              fontPx: 10,
              color: getRunColor(colorIdx),
              bold: true,
              padX: 4,
              padY: 1,
              radius: 5,
              push: { x: -1, y: -1 },
            },
          );
        }
        // Corner angle annotations at intermediate nodes
        for (let i = 1; i < pts.length - 1; i++) {
          const angle = angleBetween(pts[i - 1], pts[i], pts[i + 1]);
          if (angle > 30 && angle < 150) {
            const angleText = `${Math.round(angle)}°`;
            const labelPosition = cornerLabelPoint(pts[i - 1], pts[i], pts[i + 1]);
            drawPillLabel(angleText, labelPosition.center, {
              fontPx: 11,
              color: "#6d28d9",
              italic: true,
              padX: 5,
              padY: 2,
              radius: 5,
              push: labelPosition.push,
            });
          }
        }
      }
    }

    // Post position squares (from BOM result) — rendered on top of fence lines
    if (postPositions !== null && zoom > 0.2) {
      drawPostPositions();
    }

    // Computed post positions from per-segment panel widths — live preview
    if (segmentPanelWidths.length > 0) {
      drawComputedPosts();
    }

    ctx.restore();
    drawCursorHint();
  }

  function drawCursorHint() {
    if (canvasHintsDismissed) return;
    let text = "";
    if (tool === "draw") {
      text =
        activeRunIdx >= 0
          ? "Tap/click next point - double-tap/double-click to finish"
          : "Tap/click to start fence";
    }
    if (tool === "gate") text = "Tap/click a fence section to place gate";
    if (tool === "building") text = "Drag a building rectangle";
    if (tool === "boundary") text = activeRunIdx >= 0 ? "Tap/click next point - double-tap/double-click to finish" : "Tap/click to start dotted line";
    if (tool === "text") text = "Drag a text box";
    if (tool === "freehand") text = "Drag to free draw";
    if (tool === "arrow") text = pendingArrow ? "Click to place arrow head" : "Click to place arrow tail";
    if (tool === "post") text = "Click a fence section for existing post";
    if (tool === "pillar") text = "Click a fence section for pillar";
    if (orthoMode && (tool === "draw" || tool === "boundary")) {
      text = `${text} - ORTHO ${shiftDown ? "45deg" : "90deg"}`;
    }
    if (!text) return;
    const screen = canvasToScreen(mouseCanvas, pan, zoom);
    const padX = 8;
    const h = 24;
    ctx.save();
    ctx.font = "600 12px Inter, system-ui, sans-serif";
    const w = ctx.measureText(text).width + padX * 2;
    const canvasW = cssCanvasWidth || canvas.getBoundingClientRect().width || 800;
    const x = Math.min(canvasW - w - 8, screen.x + 16);
    const y = Math.max(8, screen.y + 16);
    ctx.fillStyle = "rgba(15,23,42,0.86)";
    ctx.strokeStyle = "rgba(59,130,246,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + padX, y + h / 2);
    ctx.restore();
  }

  function drawRunPointMarkers(runColorIdx: Map<number, number>) {
    ctx.save();
    for (let ri = 0; ri < runs.length; ri++) {
      const run = runs[ri];
      if (run.isBoundary || run.points.length === 0) continue;
      const fill = getRunColor(runColorIdx.get(ri) ?? 0);
      for (const pt of run.points) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.96)";
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPostPositions() {
    if (!postPositions) return;
    const squareSize = 6 / zoom;
    const half = squareSize / 2;
    const borderWidth = 1.5 / zoom;
    for (const pos of postPositions) {
      ctx.save();
      // White border
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(
        pos.x - half - borderWidth,
        pos.y - half - borderWidth,
        squareSize + borderWidth * 2,
        squareSize + borderWidth * 2,
      );
      // Amber fill (#f59e0b)
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(pos.x - half, pos.y - half, squareSize, squareSize);
      // Optional label
      if (pos.label) {
        drawPillLabel(
          pos.label,
          { x: pos.x, y: pos.y - half - borderWidth - 8 / zoom },
          {
            fontPx: 10,
            color: "#333333",
            bold: true,
            padX: 4,
            padY: 1,
            radius: 5,
            push: { x: 0, y: -1 },
          },
        );
      }
      ctx.restore();
    }
  }

  function drawComputedPosts() {
    if (segmentPanelWidths.length === 0) return;
    const squareSize = 6 / zoom;
    const half = squareSize / 2;
    const borderWidth = 1.5 / zoom;
    const drawPost = (px: number, py: number) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(
        px - half - borderWidth,
        py - half - borderWidth,
        squareSize + borderWidth * 2,
        squareSize + borderWidth * 2,
      );
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(px - half, py - half, squareSize, squareSize);
    };
    const drawPostRange = (seg: Segment, tStart: number, tEnd: number, maxW: number) => {
      const lengthMm = (tEnd - tStart) * seg.lengthMM;
      if (maxW <= 0 || lengthMm <= 0) return;
      const numPanels = Math.max(1, Math.ceil(lengthMm / maxW));
      for (let i = 0; i <= numPanels; i++) {
        const localT = i / numPanels;
        const t = tStart + (tEnd - tStart) * localT;
        const px = seg.p1.x + t * (seg.p2.x - seg.p1.x);
        const py = seg.p1.y + t * (seg.p2.y - seg.p1.y);
        drawPost(px, py);
      }
    };
    ctx.save();
    let flatIdx = 0;
    for (const run of runs) {
      if (run.isBoundary || !run.finished) continue;
      for (const seg of run.segments) {
        if (seg.gates.length === 0) {
          drawPostRange(seg, 0, 1, segmentPanelWidths[flatIdx] ?? 0);
          flatIdx++;
          continue;
        }
        let cursor = 0;
        const gates = seg.gates
          .map((g) => gateRange(seg, g))
          .sort((a, b) => a.tStart - b.tStart);
        for (const gate of gates) {
          if ((gate.tStart - cursor) * seg.lengthMM > 1) {
            drawPostRange(seg, cursor, gate.tStart, segmentPanelWidths[flatIdx] ?? 0);
            flatIdx++;
          }
          cursor = gate.tEnd;
        }
        if ((1 - cursor) * seg.lengthMM > 1) {
          drawPostRange(seg, cursor, 1, segmentPanelWidths[flatIdx] ?? 0);
          flatIdx++;
        }
      }
    }
    ctx.restore();
  }

  function drawGrid(W: number, H: number) {
    // Adaptive grid: pick an interval in metres so cells are 40–150px on screen
    const pxPerMetreOnScreen = zoom * scale;
    const INTERVALS_M = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100];
    const intervalM =
      INTERVALS_M.find((i) => i * pxPerMetreOnScreen >= 40) ?? 100;
    // Size of one cell in canvas world coordinates
    const cellSize = intervalM * scale;

    const tl = screenToCanvas({ x: 0, y: 0 }, pan, zoom);
    const br = screenToCanvas({ x: W, y: H }, pan, zoom);

    const startX = Math.floor(tl.x / cellSize) * cellSize;
    const startY = Math.floor(tl.y / cellSize) * cellSize;

    ctx.save();
    ctx.lineWidth = 0.5 / zoom;

    for (let x = startX; x <= br.x; x += cellSize) {
      ctx.strokeStyle =
        Math.abs(x) < cellSize * 0.01 ? COLOR.gridAxis : COLOR.grid;
      ctx.beginPath();
      ctx.moveTo(x, tl.y);
      ctx.lineTo(x, br.y);
      ctx.stroke();
    }
    for (let y = startY; y <= br.y; y += cellSize) {
      ctx.strokeStyle =
        Math.abs(y) < cellSize * 0.01 ? COLOR.gridAxis : COLOR.grid;
      ctx.beginPath();
      ctx.moveTo(tl.x, y);
      ctx.lineTo(br.x, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function segmentLabelsForMap(
    seg: Segment,
    runNumber: number,
    startPanelNumber: number,
    startGateNumber: number,
  ): { labels: SegmentMapLabel[]; nextPanelNumber: number; nextGateNumber: number } {
    const labels: SegmentMapLabel[] = [];
    let panelNumber = startPanelNumber;
    let gateNumber = startGateNumber;
    const gates = seg.gates
      .map((g) => gateRange(seg, g))
      .sort((a, b) => a.tStart - b.tStart);

    if (gates.length === 0) {
      labels.push({ text: `R${runNumber}S${panelNumber++}`, t: 0.5, tStart: 0, tEnd: 1, kind: "panel" });
      return { labels, nextPanelNumber: panelNumber, nextGateNumber: gateNumber };
    }

    let cursor = 0;
    for (const gate of gates) {
      if ((gate.tStart - cursor) * seg.lengthMM > 1) {
        labels.push({
          text: `R${runNumber}S${panelNumber++}`,
          t: (cursor + gate.tStart) / 2,
          tStart: cursor,
          tEnd: gate.tStart,
          kind: "panel",
        });
      }
      labels.push({
        text: `R${runNumber}G${gateNumber++}`,
        t: gate.tMid,
        tStart: gate.tStart,
        tEnd: gate.tEnd,
        kind: "gate",
      });
      cursor = gate.tEnd;
    }
    if ((1 - cursor) * seg.lengthMM > 1) {
      labels.push({
        text: `R${runNumber}S${panelNumber++}`,
        t: (cursor + 1) / 2,
        tStart: cursor,
        tEnd: 1,
        kind: "panel",
      });
    }
    return { labels, nextPanelNumber: panelNumber, nextGateNumber: gateNumber };
  }

  function drawArrow(fromX: number, fromY: number, toX: number, toY: number) {
    const head = 5 / zoom;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.lineTo(
      toX - Math.cos(angle - Math.PI / 6) * head,
      toY - Math.sin(angle - Math.PI / 6) * head,
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - Math.cos(angle + Math.PI / 6) * head,
      toY - Math.sin(angle + Math.PI / 6) * head,
    );
    ctx.stroke();
  }

  function drawAnnotationArrow(arrow: Pick<CanvasArrowAnnotation, "from" | "to" | "color" | "weight">, preview = false) {
    const dx = arrow.to.x - arrow.from.x;
    const dy = arrow.to.y - arrow.from.y;
    const length = Math.hypot(dx, dy);
    if (length < 1 / zoom) return;
    const angle = Math.atan2(dy, dx);
    const head = 12 / zoom;
    const color = arrow.color ?? "#444";
    const weight = (arrow.weight ?? 2) / zoom;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = preview ? 0.65 : 1;
    ctx.lineWidth = weight;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(arrow.from.x, arrow.from.y);
    ctx.lineTo(arrow.to.x, arrow.to.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(arrow.to.x, arrow.to.y);
    ctx.lineTo(
      arrow.to.x - Math.cos(angle - Math.PI / 7) * head,
      arrow.to.y - Math.sin(angle - Math.PI / 7) * head,
    );
    ctx.lineTo(
      arrow.to.x - Math.cos(angle + Math.PI / 7) * head,
      arrow.to.y - Math.sin(angle + Math.PI / 7) * head,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPlacedGateVisual(seg: Segment, gate: GateMarker) {
    const range = gateRange(seg, gate);
    const pStart = lerp(seg.p1, seg.p2, range.tStart);
    const pEnd = lerp(seg.p1, seg.p2, range.tEnd);
    const mid = lerp(pStart, pEnd, 0.5);
    const visual = gateVisualFor(gate);
    const direction = visual.swingDirection ?? (visual.gateType === "sliding" ? "right" : "out");
    const angle = Math.atan2(seg.p2.y - seg.p1.y, seg.p2.x - seg.p1.x);
    const width = Math.max(14 / zoom, dist(pStart, pEnd));
    const side = direction === "in" || direction === "left" ? -1 : 1;
    const slideSide = visual.slidingSide === "back" ? -1 : 1;
    const slideOffset = (300 / scale) * slideSide;

    ctx.save();
    ctx.translate(mid.x, mid.y);
    ctx.rotate(angle);
    ctx.strokeStyle = COLOR.gate;
    ctx.fillStyle = COLOR.gate;
    ctx.lineWidth = 1.6 / zoom;
    ctx.setLineDash([]);

    if (visual.gateType === "sliding") {
      const arrow = direction === "left" ? -1 : 1;
      const pocket = Math.max(width * 0.35, 450 / scale);
      const slideLength = width + pocket;
      ctx.strokeRect(-width / 2, slideOffset - 5 / zoom, width, 10 / zoom);
      drawArrow(-slideLength * 0.25 * arrow, slideOffset, slideLength * 0.5 * arrow, slideOffset);
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(-width / 2, 0);
      ctx.lineTo(-width / 2, slideOffset);
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, slideOffset);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `bold ${Math.max(8, 10 / zoom)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(direction === "left" ? "SLIDE LEFT" : "SLIDE RIGHT", 0, slideOffset - 8 / zoom);
      ctx.restore();
      return;
    }

    if (visual.gateType === "double-swing") {
      const leaf1Mm = Math.max(1, Number(visual.leafWidthsMM?.[0] ?? 0));
      const leaf2Mm = Math.max(1, Number(visual.leafWidthsMM?.[1] ?? 0));
      const totalLeafMm = leaf1Mm + leaf2Mm;
      const leaf1Radius = totalLeafMm > 0 ? width * (leaf1Mm / totalLeafMm) : width / 2;
      const leaf2Radius = totalLeafMm > 0 ? width * (leaf2Mm / totalLeafMm) : width / 2;
      const labelY = side > 0 ? -8 / zoom : 14 / zoom;
      ctx.beginPath();
      ctx.arc(-width / 2, 0, leaf1Radius, 0, side * Math.PI / 2, side < 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(width / 2, 0, leaf2Radius, Math.PI, side * Math.PI / 2, side > 0);
      ctx.stroke();
      drawArrow(-width / 2, 0, -width / 2 + leaf1Radius * 0.68, side * leaf1Radius * 0.68);
      drawArrow(width / 2, 0, width / 2 - leaf2Radius * 0.68, side * leaf2Radius * 0.68);
      ctx.font = `bold ${Math.max(8, 10 / zoom)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(direction === "in" ? "DBL IN" : "DBL OUT", 0, labelY);
      ctx.restore();
      return;
    }

    const hingeX = gate.anchor === "end" ? width / 2 : -width / 2;
    const radius = width;
    const closedAngle = gate.anchor === "end" ? Math.PI : 0;
    const openAngle = side * Math.PI / 2;
    const leafEndX = gate.anchor === "end" ? hingeX - radius * 0.7 : hingeX + radius * 0.7;
    ctx.beginPath();
    ctx.moveTo(hingeX, 0);
    ctx.lineTo(leafEndX, side * radius * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hingeX, 0, radius, closedAngle, openAngle, gate.anchor === "end" ? side > 0 : side < 0);
    ctx.stroke();
    drawArrow(hingeX, 0, leafEndX, side * radius * 0.7);
    ctx.font = `bold ${Math.max(8, 10 / zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(direction === "in" ? "SG IN" : "SG OUT", 0, side > 0 ? -8 / zoom : 14 / zoom);
    ctx.restore();
  }

  function drawFreehandStrokes() {
    if (freehandStrokes.length === 0) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of freehandStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.globalAlpha = stroke.opacity ?? 0.95;
      ctx.strokeStyle = stroke.color ?? "rgba(14,165,233,0.9)";
      ctx.lineWidth = (stroke.width ?? 3) / zoom;
      ctx.setLineDash(
        stroke.lineStyle === "dashed"
          ? [12 / zoom, 8 / zoom]
          : stroke.lineStyle === "dotted"
            ? [2 / zoom, 7 / zoom]
            : [],
      );
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) {
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (stroke.arrow && stroke.points.length >= 2) {
        const from = stroke.points[stroke.points.length - 2];
        const to = stroke.points[stroke.points.length - 1];
        drawArrow(from.x, from.y, to.x, to.y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawArrowAnnotations() {
    if (arrows.length === 0) return;
    for (const arrow of arrows) {
      drawAnnotationArrow(arrow);
    }
  }

  function drawPendingFreehandStroke() {
    if (!pendingFreehandStroke || pendingFreehandStroke.points.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = pendingFreehandStroke.opacity ?? 0.95;
    ctx.strokeStyle = pendingFreehandStroke.color ?? "rgba(14,165,233,0.9)";
    ctx.lineWidth = (pendingFreehandStroke.width ?? 3) / zoom;
    ctx.setLineDash(
      pendingFreehandStroke.lineStyle === "dashed"
        ? [12 / zoom, 8 / zoom]
        : pendingFreehandStroke.lineStyle === "dotted"
          ? [2 / zoom, 7 / zoom]
          : [],
    );
    ctx.beginPath();
    ctx.moveTo(pendingFreehandStroke.points[0].x, pendingFreehandStroke.points[0].y);
    for (const point of pendingFreehandStroke.points.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawPendingArrow() {
    if (!pendingArrow) return;
    drawAnnotationArrow({ from: pendingArrow.from, to: pendingArrow.to, color: "#444", weight: 2 }, true);
  }

  function drawTextNotes() {
    if (textNotes.length === 0) return;
    ctx.save();
    ctx.textBaseline = "top";
    for (let idx = 0; idx < textNotes.length; idx++) {
      const note = textNotes[idx];
      const text = note.text.trim();
      if (!text) continue;
      const fs = Math.max(10, (note.fontSize ?? 14) / zoom);
      ctx.font = `${note.italic ? "italic " : ""}${note.bold !== false ? "bold " : ""}${fs}px Inter, system-ui, sans-serif`;
      const padX = 4 / zoom;
      const padY = 2 / zoom;
      const lineGap = 3 / zoom;
      const lines = text.split(/\r?\n/).map((line) => note.bullets ? `• ${line}` : line);
      const textW = Math.max(...lines.map((line) => ctx.measureText(line).width));
      const boxW = Math.max(note.width ?? 0, textW + padX * 2);
      const h = Math.max(note.height ?? 0, lines.length * (fs + lineGap) + padY * 2);
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 4 / zoom;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1 / zoom;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.strokeStyle =
        selectedItem?.kind === "text" && selectedItem.index === idx
          ? "rgba(245,158,11,0.9)"
          : "#333";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.roundRect(note.x, note.y, boxW, h, 4 / zoom);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.stroke();
      ctx.textAlign = note.align ?? "left";
      const textX =
        note.align === "center"
          ? note.x + boxW / 2
          : note.align === "right"
            ? note.x + boxW - padX
            : note.x + padX;
      lines.forEach((line, lineIdx) => {
        const textY = note.y + padY + lineIdx * (fs + lineGap);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2 / zoom;
        ctx.strokeText(line, textX, textY);
        ctx.fillStyle = note.color ?? "#222";
        ctx.fillText(line, textX, textY);
      });
      if (selectedItem?.kind === "text" && selectedItem.index === idx) {
        const handle = 7 / zoom;
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(note.x + boxW - handle, note.y + h - handle, handle, handle);
      }
    }
    ctx.restore();
  }

  function drawPendingTextNote() {
    if (!pendingTextNote) return;
    const x = Math.min(pendingTextNote.start.x, pendingTextNote.current.x);
    const y = Math.min(pendingTextNote.start.y, pendingTextNote.current.y);
    const width = Math.abs(pendingTextNote.current.x - pendingTextNote.start.x);
    const height = Math.abs(pendingTextNote.current.y - pendingTextNote.start.y);
    if (width < 2 || height < 2) return;
    ctx.save();
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.fillStyle = "rgba(59,130,246,0.12)";
    ctx.strokeStyle = "rgba(59,130,246,0.95)";
    ctx.lineWidth = 1.4 / zoom;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5 / zoom);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawSiteMarkers() {
    if (siteMarkers.length === 0) return;
    ctx.save();
    ctx.font = `900 ${13 / zoom}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const marker of siteMarkers) {
      const widthWorld = marker.widthMM ? (marker.widthMM / 1000) * scale : marker.markerType === "pillar" ? 18 / zoom : 14 / zoom;
      const heightWorld = marker.depthMM ? (marker.depthMM / 1000) * scale : widthWorld;
      const size = Math.max(widthWorld, heightWorld, marker.markerType === "pillar" ? 18 / zoom : 14 / zoom);
      ctx.lineWidth = 2 / zoom;
      ctx.fillStyle =
        marker.markerType === "pillar"
          ? "rgba(148,163,184,0.24)"
          : "rgba(100,116,139,0.22)";
      ctx.strokeStyle = marker.markerType === "pillar" ? "#94a3b8" : "#64748b";
      if (marker.markerType === "pillar") {
        ctx.beginPath();
        ctx.roundRect(marker.x - widthWorld / 2, marker.y - heightWorld / 2, widthWorld, heightWorld, 3 / zoom);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = COLOR.label;
      ctx.fillText(marker.markerType === "pillar" ? "P" : "EP", marker.x, marker.y);
      if (marker.label) {
        ctx.font = `800 ${11 / zoom}px Inter, system-ui, sans-serif`;
        const dims =
          marker.widthMM && marker.depthMM
            ? `${marker.label} ${Math.round(marker.widthMM)}x${Math.round(marker.depthMM)}`
            : marker.label;
        ctx.fillText(dims, marker.x, marker.y - size);
        ctx.font = `900 ${13 / zoom}px Inter, system-ui, sans-serif`;
      }
    }
    ctx.restore();
  }

  function drawSegment(
    seg: Segment,
    hovered: boolean,
    runColor = COLOR.segment,
    runColorHover = COLOR.segmentHover,
    mapLabels: SegmentMapLabel[] = [],
  ) {
    const lw = 3 / zoom;
    const segColor = hovered ? runColorHover : runColor;
    const segLw = hovered ? lw * 1.5 : lw;
    const highlightedLabel = mapLabels.find((label) => label.text === highlightedMapLabel);

    // Build sorted list of gate gaps as (tStart, tEnd) pairs
    type GateGap = { tStart: number; tEnd: number; widthMM: number; gate: GateMarker };
    const gaps: GateGap[] = seg.gates
      .map((g) => ({ ...gateRange(seg, g), widthMM: g.widthMM, gate: g }))
      .sort((a, b) => a.tStart - b.tStart);

    // Draw fence line as sections between/around gate gaps
    if (highlightedLabel) drawHighlightedMapLabel(seg, highlightedLabel);

    ctx.save();
    ctx.strokeStyle = segColor;
    ctx.lineWidth = segLw;
    ctx.lineCap = "round";

    let cursor = 0; // current t position
    for (const gap of gaps) {
      // Solid fence section before this gate
      if (gap.tStart > cursor) {
        const from = lerp(seg.p1, seg.p2, cursor);
        const to = lerp(seg.p1, seg.p2, gap.tStart);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
      cursor = gap.tEnd;
    }
    // Final solid section after last gate (or whole line if no gates)
    if (cursor < 1) {
      const from = lerp(seg.p1, seg.p2, cursor);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(seg.p2.x, seg.p2.y);
      ctx.stroke();
    }
    ctx.restore();

    // Draw each gate gap as a dashed amber line + distance annotations
    for (const gap of gaps) {
      const pStart = lerp(seg.p1, seg.p2, gap.tStart);
      const pEnd = lerp(seg.p1, seg.p2, gap.tEnd);
      drawPlacedGateVisual(seg, gap.gate);

      // Dashed amber gap line
      ctx.save();
      ctx.strokeStyle = COLOR.gate;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.setLineDash([5 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Small post indicators at gap edges
      for (const pt of [pStart, pEnd]) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = COLOR.gate;
        ctx.fill();
      }
      ctx.restore();

      // Distance annotations (only when zoomed in enough)
      if (zoom > 0.25) {
        const ang = Math.atan2(seg.p2.y - seg.p1.y, seg.p2.x - seg.p1.x);
        const perpX = -Math.sin(ang);
        const perpY = Math.cos(ang);
        const offset = 12 / zoom;
        const fs = Math.max(8, 10 / zoom);

        // Distance before gate (p1 → gap start)
        const distBeforeM = (gap.tStart * seg.lengthMM) / 1000;
        // Distance after gate (gap end → p2)
        const distAfterM = ((1 - gap.tEnd) * seg.lengthMM) / 1000;
        ctx.save();
        ctx.font = `${fs}px sans-serif`;
        ctx.fillStyle = COLOR.gate;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Mid-before label
        if (distBeforeM > 0.05) {
          const midBefore = lerp(seg.p1, pStart, 0.5);
          ctx.fillText(
            `${distBeforeM.toFixed(2)}m`,
            midBefore.x + perpX * offset,
            midBefore.y + perpY * offset,
          );
        }
        // Gate opening label (centred on the gap)
        const midGate = lerp(pStart, pEnd, 0.5);
        ctx.font = `bold ${fs}px sans-serif`;
        const gateText = `${Math.round(gap.widthMM)}mm gate`;
        const gateX = midGate.x + perpX * (offset * 2.2);
        const gateY = midGate.y + perpY * (offset * 2.2);
        const gateTextWidth = ctx.measureText(gateText).width;
        const padX = 5 / zoom;
        const padY = 3 / zoom;
        ctx.fillStyle = "rgba(15,23,42,0.9)";
        ctx.strokeStyle = COLOR.gate;
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.roundRect(
          gateX - gateTextWidth / 2 - padX,
          gateY - fs / 2 - padY,
          gateTextWidth + padX * 2,
          fs + padY * 2,
          4 / zoom,
        );
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COLOR.gate;
        ctx.fillText(gateText, gateX, gateY);
        ctx.font = `${fs}px sans-serif`;

        // Mid-after label
        if (distAfterM > 0.05) {
          const midAfter = lerp(pEnd, seg.p2, 0.5);
          ctx.fillStyle = COLOR.gate;
          ctx.fillText(
            `${distAfterM.toFixed(2)}m`,
            midAfter.x + perpX * offset,
            midAfter.y + perpY * offset,
          );
        }
        ctx.restore();
      }
    }

    // Labels render over fence geometry but before handles/endpoints.
    drawLabel(seg);
    drawMapSegmentLabels(seg, mapLabels);

    // End-point dots
    ctx.save();
    for (const pt of [seg.p1, seg.p2]) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.pointFill;
      ctx.fill();
      ctx.strokeStyle = segColor;
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
    }
    ctx.restore();

  }

  function drawLabel(seg: Segment) {
    const ang = Math.atan2(seg.p2.y - seg.p1.y, seg.p2.x - seg.p1.x);
    const mid = offsetPointFromSegment(seg, 0.5, 10 / zoom);
    const labelText =
      seg.lengthMM >= 1000
        ? `${(seg.lengthMM / 1000).toFixed(2)}m`
        : `${Math.round(seg.lengthMM)}mm`;
    drawPillLabel(labelText, mid, {
      fontPx: 12,
      color: "#2563eb",
      bold: true,
      push: { x: -Math.sin(ang), y: Math.cos(ang) },
    });
  }

  function drawMapSegmentLabels(seg: Segment, labels: SegmentMapLabel[]) {
    if (zoom <= 0.18 || labels.length === 0) return;
    for (const label of labels) {
      const pt = offsetPointFromSegment(seg, label.t, -14 / zoom);
      const ang = Math.atan2(seg.p2.y - seg.p1.y, seg.p2.x - seg.p1.x);
      drawPillLabel(label.text, pt, {
        fontPx: 12,
        color: label.kind === "gate" ? "#92400e" : "#333333",
        bold: true,
        push: { x: Math.sin(ang), y: -Math.cos(ang) },
      });
    }
  }

  function drawActiveEndpoint(pt: Point, label: string, ghost = false) {
    const radius = ghost ? 8 / zoom : 10 / zoom;
    const ring = ghost ? "rgba(245,158,11,0.35)" : "rgba(15,23,42,0.18)";
    const stroke = ghost ? "#f59e0b" : "#0f172a";
    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = ghost ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5 / zoom;
    ctx.stroke();
    ctx.font = `bold ${Math.max(10, 12 / zoom)}px sans-serif`;
    ctx.fillStyle = stroke;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, pt.x, pt.y - radius * 2.1);
    ctx.restore();
  }

  function drawGatePreview(seg: Segment, t: number) {
    const previewGate: GateMarker = {
      t,
      anchor: gateAnchorForPlacement(seg, t, pendingGatePlacement.widthMM),
      widthMM: pendingGatePlacement.widthMM,
      gateType: pendingGatePlacement.gateType,
      swingDirection: pendingGatePlacement.swingDirection,
      slidingSide: pendingGatePlacement.slidingSide,
    };
    const range = gateRange(seg, previewGate);
    const pStart = lerp(seg.p1, seg.p2, range.tStart);
    const pEnd = lerp(seg.p1, seg.p2, range.tEnd);
    const gp = lerp(pStart, pEnd, 0.5);
    const ang = Math.atan2(seg.p2.y - seg.p1.y, seg.p2.x - seg.p1.x);
    const width = Math.max(14 / zoom, dist(pStart, pEnd));

    ctx.save();
    ctx.translate(gp.x, gp.y);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.72;

    ctx.fillStyle = "rgba(245,158,11,0.14)";
    ctx.strokeStyle = COLOR.gate;
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(-width / 2, -7 / zoom, width, 14 / zoom);
    ctx.fillRect(-width / 2, -7 / zoom, width, 14 / zoom);

    if (pendingGatePlacement.gateType === "sliding") {
      const arrow = pendingGatePlacement.swingDirection === "left" ? -1 : 1;
      const slideOffset = (300 / scale) * (pendingGatePlacement.slidingSide === "back" ? -1 : 1);
      ctx.strokeRect(-width / 2, slideOffset - 5 / zoom, width, 10 / zoom);
      drawArrow(-width * 0.3 * arrow, slideOffset, width * 0.35 * arrow, slideOffset);
    } else {
      const side = pendingGatePlacement.swingDirection === "in" ? -1 : 1;
      const swing = Math.min(width * 0.55, 34 / zoom);
      if (pendingGatePlacement.gateType === "double-swing") {
        ctx.beginPath();
        ctx.arc(-width / 2, 0, swing, side > 0 ? 0 : -Math.PI / 2, side > 0 ? Math.PI / 2 : 0, side < 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(width / 2, 0, swing, side > 0 ? Math.PI / 2 : Math.PI, side > 0 ? Math.PI : Math.PI / 2, side < 0);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(-width / 2, 0, swing, side > 0 ? 0 : -Math.PI / 2, side > 0 ? Math.PI / 2 : 0, side < 0);
        ctx.stroke();
      }
    }

    ctx.font = `bold ${Math.max(9, 11 / zoom)}px sans-serif`;
    ctx.fillStyle = COLOR.gate;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${pendingGatePlacement.widthMM}mm`, 0, -10 / zoom);

    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(width / 2, 0);
    ctx.strokeStyle = COLOR.gate;
    ctx.stroke();

    ctx.restore();
  }

  function scheduleRedraw() {
    cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(() => draw());
  }

  function redrawNow() {
    cancelAnimationFrame(animFrame);
    animFrame = 0;
    draw();
  }

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  function eventToCanvas(e: Pick<MouseEvent, "clientX" | "clientY">): Point {
    const rect = canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    return screenToCanvas(screen, pan, zoom);
  }

  function eventToScreen(e: Pick<MouseEvent, "clientX" | "clientY">): Point {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Hit testing ────────────────────────────────────────────────────────────

  function hitTestSegments(pt: Point, threshold = 8): number {
    const threshWorld = threshold / zoom;
    const allSegs = allSegmentsFlat();
    let closest = -1;
    let closestD = Infinity;
    for (const { seg, flatIdx } of allSegs) {
      const { d } = closestPointOnSegment(pt, seg);
      if (d < threshWorld && d < closestD) {
        closestD = d;
        closest = flatIdx;
      }
    }
    return closest;
  }

  function pointerSnapRadius(e: MouseEvent | CanvasPointerLike): number {
    return snapRadiusForPointerType("pointerType" in e ? e.pointerType : undefined);
  }

  function hitTestNodeAtScreen(
    screenPt: Point,
    hitRadius: number,
  ): { runIdx: number; ptIdx: number } | null {
    for (let ri = 0; ri < runs.length; ri++) {
      const run = runs[ri];
      for (let pi = 0; pi < run.points.length; pi++) {
        const nodePtScreen = canvasToScreen(run.points[pi], pan, zoom);
        if (dist(screenPt, nodePtScreen) < hitRadius) {
          return { runIdx: ri, ptIdx: pi };
        }
      }
    }
    return null;
  }

  function drawingTouchAction(t: Tool): "auto" | "none" {
    return t === "move" ? "auto" : "none";
  }

  function updateCanvasTouchAction() {
    canvas.style.touchAction = drawingTouchAction(tool);
  }

  function clearSegmentPreview() {
    segmentPreviewEndpoint = null;
  }

  function activateSegmentPreview(point: Point) {
    if (
      (tool !== "draw" && tool !== "boundary" && tool !== "building") ||
      activeRunIdx < 0 ||
      runs[activeRunIdx]?.finished ||
      isTouchInteractionSuppressed()
    ) {
      clearSegmentPreview();
      return;
    }
    segmentPreviewEndpoint = point;
  }

  function isTouchTapDeferredTool(t: Tool): boolean {
    return t === "draw" || t === "boundary" || t === "gate";
  }

  function isTouchInteractionSuppressed(): boolean {
    return isMultiTouching || Date.now() < multiTouchCooldownUntil;
  }

  function cancelTouchInteractionState() {
    const hadDrag = draggingNode !== null || draggingGate !== null || dragAction !== null;
    clearSegmentPreview();
    clearTouchVertexLongPress();
    touchTapCandidate = null;
    draggingNode = null;
    draggingGate = null;
    dragAction = null;
    isPanning = false;
    lastTouchPointer = null;
    if (hadDrag) notifyChange();
    canvas.style.cursor =
      tool === "move"
        ? "grab"
        : tool === "draw" || tool === "boundary" || tool === "building" || tool === "text" || tool === "post" || tool === "pillar" || tool === "freehand" || tool === "arrow"
          ? "crosshair"
          : "default";
  }

  function beginMultiTouch(touchCount: number) {
    activePointerCount = touchCount;
    isMultiTouching = true;
    cancelTouchInteractionState();
  }

  function finishMultiTouchCooldown() {
    activePointerCount = 0;
    isMultiTouching = false;
    pinchZoom = null;
    clearSegmentPreview();
    touchTapCandidate = null;
    clearTouchVertexLongPress();
    lastTapTime = 0;
    lastTapScreen = null;
    multiTouchCooldownUntil = Date.now() + TOUCH_MULTI_COOLDOWN_MS;
  }

  function clearTouchVertexLongPress() {
    if (!touchVertexLongPress) return;
    window.clearTimeout(touchVertexLongPress.timer);
    touchVertexLongPress = null;
  }

  function startTouchVertexLongPress(
    pointer: CanvasPointerLike,
    node: { runIdx: number; ptIdx: number },
  ) {
    clearTouchVertexLongPress();
    const longPress = {
      timer: 0,
      pointer,
      screenPt: eventToScreen(pointer),
      node,
    };
    longPress.timer = window.setTimeout(() => {
      if (touchVertexLongPress !== longPress) return;
      if (
        !touchTapCandidate ||
        touchTapCandidate.moved ||
        isTouchInteractionSuppressed() ||
        activePointerCount !== 1
      ) {
        clearTouchVertexLongPress();
        return;
      }

      touchTapCandidate = null;
      draggingNode = { ...longPress.node };
      mouseCanvas = eventToCanvas(longPress.pointer);
      canvas.style.cursor = "grabbing";
      touchVertexLongPress = null;
      scheduleRedraw();
    }, TOUCH_VERTEX_LONG_PRESS_MS);
    touchVertexLongPress = longPress;
  }

  function updateTouchVertexLongPress(pointer: CanvasPointerLike) {
    if (!touchVertexLongPress) return;
    const screenPt = eventToScreen(pointer);
    if (dist(screenPt, touchVertexLongPress.screenPt) > TOUCH_TAP_MOVE_TOLERANCE_PX) {
      clearTouchVertexLongPress();
      return;
    }
    touchVertexLongPress.pointer = pointer;
  }

  function hitTestLabel(pt: Point): number {
    // Returns flat segment index if pt is near its midpoint label
    const allSegs = allSegmentsFlat();
    for (const { seg, flatIdx } of allSegs) {
      const mid = offsetPointFromSegment(seg, 0.5, 18 / zoom);
      if (dist(pt, mid) < 30 / zoom) return flatIdx;
    }
    return -1;
  }

  function textNoteBounds(note: CanvasTextNote) {
    ctx.save();
    const fs = Math.max(10, (note.fontSize ?? 14) / zoom);
    ctx.font = `${note.italic ? "italic " : ""}${note.bold !== false ? "bold " : ""}${fs}px Inter, system-ui, sans-serif`;
    const lines = note.text.split(/\r?\n/).map((line) => note.bullets ? `• ${line}` : line);
    const padX = 4 / zoom;
    const padY = 2 / zoom;
    const lineGap = 3 / zoom;
    const textW = Math.max(...lines.map((line) => ctx.measureText(line).width), 80 / zoom);
    ctx.restore();
    return {
      x: note.x,
      y: note.y,
      width: Math.max(note.width ?? 0, textW + padX * 2),
      height: Math.max(note.height ?? 0, lines.length * (fs + lineGap) + padY * 2),
    };
  }

  function hitTestText(pt: Point): { index: number; resize: boolean } | null {
    for (let i = textNotes.length - 1; i >= 0; i--) {
      const b = textNoteBounds(textNotes[i]);
      const inBox = pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height;
      if (!inBox) continue;
      const resize =
        pt.x >= b.x + b.width - 12 / zoom &&
        pt.y >= b.y + b.height - 12 / zoom;
      return { index: i, resize };
    }
    return null;
  }

  function buildingHandles(run: Run): Point[] {
    if (!run.boundaryType || run.boundaryType !== "building" || run.points.length < 4) return [];
    const pts = run.points.slice(0, 4);
    return [
      pts[0],
      pts[1],
      pts[2],
      pts[3],
      lerp(pts[0], pts[1], 0.5),
      lerp(pts[1], pts[2], 0.5),
      lerp(pts[2], pts[3], 0.5),
      lerp(pts[3], pts[0], 0.5),
    ];
  }

  function hitTestBuilding(pt: Point): { runIdx: number; handle?: number } | null {
    for (let i = runs.length - 1; i >= 0; i--) {
      const run = runs[i];
      if (!run.isBoundary || run.boundaryType !== "building" || run.points.length < 4) continue;
      const handles = buildingHandles(run);
      const handleIdx = handles.findIndex((handle) => dist(handle, pt) <= 10 / zoom);
      if (handleIdx >= 0) return { runIdx: i, handle: handleIdx };
      const xs = run.points.slice(0, 4).map((p) => p.x);
      const ys = run.points.slice(0, 4).map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) return { runIdx: i };
    }
    return null;
  }

  function hitTestBoundaryRun(pt: Point): number | null {
    for (let i = runs.length - 1; i >= 0; i--) {
      const run = runs[i];
      if (!run.isBoundary || run.boundaryType === "building") continue;
      for (const seg of run.segments) {
        if (closestPointOnSegment(pt, seg).d <= 8 / zoom) return i;
      }
    }
    return null;
  }

  function hitTestMarker(pt: Point): number | null {
    for (let i = siteMarkers.length - 1; i >= 0; i--) {
      const marker = siteMarkers[i];
      const w = marker.widthMM ? (marker.widthMM / 1000) * scale : 18 / zoom;
      const h = marker.depthMM ? (marker.depthMM / 1000) * scale : w;
      if (Math.abs(pt.x - marker.x) <= Math.max(w / 2, 10 / zoom) && Math.abs(pt.y - marker.y) <= Math.max(h / 2, 10 / zoom)) {
        return i;
      }
    }
    return null;
  }

  function hitTestFreehand(pt: Point): number | null {
    for (let i = freehandStrokes.length - 1; i >= 0; i--) {
      const stroke = freehandStrokes[i];
      for (let j = 0; j < stroke.points.length - 1; j++) {
        const seg: Segment = { p1: stroke.points[j], p2: stroke.points[j + 1], lengthMM: 0, gates: [] };
        if (closestPointOnSegment(pt, seg).d <= 8 / zoom) return i;
      }
    }
    return null;
  }

  function hitTestCanvasItem(pt: Point, screenPt: Point): SelectedCanvasItem {
    const textHit = hitTestText(pt);
    if (textHit) return { kind: "text", index: textHit.index };
    const markerIdx = hitTestMarker(pt);
    if (markerIdx !== null) return { kind: "marker", index: markerIdx };
    const buildingHit = hitTestBuilding(pt);
    if (buildingHit) return { kind: "building", runIdx: buildingHit.runIdx };
    const boundaryRunIdx = hitTestBoundaryRun(pt);
    if (boundaryRunIdx !== null) return { kind: "boundary", runIdx: boundaryRunIdx };
    const freehandIdx = hitTestFreehand(pt);
    if (freehandIdx !== null) return { kind: "freehand", index: freehandIdx };
    for (const gm of getAllGateMidpoints()) {
      if (dist(screenPt, gm.screenPt) < 12) {
        return { kind: "gate", runIdx: gm.runIdx, segIdx: gm.segIdx, gateIdx: gm.gateIdx, flatSegIdx: gm.flatSegIdx };
      }
    }
    const flatIdx = hitTestSegments(pt, 10);
    if (flatIdx >= 0) {
      const info = allSegmentsFlat()[flatIdx];
      if (info) return { kind: "segment", runIdx: info.runIdx, segIdx: info.segIdx, flatIdx };
    }
    return null;
  }

  function isNearActiveLastPoint(screenPt: Point, thresholdPx = 34): boolean {
    if (activeRunIdx < 0 || runs[activeRunIdx]?.finished) return false;
    const run = runs[activeRunIdx];
    if (!run || run.points.length < 2) return false;
    const last = run.points[run.points.length - 1];
    const lastScreen = canvasToScreen(last, pan, zoom);
    return dist(screenPt, lastScreen) <= thresholdPx;
  }

  function getAllGateMidpoints(): Array<{
    screenPt: Point;
    runIdx: number;
    segIdx: number;
    gateIdx: number;
    flatSegIdx: number;
  }> {
    const result: Array<{
      screenPt: Point;
      runIdx: number;
      segIdx: number;
      gateIdx: number;
      flatSegIdx: number;
    }> = [];
    let flatSeg = 0;
    for (let ri = 0; ri < runs.length; ri++) {
      const run = runs[ri];
      for (let si = 0; si < run.segments.length; si++) {
        const seg = run.segments[si];
        for (let gi = 0; gi < seg.gates.length; gi++) {
          const gate = seg.gates[gi];
          const midWorld = lerp(seg.p1, seg.p2, gateRange(seg, gate).tMid);
          result.push({
            screenPt: canvasToScreen(midWorld, pan, zoom),
            runIdx: ri,
            segIdx: si,
            gateIdx: gi,
            flatSegIdx: flatSeg,
          });
        }
        flatSeg++;
      }
    }
    return result;
  }

  // ── Chain stop helper ──────────────────────────────────────────────────────

  /**
   * Stops an in-progress chain draw. If the active run has only one point (i.e.
   * it is the pending chain stub), discard it. If it has ≥2 points (the very
   * first run started with the draw tool before any chain occurred), finish it
   * normally. In either case activeRunIdx is reset to -1.
   */
  function stopChain(popExtra = true) {
    if (activeRunIdx < 0 || runs[activeRunIdx]?.finished) return;
    const run = runs[activeRunIdx];
    clearSegmentPreview();

    // The dblclick's first mousedown already added the dblclick point — pop it.
    // Skip the pop when called from keyboard (Enter/Escape) since no extra point was added.
    if (popExtra && run.points.length > 1) {
      run.points.pop();
      rebuildSegmentsPreservingGates(run, scale);
      // The matching ADD_POINT was just pushed; remove it from the undo stack.
      if (undoStack[undoStack.length - 1]?.type === "ADD_POINT") {
        undoStack.pop();
        notifyHistoryChange();
      }
    }

    if (run.points.length < 2) {
      // Only the start point remains — discard the run entirely
      runs.splice(activeRunIdx, 1);
      if (undoStack[undoStack.length - 1]?.type === "ADD_RUN") {
        undoStack.pop();
        notifyHistoryChange();
      }
    } else {
      // Finish the run with its accumulated points
      run.finished = true;
      pushUndo({ type: "FINISH_RUN", runIdx: activeRunIdx });
      notifyChange();
    }

    activeRunIdx = -1;
    scheduleRedraw();
  }

  function clearContextMenu() {
    if (contextMenuEl?.parentNode) contextMenuEl.parentNode.removeChild(contextMenuEl);
    contextMenuEl = null;
  }

  function deleteSelectedItem(item = selectedItem) {
    if (!item) return;
    const destructive =
      item.kind === "segment" ||
      (item.kind === "gate" && runs[item.runIdx]?.segments[item.segIdx]?.gates[item.gateIdx]);
    if (destructive && item.kind === "segment") {
      const seg = runs[item.runIdx]?.segments[item.segIdx];
      if (seg?.gates.length && !window.confirm("Delete this fence section and its gates?")) return;
    }
    pushSnapshotUndo();
    switch (item.kind) {
      case "gate":
        runs[item.runIdx]?.segments[item.segIdx]?.gates.splice(item.gateIdx, 1);
        break;
      case "segment": {
        const run = runs[item.runIdx];
        if (!run) break;
        if (run.segments.length <= 1) {
          runs.splice(item.runIdx, 1);
        } else {
          run.points.splice(item.segIdx + 1, 1);
          rebuildSegmentsPreservingGates(run, scale);
        }
        break;
      }
      case "building":
      case "boundary":
        runs.splice(item.runIdx, 1);
        break;
      case "text":
        textNotes.splice(item.index, 1);
        break;
      case "marker":
        siteMarkers.splice(item.index, 1);
        break;
      case "freehand":
        freehandStrokes.splice(item.index, 1);
        break;
    }
    selectedItem = null;
    notifyChange();
    scheduleRedraw();
  }

  function duplicateSelectedItem(item = selectedItem) {
    if (!item) return;
    pushSnapshotUndo();
    const offset = 20 / zoom;
    if (item.kind === "text") {
      const note = textNotes[item.index];
      if (note) textNotes.push({ ...note, x: note.x + offset, y: note.y + offset });
    } else if (item.kind === "marker") {
      const marker = siteMarkers[item.index];
      if (marker) siteMarkers.push({ ...marker, x: marker.x + offset, y: marker.y + offset });
    } else if (item.kind === "freehand") {
      const stroke = freehandStrokes[item.index];
      if (stroke) freehandStrokes.push({ ...stroke, points: stroke.points.map((p) => ({ x: p.x + offset, y: p.y + offset })) });
    } else if (item.kind === "building" || item.kind === "boundary") {
      const run = runs[item.runIdx];
      if (run) {
        const points = run.points.map((p) => ({ x: p.x + offset, y: p.y + offset }));
        const duplicated: Run = {
          ...JSON.parse(JSON.stringify(run)),
          points,
          segments: buildSegmentsFromPoints(points, scale),
        };
        runs.push(duplicated);
      }
    }
    notifyChange();
    scheduleRedraw();
  }

  function moveSelectedZ(item: SelectedCanvasItem, direction: "front" | "back") {
    if (!item) return;
    pushSnapshotUndo();
    if (item.kind === "text") {
      const [note] = textNotes.splice(item.index, 1);
      if (note) direction === "front" ? textNotes.push(note) : textNotes.unshift(note);
    } else if (item.kind === "marker") {
      const [marker] = siteMarkers.splice(item.index, 1);
      if (marker) direction === "front" ? siteMarkers.push(marker) : siteMarkers.unshift(marker);
    } else if (item.kind === "freehand") {
      const [stroke] = freehandStrokes.splice(item.index, 1);
      if (stroke) direction === "front" ? freehandStrokes.push(stroke) : freehandStrokes.unshift(stroke);
    } else if (item.kind === "building" || item.kind === "boundary") {
      const [run] = runs.splice(item.runIdx, 1);
      if (run) direction === "front" ? runs.push(run) : runs.unshift(run);
    }
    notifyChange();
    scheduleRedraw();
  }

  function editSelectedItem(item = selectedItem) {
    if (!item) return;
    if (item.kind === "text") {
      const note = textNotes[item.index];
      if (!note) return;
      const nextText = window.prompt("Text note", note.text);
      if (nextText === null) return;
      const fontSize = window.prompt("Font size", String(note.fontSize ?? 14));
      const color = window.prompt("Text colour (CSS value)", note.color ?? "#111827");
      const style = window.prompt("Style: normal, bold, italic, bold italic", `${note.bold === false ? "" : "bold"}${note.italic ? " italic" : ""}`.trim() || "normal");
      const align = window.prompt("Align: left, center, right", note.align ?? "left");
      pushSnapshotUndo();
      textNotes[item.index] = {
        ...note,
        text: nextText,
        fontSize: Math.max(8, Number(fontSize) || note.fontSize || 14),
        color: color || note.color,
        bold: /bold/i.test(style ?? ""),
        italic: /italic/i.test(style ?? ""),
        align: align === "center" || align === "right" ? align : "left",
      };
      notifyChange();
      scheduleRedraw();
    } else if (item.kind === "marker") {
      const marker = siteMarkers[item.index];
      if (!marker) return;
      const width = window.prompt("Width in mm", String(marker.widthMM ?? (marker.markerType === "pillar" ? 350 : 90)));
      if (width === null) return;
      const depth = window.prompt("Depth in mm", String(marker.depthMM ?? Number(width)));
      if (depth === null) return;
      pushSnapshotUndo();
      siteMarkers[item.index] = {
        ...marker,
        widthMM: Math.max(1, Number(width) || marker.widthMM || 90),
        depthMM: Math.max(1, Number(depth) || marker.depthMM || 90),
      };
      notifyChange();
      scheduleRedraw();
    } else if (item.kind === "gate") {
      const gate = runs[item.runIdx]?.segments[item.segIdx]?.gates[item.gateIdx];
      config.onGateEdit?.(
        item.flatSegIdx,
        item.gateIdx,
        gate?.gateId,
        gate?.widthMM ?? DEFAULT_GATE_WIDTH_MM,
        gate
          ? {
              segmentIndex: item.flatSegIdx,
              positionOnSegment: gate.t,
              anchor: gate.anchor,
              widthMM: gate.widthMM,
              gateId: gate.gateId,
              useGatePostsAsFenceTermination:
                gate.useGatePostsAsFenceTermination,
              gateType: gate.gateType,
              swingDirection: gate.swingDirection,
              slidingSide: gate.slidingSide,
              variables: gate.variables,
            }
          : undefined,
      );
    }
  }

  function showContextMenu(screenPt: Point, item: SelectedCanvasItem) {
    clearContextMenu();
    selectedItem = item;
    const menu = document.createElement("div");
    contextMenuEl = menu;
    menu.style.cssText = `
      position:absolute; left:${screenPt.x}px; top:${screenPt.y}px; z-index:500;
      min-width:160px; padding:6px; border:1px solid #334155; border-radius:10px;
      background:rgba(15,23,42,0.96); color:#e5e7eb; box-shadow:0 16px 40px rgba(0,0,0,0.35);
      font:600 12px Inter, system-ui, sans-serif;
    `;
    const add = (label: string, fn: () => void, disabled = false) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.disabled = disabled;
      btn.style.cssText = `
        display:block; width:100%; text-align:left; padding:7px 9px; border:0; border-radius:7px;
        color:${disabled ? "#64748b" : "#e5e7eb"}; background:transparent; cursor:${disabled ? "not-allowed" : "pointer"};
      `;
      btn.onmouseenter = () => { if (!disabled) btn.style.background = "rgba(59,130,246,0.22)"; };
      btn.onmouseleave = () => { btn.style.background = "transparent"; };
      btn.onclick = () => {
        if (!disabled) fn();
        clearContextMenu();
      };
      menu.appendChild(btn);
    };
    if (item) {
      add("Edit", () => editSelectedItem(item), item.kind === "segment" || item.kind === "freehand" || item.kind === "boundary" || item.kind === "building");
      add("Copy", () => { clipboardItem = item; });
      add("Duplicate", () => duplicateSelectedItem(item), item.kind === "segment" || item.kind === "gate");
      add("Delete", () => deleteSelectedItem(item));
      add("Bring to front", () => moveSelectedZ(item, "front"), item.kind === "segment" || item.kind === "gate");
      add("Send to back", () => moveSelectedZ(item, "back"), item.kind === "segment" || item.kind === "gate");
    } else {
      add("Paste", () => duplicateSelectedItem(clipboardItem), !clipboardItem);
      add("Reset view", () => resetView());
      add(showGrid ? "Hide grid" : "Show grid", () => setShowGrid(!showGrid));
    }
    container.appendChild(menu);
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && menu.contains(event.target as Node)) return;
      clearContextMenu();
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
    setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("keydown", close);
    }, 0);
    scheduleRedraw();
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  function onMouseDown(e: MouseEvent | CanvasPointerLike) {
    if (e.button === 2) {
      // Right button: start pan
      clearSegmentPreview();
      isPanning = true;
      panStart = eventToScreen(e);
      panOrigin = { ...pan };
      e.preventDefault();
      return;
    }

    if (e.button !== 0) {
      clearSegmentPreview();
      return;
    }

    const canvasPt = eventToCanvas(e);
    const hitRadius = pointerSnapRadius(e);
    mouseCanvas = canvasPt;
    let worldPt = snap ? snapToGrid(canvasPt, gridSize) : canvasPt;
    const screenPtDown = eventToScreen(e);
    clearContextMenu();

    if (tool === "move") {
      const textHit = hitTestText(canvasPt);
      if (textHit) {
        selectedItem = { kind: "text", index: textHit.index };
        pushSnapshotUndo();
        dragAction = textHit.resize
          ? { kind: "resize-text", index: textHit.index, start: canvasPt, original: { ...textNotes[textHit.index] } }
          : { kind: "move-text", index: textHit.index, start: canvasPt, original: { ...textNotes[textHit.index] } };
        scheduleRedraw();
        return;
      }

      const buildingHit = hitTestBuilding(canvasPt);
      if (buildingHit) {
        selectedItem = { kind: "building", runIdx: buildingHit.runIdx };
        pushSnapshotUndo();
        dragAction =
          buildingHit.handle !== undefined
            ? { kind: "resize-building", runIdx: buildingHit.runIdx, handle: buildingHit.handle, original: runs[buildingHit.runIdx].points.map((p) => ({ ...p })) }
            : { kind: "move-building", runIdx: buildingHit.runIdx, start: canvasPt, original: runs[buildingHit.runIdx].points.map((p) => ({ ...p })) };
        scheduleRedraw();
        return;
      }

      const markerIdx = hitTestMarker(canvasPt);
      if (markerIdx !== null) {
        selectedItem = { kind: "marker", index: markerIdx };
        pushSnapshotUndo();
        dragAction = { kind: "move-marker", index: markerIdx, start: canvasPt, original: { ...siteMarkers[markerIdx] } };
        scheduleRedraw();
        return;
      }
    }

    // ── Gate hit-test (all modes) ────────────────────────────────────────────
    // Check for an existing gate click/drag before any tool-specific handling.
    // A short move (<5px) will be treated as a click → edit; a longer move → drag.
    {
      const gateMids = getAllGateMidpoints();
      for (const gm of gateMids) {
        const dx = screenPtDown.x - gm.screenPt.x;
        const dy = screenPtDown.y - gm.screenPt.y;
        if (Math.sqrt(dx * dx + dy * dy) < Math.max(12, hitRadius)) {
          draggingGate = {
            runIdx: gm.runIdx,
            segIdx: gm.segIdx,
            gateIdx: gm.gateIdx,
            flatSegIdx: gm.flatSegIdx,
            startScreenPt: screenPtDown,
          };
          return;
        }
      }
    }

    if (!editingLabel && (tool === "draw" || tool === "move")) {
      const labelIdx = hitTestLabel(canvasPt);
      if (labelIdx >= 0 && !(tool === "draw" && activeRunIdx >= 0)) {
        startLabelEdit(labelIdx, screenPtDown);
        return;
      }
    }

    if (tool === "text") {
      canvasHintsDismissed = true;
      pushSnapshotUndo();
      pendingTextNote = { start: canvasPt, current: canvasPt };
      scheduleRedraw();
      return;
    }

    if (tool === "freehand") {
      canvasHintsDismissed = true;
      pushSnapshotUndo();
      pendingFreehandStroke = {
        points: [canvasPt],
        color: currentFreehandStyle.color,
        width: currentFreehandStyle.width,
        lineStyle: currentFreehandStyle.lineStyle,
        opacity: currentFreehandStyle.opacity,
        arrow: currentFreehandStyle.arrow,
      };
      scheduleRedraw();
      return;
    }

    if (tool === "arrow") {
      canvasHintsDismissed = true;
      if (pendingArrow) {
        pendingArrow.to = canvasPt;
        if (dist(pendingArrow.from, pendingArrow.to) > 2 / zoom) {
          arrows.push({
            kind: "arrow",
            from: { ...pendingArrow.from },
            to: { ...pendingArrow.to },
            color: "#444",
            weight: 2,
          });
          notifyChange();
        }
        pendingArrow = null;
      } else {
        pushSnapshotUndo();
        pendingArrow = { from: canvasPt, to: canvasPt };
      }
      scheduleRedraw();
      return;
    }

    if (tool === "post" || tool === "pillar") {
      const markerType = tool;
      const defaultLabel = markerType === "pillar" ? "Pillar" : "Existing post";
      const widthResponse = window.prompt(`${defaultLabel} width in mm`, markerType === "pillar" ? "350" : "90");
      if (widthResponse === null) return;
      const depthResponse = window.prompt(`${defaultLabel} depth in mm`, widthResponse);
      if (depthResponse === null) return;
      const widthMM = Math.max(1, Number.parseFloat(widthResponse.replace(",", ".")));
      const depthMM = Math.max(1, Number.parseFloat(depthResponse.replace(",", ".")));
      if (!Number.isFinite(widthMM) || !Number.isFinite(depthMM)) {
        window.alert("Enter valid post/pillar width and depth in millimetres.");
        return;
      }
      const target = closestFenceSegment(canvasPt);
      const snapDistance = Math.max(scale * 0.1, 16 / zoom);
      if (!target || target.d > snapDistance) {
        window.alert("Place the existing post or pillar directly on a fence section so it can become a termination point.");
        return;
      }
      createLabelInput(
        container,
        screenPtDown,
        defaultLabel,
        (value) => {
          pushSnapshotUndo();
          const placed = placeSiteMarkerOnFence(
            markerType,
            canvasPt,
            value.trim() || defaultLabel,
            widthMM,
            depthMM,
          );
          if (placed) {
            canvasHintsDismissed = true;
            notifyChange();
            scheduleRedraw();
          }
        },
        () => scheduleRedraw(),
        180,
      );
      return;
    }

    if (tool === "building") {
      canvasHintsDismissed = true;
      pushSnapshotUndo();
      pendingBuildingRect = { start: canvasPt, current: canvasPt };
      scheduleRedraw();
      return;
    }

    if (tool === "draw") {
      canvasHintsDismissed = true;
      clearSegmentPreview();
      if (isNearActiveLastPoint(screenPtDown)) {
        stopChain(false);
        return;
      }

      if (activeRunIdx === -1 || runs[activeRunIdx]?.finished) {
        // Check if click is on the end-point of a finished run — resume it
        let resumedIdx = -1;
        for (let ri = 0; ri < runs.length; ri++) {
          const run = runs[ri];
          if (!run.finished || run.isBoundary || run.points.length === 0) continue;
          const endPtScreen = canvasToScreen(
            run.points[run.points.length - 1],
            pan,
            zoom,
          );
          const dx = screenPtDown.x - endPtScreen.x;
          const dy = screenPtDown.y - endPtScreen.y;
          if (Math.sqrt(dx * dx + dy * dy) < Math.max(10, hitRadius)) {
            resumedIdx = ri;
            break;
          }
        }

        if (resumedIdx >= 0 && tool === "draw") {
          // Resume the existing run — un-finish it so new points can be appended
          runs[resumedIdx].finished = false;
          activeRunIdx = resumedIdx;
          pushUndo({ type: "RESUME_RUN", runIdx: resumedIdx }); // undo will re-finish it
        } else {
          // Start a new run with this as the first point
          mouseCanvas = worldPt;
          const newRun: Run = {
            points: [worldPt],
            finished: false,
            segments: [],
          };
          pushUndo({ type: "ADD_RUN" });
          runs.push(newRun);
          activeRunIdx = runs.length - 1;
        }
      } else {
        // Append point to the current run (multi-point polyline)
        const run = runs[activeRunIdx];
        worldPt = snapDrawingPoint(canvasPt);
        mouseCanvas = worldPt;
        run.points.push(worldPt);
        rebuildSegmentsPreservingGates(run, scale);
        notifyChange();
        pushUndo({ type: "ADD_POINT", runIdx: activeRunIdx });
      }
      scheduleRedraw();
      return;
    }

    if (tool === "boundary") {
      canvasHintsDismissed = true;
      clearSegmentPreview();
      if (activeRunIdx === -1 || runs[activeRunIdx]?.finished) {
        mouseCanvas = worldPt;
        const newRun: Run = {
          points: [worldPt],
          finished: false,
          segments: [],
          isBoundary: true,
        };
        pushUndo({ type: "ADD_RUN" });
        runs.push(newRun);
        activeRunIdx = runs.length - 1;
      } else {
        const run = runs[activeRunIdx];
        const prevRunIdx = activeRunIdx;
        worldPt = snapDrawingPoint(canvasPt);
        mouseCanvas = worldPt;
        run.points.push(worldPt);
        rebuildSegmentsPreservingGates(run, scale);
        run.finished = true;
        notifyChange();
        const newRun: Run = {
          points: [{ ...worldPt }],
          finished: false,
          segments: [],
          isBoundary: true,
        };
        runs.push(newRun);
        const newRunIdx = runs.length - 1;
        activeRunIdx = newRunIdx;
        pushUndo({ type: "CHAIN_POINT", prevRunIdx, newRunIdx });
      }
      scheduleRedraw();
      return;
    }

    if (tool === "gate") {
      clearSegmentPreview();
      const flatIdx = hitTestSegments(canvasPt, Math.max(12, hitRadius));
      if (flatIdx >= 0) {
        const allSegs = allSegmentsFlat();
        const info = allSegs[flatIdx];
        const proj = closestPointOnSegment(canvasPt, info.seg);
        const snappedGateT = snapGatePositionTo100mm(
          info.seg,
          proj.t,
          gateSnap100,
        );
        const gateAnchor = gateAnchorForPlacement(
          info.seg,
          snappedGateT,
          pendingGatePlacement.widthMM,
        );
        const gateIdx = info.seg.gates.length;
        pushUndo({ type: "ADD_GATE", segIdx: flatIdx, gateIdx });
        info.seg.gates.push({
          t: snappedGateT,
          anchor: gateAnchor,
          widthMM: pendingGatePlacement.widthMM,
          useGatePostsAsFenceTermination: true,
          gateType: pendingGatePlacement.gateType,
          swingDirection: pendingGatePlacement.swingDirection,
          slidingSide: pendingGatePlacement.slidingSide,
          variables: pendingGatePlacement.variables,
        });
        canvasHintsDismissed = true;
        notifyChange();
        scheduleRedraw();
        config.onGatePlaced?.(
          flatIdx,
          gateIdx,
          pendingGatePlacement.widthMM,
          pendingGatePlacement.gateType,
          pendingGatePlacement.slidingSide,
        );
      }
      return;
    }

    if (tool === "move") {
      // Hit test nodes first (screen-space comparison for consistent 8px threshold)
      const nodeHit = hitTestNodeAtScreen(screenPtDown, hitRadius);
      if (nodeHit) {
        draggingNode = nodeHit;
        return;
      }

      // Label click-to-edit
      if (!editingLabel) {
        const labelIdx = hitTestLabel(canvasPt);
        if (labelIdx >= 0) {
          startLabelEdit(labelIdx, eventToScreen(e));
          return;
        }
      }
      selectedItem = hitTestCanvasItem(canvasPt, screenPtDown);
      if (selectedItem) {
        scheduleRedraw();
        return;
      }
      isPanning = true;
      panStart = screenPtDown;
      panOrigin = { ...pan };
      canvas.style.cursor = "grabbing";
      return;
    }
  }

  function onMouseMove(e: MouseEvent | CanvasPointerLike) {
    const canvasPt = eventToCanvas(e);
    const hitRadius = pointerSnapRadius(e);
    mouseCanvas = canvasPt;

    if (dragAction) {
      if (dragAction.kind === "move-text") {
        textNotes[dragAction.index] = {
          ...dragAction.original,
          x: dragAction.original.x + (canvasPt.x - dragAction.start.x),
          y: dragAction.original.y + (canvasPt.y - dragAction.start.y),
        };
      } else if (dragAction.kind === "resize-text") {
        textNotes[dragAction.index] = {
          ...dragAction.original,
          width: Math.max(80 / zoom, (dragAction.original.width ?? 160 / zoom) + (canvasPt.x - dragAction.start.x)),
          height: Math.max(28 / zoom, (dragAction.original.height ?? 38 / zoom) + (canvasPt.y - dragAction.start.y)),
        };
      } else if (dragAction.kind === "move-marker") {
        siteMarkers[dragAction.index] = {
          ...dragAction.original,
          x: dragAction.original.x + (canvasPt.x - dragAction.start.x),
          y: dragAction.original.y + (canvasPt.y - dragAction.start.y),
        };
      } else if (dragAction.kind === "move-building") {
        const dx = canvasPt.x - dragAction.start.x;
        const dy = canvasPt.y - dragAction.start.y;
        const run = runs[dragAction.runIdx];
        if (run) {
          run.points = dragAction.original.map((p) => ({ x: p.x + dx, y: p.y + dy }));
          rebuildSegmentsPreservingGates(run, scale);
        }
      } else if (dragAction.kind === "resize-building") {
        const run = runs[dragAction.runIdx];
        if (run && dragAction.original.length >= 4) {
          const xs = dragAction.original.slice(0, 4).map((p) => p.x);
          const ys = dragAction.original.slice(0, 4).map((p) => p.y);
          let minX = Math.min(...xs);
          let maxX = Math.max(...xs);
          let minY = Math.min(...ys);
          let maxY = Math.max(...ys);
          if ([0, 3, 7].includes(dragAction.handle)) minX = canvasPt.x;
          if ([1, 2, 5].includes(dragAction.handle)) maxX = canvasPt.x;
          if ([0, 1, 4].includes(dragAction.handle)) minY = canvasPt.y;
          if ([2, 3, 6].includes(dragAction.handle)) maxY = canvasPt.y;
          if (Math.abs(maxX - minX) > 4 / zoom && Math.abs(maxY - minY) > 4 / zoom) {
            run.points = [
              { x: minX, y: minY },
              { x: maxX, y: minY },
              { x: maxX, y: maxY },
              { x: minX, y: maxY },
              { x: minX, y: minY },
            ];
            rebuildSegmentsPreservingGates(run, scale);
          }
        }
      }
      canvas.style.cursor = "grabbing";
      scheduleRedraw();
      return;
    }

    if (isPanning) {
      const screen = eventToScreen(e);
      pan = {
        x: panOrigin.x + (screen.x - panStart.x),
        y: panOrigin.y + (screen.y - panStart.y),
      };
      scheduleRedraw();
      return;
    }

    // Node dragging
    if (draggingNode !== null) {
      const snapped = snap ? snapToGrid(canvasPt, gridSize) : canvasPt;
      const run = runs[draggingNode.runIdx];
      run.points[draggingNode.ptIdx] = snapped;
      rebuildSegmentsPreservingGates(run, scale);
      scheduleRedraw();
      return;
    }

    // Gate dragging
    if (draggingGate !== null) {
      const seg = runs[draggingGate.runIdx].segments[draggingGate.segIdx];
      if (seg) {
        const dx = seg.p2.x - seg.p1.x;
        const dy = seg.p2.y - seg.p1.y;
        const len2 = dx * dx + dy * dy;
        if (len2 > 0) {
          const t =
            ((canvasPt.x - seg.p1.x) * dx + (canvasPt.y - seg.p1.y) * dy) /
            len2;
          const gate = seg.gates[draggingGate.gateIdx];
          gate.t = snapGatePositionTo100mm(seg, t, gateSnap100);
          gate.anchor = gateAnchorForPlacement(seg, gate.t, gate.widthMM);
        }
        scheduleRedraw();
      }
      return;
    }

    if (pendingTextNote) {
      pendingTextNote.current = canvasPt;
      canvas.style.cursor = "crosshair";
      scheduleRedraw();
      return;
    }

    if (pendingBuildingRect) {
      pendingBuildingRect.current = snap ? snapToGrid(canvasPt, gridSize) : canvasPt;
      canvas.style.cursor = "crosshair";
      scheduleRedraw();
      return;
    }

    if (pendingFreehandStroke) {
      pendingFreehandStroke.points.push(canvasPt);
      canvas.style.cursor = "crosshair";
      scheduleRedraw();
      return;
    }

    if (pendingArrow) {
      pendingArrow.to = canvasPt;
      canvas.style.cursor = "crosshair";
      scheduleRedraw();
      return;
    }

    activateSegmentPreview(canvasPt);

    // Update hover state
    const prevHover = hoveredSegIdx;
    hoveredSegIdx = hitTestSegments(canvasPt, Math.max(10, hitRadius));

    // Gate hover cursor works in all modes
    const screenPt = eventToScreen(e);
    let overGate = false;
    const gateMids = getAllGateMidpoints();
    for (const gm of gateMids) {
      const dx = screenPt.x - gm.screenPt.x;
      const dy = screenPt.y - gm.screenPt.y;
      if (Math.sqrt(dx * dx + dy * dy) < Math.max(12, hitRadius)) {
        overGate = true;
        break;
      }
    }

    if (draggingGate !== null) {
      canvas.style.cursor = "grabbing";
    } else if (overGate) {
      canvas.style.cursor = "grab";
    } else if (tool === "move") {
      // Check if hovering a node
      let overNode = false;
      for (const run of runs) {
        for (const pt of run.points) {
          const nodePtScreen = canvasToScreen(pt, pan, zoom);
          const dx = screenPt.x - nodePtScreen.x;
          const dy = screenPt.y - nodePtScreen.y;
          if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
            overNode = true;
            break;
          }
        }
        if (overNode) break;
      }
      canvas.style.cursor = overNode
        ? "grab"
        : hoveredSegIdx >= 0
          ? "pointer"
          : "grab";
    } else if (hoveredSegIdx !== prevHover) {
      canvas.style.cursor =
        hoveredSegIdx >= 0
          ? tool === "gate"
            ? "crosshair"
            : "pointer"
          : tool === "draw" || tool === "building" || tool === "text" || tool === "freehand" || tool === "arrow"
            ? "crosshair"
            : "default";
    }

    scheduleRedraw();
  }

  function onMouseUp(e: MouseEvent | CanvasPointerLike) {
    if (dragAction && e.button === 0) {
      dragAction = null;
      notifyChange();
      canvas.style.cursor = tool === "move" ? "grab" : "default";
      scheduleRedraw();
      return;
    }

    if (pendingBuildingRect && e.button === 0) {
      pendingBuildingRect.current = snap ? snapToGrid(eventToCanvas(e), gridSize) : eventToCanvas(e);
      const x1 = pendingBuildingRect.start.x;
      const y1 = pendingBuildingRect.start.y;
      const x2 = pendingBuildingRect.current.x;
      const y2 = pendingBuildingRect.current.y;
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      pendingBuildingRect = null;
      if (width > 4 / zoom && height > 4 / zoom) {
        const points: Point[] = [
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x2, y: y2 },
          { x: x1, y: y2 },
          { x: x1, y: y1 },
        ];
        const newRun: Run = {
          points,
          finished: true,
          segments: buildSegmentsFromPoints(points, scale),
          isBoundary: true,
          boundaryType: "building",
        };
        runs.push(newRun);
        textNotes.push({
          x: Math.min(x1, x2) + width / 2 - 40 / zoom,
          y: Math.min(y1, y2) + height / 2 - 12 / zoom,
          width: 80 / zoom,
          height: 24 / zoom,
          text: "Building",
          fontSize: 13,
          color: "#0f2f6f",
          bold: true,
          align: "center",
        });
        activeRunIdx = -1;
        notifyChange();
      }
      scheduleRedraw();
      return;
    }

    if (pendingFreehandStroke && e.button === 0) {
      pendingFreehandStroke.points.push(eventToCanvas(e));
      if (pendingFreehandStroke.points.length > 1) {
        freehandStrokes.push(pendingFreehandStroke);
        notifyChange();
      }
      pendingFreehandStroke = null;
      scheduleRedraw();
      return;
    }

    if (pendingTextNote && e.button === 0) {
      pendingTextNote.current = eventToCanvas(e);
      const x = Math.min(pendingTextNote.start.x, pendingTextNote.current.x);
      const y = Math.min(pendingTextNote.start.y, pendingTextNote.current.y);
      const width = Math.max(90 / zoom, Math.abs(pendingTextNote.current.x - pendingTextNote.start.x));
      const height = Math.max(34 / zoom, Math.abs(pendingTextNote.current.y - pendingTextNote.start.y));
      const screenCenter = canvasToScreen(
        { x: x + width / 2, y: y + height / 2 },
        pan,
        zoom,
      );
      const inputWidth = Math.max(160, Math.min(420, width * zoom));
      pendingTextNote = null;
      createLabelInput(
        container,
        screenCenter,
        "",
        (value) => {
          const text = value.trim();
          if (!text) {
            scheduleRedraw();
            return;
          }
          textNotes.push({ x, y, width, height, text, bold: true, fontSize: 14, color: "#111827", align: "left" });
          notifyChange();
          scheduleRedraw();
        },
        () => scheduleRedraw(),
        inputWidth,
      );
      scheduleRedraw();
      return;
    }

    if (e.button === 2 || (e.button === 0 && isPanning)) {
      isPanning = false;
      canvas.style.cursor = tool === "move" ? "grab" : "default";
    }

    if (draggingNode !== null) {
      notifyChange();
      draggingNode = null;
      canvas.style.cursor = "default";
      return;
    }

    if (draggingGate !== null) {
      const { flatSegIdx, gateIdx, startScreenPt, runIdx, segIdx } =
        draggingGate;
      const endScreen = eventToScreen(e);
      const dx = endScreen.x - startScreenPt.x;
      const dy = endScreen.y - startScreenPt.y;
      const wasDrag = Math.sqrt(dx * dx + dy * dy) > 5;

      if (wasDrag) {
        notifyChange();
      } else {
        // Click (not drag) on an existing gate → edit it
        const gate = runs[runIdx]?.segments[segIdx]?.gates[gateIdx];
        config.onGateEdit?.(
          flatSegIdx,
          gateIdx,
          gate?.gateId,
          gate?.widthMM ?? DEFAULT_GATE_WIDTH_MM,
          gate
            ? {
                segmentIndex: flatSegIdx,
                positionOnSegment: gate.t,
                anchor: gate.anchor,
                widthMM: gate.widthMM,
                gateId: gate.gateId,
                useGatePostsAsFenceTermination:
                  gate.useGatePostsAsFenceTermination,
                gateType: gate.gateType,
                swingDirection: gate.swingDirection,
                slidingSide: gate.slidingSide,
                variables: gate.variables,
              }
            : undefined,
        );
      }
      draggingGate = null;
      canvas.style.cursor = tool === "draw" || tool === "building" || tool === "text" || tool === "freehand" || tool === "arrow" ? "crosshair" : "default";
      return;
    }
  }

  function touchToPointer(touch: Touch, source: TouchEvent): CanvasPointerLike {
    return {
      button: 0,
      clientX: touch.clientX,
      clientY: touch.clientY,
      pointerType: "touch",
      preventDefault: () => source.preventDefault(),
    };
  }

  function touchToScreenPoint(touch: Touch): Point {
    const rect = canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  function touchPairDistance(touches: TouchList): number {
    const a = touches[0];
    const b = touches[1];
    if (!a || !b) return 0;
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function touchPairCenter(touches: TouchList): Point {
    const a = touches[0];
    const b = touches[1];
    if (!a || !b) return canvasCenterScreenPoint();
    const aScreen = touchToScreenPoint(a);
    const bScreen = touchToScreenPoint(b);
    return {
      x: (aScreen.x + bScreen.x) / 2,
      y: (aScreen.y + bScreen.y) / 2,
    };
  }

  function completeDeferredTouchTap(pointer: CanvasPointerLike) {
    clearTouchVertexLongPress();
    const candidate = touchTapCandidate;
    touchTapCandidate = null;
    if (!candidate || isTouchInteractionSuppressed()) return;

    const screenPt = eventToScreen(pointer);
    const now = Date.now();
    const heldMs = now - candidate.startedAt;
    const isDoubleTap =
      lastTapScreen !== null &&
      now - lastTapTime < TOUCH_DOUBLE_TAP_MS &&
      dist(screenPt, lastTapScreen) < TOUCH_DOUBLE_TAP_DISTANCE_PX;

    if (
      isDoubleTap &&
      (tool === "draw" || tool === "boundary") &&
      activeRunIdx >= 0 &&
      !runs[activeRunIdx]?.finished
    ) {
      lastTapTime = 0;
      lastTapScreen = null;
      stopChain(false);
      scheduleRedraw();
      return;
    }

    if (candidate.moved || heldMs > TOUCH_SINGLE_TAP_MAX_MS) {
      return;
    }

    const isDuplicateTap =
      lastPlacedTouchTapScreen !== null &&
      now - lastPlacedTouchTapTime < TOUCH_SINGLE_TAP_DEBOUNCE_MS &&
      dist(screenPt, lastPlacedTouchTapScreen) < TOUCH_DUPLICATE_TAP_DISTANCE_PX;
    if (isDuplicateTap) return;

    // Debounce only exact duplicate touchend taps; fast taps in different
    // locations still place distinct points as intentional drawing input.
    lastPlacedTouchTapTime = now;
    lastPlacedTouchTapScreen = screenPt;
    lastTapTime = now;
    lastTapScreen = screenPt;
    mouseCanvas = eventToCanvas(pointer);
    onMouseDown(pointer);
    onMouseUp(pointer);
    redrawNow();
  }

  function onTouchStart(e: TouchEvent) {
    if (editingLabel) return;
    activePointerCount = e.touches.length;
    if (e.touches.length >= 2) {
      beginMultiTouch(e.touches.length);
      pinchZoom = {
        lastDistance: touchPairDistance(e.touches),
        lastCenter: touchPairCenter(e.touches),
      };
      e.preventDefault();
      return;
    }
    if (e.touches.length !== 1) return;
    const pointer = touchToPointer(e.touches[0], e);
    lastTouchPointer = pointer;
    if (isTouchInteractionSuppressed()) {
      pointer.preventDefault();
      return;
    }
    if (isTouchTapDeferredTool(tool)) {
      const screenPt = eventToScreen(pointer);
      const nodeHit = hitTestNodeAtScreen(screenPt, pointerSnapRadius(pointer));
      touchTapCandidate = {
        pointer,
        screenPt,
        startedAt: Date.now(),
        moved: false,
      };
      if (nodeHit) {
        startTouchVertexLongPress(pointer, nodeHit);
      } else {
        clearTouchVertexLongPress();
      }
      pointer.preventDefault();
      return;
    }
    pointer.preventDefault();
    onMouseDown(pointer);
  }

  function onTouchMove(e: TouchEvent) {
    activePointerCount = e.touches.length;
    if (e.touches.length >= 2) {
      beginMultiTouch(e.touches.length);
      const distance = touchPairDistance(e.touches);
      const center = touchPairCenter(e.touches);
      if (pinchZoom && pinchZoom.lastDistance > 0 && distance > 0) {
        zoomAtScreenPoint(
          center,
          distance / pinchZoom.lastDistance,
        );
        pan.x += center.x - pinchZoom.lastCenter.x;
        pan.y += center.y - pinchZoom.lastCenter.y;
        scheduleRedraw();
      }
      pinchZoom = { lastDistance: distance, lastCenter: center };
      e.preventDefault();
      return;
    }
    if (pinchZoom || isMultiTouching) {
      if (e.touches.length === 0) {
        finishMultiTouchCooldown();
      } else {
        activePointerCount = e.touches.length;
      }
      lastTouchPointer = null;
      e.preventDefault();
      return;
    }
    if (e.touches.length !== 1) return;
    const pointer = touchToPointer(e.touches[0], e);
    lastTouchPointer = pointer;
    if (isTouchInteractionSuppressed()) {
      pointer.preventDefault();
      return;
    }
    if (touchTapCandidate) {
      const screenPt = eventToScreen(pointer);
      if (dist(screenPt, touchTapCandidate.screenPt) > TOUCH_TAP_MOVE_TOLERANCE_PX) {
        touchTapCandidate.moved = true;
        clearTouchVertexLongPress();
      } else {
        updateTouchVertexLongPress(pointer);
      }
      touchTapCandidate.pointer = pointer;
      pointer.preventDefault();
      if (touchTapCandidate.moved) {
        onMouseMove(pointer);
      }
      return;
    }
    pointer.preventDefault();
    onMouseMove(pointer);
  }

  function onTouchEnd(e: TouchEvent) {
    activePointerCount = e.touches.length;
    if (pinchZoom || isMultiTouching || activePointerCount >= 2) {
      if (e.touches.length === 0) {
        finishMultiTouchCooldown();
      } else {
        activePointerCount = e.touches.length;
        isMultiTouching = true;
      }
      lastTouchPointer = null;
      e.preventDefault();
      scheduleRedraw();
      return;
    }
    const touch = e.changedTouches[0];
    const pointer = touch ? touchToPointer(touch, e) : lastTouchPointer;
    if (!pointer) {
      clearTouchVertexLongPress();
      return;
    }

    pointer.preventDefault();
    if (isTouchInteractionSuppressed()) {
      touchTapCandidate = null;
      clearTouchVertexLongPress();
      lastTouchPointer = null;
      return;
    }

    if (touchTapCandidate) {
      completeDeferredTouchTap(pointer);
      clearSegmentPreview();
      lastTouchPointer = null;
      return;
    }

    clearTouchVertexLongPress();
    onMouseUp(pointer);
    clearSegmentPreview();
    lastTouchPointer = null;
  }

  function onTouchCancel(e: TouchEvent) {
    cancelTouchInteractionState();
    finishMultiTouchCooldown();
    e.preventDefault();
    scheduleRedraw();
  }

  function onDblClick(e: MouseEvent) {
    if (editingLabel) return;

    if ((tool === "draw" || tool === "building" || tool === "boundary") && activeRunIdx >= 0 && !runs[activeRunIdx]?.finished) {
      const screenPt = eventToScreen(e);
      stopChain(!isNearActiveLastPoint(screenPt));
      scheduleRedraw();
      return;
    }

    const canvasPt = eventToCanvas(e);
    const textHit = hitTestText(canvasPt);
    if (textHit) {
      selectedItem = { kind: "text", index: textHit.index };
      editSelectedItem(selectedItem);
      return;
    }

    const labelIdx = hitTestLabel(canvasPt);
    if (labelIdx >= 0) {
      startLabelEdit(labelIdx, eventToScreen(e));
      return;
    }

    // Scale calibration is intentionally behind Alt+double-click so normal
    // double-clicking a length label can never resize the whole drawing scale.
    if (!e.altKey) return;

    const flatIdx = hitTestSegments(canvasPt, 12);
    if (flatIdx >= 0) {
      const allSegs = allSegmentsFlat();
      const info = allSegs[flatIdx];
      if (!info) return;
      const seg = info.seg;
      const segLengthWorld = Math.sqrt(
        (seg.p2.x - seg.p1.x) ** 2 + (seg.p2.y - seg.p1.y) ** 2,
      );
      if (segLengthWorld === 0) return;
      const response = prompt(
        "Enter real-world length for this section (e.g. 2500 for 2500mm or 2.5 for 2.5m):",
      );
      if (response === null) return;
      const parsed = parseFloat(response.replace(",", "."));
      if (isNaN(parsed) || parsed <= 0) return;
      const enteredMM = parsed < 30 ? parsed * 1000 : parsed;
      // Update scale: mm per world unit
      scale = enteredMM / segLengthWorld;
      // Recalculate all segment lengths with new scale
      for (const r of runs) {
        rebuildSegmentsPreservingGates(r, scale);
      }
      notifyChange();
      scheduleRedraw();
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const screen = eventToScreen(e);
    const zoomFactor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    zoomAtScreenPoint(screen, zoomFactor);
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    const canvasPt = eventToCanvas(e);
    const screenPt = eventToScreen(e);
    showContextMenu(screenPt, hitTestCanvasItem(canvasPt, screenPt));
  }

  function drawPendingBuildingRect() {
    if (!pendingBuildingRect) return;
    const x = Math.min(pendingBuildingRect.start.x, pendingBuildingRect.current.x);
    const y = Math.min(pendingBuildingRect.start.y, pendingBuildingRect.current.y);
    const width = Math.abs(pendingBuildingRect.current.x - pendingBuildingRect.start.x);
    const height = Math.abs(pendingBuildingRect.current.y - pendingBuildingRect.start.y);
    if (width < 2 || height < 2) return;
    ctx.save();
    ctx.fillStyle = "rgba(30,64,175,0.14)";
    ctx.strokeStyle = "rgba(30,64,175,0.9)";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3 / zoom);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function isTypingTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return (
      el.isContentEditable ||
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT"
    );
  }

  function zoomAtScreenPoint(screen: Point, factor: number) {
    const newZoom = Math.max(
      MIN_CANVAS_ZOOM,
      Math.min(MAX_CANVAS_ZOOM, zoom * factor),
    );
    pan = {
      x: screen.x - (screen.x - pan.x) * (newZoom / zoom),
      y: screen.y - (screen.y - pan.y) * (newZoom / zoom),
    };
    zoom = newZoom;
    scheduleRedraw();
  }

  function canvasCenterScreenPoint(): Point {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (cssCanvasWidth || rect.width || canvas.width || 800) / 2,
      y: (cssCanvasHeight || rect.height || canvas.height || 420) / 2,
    };
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return;
    if (editingLabel) return;
    if (e.key === 'Shift') { shiftDown = true; scheduleRedraw(); }
    if ((e.key === "Delete" || e.key === "Backspace") && selectedItem) {
      e.preventDefault();
      deleteSelectedItem();
      return;
    }
    if (e.key === " " && !e.repeat) {
      e.preventDefault();
      spacePanPreviousTool = tool;
      setTool("move");
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "d") {
        e.preventDefault();
        setTool("draw");
        return;
      }
      if (key === "e") {
        e.preventDefault();
        setTool("move");
        return;
      }
      if (key === "g") {
        e.preventDefault();
        setTool("gate");
        return;
      }
      if (key === "b") {
        e.preventDefault();
        setTool("boundary");
        return;
      }
      if (key === "u") {
        e.preventDefault();
        setTool("building");
        return;
      }
      if (key === "p") {
        e.preventDefault();
        setTool("post");
        return;
      }
      if (key === "i") {
        e.preventDefault();
        setTool("pillar");
        return;
      }
      if (key === "t") {
        e.preventDefault();
        setTool("text");
        return;
      }
      if (key === "f") {
        e.preventDefault();
        setTool("freehand");
        return;
      }
      if (key === "a") {
        e.preventDefault();
        setTool("arrow");
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomAtScreenPoint(canvasCenterScreenPoint(), 1.2);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomAtScreenPoint(canvasCenterScreenPoint(), 1 / 1.2);
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        fitToContent();
        return;
      }
    }
    if (e.key === "Enter" && tool === "draw") {
      if (activeRunIdx >= 0 && !runs[activeRunIdx]?.finished) {
        stopChain(false); // keyboard — no extra mousedown point to pop
        scheduleRedraw();
      }
    }
    if (e.key === "Escape" && tool === "draw") {
      if (activeRunIdx >= 0 && !runs[activeRunIdx]?.finished) {
        stopChain(false); // keyboard — no extra mousedown point to pop
        scheduleRedraw();
      }
    }
    if (e.key === "Escape" && tool === "arrow") {
      pendingArrow = null;
      setTool("move");
      scheduleRedraw();
      return;
    }
    if (
      ((e.key === "y" || e.key === "Y") && (e.ctrlKey || e.metaKey)) ||
      ((e.key === "z" || e.key === "Z") && e.shiftKey && (e.ctrlKey || e.metaKey))
    ) {
      e.preventDefault();
      redoLast();
      return;
    }
    if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undoLast();
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return;
    if (e.key === 'Shift') { shiftDown = false; scheduleRedraw(); }
    if (e.key === " " && spacePanPreviousTool) {
      setTool(spacePanPreviousTool);
      spacePanPreviousTool = null;
    }
  }

  function onResize() {
    const previousWidth = cssCanvasWidth;
    resizeCanvas();
    const hasDrawnRuns = runs.some((run) => !run.isBoundary && run.points.length > 1);
    if (!hasDrawnRuns && previousWidth <= 4 && cssCanvasWidth > 4) {
      fitToWidth(50);
      return;
    }
    scheduleRedraw();
  }

  // ── Label editing ──────────────────────────────────────────────────────────

  function startLabelEdit(flatIdx: number, screenPos: Point) {
    const allSegs = allSegmentsFlat();
    const info = allSegs[flatIdx];
    if (!info) return;
    editingLabel = true;

    const current =
      info.seg.lengthMM >= 1000
        ? `${(info.seg.lengthMM / 1000).toFixed(2)}`
        : `${Math.round(info.seg.lengthMM)}`;

    createLabelInput(
      container,
      screenPos,
      current,
      (val) => {
        editingLabel = false;
        const num = parseFloat(val.replace(",", "."));
        if (!isNaN(num) && num > 0) {
          // Determine unit: if the number looks like metres (≤ 30), convert to mm
          setSegmentLength(flatIdx, num < 30 ? num * 1000 : num);
        }
        scheduleRedraw();
      },
      () => {
        editingLabel = false;
        scheduleRedraw();
      },
    );
  }

  // ── Undo ───────────────────────────────────────────────────────────────────

  function undoLast() {
    if (undoStack.length === 0) return;
    clearSegmentPreview();
    const action = undoStack.pop()!;
    redoStack.push({ action, snapshot: snapshot() });
    if (redoStack.length > HISTORY_STACK_LIMIT) {
      redoStack.shift();
    }

    switch (action.type) {
      case "ADD_RUN": {
        runs.pop();
        activeRunIdx = -1;
        break;
      }
      case "ADD_POINT": {
        const run = runs[action.runIdx];
        if (run && run.points.length > 1) {
          run.points.pop();
          rebuildSegmentsPreservingGates(run, scale);
        } else if (run) {
          runs.splice(action.runIdx, 1);
          if (undoStack[undoStack.length - 1]?.type === "ADD_RUN") {
            undoStack.pop();
            notifyHistoryChange();
          }
          activeRunIdx = -1;
        }
        if (run) rebuildSegmentsPreservingGates(run, scale);
        break;
      }
      case "CHAIN_POINT": {
        // Remove the newly-started chain run
        runs.splice(action.newRunIdx, 1);
        // Un-finish the previous run and remove its last (chained) point
        const prevRun = runs[action.prevRunIdx];
        if (prevRun) {
          prevRun.finished = false;
          if (prevRun.points.length > 1) {
            prevRun.points.pop();
            rebuildSegmentsPreservingGates(prevRun, scale);
          }
        }
        activeRunIdx = action.prevRunIdx;
        break;
      }
      case "FINISH_RUN": {
        const run = runs[action.runIdx];
        if (run) {
          run.finished = false;
          activeRunIdx = action.runIdx;
        }
        break;
      }
      case "RESUME_RUN": {
        // Undo a resume — re-finish the run and clear active draw state
        const run = runs[action.runIdx];
        if (run) {
          run.finished = true;
          activeRunIdx = -1;
        }
        break;
      }
      case "ADD_GATE": {
        const allSegs = allSegmentsFlat();
        const info = allSegs[action.segIdx];
        if (info) {
          info.seg.gates.splice(action.gateIdx, 1);
        }
        break;
      }
      case "CLEAR": {
        runs = action.runs;
        scale = action.scale;
        activeRunIdx = -1;
        break;
      }
      case "SNAPSHOT": {
        restoreSnapshot(action.snapshot);
        break;
      }
    }

    notifyChange();
    notifyHistoryChange();
    scheduleRedraw();
  }

  function redoLast() {
    const entry = redoStack.pop();
    if (!entry) return;
    clearSegmentPreview();
    restoreSnapshot(entry.snapshot);
    undoStack.push(entry.action);
    if (undoStack.length > HISTORY_STACK_LIMIT) {
      undoStack.shift();
    }
    notifyChange();
    notifyHistoryChange();
    scheduleRedraw();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function setTool(t: Tool) {
    clearSegmentPreview();
    tool = t;
    updateCanvasTouchAction();
    if (t !== "text") pendingTextNote = null;
    if (t !== "building") pendingBuildingRect = null;
    if (t !== "freehand") pendingFreehandStroke = null;
    if (t !== "arrow") pendingArrow = null;
    if (t === "draw" || t === "boundary" || t === "building" || t === "text" || t === "post" || t === "pillar" || t === "freehand" || t === "arrow") {
      canvas.style.cursor = "crosshair";
    } else if (t === "move") {
      canvas.style.cursor = "grab";
    } else {
      canvas.style.cursor = "default";
    }
    if (t !== "draw" && t !== "boundary" && t !== "building") {
      // Finish any active drawing run
      if (activeRunIdx >= 0 && !runs[activeRunIdx]?.finished) {
        const run = runs[activeRunIdx];
        if (run.points.length >= 2) {
          run.finished = true;
          pushUndo({ type: "FINISH_RUN", runIdx: activeRunIdx });
          notifyChange();
        } else {
          runs.splice(activeRunIdx, 1);
        }
        activeRunIdx = -1;
      }
    }
    scheduleRedraw();
  }

  function undo() {
    undoLast();
  }

  function redo() {
    redoLast();
  }

  function clear() {
    pushSnapshotUndo();
    runs = [];
    textNotes = [];
    siteMarkers = [];
    freehandStrokes = [];
    arrows = [];
    pendingArrow = null;
    clearSegmentPreview();
    activeRunIdx = -1;
    canvasHintsDismissed = false;
    notifyChange();
    scheduleRedraw();
  }

  /** Set zoom so that `targetMetres` of real-world width fits the canvas. */
  function fitToWidth(targetMetres = 50) {
    const W = canvas.getBoundingClientRect().width || canvas.width || 800;
    zoom = W / (targetMetres * scale);
    pan = { x: 0, y: 0 };
    scheduleRedraw();
  }

  /** Zoom and pan so all drawn runs fill the canvas with padding. */
  function fitToContent() {
    const allPts = runs.flatMap((r) => r.points);
    if (allPts.length === 0) {
      resetView();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of allPts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const W = canvas.getBoundingClientRect().width || canvas.width || 800;
    const H = canvas.getBoundingClientRect().height || canvas.height || 420;
    const pad = 80; // px
    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;
    zoom = Math.min((W - pad * 2) / contentW, (H - pad * 2) / contentH, 8);
    pan = {
      x: W / 2 - zoom * (minX + contentW / 2),
      y: H / 2 - zoom * (minY + contentH / 2),
    };
    scheduleRedraw();
  }

  function resetView() {
    if (defaultViewportTransform) {
      setViewportTransform(defaultViewportTransform);
      return;
    }
    fitToWidth(50);
  }

  function zoomIn() {
    zoomAtScreenPoint(canvasCenterScreenPoint(), 1.2);
  }

  function zoomOut() {
    zoomAtScreenPoint(canvasCenterScreenPoint(), 1 / 1.2);
  }

  function setSnapToGrid(s: boolean) {
    snap = s;
    scheduleRedraw();
  }

  function setOrthoMode(enabled: boolean) {
    orthoMode = enabled;
    scheduleRedraw();
  }

  function setFreehandStyle(style: Partial<CanvasFreehandStroke>) {
    currentFreehandStyle = {
      ...currentFreehandStyle,
      color: style.color ?? currentFreehandStyle.color,
      width: Math.max(1, Number(style.width ?? currentFreehandStyle.width)),
      lineStyle: style.lineStyle ?? currentFreehandStyle.lineStyle,
      opacity: Math.max(0.1, Math.min(1, Number(style.opacity ?? currentFreehandStyle.opacity))),
      arrow: Boolean(style.arrow ?? currentFreehandStyle.arrow),
    };
    scheduleRedraw();
  }

  function setGateSnapTo100mm(enabled: boolean) {
    gateSnap100 = enabled;
    scheduleRedraw();
  }

  function setAllowedAngles(angles: number[]) {
    allowedAngles = angles;
    scheduleRedraw();
  }

  function setShowGrid(s: boolean) {
    showGrid = s;
    scheduleRedraw();
  }

  function setScale(pxPerMetre: number) {
    scale = pxPerMetre;
    // Recalculate all segment lengths
    for (const run of runs) {
      rebuildSegmentsPreservingGates(run, scale);
    }
    const nonBoundaryRuns = runs.filter((run) => !run.isBoundary);
    if (nonBoundaryRuns.length > 0) {
      notifyChange();
    }
    scheduleRedraw();
  }

  function setViewportTransform(next: {
    pan: Point;
    zoom: number;
    scale?: number;
  }) {
    const nextScale = next.scale;
    if (
      typeof nextScale === "number" &&
      Number.isFinite(nextScale) &&
      Math.abs(nextScale - scale) > 1e-6
    ) {
      scale = nextScale;
      for (const run of runs) {
        rebuildSegmentsPreservingGates(run, scale);
      }
      const nonBoundaryRuns = runs.filter((run) => !run.isBoundary);
      if (nonBoundaryRuns.length > 0) {
        notifyChange();
      }
    }
    pan = { ...next.pan };
    zoom = Math.max(0.000001, next.zoom);
    defaultViewportTransform = {
      pan: { ...pan },
      zoom,
      ...(typeof nextScale === "number" && Number.isFinite(nextScale)
        ? { scale: nextScale }
        : {}),
    };
    scheduleRedraw();
  }

  function getViewportTransform() {
    return {
      pan: { ...pan },
      zoom,
      scale,
    };
  }

  /**
   * Load a Google Static Maps tile and register its geo-scale so the image is
   * drawn at the correct real-world size inside the canvas coordinate system.
   *
   * @param imageUrl  Google Static Maps URL (already built with center/zoom/size)
   * @param opacity   0–1 overlay opacity
   * @param lat       Centre latitude of the tile (decimal degrees)
   * @param mapZoom   Google Maps zoom level used in the URL (e.g. 20)
   */
  function loadMapTile(
    imageUrl: string,
    opacity: number,
    lat: number,
    mapZoom: number,
  ) {
    loadMapTileLayers(
      imageUrl ? [{ imageUrl, opacity }] : [],
      lat,
      mapZoom,
    );
  }

  function loadMapTileLayers(
    layers: Array<{ imageUrl: string; opacity: number }>,
    lat: number,
    mapZoom: number,
  ) {
    const visibleLayers = layers.filter(
      (layer) => layer.imageUrl && layer.opacity > 0,
    );
    const loadVersion = ++mapLoadVersion;
    if (visibleLayers.length === 0) {
      mapLayers = [];
      mapWorldWidth = 0;
      scheduleRedraw();
      return;
    }

    // Ground resolution: metres per image pixel at this latitude and zoom level.
    // Formula from Google Maps documentation (Mercator projection).
    const metersPerPixel =
      (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, mapZoom);

    Promise.allSettled(
      visibleLayers.map(
        (layer) =>
          new Promise<{ image: HTMLImageElement; opacity: number }>(
            (resolve, reject) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () =>
                resolve({ image: img, opacity: layer.opacity });
              img.onerror = () => reject(new Error("Map layer failed to load"));
              img.src = layer.imageUrl;
            },
          ),
      ),
    )
      .then((results) => {
        if (loadVersion !== mapLoadVersion) return;
        const loadedLayers = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        if (loadedLayers.length === 0) {
          mapLayers = [];
          mapWorldWidth = 0;
          scheduleRedraw();
          return;
        }
        mapLayers = loadedLayers;
        const firstImage = loadedLayers[0].image;
        mapWorldWidth = firstImage.width * metersPerPixel * scale;
        mapWorldHeight = firstImage.height * metersPerPixel * scale;
        const cw = cssCanvasWidth || canvas.getBoundingClientRect().width || 800;
        const ch = cssCanvasHeight || canvas.getBoundingClientRect().height || 400;
        mapWorldOriginX = (cw / 2 - pan.x) / zoom;
        mapWorldOriginY = (ch / 2 - pan.y) / zoom;
        scheduleRedraw();
      })
      .catch(() => {
        if (loadVersion !== mapLoadVersion) return;
        mapLayers = [];
        mapWorldWidth = 0;
        scheduleRedraw();
      });
  }

  function setMapOpacity(opacity: number) {
    mapLayers = mapLayers.map((layer) => ({ ...layer, opacity }));
    scheduleRedraw();
  }

  function updateGateWidth(segIdx: number, gateIdx: number, widthMM: number) {
    const allSegs = allSegmentsFlat();
    const info = allSegs[segIdx];
    if (info && info.seg.gates[gateIdx] !== undefined) {
      info.seg.gates[gateIdx].widthMM = widthMM;
      info.seg.gates[gateIdx].anchor = gateAnchorForPlacement(
        info.seg,
        info.seg.gates[gateIdx].t,
        widthMM,
      );
      notifyChange();
      scheduleRedraw();
    }
  }

  /** Associate a GateConfig id with a canvas gate marker so it can be found for editing. */
  function setGateId(flatSegIdx: number, gateIdx: number, id: string) {
    const allSegs = allSegmentsFlat();
    const info = allSegs[flatSegIdx];
    if (info && info.seg.gates[gateIdx] !== undefined) {
      info.seg.gates[gateIdx].gateId = id;
    }
  }

  function setGateVariables(gateId: string, variables: CanvasGateVariables) {
    if (!gateId) return;
    let changed = false;
    for (const run of runs) {
      if (run.isBoundary) continue;
      for (const seg of run.segments) {
        for (const gate of seg.gates) {
          if (gate.gateId !== gateId) continue;
          gate.variables = { ...variables };
          changed = true;
        }
      }
    }
    if (!changed) return;
    notifyChange();
    scheduleRedraw();
  }

  function removeGatesById(ids: string[]) {
    const idSet = new Set(ids.filter(Boolean));
    if (idSet.size === 0) return;
    let changed = false;
    for (const run of runs) {
      if (run.isBoundary) continue;
      for (const seg of run.segments) {
        const before = seg.gates.length;
        seg.gates = seg.gates.filter((gate) => !gate.gateId || !idSet.has(gate.gateId));
        changed = changed || seg.gates.length !== before;
      }
    }
    if (!changed) return;
    notifyChange();
    scheduleRedraw();
  }

  function setGateTerminationPosts(
    flatSegIdx: number,
    gateIdx: number,
    useTerminationPosts: boolean,
  ) {
    const allSegs = allSegmentsFlat();
    const info = allSegs[flatSegIdx];
    if (info && info.seg.gates[gateIdx] !== undefined) {
      info.seg.gates[gateIdx].useGatePostsAsFenceTermination =
        useTerminationPosts;
      notifyChange();
      scheduleRedraw();
    }
  }

  /**
   * Set post positions to overlay on the canvas after BOM generation.
   * Positions are in canvas world coordinates — the same space as drawn nodes
   * (i.e. canvas pixels relative to the origin, before the pan/zoom transform).
   * Pass null to clear.
   */
  function setPostPositions(
    positions: Array<{ x: number; y: number; label?: string }> | null,
  ) {
    postPositions = positions;
    scheduleRedraw();
  }

  /** Set per-segment max panel widths (flat array, index matches allSegmentsFlat order). */
  function setSegmentPanelWidths(widths: number[]) {
    segmentPanelWidths = widths;
    scheduleRedraw();
  }

  /** Set the job-level default panel width for the in-progress preview segment. */
  function setJobPanelWidth(mm: number | null) {
    jobPanelWidthMm = mm;
    scheduleRedraw();
  }

  function setRunStatsTexts(_global: string, _perRun: string[]) {
    // Run stats live in React cards now; the canvas hover stats overlay is suppressed.
  }

  function updateGateVisual(
    segIdx: number,
    gateIdx: number,
    visual: Partial<CanvasGateVisual>,
  ) {
    const allSegs = allSegmentsFlat();
    const info = allSegs[segIdx];
    const gate = info?.seg.gates[gateIdx];
    if (!gate) return;
    gate.gateType = visual.gateType ?? gate.gateType;
    gate.swingDirection = visual.swingDirection ?? gate.swingDirection;
    gate.slidingSide = visual.slidingSide ?? gate.slidingSide ?? "front";
    gate.variables = visual.variables ?? gate.variables;
    if (gate.gateId) {
      gateVisuals = {
        ...gateVisuals,
        [gate.gateId]: {
          gateType: gate.gateType ?? "single-swing",
          swingDirection: gate.swingDirection,
          slidingSide: gate.slidingSide,
          leafWidthsMM: visual.leafWidthsMM,
          variables: gate.variables,
        },
      };
    }
    notifyChange();
    scheduleRedraw();
  }

  function setGateVisuals(visuals: Record<string, CanvasGateVisual>) {
    gateVisuals = visuals;
    scheduleRedraw();
  }

  function setPendingGatePlacement(config: Partial<CanvasGateVisual & { widthMM: number }>) {
    pendingGatePlacement = {
      ...pendingGatePlacement,
      ...config,
      widthMM: Math.max(100, Number(config.widthMM ?? pendingGatePlacement.widthMM)),
    };
    scheduleRedraw();
  }

  function hasSatelliteUnderlay() {
    return mapLayers.length > 0;
  }

  function contentBounds() {
    const points: Point[] = [];
    for (const run of runs) points.push(...run.points);
    for (const note of textNotes) {
      points.push({ x: note.x, y: note.y });
      points.push({ x: note.x + (note.width ?? 160 / zoom), y: note.y + (note.height ?? 40 / zoom) });
    }
    for (const marker of siteMarkers) {
      const halfW = marker.widthMM ? ((marker.widthMM / 1000) * scale) / 2 : 16 / zoom;
      const halfH = marker.depthMM ? ((marker.depthMM / 1000) * scale) / 2 : 16 / zoom;
      points.push({ x: marker.x - halfW, y: marker.y - halfH });
      points.push({ x: marker.x + halfW, y: marker.y + halfH });
    }
    for (const stroke of freehandStrokes) points.push(...stroke.points);
    for (const arrow of arrows) {
      points.push(arrow.from, arrow.to);
    }
    if (points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }

  async function printMap(options: CanvasPrintMapOptions = {}) {
    return printMapOutput(options);
    const originalMapLayers = mapLayers;
    const originalZoom = zoom;
    const originalPan = { ...pan };
    const bounds = contentBounds();
    if (bounds) {
      const W = canvas.getBoundingClientRect().width || canvas.width || 1000;
      const H = canvas.getBoundingClientRect().height || canvas.height || 700;
      const viewport = computePrintViewport(bounds!, W, H);
      zoom = viewport.zoom;
      pan = viewport.pan;
    }
    if (!options.includeSatellite) mapLayers = [];
    draw();
    const dataUrl = canvas.toDataURL("image/png");
    const layout = getLayout();
    const totalGates = layout.runs.reduce((sum, run) => sum + run.gates.length, 0);
    const printedAt = new Date().toLocaleDateString("en-AU");
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char);
    const jobName = escapeHtml(options.jobName?.trim() || "Untitled Glass Outlet job");
    const summaryHtml = layout.runs
      .map((run) => {
        const gatePart = run.gates.length ? ` · ${run.gates.length} gate${run.gates.length === 1 ? "" : "s"}` : "";
        const sectionRows = (run.sections ?? [])
          .map((section) => {
            const sectionGatePart = section.gateCount
              ? `${section.gateCount} gate${section.gateCount === 1 ? "" : "s"}`
              : "—";
            return `<li>${section.label} · ${section.lengthM.toFixed(2)}m · ${section.panelCount} panel${section.panelCount === 1 ? "" : "s"} · ${sectionGatePart}</li>`;
          })
          .join("");
        return `<div class="run-summary"><strong>${run.label} · ${run.totalLengthM.toFixed(2)}m${gatePart}</strong><ul>${sectionRows}</ul></div>`;
      })
      .join("");
    mapLayers = originalMapLayers;
    zoom = originalZoom;
    pan = originalPan;
    draw();

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow!.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Fence Layout Map</title>
          <style>
            body { margin: 0; padding: 18px; font-family: Arial, sans-serif; color: #111827; }
            h1 { margin: 0 0 4px; font-size: 20px; color: #0f2f6f; }
            p { margin: 0 0 12px; font-size: 12px; color: #4b5563; }
            img { width: 100%; height: auto; border: 1px solid #d1d5db; }
            .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 12px 0; }
            .summary div { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; font-size: 11px; }
            .summary strong { display: block; font-size: 13px; color: #111827; }
            .run-summary { margin-top: 10px; font-size: 12px; }
            ul { margin: 4px 0 0 18px; padding: 0; color: #374151; }
            li { margin: 2px 0; }
            @media print {
              @page { margin: 10mm; }
              body { padding: 0; }
              img { break-inside: avoid; page-break-inside: avoid; }
              .run-summary { break-inside: avoid; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Fence Layout Map</h1>
          <p>Installer guide showing section lengths, gate openings, run measurements, notes, and drawn context lines.</p>
          <div class="summary">
            <div><span>Job</span><strong>${jobName}</strong></div>
            <div><span>Total</span><strong>${layout.totalLengthM.toFixed(2)}m</strong></div>
            <div><span>Runs</span><strong>${layout.runs.length}</strong></div>
            <div><span>Gates</span><strong>${totalGates}</strong></div>
            <div><span>Date</span><strong>${printedAt}</strong></div>
          </div>
          <img src="${dataUrl}" alt="Fence layout map" />
          ${summaryHtml}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWindow!.document.close();
  }

  async function printMapOutput(options: CanvasPrintMapOptions = {}) {
    const originalMapLayers = mapLayers;
    const originalZoom = zoom;
    const originalPan = { ...pan };
    const bounds = contentBounds();
    if (bounds) {
      const W = canvas.getBoundingClientRect().width || canvas.width || 1000;
      const H = canvas.getBoundingClientRect().height || canvas.height || 700;
      const viewport = computePrintViewport(bounds, W, H);
      zoom = viewport.zoom;
      pan = viewport.pan;
    }
    if (!options.includeSatellite) mapLayers = [];
    draw();
    const dataUrl = canvas.toDataURL("image/png");
    const layout = getLayout();
    const printedAt = new Date().toLocaleDateString("en-AU");
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char);
    const jobName = escapeHtml(options.jobName?.trim() || "Untitled Glass Outlet job");
    const propertyAddress = escapeHtml(options.propertyAddress?.trim() || "Not supplied");
    const printRuns: CanvasPrintRunSummary[] = options.runs?.length
      ? options.runs
      : layout.runs.map((run) => ({
          label: run.label,
          totalLengthM: run.totalLengthM,
          gateCount: run.gates.length,
          sections: run.sections,
        }));
    const totalGates = printRuns.reduce((sum, run) => sum + (run.gateCount ?? 0), 0);
    const totalPosts = printRuns.reduce((sum, run) => sum + (run.postCount ?? 0), 0);
    const summaryHtml = printRuns
      .map((run) => {
        const meta = [
          run.systemType ? `System: ${escapeHtml(run.systemType)}` : null,
          run.colour ? `Colour: ${escapeHtml(run.colour)}` : null,
          `Total: ${(run.totalLengthM ?? 0).toFixed(2)}m`,
          typeof run.postCount === "number" ? `Posts: ${run.postCount}` : null,
          `Gates: ${run.gateCount ?? 0}`,
        ].filter(Boolean);
        const sectionRows = (run.sections ?? [])
          .map((section) => {
            const sectionGatePart = section.gateCount
              ? `${section.gateCount} gate${section.gateCount === 1 ? "" : "s"}`
              : "none";
            const heightPart = section.heightMm ? ` - ${section.heightMm}mm high` : "";
            const panelPart =
              typeof section.panelCount === "number"
                ? ` - ${section.panelCount} panel${section.panelCount === 1 ? "" : "s"}`
                : "";
            return `<li>${escapeHtml(section.label)} - ${section.lengthM.toFixed(2)}m${heightPart}${panelPart} - ${sectionGatePart}</li>`;
          })
          .join("");
        return `<section class="run-summary"><h2>${escapeHtml(run.label)}</h2><div class="run-meta">${meta.map((item) => `<span>${item}</span>`).join("")}</div>${sectionRows ? `<ul>${sectionRows}</ul>` : ""}</section>`;
      })
      .join("");
    mapLayers = originalMapLayers;
    zoom = originalZoom;
    pan = originalPan;
    draw();

    const shareTitle = options.jobName?.trim() || "Fence layout map";
    const shareText = `Fence layout map${options.propertyAddress ? ` for ${options.propertyAddress}` : ""}`;
    const canTryShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (canTryShare) {
      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], "fence-layout-map.png", { type: "image/png" });
        const shareData: ShareData = { title: shareTitle, text: shareText, files: [file] };
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
        await navigator.share({ title: shareTitle, text: shareText });
        return;
      } catch {
        // Fall through to printable HTML when native sharing is unavailable.
      }
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow!.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Fence Layout Map</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 18px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
            h1 { margin: 0; font-size: 22px; color: #0f2f6f; }
            p { margin: 4px 0 0; font-size: 12px; color: #4b5563; }
            img { width: 100%; height: auto; border: 1px solid #cbd5e1; border-radius: 8px; display: block; }
            .header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 12px; }
            .header-meta { text-align: right; font-size: 12px; color: #4b5563; }
            .summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 12px 0; }
            .summary div { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; font-size: 10px; background: #f8fafc; }
            .summary span { color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
            .summary strong { display: block; margin-top: 3px; font-size: 13px; color: #111827; }
            .run-summary { margin-top: 10px; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; break-inside: avoid; page-break-inside: avoid; }
            .run-summary h2 { margin: 0 0 6px; font-size: 14px; color: #111827; }
            .run-meta { display: flex; flex-wrap: wrap; gap: 6px; }
            .run-meta span { border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 7px; font-size: 11px; background: #f9fafb; }
            ul { margin: 8px 0 0 18px; padding: 0; color: #374151; font-size: 11px; }
            li { margin: 3px 0; }
            @media print {
              @page { size: A4 landscape; margin: 10mm; }
              body { padding: 0; }
              img { break-inside: avoid; page-break-inside: avoid; }
              .run-summary { break-inside: avoid; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <header class="header">
            <div>
              <h1>${jobName}</h1>
              <p>Fence layout map for customer review and installation reference.</p>
            </div>
            <div class="header-meta">
              <div><strong>Date:</strong> ${printedAt}</div>
              <div><strong>Address:</strong> ${propertyAddress}</div>
            </div>
          </header>
          <div class="summary">
            <div><span>Job</span><strong>${jobName}</strong></div>
            <div><span>Address</span><strong>${propertyAddress}</strong></div>
            <div><span>Total</span><strong>${layout.totalLengthM.toFixed(2)}m</strong></div>
            <div><span>Runs</span><strong>${layout.runs.length}</strong></div>
            <div><span>Gates</span><strong>${totalGates}</strong></div>
            <div><span>Posts</span><strong>${totalPosts || "See runs"}</strong></div>
          </div>
          <img src="${dataUrl}" alt="Fence layout map" />
          ${summaryHtml}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWindow!.document.close();
  }

  function setHighlightedMapLabel(label: string | null) {
    highlightedMapLabel = label;
    scheduleRedraw();
  }

  /**
   * Replace the current canvas state with the runs described by `layout`.
   * Used for form-driven geometry changes (bidirectional sync).
   * Boundary runs in `layout.boundaries` are also restored.
   */
  function loadLayout(layout: CanvasLayout) {
    clearSegmentPreview();
    const shouldPreserveViewport = layoutMatchesCurrentGeometry(layout);
    const newRuns: Run[] = [];
    const preservedBoundaries: CanvasSegment[] = [];
    for (const run of runs) {
      if (!run.isBoundary) continue;
      for (const seg of run.segments) {
        preservedBoundaries.push({
          startX: seg.p1.x,
          startY: seg.p1.y,
          endX: seg.p2.x,
          endY: seg.p2.y,
          lengthMM: seg.lengthMM,
          angleDeg: angleDeg(seg.p1, seg.p2),
          contextType: run.boundaryType ?? "boundary",
        });
      }
    }
    const nextBoundaries =
      layout.boundaries && layout.boundaries.length > 0
        ? layout.boundaries
        : preservedBoundaries;
    const nextTextNotes =
      layout.textNotes && layout.textNotes.length > 0 ? layout.textNotes : textNotes;
    const nextSiteMarkers =
      layout.siteMarkers && layout.siteMarkers.length > 0 ? layout.siteMarkers : siteMarkers;
    const nextFreehandStrokes =
      layout.freehandStrokes && layout.freehandStrokes.length > 0
        ? layout.freehandStrokes
        : freehandStrokes;
    const nextArrows =
      layout.arrows && layout.arrows.length > 0 ? layout.arrows : arrows;

    // Group flat segments into runs using totalLengthM as slice boundaries
    let segIdx = 0;
    for (const runSummary of layout.runs) {
      const targetLengthMm = runSummary.totalLengthM * 1000;
      let cumLength = 0;
      const runSegs: CanvasSegment[] = [];
      while (segIdx < layout.segments.length) {
        const cseg = layout.segments[segIdx];
        runSegs.push(cseg);
        cumLength += cseg.lengthMM;
        segIdx++;
        if (Math.abs(cumLength - targetLengthMm) < 1) break;
      }
      if (runSegs.length === 0) continue;

      const points: Point[] = [
        { x: runSegs[0].startX, y: runSegs[0].startY },
      ];
      const segments: Segment[] = runSegs.map((cseg) => {
        const p1 = { x: cseg.startX, y: cseg.startY };
        const p2 = { x: cseg.endX, y: cseg.endY };
        points.push({ ...p2 });
        return { p1, p2, lengthMM: cseg.lengthMM, gates: [] };
      });
      // Remove duplicated intermediate points (each segment pushed its p2)
      // points is [run start, seg0.end, seg1.end, ...] which is correct as-is
      newRuns.push({ points, segments, finished: true });
    }

    // Restore boundary runs
    for (const cseg of nextBoundaries) {
      const p1 = { x: cseg.startX, y: cseg.startY };
      const p2 = { x: cseg.endX, y: cseg.endY };
      newRuns.push({
        points: [p1, p2],
        segments: [{ p1, p2, lengthMM: cseg.lengthMM, gates: [] }],
        finished: true,
        isBoundary: true,
        boundaryType: cseg.contextType ?? "boundary",
      });
    }

    // Re-attach gates by flat segment index (non-boundary runs only)
    let flatIdx = 0;
    for (const run of newRuns) {
      if (run.isBoundary) continue;
      for (const seg of run.segments) {
        const segsGates = layout.gates.filter(
          (g) => g.segmentIndex === flatIdx,
        );
        seg.gates = segsGates.map((g) => ({
          t: g.positionOnSegment,
          anchor: g.anchor,
          widthMM: g.widthMM,
          gateId: g.gateId,
          useGatePostsAsFenceTermination:
            g.useGatePostsAsFenceTermination ?? true,
          gateType: g.gateType,
          swingDirection: g.swingDirection,
          slidingSide: g.slidingSide,
          variables: g.variables,
        }));
        flatIdx++;
      }
    }

    runs = newRuns;
    textNotes = [...nextTextNotes];
    siteMarkers = [...nextSiteMarkers];
    freehandStrokes = [...nextFreehandStrokes];
    arrows = [...nextArrows];
    pendingArrow = null;
    activeRunIdx = -1;
    canvasHintsDismissed =
      newRuns.some(
      (run) => !run.isBoundary && run.points.length > 0,
      ) ||
      textNotes.length > 0 ||
      siteMarkers.length > 0 ||
      freehandStrokes.length > 0 ||
      arrows.length > 0;
    undoStack = [];
    redoStack = [];
    notifyHistoryChange();
    // Do NOT call notifyChange() here — this is a form→canvas push.
    // The caller already has the latest data in context; firing onLayoutChange
    // would trigger handleLiveSync which dispatches SET_PAYLOAD with fresh IDs,
    // causing all RunCard components to remount and lose their expanded state.
    if (shouldPreserveViewport) {
      scheduleRedraw();
    } else {
      fitToContent();
    }
  }

  function layoutMatchesCurrentGeometry(layout: CanvasLayout) {
    const current = getLayout();
    const sameNumber = (a: number, b: number, tolerance = 0.01) =>
      Math.abs(a - b) <= tolerance;

    if (
      current.segments.length !== layout.segments.length ||
      current.gates.length !== layout.gates.length ||
      current.runs.length !== layout.runs.length
    ) {
      return false;
    }

    for (let i = 0; i < current.segments.length; i++) {
      const a = current.segments[i];
      const b = layout.segments[i];
      if (
        !sameNumber(a.startX, b.startX) ||
        !sameNumber(a.startY, b.startY) ||
        !sameNumber(a.endX, b.endX) ||
        !sameNumber(a.endY, b.endY) ||
        !sameNumber(a.lengthMM, b.lengthMM, 0.1)
      ) {
        return false;
      }
    }

    for (let i = 0; i < current.gates.length; i++) {
      const a = current.gates[i];
      const b = layout.gates[i];
      if (
        a.segmentIndex !== b.segmentIndex ||
        !sameNumber(a.positionOnSegment, b.positionOnSegment) ||
        !sameNumber(a.widthMM, b.widthMM, 0.1)
      ) {
        return false;
      }
    }

    return true;
  }

  function destroy() {
    cancelAnimationFrame(animFrame);
    clearContextMenu();
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove", onTouchMove);
    canvas.removeEventListener("touchend", onTouchEnd);
    canvas.removeEventListener("touchcancel", onTouchCancel);
    canvas.removeEventListener("dblclick", onDblClick);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", onResize);
    // Remove any label input that might be open
    const inp = container.querySelector('input[type="text"]');
    if (inp) inp.parentNode?.removeChild(inp);
  }

  // ── Register events ────────────────────────────────────────────────────────

  updateCanvasTouchAction();
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchCancel, { passive: false });
  canvas.addEventListener("dblclick", onDblClick);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);

  // Initial draw — fit to 50m wide view
  fitToWidth(50);
  notifyHistoryChange();

  return {
    destroy,
    getLayout,
    setTool,
    undo,
    redo,
    clear,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    getHistoryState,
    resetView,
    getViewportTransform,
    zoomIn,
    zoomOut,
    setSnapToGrid,
    setOrthoMode,
    setGateSnapTo100mm,
    setFreehandStyle,
    setAllowedAngles,
    setShowGrid,
    setScale,
    setViewportTransform,
    setMapOpacity,
    loadMapTile,
    loadMapTileLayers,
    updateGateWidth,
    updateGateVisual,
    setGateId,
    setGateVariables,
    removeGatesById,
    setGateTerminationPosts,
    setPostPositions,
    setSegmentPanelWidths,
    setJobPanelWidth,
    setRunStatsTexts,
    setGateVisuals,
    setPendingGatePlacement,
    hasSatelliteUnderlay,
    printMap,
    setHighlightedMapLabel,
    loadLayout,
    fitToWidth,
    fitToContent,
    setUiHighlightFlatSeg: (_idx: number | null) => { /* no-op in V3 canvas */ },
  };
}
