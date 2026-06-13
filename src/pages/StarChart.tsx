import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  Plus, Trash2, Save, Sparkles, ZoomIn, ZoomOut, RotateCcw,
  X, GitBranch,
} from 'lucide-react';
import type { StarMapNode, StarMapEdge, RelationType, CharacterListItem, WorldbuildingItem } from '@/types';
import { RelationTypeLabels, RelationTypeColors } from '@/types';

interface DraftNode {
  id: string; // temp client id like 'temp_1'
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

const STAR_COLORS = ['#c9a96e', '#e8a8c9', '#7dc9a9', '#7da8c9', '#c97da8', '#a9c97d', '#e87d7d'];

function generateId() {
  return 'temp_' + Math.random().toString(36).substring(2, 9);
}

export default function StarChart() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { characters, fetchCharacters, worldbuilding, fetchWorldbuilding } = useProjectStore();

  const [nodes, setNodes] = useState<DraftNode[]>([]);
  const [edges, setEdges] = useState<DraftEdge[]>([]);
  const [loading, setLoading] = useState(true);

  // Viewport state
  const viewRef = useRef({ x: 0, y: 0, zoom: 1 });
  const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });

  // Interaction state
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const panViewStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });

  // UI state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEdgeEdit, setShowEdgeEdit] = useState<DraftEdge | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [showNodeDetail, setShowNodeDetail] = useState<DraftNode | null>(null);
  const [connectionTarget, setConnectionTarget] = useState<string | null>(null);

  // Animation time for blinking stars
  const [elapsed, setElapsed] = useState(0);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef(Date.now());
  const initialLoadDone = useRef(false);

  // Auto-save
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data
  useEffect(() => {
    if (!projectId) return;
    loadData();
  }, [projectId]);

  async function loadData() {
    setLoading(true);
    initialLoadDone.current = false;
    try {
      const [data] = await Promise.all([
        api.getStarChart(projectId),
        fetchCharacters(projectId),
        fetchWorldbuilding(projectId),
      ]);
      // Build dbId -> draftId map
      const dbToDraft = new Map<number, string>();
      const loadedNodes: DraftNode[] = data.nodes.map((n: StarMapNode) => {
        const draftId = generateId();
        dbToDraft.set(n.id, draftId);
        return {
          id: draftId,
          dbId: n.id,
          name: n.name,
          x: n.x,
          y: n.y,
          color: n.color,
          entityType: n.entityType,
          entityId: n.entityId,
          description: n.description,
        };
      });
      const loadedEdges: DraftEdge[] = data.edges.map((e: StarMapEdge) => ({
        id: generateId(),
        dbId: e.id,
        sourceId: dbToDraft.get(e.sourceNodeId) || '',
        targetId: dbToDraft.get(e.targetNodeId) || '',
        relationType: e.relationType,
        label: e.label,
        description: e.description,
      }));
      setNodes(loadedNodes);
      setEdges(loadedEdges);
    } catch (e) {
      console.error('Load star chart error:', e);
    }
    setLoading(false);
    setTimeout(() => { initialLoadDone.current = true; }, 500);
  }

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const { x, y, zoom } = viewRef.current;

    // Background - deep space
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(201, 169, 110, 0.04)';
    ctx.lineWidth = 0.5;
    const gridSize = 50 * zoom;
    const startX = x % gridSize;
    const startY = y % gridSize;
    for (let gx = startX; gx < rect.width; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, rect.height);
      ctx.stroke();
    }
    for (let gy = startY; gy < rect.height; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(rect.width, gy);
      ctx.stroke();
    }

    // Draw edges
    for (const edge of edges) {
      const src = nodes.find(n => n.id === edge.sourceId);
      const tgt = nodes.find(n => n.id === edge.targetId);
      if (!src || !tgt) continue;

      const sx = src.x * zoom + x + rect.width / 2;
      const sy = src.y * zoom + y + rect.height / 2;
      const tx = tgt.x * zoom + x + rect.width / 2;
      const ty = tgt.y * zoom + y + rect.height / 2;

      const isSelected = selectedEdge === edge.id;
      const isConnecting = (connecting === edge.sourceId || connecting === edge.targetId);
      const color = RelationTypeColors[edge.relationType] || '#8e8e9e';

      // Glow effect for selected
      if (isSelected) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }

      ctx.strokeStyle = isConnecting ? `${color}80` : color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash(edge.relationType === 'enemy' ? [6, 4] : []);

      // Draw curved line
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const curveOffset = Math.min(dist * 0.15, 30) * zoom;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(
        midX + curveOffset * Math.sin(Math.atan2(dy, dx)),
        midY - curveOffset * Math.cos(Math.atan2(dy, dx)),
        tx, ty,
      );
      ctx.stroke();
      ctx.setLineDash([]);

      if (isSelected) ctx.restore();

      // Edge label
      if (edge.label) {
        const labelX = midX + curveOffset * Math.sin(Math.atan2(dy, dx)) * 0.5;
        const labelY = midY - curveOffset * Math.cos(Math.atan2(dy, dx)) * 0.5;
        ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.7)';
        ctx.font = `${11 * zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(edge.label, labelX, labelY - 6);
        ctx.fillStyle = color;
        ctx.font = `${9 * zoom}px sans-serif`;
        ctx.fillText(RelationTypeLabels[edge.relationType], labelX, labelY + 6);
      }
    }

    // Draw connection line during drag
    if (connecting && mousePos.x && mousePos.y) {
      const src = nodes.find(n => n.id === connecting);
      if (src) {
        const sx = src.x * zoom + x + rect.width / 2;
        const sy = src.y * zoom + y + rect.height / 2;
        ctx.strokeStyle = 'rgba(201, 169, 110, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw nodes — simple blinking dots
    for (const node of nodes) {
      const nx = node.x * zoom + x + rect.width / 2;
      const ny = node.y * zoom + y + rect.height / 2;
      const radius = 8 * zoom;

      const isSelected = selectedNode === node.id;
      const isDragging = draggingNode === node.id;
      const isConnectSource = connecting === node.id;
      const isConnectTarget = connectionTarget === node.id;

      // Blinking alpha oscillation (each star has a unique phase based on its id)
      const phase = node.id.charCodeAt(0) + node.id.charCodeAt(node.id.length - 1);
      const blinkAlpha = 0.55 + 0.45 * Math.sin(elapsed * 0.002 + phase);
      const alpha = isSelected || isDragging || isConnectSource ? 1 : blinkAlpha;

      // Soft glow (subtle, proportional to small radius)
      const glowGrad = ctx.createRadialGradient(nx, ny, radius * 0.5, nx, ny, radius * 3);
      glowGrad.addColorStop(0, node.color + '80');
      glowGrad.addColorStop(0.5, node.color + '15');
      glowGrad.addColorStop(1, 'transparent');
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(nx, ny, radius * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Selection ring
      if (isSelected || isDragging || isConnectSource) {
        ctx.strokeStyle = isConnectSource ? '#c9a96e' : '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isConnectTarget) {
        ctx.strokeStyle = '#c9a96e';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(nx, ny, radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Node dot — simple filled circle
      ctx.fillStyle = node.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(nx, ny, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Bright center point
      ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * alpha) + ')';
      ctx.beginPath();
      ctx.arc(nx, ny, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Name label
      const nameFontSize = Math.max(10, 12 * zoom);
      ctx.fillStyle = '#f5f0e8';
      ctx.font = `${nameFontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(node.name, nx, ny - radius - 10);

      // Connect button for source node
      if (isSelected && !connecting) {
        ctx.fillStyle = 'rgba(201, 169, 110, 0.8)';
        ctx.beginPath();
        ctx.arc(nx + radius + 8, ny, 7 * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${10 * zoom}px sans-serif`;
        ctx.fillText('+', nx + radius + 8, ny + 3 * zoom);
      }
    }

    // Center hint when empty
    if (nodes.length === 0 && !loading) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('点击右上角「添加星辰」开始构建星图', rect.width / 2, rect.height / 2 - 10);
      ctx.fillText('角色关系与世界观概念将以星辰形式呈现', rect.width / 2, rect.height / 2 + 18);
    }

  }, [nodes, edges, viewState, selectedNode, selectedEdge, connecting, mousePos, draggingNode, connectionTarget, loading, elapsed]);

  // Canvas event handlers
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

    for (const node of nodes) {
      const nx = node.x * zoom + x + rect.width / 2;
      const ny = node.y * zoom + y + rect.height / 2;
      const radius = 30 * zoom;
      const dx = canvasX - nx;
      const dy = canvasY - ny;
      if (dx * dx + dy * dy <= radius * radius) {
        return node;
      }
    }
    // Check connect button
    if (selectedNode) {
      const selNode = nodes.find(n => n.id === selectedNode);
      if (selNode) {
        const nx = selNode.x * zoom + x + rect.width / 2;
        const ny = selNode.y * zoom + y + rect.height / 2;
        const btnX = nx + (8 * zoom) + 8;
        const dx = canvasX - btnX;
        const dy = canvasY - ny;
        if (dx * dx + dy * dy <= (10 * zoom) * (10 * zoom)) {
          return { __connect: true, node: selNode };
        }
      }
    }
    return null;
  }, [nodes, selectedNode]);

  const getScreenPos = useCallback((nodeX: number, nodeY: number) => {
    const { x, y, zoom } = viewRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: nodeX * zoom + x + rect.width / 2,
      y: nodeY * zoom + y + rect.height / 2,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const hit = findNodeAt(pos.x, pos.y);

    if (hit && (hit as any).__connect) {
      // Start connecting from selected node
      setConnecting(selectedNode);
      setMousePos(pos);
      e.preventDefault();
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
      // Complete connection
      const targetNode = hit as DraftNode;
      if (targetNode.id !== connecting) {
        const newEdge: DraftEdge = {
          id: generateId(),
          dbId: null,
          sourceId: connecting,
          targetId: targetNode.id,
          relationType: 'other',
          label: '',
          description: '',
        };
        setEdges(prev => [...prev, newEdge]);
        setShowEdgeEdit(newEdge);
      }
      setConnecting(null);
      setConnectionTarget(null);
    } else if (!hit && !connecting) {
      // Start panning
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
      const node = nodes.find(n => n.id === draggingNode);
      if (!node) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x, y } = viewRef.current;
      const newX = (pos.x - dragOffset.current.x - x - rect.width / 2) / zoom;
      const newY = (pos.y - dragOffset.current.y - y - rect.height / 2) / zoom;
      setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: newX, y: newY } : n));
    }

    if (panning) {
      const dx = pos.x - panStart.x;
      const dy = pos.y - panStart.y;
      viewRef.current.x = panViewStart.current.x + dx;
      viewRef.current.y = panViewStart.current.y + dy;
      setViewState({ ...viewRef.current, zoom: viewRef.current.zoom });
    }

    // Highlight connection target
    if (connecting) {
      const hit = findNodeAt(pos.x, pos.y);
      const validTarget = hit && !(hit as any).__connect && (hit as DraftNode).id !== connecting;
      setConnectionTarget(validTarget ? (hit as DraftNode).id : null);
    }

    // Cursor style
    const hit = findNodeAt(pos.x, pos.y);
    const canvas = canvasRef.current;
    if (canvas) {
      if (hit && (hit as any).__connect) {
        canvas.style.cursor = 'pointer';
      } else if (connecting && hit && (hit as DraftNode).id !== connecting) {
        canvas.style.cursor = 'copy';
      } else if (hit) {
        canvas.style.cursor = 'grab';
      } else {
        canvas.style.cursor = panning ? 'grabbing' : (connecting ? 'crosshair' : 'default');
      }
    }
  }, [draggingNode, panning, connecting, nodes, panStart, getCanvasPos, findNodeAt]);

  const handleMouseUp = useCallback(() => {
    if (draggingNode) {
      setDraggingNode(null);
    }
    if (panning) {
      setPanning(false);
    }
  }, [draggingNode, panning]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const hit = findNodeAt(pos.x, pos.y);
    if (hit && !(hit as any).__connect) {
      setShowNodeDetail(hit as DraftNode);
    }
  }, [getCanvasPos, findNodeAt]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(3, viewRef.current.zoom * delta));
    viewRef.current.zoom = newZoom;
    setViewState({ ...viewRef.current, zoom: newZoom });
  }, []);

  // Actions
  const addNode = useCallback((item: CharacterListItem | WorldbuildingItem | { name: string; type: 'custom' }, type: 'character' | 'worldbuilding' | 'custom') => {
    const centerArea = 200;
    const itemName = 'title' in item ? (item as WorldbuildingItem).title : item.name;
    const itemDesc = 'summary' in item ? (item as CharacterListItem).summary : 
                     'content' in item ? (item as WorldbuildingItem).content?.substring(0, 100) || '' : '';
    const itemId = 'id' in item ? (item as any).id : null;
    const newNode: DraftNode = {
      id: generateId(),
      dbId: null,
      name: itemName,
      x: (Math.random() - 0.5) * centerArea,
      y: (Math.random() - 0.5) * centerArea,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      entityType: type,
      entityId: itemId,
      description: itemDesc,
    };
    setNodes(prev => [...prev, newNode]);
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
      // Build index map for edge references
      const nodeIndexMap = new Map<string, number>();
      nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));
      
      const payload = {
        nodes: nodes.map(n => ({
          id: n.id,
          entityType: n.entityType,
          entityId: n.entityId,
          name: n.name,
          x: n.x,
          y: n.y,
          color: n.color,
          description: n.description,
        })),
        edges: edges.map(e => ({
          sourceNodeId: nodeIndexMap.get(e.sourceId) ?? 0,
          targetNodeId: nodeIndexMap.get(e.targetId) ?? 0,
          relationType: e.relationType,
          label: e.label,
          description: e.description,
        })),
      };
      await api.saveStarChart(projectId, payload);
      setDirty(false);
      await loadData();
    } catch (e) {
      console.error('Save error:', e);
      alert('保存失败，请重试');
    }
  }, [nodes, edges, projectId]);

  const handleAddCustomNode = useCallback((name: string) => {
    if (!name.trim()) return;
    addNode({ name: name.trim(), type: 'custom' }, 'custom');
    setShowAddPanel(false);
  }, [addNode]);

  // Force-directed auto-organize layout (Fruchterman-Reingold)
  const autoOrganize = useCallback(() => {
    if (nodes.length === 0) return;

    const positions = nodes.map(n => ({ x: n.x, y: n.y }));
    const nodeIds = nodes.map(n => n.id);
    const n = nodes.length;
    const iterations = Math.min(200, n * 10);
    const area = 400 * n;
    const k = Math.sqrt(area / n); // optimal distance
    let temperature = k * 0.5;

    for (let iter = 0; iter < iterations; iter++) {
      const displacements = positions.map(() => ({ x: 0, y: 0 }));

      // Repulsive forces (all pairs)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = positions[i].x - positions[j].x;
          const dy = positions[i].y - positions[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (k * k) / dist;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          displacements[i].x += fx;
          displacements[i].y += fy;
          displacements[j].x -= fx;
          displacements[j].y -= fy;
        }
      }

      // Attractive forces (along edges)
      for (const edge of edges) {
        const i = nodeIds.indexOf(edge.sourceId);
        const j = nodeIds.indexOf(edge.targetId);
        if (i < 0 || j < 0) continue;
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist * dist) / k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        displacements[i].x += fx;
        displacements[i].y += fy;
        displacements[j].x -= fx;
        displacements[j].y -= fy;
      }

      // Center gravity
      for (let i = 0; i < n; i++) {
        displacements[i].x -= positions[i].x * 0.01;
        displacements[i].y -= positions[i].y * 0.01;
      }

      // Apply with temperature damping
      for (let i = 0; i < n; i++) {
        const d = Math.sqrt(displacements[i].x ** 2 + displacements[i].y ** 2) || 1;
        positions[i].x += (displacements[i].x / d) * Math.min(d, temperature);
        positions[i].y += (displacements[i].y / d) * Math.min(d, temperature);
      }

      temperature *= 0.95;
    }

    setNodes(prev => prev.map((node, i) => ({
      ...node,
      x: positions[i].x,
      y: positions[i].y,
    })));
  }, [nodes, edges]);

  // Update node description from detail panel
  const updateNodeDetail = useCallback((nodeId: string, name: string, description: string) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, name, description } : n
    ));
    setShowNodeDetail(prev => prev && prev.id === nodeId ? { ...prev, name, description } : prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
      if (e.key === 'Escape') {
        setConnecting(null);
        setConnectionTarget(null);
        setSelectedNode(null);
        setSelectedEdge(null);
        setShowEdgeEdit(null);
        setShowNodeDetail(null);
        setShowAddPanel(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deleteSelected]);

  // Blinking animation loop
  useEffect(() => {
    const animate = () => {
      setElapsed(Date.now() - startTimeRef.current);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Auto-save with debounce (3s after last change)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    setDirty(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const nodeIndexMap = new Map<string, number>();
        nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));
        const payload = {
          nodes: nodes.map(n => ({
            id: n.id,
            entityType: n.entityType,
            entityId: n.entityId,
            name: n.name,
            x: n.x,
            y: n.y,
            color: n.color,
            description: n.description,
          })),
          edges: edges.map(e => ({
            sourceNodeId: nodeIndexMap.get(e.sourceId) ?? 0,
            targetNodeId: nodeIndexMap.get(e.targetId) ?? 0,
            relationType: e.relationType,
            label: e.label,
            description: e.description,
          })),
        };
        await api.saveStarChart(projectId, payload);
        setDirty(false);
        await loadData();
      } catch (e) {
        console.error('Auto-save error:', e);
      }
    }, 3000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [nodes, edges]);

  // Find edges for selected node to show
  const nodeEdges = selectedNode
    ? edges.filter(e => e.sourceId === selectedNode || e.targetId === selectedNode)
    : [];

  // Find edges for the detail panel node
  const detailNodeEdges = showNodeDetail
    ? edges.filter(e => e.sourceId === showNodeDetail.id || e.targetId === showNodeDetail.id)
    : [];

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const hit = findNodeAt(pos.x, pos.y);
    if (!hit) {
      setSelectedNode(null);
      setSelectedEdge(null);
    }
    // Check if clicking on an edge
    const { x: vx, y: vy, zoom } = viewRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    for (const edge of edges) {
      const src = nodes.find(n => n.id === edge.sourceId);
      const tgt = nodes.find(n => n.id === edge.targetId);
      if (!src || !tgt) continue;
      const sx = src.x * zoom + vx + rect.width / 2;
      const sy = src.y * zoom + vy + rect.height / 2;
      const tx = tgt.x * zoom + vx + rect.width / 2;
      const ty = tgt.y * zoom + vy + rect.height / 2;
      // Simple distance to line
      const dx = tx - sx;
      const dy = ty - sy;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = ((pos.x - sx) * dx + (pos.y - sy) * dy) / lenSq;
      const closestX = sx + Math.max(0, Math.min(1, t)) * dx;
      const closestY = sy + Math.max(0, Math.min(1, t)) * dy;
      const dist = Math.sqrt((pos.x - closestX) ** 2 + (pos.y - closestY) ** 2);
      if (dist < 10) {
        setSelectedEdge(edge.id);
        setSelectedNode(null);
        return;
      }
    }
  }, [getCanvasPos, findNodeAt, edges, nodes]);

  if (!projectId) return null;

  return (
    <div className="h-full flex flex-col bg-[#0d0d1a]" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a2e]/90 border-b border-[#c9a96e]/10 backdrop-blur">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-[#c9a96e]" />
          <h2 className="text-[#f5f0e8] font-medium">星图</h2>
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
          <button
            onClick={() => {
              viewRef.current.zoom = Math.max(0.2, viewRef.current.zoom - 0.2);
              setViewState({ ...viewRef.current });
            }}
            className="p-1.5 text-[#f5f0e8]/50 hover:text-[#f5f0e8] rounded"
          ><ZoomOut size={16} /></button>
          <span className="text-xs text-[#f5f0e8]/50 w-10 text-center">{Math.round(viewState.zoom * 100)}%</span>
          <button
            onClick={() => {
              viewRef.current.zoom = Math.min(3, viewRef.current.zoom + 0.2);
              setViewState({ ...viewRef.current });
            }}
            className="p-1.5 text-[#f5f0e8]/50 hover:text-[#f5f0e8] rounded"
          ><ZoomIn size={16} /></button>
          <button
            onClick={() => {
              viewRef.current = { x: 0, y: 0, zoom: 1 };
              setViewState({ x: 0, y: 0, zoom: 1 });
            }}
            className="p-1.5 text-[#f5f0e8]/50 hover:text-[#f5f0e8] rounded"
          ><RotateCcw size={16} /></button>
          <div className="w-px h-6 bg-[#c9a96e]/20" />
          <Button variant="ghost" size="sm" onClick={autoOrganize} disabled={nodes.length === 0}>
            <Sparkles size={14} /> 一键整理
          </Button>
          <div className="w-px h-6 bg-[#c9a96e]/20" />
          <Button size="sm" onClick={handleSave}>
            <Save size={14} /> {dirty ? '保存星图 *' : '保存星图'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Canvas */}
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
          <div className="absolute right-4 top-4 w-72 bg-[#1a1a2e]/95 backdrop-blur border border-[#c9a96e]/20 rounded-xl p-4 shadow-2xl z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#f5f0e8] text-sm font-medium">添加星辰</h3>
              <button onClick={() => setShowAddPanel(false)} className="text-[#f5f0e8]/40 hover:text-[#f5f0e8]">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Characters */}
              {characters.filter(c => !nodes.some(n => n.entityType === 'character' && n.entityId === c.id)).length > 0 && (
                <div>
                  <div className="text-xs text-[#f5f0e8]/40 mb-1.5">已有角色</div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {characters.filter(c => !nodes.some(n => n.entityType === 'character' && n.entityId === c.id)).map(char => (
                      <button
                        key={char.id}
                        onClick={() => addNode(char, 'character')}
                        className="w-full text-left px-2 py-1.5 rounded text-sm text-[#f5f0e8]/70 hover:text-[#f5f0e8] hover:bg-[#c9a96e]/10 transition-colors flex items-center gap-2"
                      >
                        <span className="text-xs">♂</span>
                        <span>{char.name}</span>
                        <span className="text-xs text-[#f5f0e8]/30 ml-auto">{char.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Worldbuilding */}
              {worldbuilding.filter(w => !nodes.some(n => n.entityType === 'worldbuilding' && n.entityId === w.id)).length > 0 && (
                <div>
                  <div className="text-xs text-[#f5f0e8]/40 mb-1.5">世界观概念</div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {worldbuilding.filter(w => !nodes.some(n => n.entityType === 'worldbuilding' && n.entityId === w.id)).map(wb => (
                      <button
                        key={wb.id}
                        onClick={() => addNode(wb, 'worldbuilding')}
                        className="w-full text-left px-2 py-1.5 rounded text-sm text-[#f5f0e8]/70 hover:text-[#f5f0e8] hover:bg-[#c9a96e]/10 transition-colors flex items-center gap-2"
                      >
                        <span className="text-xs">◎</span>
                        <span>{wb.title}</span>
                        <span className="text-xs text-[#f5f0e8]/30 ml-auto">{wb.category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom label */}
              <div>
                <div className="text-xs text-[#f5f0e8]/40 mb-1.5">自由概念</div>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const input = (e.target as HTMLFormElement).querySelector('input') as HTMLInputElement;
                    handleAddCustomNode(input.value);
                    input.value = '';
                  }}
                  className="flex gap-1"
                >
                  <Input
                    placeholder="输入名称..."
                    className="text-sm h-8"
                  />
                  <Button type="submit" size="sm" className="h-8 px-2">
                    <Plus size={14} />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Node detail side panel — editable */}
        {showNodeDetail && (
          <div className="absolute left-4 top-4 w-72 bg-[#1a1a2e]/95 backdrop-blur border border-[#c9a96e]/20 rounded-xl p-4 shadow-2xl z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#f5f0e8] text-sm font-medium">编辑星辰</h3>
              <button onClick={() => setShowNodeDetail(null)} className="text-[#f5f0e8]/40 hover:text-[#f5f0e8]">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-[#f5f0e8]/30">类型：</span>
                <span className="text-xs text-[#f5f0e8]/60 ml-1">
                  {showNodeDetail.entityType === 'character' ? '角色' : showNodeDetail.entityType === 'worldbuilding' ? '世界观概念' : '自由概念'}
                </span>
              </div>
              <Input
                label="名称"
                value={showNodeDetail.name}
                onChange={e => setShowNodeDetail({ ...showNodeDetail, name: e.target.value })}
              />
              <div>
                <label className="text-sm text-[#f5f0e8]/60 mb-1 block">描述</label>
                <textarea
                  value={showNodeDetail.description}
                  onChange={e => setShowNodeDetail({ ...showNodeDetail, description: e.target.value })}
                  placeholder="描述这个节点..."
                  rows={3}
                  className="w-full bg-[#0d0d1a] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/50 resize-none"
                />
              </div>
              <Button size="sm" className="w-full" onClick={() => {
                updateNodeDetail(showNodeDetail.id, showNodeDetail.name, showNodeDetail.description);
              }}>
                <Save size={14} /> 保存修改
              </Button>

              {/* Related edges */}
              {detailNodeEdges.length > 0 && (
                <div className="pt-2 border-t border-[#c9a96e]/10">
                  <span className="text-xs text-[#f5f0e8]/30">关联连线：</span>
                  <div className="mt-1.5 space-y-1">
                    {detailNodeEdges.map(e => {
                      const other = e.sourceId === showNodeDetail.id
                        ? nodes.find(n => n.id === e.targetId)
                        : nodes.find(n => n.id === e.sourceId);
                      return other ? (
                        <div key={e.id}
                          className="text-xs flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-[#c9a96e]/5 rounded px-1 -mx-1"
                          onClick={() => {
                            setShowNodeDetail(null);
                            setSelectedEdge(e.id);
                          }}
                        >
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

        {/* Selected node action bar */}
        {selectedNode && !showNodeDetail && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1a1a2e]/95 backdrop-blur border border-[#c9a96e]/20 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg z-10">
            <span className="text-sm text-[#f5f0e8]">{nodes.find(n => n.id === selectedNode)?.name}</span>
            <button
              onClick={() => setConnecting(selectedNode)}
              className="px-2 py-1 text-xs text-[#c9a96e] hover:bg-[#c9a96e]/10 rounded flex items-center gap-1"
            >
              <GitBranch size={12} /> 连线
            </button>
            <button
              onClick={() => setShowNodeDetail(nodes.find(n => n.id === selectedNode) || null)}
              className="px-2 py-1 text-xs text-[#f5f0e8]/60 hover:text-[#f5f0e8] hover:bg-[#f5f0e8]/5 rounded"
            >
              详情
            </button>
            <button
              onClick={deleteSelected}
              className="px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 rounded"
            >
              <Trash2 size={12} />
            </button>
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
                  <button
                    key={type}
                    onClick={() => {
                      setShowEdgeEdit({ ...showEdgeEdit, relationType: type });
                    }}
                    className="px-2.5 py-1 rounded text-xs transition-colors"
                    style={{
                      background: showEdgeEdit.relationType === type ? RelationTypeColors[type] + '30' : 'transparent',
                      color: showEdgeEdit.relationType === type ? RelationTypeColors[type] : '#f5f0e860',
                      border: `1px solid ${showEdgeEdit.relationType === type ? RelationTypeColors[type] : 'transparent'}`,
                    }}
                  >
                    {RelationTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="关系标签"
              value={showEdgeEdit.label}
              onChange={e => setShowEdgeEdit({ ...showEdgeEdit, label: e.target.value })}
              placeholder="如：挚友、宿敌、师徒..."
            />
            <Input
              label="关系描述"
              value={showEdgeEdit.description}
              onChange={e => setShowEdgeEdit({ ...showEdgeEdit, description: e.target.value })}
              placeholder="描述两者的关系..."
            />
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => {
                setEdges(prev => prev.filter(e => e.id !== showEdgeEdit.id));
                setShowEdgeEdit(null);
              }}>
                <Trash2 size={14} /> 删除此连线
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowEdgeEdit(null)}>取消</Button>
                <Button onClick={() => {
                  setEdges(prev => prev.map(e =>
                    e.id === showEdgeEdit.id ? showEdgeEdit : e
                  ));
                  setShowEdgeEdit(null);
                }}>确定</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}