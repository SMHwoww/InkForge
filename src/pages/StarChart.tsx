import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  Plus, Trash2, Save, Sparkles, ZoomIn, ZoomOut, RotateCcw,
  X, GitBranch, Compass,
} from 'lucide-react';
import type { StarMapNode, StarMapEdge, RelationType, CharacterListItem, WorldbuildingItem } from '@/types';
import { RelationTypeLabels, RelationTypeColors } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DraftNode {
  id: string;
  dbId: number | null;
  name: string;
  x: number;
  y: number;
  color: string;
  entityType: 'character' | 'worldbuilding' | 'custom';
  entityId: number | null;
  description: string;
}

interface DraftEdge {
  id: string;
  dbId: number | null;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  label: string;
  description: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STAR_COLORS = ['#c9a96e', '#e8a8c9', '#7dc9a9', '#7da8c9', '#c97da8', '#a9c97d', '#e87d7d', '#e8c97d', '#a8c9e8', '#c9a8e8'];

// Force-directed layout params
const FORCE = {
  REPULSION: 8000,
  ATTRACTION: 0.005,
  CENTER: 0.008,
  DAMPING: 0.85,
  MAX_VELOCITY: 15,
  IDEAL_LENGTH: 180,
} as const;

function generateId() { return 'temp_' + Math.random().toString(36).substring(2, 9); }

// ─── Starfield background ──────────────────────────────────────────────────

let starfieldCache: { x: number; y: number; r: number; a: number }[] | null = null;
function getStarfield(w: number, h: number) {
  if (!starfieldCache || starfieldCache.length === 0) {
    starfieldCache = Array.from({ length: 200 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.3 + Math.random() * 1.2,
      a: 0.2 + Math.random() * 0.6,
    }));
  }
  return starfieldCache;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function StarChart() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { characters, fetchCharacters, worldbuilding, fetchWorldbuilding } = useProjectStore();

  const [nodes, setNodes] = useState<DraftNode[]>([]);
  const [edges, setEdges] = useState<DraftEdge[]>([]);
  const [loading, setLoading] = useState(true);

  // Viewport
  const viewRef = useRef({ x: 0, y: 0, zoom: 1 });
  const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });

  // Interaction
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const draggingNodeRef = useRef<string | null>(null);
  useEffect(() => { draggingNodeRef.current = draggingNode; }, [draggingNode]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const panViewStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });

  // UI
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEdgeEdit, setShowEdgeEdit] = useState<DraftEdge | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [showNodeDetail, setShowNodeDetail] = useState<DraftNode | null>(null);
  const [connectionTarget, setConnectionTarget] = useState<string | null>(null);

  // Animation
  const [elapsed, setElapsed] = useState(0);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef(Date.now());
  const initialLoadDone = useRef(false);

  // Force simulation state (stored in refs to avoid re-render overhead)
  const velocities = useRef<Map<string, { vx: number; vy: number }>>(new Map());
  const positions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const simActive = useRef(true); // 始终开启

  // Auto-save
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────

  useEffect(() => { if (projectId) loadData(); }, [projectId]);

  async function loadData() {
    setLoading(true);
    initialLoadDone.current = false;
    try {
      const [data] = await Promise.all([
        api.getStarChart(projectId),
        fetchCharacters(projectId),
        fetchWorldbuilding(projectId),
      ]);
      const safeData = data || { nodes: [], edges: [] };
      const dbToDraft = new Map<number, string>();
      const loadedNodes: DraftNode[] = (safeData.nodes || []).map((n: StarMapNode) => {
        const draftId = generateId();
        dbToDraft.set(n.id, draftId);
        return { id: draftId, dbId: n.id, name: n.name, x: n.x, y: n.y, color: n.color, entityType: n.entityType, entityId: n.entityId, description: n.description };
      });
      const loadedEdges: DraftEdge[] = (safeData.edges || []).map((e: StarMapEdge) => ({
        id: generateId(), dbId: e.id, sourceId: dbToDraft.get(e.sourceNodeId) || '', targetId: dbToDraft.get(e.targetNodeId) || '', relationType: e.relationType, label: e.label, description: e.description,
      }));
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      syncPositions(loadedNodes);
    } catch (e) { console.error('Load star chart error:', e); }
    setLoading(false);
    setTimeout(() => { initialLoadDone.current = true; }, 500);
  }

  function syncPositions(nodeList: DraftNode[]) {
    const pm = new Map<string, { x: number; y: number }>();
    const vm = velocities.current;
    for (const n of nodeList) {
      pm.set(n.id, { x: n.x, y: n.y });
      if (!vm.has(n.id)) vm.set(n.id, { vx: 0, vy: 0 });
    }
    positions.current = pm;
  }

  // ── Force simulation ───────────────────────────────────────────────────

  const stepSimulation = useCallback(() => {
    const pos = positions.current;
    const vel = velocities.current;
    const nodeIds = Array.from(pos.keys());
    const n = nodeIds.length;
    if (n === 0) return;

    const f = FORCE;
    const k = f.IDEAL_LENGTH;

    // Compute forces
    const fx = new Map<string, number>();
    const fy = new Map<string, number>();
    for (const id of nodeIds) { fx.set(id, 0); fy.set(id, 0); }

    // Repulsion (Barnes-Hut approximation not needed for small N)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodeIds[i], b = nodeIds[j];
        const pa = pos.get(a)!, pb = pos.get(b)!;
        let dx = pa.x - pb.x, dy = pa.y - pb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = f.REPULSION / (dist * dist);
        const fxVal = (dx / dist) * force;
        const fyVal = (dy / dist) * force;
        fx.set(a, fx.get(a)! + fxVal);
        fy.set(a, fy.get(a)! + fyVal);
        fx.set(b, fx.get(b)! - fxVal);
        fy.set(b, fy.get(b)! - fyVal);
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const pa = pos.get(edge.sourceId), pb = pos.get(edge.targetId);
      if (!pa || !pb) continue;
      let dx = pb.x - pa.x, dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = f.ATTRACTION * (dist - k);
      const fxVal = (dx / dist) * force;
      const fyVal = (dy / dist) * force;
      fx.set(edge.sourceId, fx.get(edge.sourceId)! + fxVal);
      fy.set(edge.sourceId, fy.get(edge.sourceId)! + fyVal);
      fx.set(edge.targetId, fx.get(edge.targetId)! - fxVal);
      fy.set(edge.targetId, fy.get(edge.targetId)! - fyVal);
    }

    // Center gravity
    for (const id of nodeIds) {
      const p = pos.get(id)!;
      fx.set(id, fx.get(id)! - p.x * f.CENTER);
      fy.set(id, fy.get(id)! - p.y * f.CENTER);
    }

    // Apply velocities with damping
    for (const id of nodeIds) {
      const v = vel.get(id)!;
      v.vx = (v.vx + fx.get(id)!) * f.DAMPING;
      v.vy = (v.vy + fy.get(id)!) * f.DAMPING;
      // Clamp
      const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
      if (speed > f.MAX_VELOCITY) {
        v.vx = (v.vx / speed) * f.MAX_VELOCITY;
        v.vy = (v.vy / speed) * f.MAX_VELOCITY;
      }
      // 拖拽中的节点不累积速度
      if (id === draggingNodeRef.current) {
        v.vx = 0; v.vy = 0;
      }
    }

    // Update positions (always keep running, never stop)
    for (const id of nodeIds) {
      const p = pos.get(id)!, v = vel.get(id)!;
      const newX = p.x + v.vx, newY = p.y + v.vy;
      // Boundary clamp
      const bound = 800;
      pos.set(id, { x: Math.max(-bound, Math.min(bound, newX)), y: Math.max(-bound, Math.min(bound, newY)) });
    }
  }, [edges]);

  // ── Canvas drawing ─────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const { x: vx, y: vy, zoom } = viewRef.current;
    const cx = w / 2, cy = h / 2;

    // ── Deep space background ──
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
    bgGrad.addColorStop(0, '#0a0a18');
    bgGrad.addColorStop(0.6, '#060612');
    bgGrad.addColorStop(1, '#020208');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ── Starfield ──
    const stars = getStarfield(w, h);
    const twinkle = elapsed * 0.0005;
    for (const s of stars) {
      const sx = (s.x * w + vx * 0.1) % w;
      const sy = (s.y * h + vy * 0.1) % h;
      const alpha = s.a * (0.4 + 0.6 * Math.sin(twinkle + s.x * 10 + s.y * 7));
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(sx < 0 ? sx + w : sx, sy < 0 ? sy + h : sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Celestial grid ──
    const gridRings = [150, 300, 500, 750];
    ctx.strokeStyle = 'rgba(201, 169, 110, 0.06)';
    ctx.lineWidth = 0.5;
    for (const r of gridRings) {
      ctx.beginPath();
      ctx.arc(cx + vx, cy + vy, r * zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Radial lines (meridians)
    const meridianCount = 12;
    for (let i = 0; i < meridianCount; i++) {
      const angle = (i / meridianCount) * Math.PI * 2;
      const maxR = 800 * zoom;
      ctx.beginPath();
      ctx.moveTo(cx + vx, cy + vy);
      ctx.lineTo(cx + vx + Math.cos(angle) * maxR, cy + vy + Math.sin(angle) * maxR);
      ctx.stroke();
    }

    // ── Ecliptic circle (main boundary) ──
    const eclipticR = 600 * zoom;
    ctx.strokeStyle = 'rgba(201, 169, 110, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx + vx, cy + vy, eclipticR, 0, Math.PI * 2);
    ctx.stroke();

    // Direction markers
    const dirs = [
      { label: 'N', angle: -Math.PI / 2, offset: -20 },
      { label: 'S', angle: Math.PI / 2, offset: 20 },
      { label: 'E', angle: 0, offset: 20 },
      { label: 'W', angle: Math.PI, offset: -20 },
    ];
    ctx.fillStyle = 'rgba(201, 169, 110, 0.2)';
    ctx.font = `${11 * zoom}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const d of dirs) {
      const mx = cx + vx + Math.cos(d.angle) * (eclipticR + d.offset);
      const my = cy + vy + Math.sin(d.angle) * (eclipticR + d.offset);
      ctx.fillText(d.label, mx, my);
    }

    // ── Draw edges (constellation lines) ──
    for (const edge of edges) {
      const src = nodes.find(n => n.id === edge.sourceId);
      const tgt = nodes.find(n => n.id === edge.targetId);
      if (!src || !tgt) continue;

      const sp = positions.current.get(src.id) || { x: src.x, y: src.y };
      const tp = positions.current.get(tgt.id) || { x: tgt.x, y: tgt.y };
      const sx = sp.x * zoom + vx + cx;
      const sy = sp.y * zoom + vy + cy;
      const tx = tp.x * zoom + vx + cx;
      const ty = tp.y * zoom + vy + cy;

      const isSelected = selectedEdge === edge.id;
      const color = RelationTypeColors[edge.relationType] || '#8e8e9e';

      if (isSelected) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
      }

      ctx.strokeStyle = isSelected ? color : `${color}50`;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.setLineDash(edge.relationType === 'enemy' ? [4, 4] : [3, 3]);

      // Straight line for constellation style
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isSelected) ctx.restore();

      // Edge label
      {
        const midX = (sx + tx) / 2, midY = (sy + ty) / 2;
        if (edge.label) {
          ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.5)';
          ctx.font = `${Math.max(11, 13 * zoom)}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(edge.label, midX, midY - 6);
        }
        ctx.fillStyle = isSelected ? color : `${color}80`;
        ctx.font = `${Math.max(10, 12 * zoom)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = edge.label ? 'top' : 'middle';
        ctx.fillText(RelationTypeLabels[edge.relationType], midX, edge.label ? midY + 4 : midY);
      }
    }

    // ── Connection drag line ──
    if (connecting && mousePos.x && mousePos.y) {
      const src = nodes.find(n => n.id === connecting);
      if (src) {
        const sp = positions.current.get(src.id) || { x: src.x, y: src.y };
        const sx = sp.x * zoom + vx + cx;
        const sy = sp.y * zoom + vy + cy;
        ctx.strokeStyle = 'rgba(201, 169, 110, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── Draw nodes ──
    const edgeCount = new Map<string, number>();
    for (const e of edges) {
      edgeCount.set(e.sourceId, (edgeCount.get(e.sourceId) || 0) + 1);
      edgeCount.set(e.targetId, (edgeCount.get(e.targetId) || 0) + 1);
    }

    for (const node of nodes) {
      const p = positions.current.get(node.id) || { x: node.x, y: node.y };
      const nx = p.x * zoom + vx + cx;
      const ny = p.y * zoom + vy + cy;

      const connections = edgeCount.get(node.id) || 0;
      const magnitude = 0.7 + Math.min(connections * 0.2, 0.8);
      const baseRadius = 6 * zoom;
      const radius = baseRadius * (0.8 + magnitude * 0.6);

      const isSelected = selectedNode === node.id;
      const isDragging = draggingNode === node.id;
      const isConnectSource = connecting === node.id;
      const isConnectTarget = connectionTarget === node.id;

      // Blinking
      const phase = node.id.charCodeAt(0) + node.id.charCodeAt(node.id.length - 1);
      const blinkAlpha = 0.5 + 0.5 * Math.sin(elapsed * 0.002 + phase);
      const alpha = (isSelected || isDragging || isConnectSource) ? 1 : blinkAlpha;

      // Outer glow
      for (let i = 3; i >= 0; i--) {
        const glowR = radius * (2 + i * 1.5);
        const glowAlpha = alpha * (0.04 - i * 0.01);
        ctx.fillStyle = node.color + Math.round(glowAlpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(nx, ny, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Starlight cross (4-pointed star effect)
      const crossLen = radius * 3.5;
      const crossAlpha = alpha * 0.25;
      ctx.strokeStyle = node.color + Math.round(crossAlpha * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 0.5;
      for (const angle of [0, Math.PI / 2]) {
        ctx.beginPath();
        ctx.moveTo(nx - Math.cos(angle) * crossLen, ny - Math.sin(angle) * crossLen);
        ctx.lineTo(nx + Math.cos(angle) * crossLen, ny + Math.sin(angle) * crossLen);
        ctx.stroke();
      }
      // Diagonal cross (smaller)
      const crossLen2 = radius * 1.8;
      const crossAlpha2 = alpha * 0.15;
      ctx.strokeStyle = node.color + Math.round(crossAlpha2 * 255).toString(16).padStart(2, '0');
      for (const angle of [Math.PI / 4, 3 * Math.PI / 4]) {
        ctx.beginPath();
        ctx.moveTo(nx - Math.cos(angle) * crossLen2, ny - Math.sin(angle) * crossLen2);
        ctx.lineTo(nx + Math.cos(angle) * crossLen2, ny + Math.sin(angle) * crossLen2);
        ctx.stroke();
      }

      // Selection ring
      if (isSelected || isDragging || isConnectSource) {
        ctx.strokeStyle = isConnectSource ? '#c9a96e' : '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (isConnectTarget) {
        ctx.strokeStyle = '#c9a96e';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(nx, ny, radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Star core
      ctx.fillStyle = node.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(nx, ny, radius, 0, Math.PI * 2);
      ctx.fill();

      // Bright center
      ctx.fillStyle = `rgba(255,255,255,${0.7 * alpha})`;
      ctx.beginPath();
      ctx.arc(nx, ny, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Name label with connecting line
      const labelY = ny - radius - 14;
      const labelX = nx;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(nx, ny - radius - 2);
      ctx.lineTo(nx, labelY + 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(245, 240, 232, 0.8)';
      const nameFontSize = Math.max(9, 11 * zoom);
      ctx.font = `${nameFontSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(node.name, labelX, labelY);

      // Connect button
      if (isSelected && !connecting) {
        const btnX = nx + radius + 10;
        const btnY = ny;
        const btnR = Math.max(7, 8 * zoom);
        ctx.fillStyle = 'rgba(201, 169, 110, 0.85)';
        ctx.beginPath();
        ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(9, 10 * zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', btnX, btnY);
      }
    }

    // ── Empty state ──
    if (nodes.length === 0 && !loading) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('点击右上角「添加星辰」构建星图', cx, cy - 10);
      ctx.fillText('角色与世界观将以星辰形式呈现', cx, cy + 14);
    }
  }, [nodes, edges, viewState, selectedNode, selectedEdge, connecting, mousePos, draggingNode, connectionTarget, loading, elapsed]);

  // ── Animation loop (draw + simulation) ─────────────────────────────────

  useEffect(() => {
    const loop = () => {
      const now = Date.now();
      setElapsed(now - startTimeRef.current);

      // Step simulation always (dragged node position is set by mouse, not simulation)
      if (simActive.current) {
          stepSimulation();
        // Sync positions back to React state, but skip the dragged node
        const pos = positions.current;
        const newNodes = nodes.map(n => {
          if (n.id === draggingNode) return n; // 拖拽中的节点位置由鼠标控制
          const p = pos.get(n.id);
          if (p && (Math.abs(p.x - n.x) > 0.1 || Math.abs(p.y - n.y) > 0.1)) {
            return { ...n, x: p.x, y: p.y };
          }
          return n;
        });
        if (newNodes.some((n, i) => n.x !== nodes[i].x || n.y !== nodes[i].y)) {
          setNodes(newNodes);
        }
      }

      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, stepSimulation, draggingNode, nodes]);

  // ── Event handlers ─────────────────────────────────────────────────────

  const getCanvasPos = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const findNodeAt = useCallback((canvasX: number, canvasY: number) => {
    const { x, y, zoom } = viewRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    if (selectedNode) {
      const selNode = nodes.find(n => n.id === selectedNode);
      if (selNode) {
        const p = positions.current.get(selNode.id) || { x: selNode.x, y: selNode.y };
        const nx = p.x * zoom + x + rect.width / 2;
        const ny = p.y * zoom + y + rect.height / 2;
        const btnX = nx + (8 * zoom) + 10;
        const dx = canvasX - btnX;
        const dy = canvasY - ny;
        const btnRadius = Math.max(12, 14 * zoom);
        if (dx * dx + dy * dy <= btnRadius * btnRadius) {
          return { __connect: true, node: selNode };
        }
      }
    }

    for (const node of nodes) {
      const p = positions.current.get(node.id) || { x: node.x, y: node.y };
      const nx = p.x * zoom + x + rect.width / 2;
      const ny = p.y * zoom + y + rect.height / 2;
      const radius = 28 * zoom;
      const dx = canvasX - nx;
      const dy = canvasY - ny;
      if (dx * dx + dy * dy <= radius * radius) {
        return node;
      }
    }
    return null;
  }, [nodes, selectedNode]);

  const getScreenPos = useCallback((nodeX: number, nodeY: number) => {
    const { x, y, zoom } = viewRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: nodeX * zoom + x + rect.width / 2, y: nodeY * zoom + y + rect.height / 2 };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const hit = findNodeAt(pos.x, pos.y);

    if (hit && (hit as any).__connect) {
      setConnecting(selectedNode);
      setMousePos(pos);
      return;
    }

    if (hit && !connecting) {
      const node = hit as DraftNode;
      setDraggingNode(node.id);
      setSelectedNode(node.id);
      setSelectedEdge(null);
      dragOffset.current = {
        x: pos.x - getScreenPos(node.x, node.y).x,
        y: pos.y - getScreenPos(node.x, node.y).y,
      };
    } else if (connecting && hit) {
      const targetNode = hit as DraftNode;
      if (targetNode.id !== connecting) {
        const newEdge: DraftEdge = {
          id: generateId(), dbId: null, sourceId: connecting, targetId: targetNode.id,
          relationType: 'other', label: '', description: '',
        };
        setEdges(prev => [...prev, newEdge]);
        setShowEdgeEdit(newEdge);
      }
      setConnecting(null);
      setConnectionTarget(null);
    } else if (!hit && !connecting) {
      setPanning(true);
      setPanStart(pos);
      panViewStart.current = { x: viewRef.current.x, y: viewRef.current.y };
      setSelectedNode(null);
      setSelectedEdge(null);
    }
    e.preventDefault();
  }, [nodes, connecting, selectedNode, getCanvasPos, findNodeAt, getScreenPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    setMousePos(pos);

    if (draggingNode) {
      const { zoom } = viewRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x, y } = viewRef.current;
      const newX = (pos.x - dragOffset.current.x - x - rect.width / 2) / zoom;
      const newY = (pos.y - dragOffset.current.y - y - rect.height / 2) / zoom;
      positions.current.set(draggingNode, { x: newX, y: newY });
      setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: newX, y: newY } : n));
    }

    if (panning) {
      const dx = pos.x - panStart.x;
      const dy = pos.y - panStart.y;
      viewRef.current.x = panViewStart.current.x + dx;
      viewRef.current.y = panViewStart.current.y + dy;
      setViewState({ ...viewRef.current, zoom: viewRef.current.zoom });
    }

    if (connecting) {
      const hit = findNodeAt(pos.x, pos.y);
      const validTarget = hit && !(hit as any).__connect && (hit as DraftNode).id !== connecting;
      setConnectionTarget(validTarget ? (hit as DraftNode).id : null);
    }

    const hit = findNodeAt(pos.x, pos.y);
    const canvas = canvasRef.current;
    if (canvas) {
      if (hit && (hit as any).__connect) canvas.style.cursor = 'pointer';
      else if (connecting && hit && (hit as DraftNode).id !== connecting) canvas.style.cursor = 'copy';
      else if (hit) canvas.style.cursor = 'grab';
      else canvas.style.cursor = panning ? 'grabbing' : (connecting ? 'crosshair' : 'default');
    }
  }, [draggingNode, panning, connecting, nodes, panStart, getCanvasPos, findNodeAt]);

  const handleMouseUp = useCallback(() => {
    if (draggingNode) setDraggingNode(null);
    if (panning) setPanning(false);
  }, [draggingNode, panning]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const hit = findNodeAt(pos.x, pos.y);
    if (hit && !(hit as any).__connect) setShowNodeDetail(hit as DraftNode);
  }, [getCanvasPos, findNodeAt]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.15, Math.min(3, viewRef.current.zoom * delta));
    viewRef.current.zoom = newZoom;
    setViewState({ ...viewRef.current, zoom: newZoom });
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────

  const addNode = useCallback((item: CharacterListItem | WorldbuildingItem | { name: string; type: 'custom' }, type: 'character' | 'worldbuilding' | 'custom') => {
    const itemName = 'title' in item ? (item as WorldbuildingItem).title : item.name;
    const itemDesc = 'summary' in item ? (item as CharacterListItem).summary : 'content' in item ? (item as WorldbuildingItem).content?.substring(0, 100) || '' : '';
    const itemId = 'id' in item ? (item as any).id : null;
    const newNode: DraftNode = {
      id: generateId(), dbId: null, name: itemName,
      x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      entityType: type, entityId: itemId, description: itemDesc,
    };
    setNodes(prev => {
      const next = [...prev, newNode];
      syncPositions(next);
      velocities.current.set(newNode.id, { vx: 0, vy: 0 });
      return next;
    });
    setSelectedNode(newNode.id);
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedNode) {
      setNodes(prev => prev.filter(n => n.id !== selectedNode));
      setEdges(prev => prev.filter(e => e.sourceId !== selectedNode && e.targetId !== selectedNode));
      setSelectedNode(null);
      setConnecting(null);
    }
    if (selectedEdge) {
      setEdges(prev => prev.filter(e => e.id !== selectedEdge));
      setSelectedEdge(null);
    }
  }, [selectedNode, selectedEdge]);

  const handleSave = useCallback(async () => {
    try {
      const nodeIndexMap = new Map<string, number>();
      nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));
      const payload = {
        nodes: nodes.map(n => ({ id: n.id, entityType: n.entityType, entityId: n.entityId, name: n.name, x: n.x, y: n.y, color: n.color, description: n.description })),
        edges: edges.map(e => ({ sourceNodeId: nodeIndexMap.get(e.sourceId) ?? 0, targetNodeId: nodeIndexMap.get(e.targetId) ?? 0, relationType: e.relationType, label: e.label, description: e.description })),
      };
      await api.saveStarChart(projectId, payload);
      setDirty(false);
      await loadData();
    } catch (e) { console.error('Save error:', e); alert('保存失败，请重试'); }
  }, [nodes, edges, projectId]);

  const handleAddCustomNode = useCallback((name: string) => {
    if (!name.trim()) return;
    addNode({ name: name.trim(), type: 'custom' }, 'custom');
    setShowAddPanel(false);
  }, [addNode]);

  const updateNodeDetail = useCallback((nodeId: string, name: string, description: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, name, description } : n));
    setShowNodeDetail(prev => prev && prev.id === nodeId ? { ...prev, name, description } : prev);
  }, []);

  // ── Keyboard ───────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') {
        setConnecting(null); setConnectionTarget(null); setSelectedNode(null);
        setSelectedEdge(null); setShowEdgeEdit(null); setShowNodeDetail(null); setShowAddPanel(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deleteSelected]);

  // ── Auto-save ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!initialLoadDone.current) return;
    setDirty(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const nodeIndexMap = new Map<string, number>();
        nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));
        const payload = {
          nodes: nodes.map(n => ({ id: n.id, entityType: n.entityType, entityId: n.entityId, name: n.name, x: n.x, y: n.y, color: n.color, description: n.description })),
          edges: edges.map(e => ({ sourceNodeId: nodeIndexMap.get(e.sourceId) ?? 0, targetNodeId: nodeIndexMap.get(e.targetId) ?? 0, relationType: e.relationType, label: e.label, description: e.description })),
        };
        await api.saveStarChart(projectId, payload);
        setDirty(false);
        await loadData();
      } catch (e) { console.error('Auto-save error:', e); }
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [nodes, edges]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const hit = findNodeAt(pos.x, pos.y);
    if (!hit) { setSelectedNode(null); setSelectedEdge(null); }
    const { x: vx, y: vy, zoom } = viewRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    for (const edge of edges) {
      const src = nodes.find(n => n.id === edge.sourceId);
      const tgt = nodes.find(n => n.id === edge.targetId);
      if (!src || !tgt) continue;
      const sp = positions.current.get(src.id) || { x: src.x, y: src.y };
      const tp = positions.current.get(tgt.id) || { x: tgt.x, y: tgt.y };
      const sx = sp.x * zoom + vx + rect.width / 2;
      const sy = sp.y * zoom + vy + rect.height / 2;
      const tx = tp.x * zoom + vx + rect.width / 2;
      const ty = tp.y * zoom + vy + rect.height / 2;
      const dx = tx - sx, dy = ty - sy;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = ((pos.x - sx) * dx + (pos.y - sy) * dy) / lenSq;
      const closestX = sx + Math.max(0, Math.min(1, t)) * dx;
      const closestY = sy + Math.max(0, Math.min(1, t)) * dy;
      const dist = Math.sqrt((pos.x - closestX) ** 2 + (pos.y - closestY) ** 2);
      if (dist < 10) { setSelectedEdge(edge.id); setSelectedNode(null); return; }
    }
  }, [getCanvasPos, findNodeAt, edges, nodes]);

  // ── Derived ────────────────────────────────────────────────────────────

  const detailNodeEdges = showNodeDetail
    ? edges.filter(e => e.sourceId === showNodeDetail.id || e.targetId === showNodeDetail.id) : [];

  if (!projectId) return null;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#020208]" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a18]/95 border-b border-[#c9a96e]/10 backdrop-blur">
        <div className="flex items-center gap-3">
          <Compass size={18} className="text-[#c9a96e]" />
          <h2 className="text-[#f5f0e8] font-medium font-serif tracking-wide">星图</h2>
          <span className="text-xs text-[#f5f0e8]/30">{nodes.length} 星辰 · {edges.length} 连线</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAddPanel(!showAddPanel)}>
            <Plus size={14} /> 添加星辰
          </Button>
          <Button variant="ghost" size="sm" onClick={deleteSelected} disabled={!selectedNode && !selectedEdge}>
            <Trash2 size={14} /> 删除
          </Button>
          <div className="w-px h-6 bg-[#c9a96e]/20" />
          <button onClick={() => { viewRef.current.zoom = Math.max(0.15, viewRef.current.zoom - 0.2); setViewState({ ...viewRef.current }); }} className="p-1.5 text-[#f5f0e8]/50 hover:text-[#f5f0e8] rounded"><ZoomOut size={16} /></button>
          <span className="text-xs text-[#f5f0e8]/50 w-10 text-center">{Math.round(viewState.zoom * 100)}%</span>
          <button onClick={() => { viewRef.current.zoom = Math.min(3, viewRef.current.zoom + 0.2); setViewState({ ...viewRef.current }); }} className="p-1.5 text-[#f5f0e8]/50 hover:text-[#f5f0e8] rounded"><ZoomIn size={16} /></button>
          <button onClick={() => { viewRef.current = { x: 0, y: 0, zoom: 1 }; setViewState({ x: 0, y: 0, zoom: 1 }); }} className="p-1.5 text-[#f5f0e8]/50 hover:text-[#f5f0e8] rounded"><RotateCcw size={16} /></button>
          <div className="w-px h-6 bg-[#c9a96e]/20" />
          <Button size="sm" onClick={handleSave}><Save size={14} /> {dirty ? '保存星图 *' : '保存星图'}</Button>
        </div>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="flex-1"
          style={{ width: '100%', height: '100%' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          onClick={handleCanvasClick}
          onContextMenu={e => e.preventDefault()}
        />

        {/* Add panel */}
        {showAddPanel && (
          <div className="absolute right-4 top-4 w-72 bg-[#0a0a18]/98 backdrop-blur border border-[#c9a96e]/20 rounded-xl p-4 shadow-2xl z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#f5f0e8] text-sm font-medium font-serif">添加星辰</h3>
              <button onClick={() => setShowAddPanel(false)} className="text-[#f5f0e8]/40 hover:text-[#f5f0e8]"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {characters.filter(c => !nodes.some(n => n.entityType === 'character' && n.entityId === c.id)).length > 0 && (
                <div>
                  <div className="text-xs text-[#f5f0e8]/40 mb-1.5">角色</div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {characters.filter(c => !nodes.some(n => n.entityType === 'character' && n.entityId === c.id)).map(char => (
                      <button key={char.id} onClick={() => addNode(char, 'character')} className="w-full text-left px-2 py-1.5 rounded text-sm text-[#f5f0e8]/70 hover:text-[#f5f0e8] hover:bg-[#c9a96e]/10 transition-colors flex items-center gap-2">
                        <span className="text-xs">♂</span><span>{char.name}</span><span className="text-xs text-[#f5f0e8]/30 ml-auto">{char.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {worldbuilding.filter(w => !nodes.some(n => n.entityType === 'worldbuilding' && n.entityId === w.id)).length > 0 && (
                <div>
                  <div className="text-xs text-[#f5f0e8]/40 mb-1.5">世界观概念</div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {worldbuilding.filter(w => !nodes.some(n => n.entityType === 'worldbuilding' && n.entityId === w.id)).map(wb => (
                      <button key={wb.id} onClick={() => addNode(wb, 'worldbuilding')} className="w-full text-left px-2 py-1.5 rounded text-sm text-[#f5f0e8]/70 hover:text-[#f5f0e8] hover:bg-[#c9a96e]/10 transition-colors flex items-center gap-2">
                        <span className="text-xs">◎</span><span>{wb.title}</span><span className="text-xs text-[#f5f0e8]/30 ml-auto">{wb.category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-[#f5f0e8]/40 mb-1.5">自由概念</div>
                <form onSubmit={e => { e.preventDefault(); const input = (e.target as HTMLFormElement).querySelector('input') as HTMLInputElement; handleAddCustomNode(input.value); input.value = ''; }} className="flex gap-1">
                  <Input placeholder="输入名称..." className="text-sm h-8" />
                  <Button type="submit" size="sm" className="h-8 px-2"><Plus size={14} /></Button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Node detail panel */}
        {showNodeDetail && (
          <div className="absolute left-4 top-4 w-72 bg-[#0a0a18]/98 backdrop-blur border border-[#c9a96e]/20 rounded-xl p-4 shadow-2xl z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#f5f0e8] text-sm font-medium font-serif">编辑星辰</h3>
              <button onClick={() => setShowNodeDetail(null)} className="text-[#f5f0e8]/40 hover:text-[#f5f0e8]"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-[#f5f0e8]/30">类型：</span>
                <span className="text-xs text-[#f5f0e8]/60 ml-1">{showNodeDetail.entityType === 'character' ? '角色' : showNodeDetail.entityType === 'worldbuilding' ? '世界观概念' : '自由概念'}</span>
              </div>
              <Input label="名称" value={showNodeDetail.name} onChange={e => setShowNodeDetail({ ...showNodeDetail, name: e.target.value })} />
              <div>
                <label className="text-sm text-[#f5f0e8]/60 mb-1 block">描述</label>
                <textarea value={showNodeDetail.description} onChange={e => setShowNodeDetail({ ...showNodeDetail, description: e.target.value })} placeholder="描述这个节点..." rows={3} className="w-full bg-[#020208] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/50 resize-none" />
              </div>
              <Button size="sm" className="w-full" onClick={() => updateNodeDetail(showNodeDetail.id, showNodeDetail.name, showNodeDetail.description)}><Save size={14} /> 保存修改</Button>
              {detailNodeEdges.length > 0 && (
                <div className="pt-2 border-t border-[#c9a96e]/10">
                  <span className="text-xs text-[#f5f0e8]/30">关联连线：</span>
                  <div className="mt-1.5 space-y-1">
                    {detailNodeEdges.map(e => {
                      const other = e.sourceId === showNodeDetail.id ? nodes.find(n => n.id === e.targetId) : nodes.find(n => n.id === e.sourceId);
                      return other ? (
                        <div key={e.id} className="text-xs flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-[#c9a96e]/5 rounded px-1 -mx-1" onClick={() => { setShowNodeDetail(null); setSelectedEdge(e.id); }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: RelationTypeColors[e.relationType] }} />
                          <span className="text-[#f5f0e8]/40">{RelationTypeLabels[e.relationType]}</span>
                          <span className="text-[#c9a96e] truncate">{other.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action bar */}
        {selectedNode && !showNodeDetail && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#0a0a18]/98 backdrop-blur border border-[#c9a96e]/20 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg z-10">
            <span className="text-sm text-[#f5f0e8] font-serif">{nodes.find(n => n.id === selectedNode)?.name}</span>
            <button onClick={() => setConnecting(selectedNode)} className="px-2 py-1 text-xs text-[#c9a96e] hover:bg-[#c9a96e]/10 rounded flex items-center gap-1"><GitBranch size={12} /> 连线</button>
            <button onClick={() => setShowNodeDetail(nodes.find(n => n.id === selectedNode) || null)} className="px-2 py-1 text-xs text-[#f5f0e8]/60 hover:text-[#f5f0e8] hover:bg-[#f5f0e8]/5 rounded">详情</button>
            <button onClick={deleteSelected} className="px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 rounded"><Trash2 size={12} /></button>
          </div>
        )}
      </div>

      {/* Edge edit modal */}
      <Modal open={!!showEdgeEdit} onClose={() => setShowEdgeEdit(null)} title="编辑关系">
        {showEdgeEdit && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[#f5f0e8]/60 mb-1 block">关系类型</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(RelationTypeLabels) as RelationType[]).map(type => (
                  <button key={type} onClick={() => setShowEdgeEdit({ ...showEdgeEdit, relationType: type })} className="px-2.5 py-1 rounded text-xs transition-colors"
                    style={{ background: showEdgeEdit.relationType === type ? RelationTypeColors[type] + '30' : 'transparent', color: showEdgeEdit.relationType === type ? RelationTypeColors[type] : '#f5f0e860', border: `1px solid ${showEdgeEdit.relationType === type ? RelationTypeColors[type] : 'transparent'}` }}>
                    {RelationTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>
            <Input label="关系标签" value={showEdgeEdit.label} onChange={e => setShowEdgeEdit({ ...showEdgeEdit, label: e.target.value })} placeholder="如：挚友、宿敌、师徒..." />
            <Input label="关系描述" value={showEdgeEdit.description} onChange={e => setShowEdgeEdit({ ...showEdgeEdit, description: e.target.value })} placeholder="描述两者的关系..." />
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => { setEdges(prev => prev.filter(e => e.id !== showEdgeEdit.id)); setShowEdgeEdit(null); }}><Trash2 size={14} /> 删除此连线</Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowEdgeEdit(null)}>取消</Button>
                <Button onClick={() => { setEdges(prev => prev.map(e => e.id === showEdgeEdit.id ? showEdgeEdit : e)); setShowEdgeEdit(null); }}>确定</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}