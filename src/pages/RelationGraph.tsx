import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  addEdge,
  MarkerType,
  useReactFlow,
} from '@reactflow/core';
import { Background, BackgroundVariant } from '@reactflow/background';
import { Controls } from '@reactflow/controls';
import '@reactflow/core/dist/style.css';
import '@reactflow/controls/dist/style.css';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  RelationTypeLabels, type RelationType, type RelationEdge,
  GraphNodeTypeLabels, GraphNodeTypeColors, type GraphNodeType,
} from '@/types';
import {
  Download, Plus, X, Save, Trash2,
  User, MapPin, Calendar, Flag, Box, Lightbulb,
  Edit3, Link2, Unlink, Maximize2, Minimize2,
  Star,
} from 'lucide-react';
import { toPng } from 'html-to-image';

const relationColors: Record<string, string> = {
  family: '#f0a060',
  friend: '#60d090',
  love: '#f06080',
  enemy: '#d06060',
  master_student: '#60a0d0',
  colleague: '#a0a0d0',
  other: '#8888a0',
};

const nodeIcons: Record<string, React.ReactNode> = {
  character: <User size={16} />,
  location: <MapPin size={16} />,
  event: <Calendar size={16} />,
  faction: <Flag size={16} />,
  item: <Box size={16} />,
  concept: <Lightbulb size={16} />,
};

// Star chart custom node with glow animation
function StarNode({ data }: { data: { label: string; nodeType: GraphNodeType; description: string } }) {
  const color = GraphNodeTypeColors[data.nodeType] || '#c9a96e';

  return (
    <div className="star-node group">
      {/* Outer glow ring */}
      <div
        className="star-node-glow absolute inset-0 rounded-full animate-pulse"
        style={{
          background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />
      {/* Main node body */}
      <div
        className="star-node-body relative flex flex-col items-center justify-center rounded-2xl border-2 min-w-[80px] px-4 py-3 cursor-pointer transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl"
        style={{
          background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
          borderColor: `${color}60`,
          boxShadow: `0 0 20px ${color}20, 0 0 40px ${color}08`,
        }}
      >
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center mb-1"
          style={{
            background: `linear-gradient(135deg, ${color}40, ${color}20)`,
            color,
          }}
        >
          {nodeIcons[data.nodeType]}
        </div>
        {/* Label */}
        <span className="text-xs font-semibold text-[#f5f0e8] text-center leading-tight max-w-[100px] truncate">
          {data.label}
        </span>
        {/* Type badge */}
        <span
          className="text-[9px] mt-0.5 px-1.5 py-0.5 rounded-full"
          style={{ background: `${color}20`, color: `${color}cc` }}
        >
          {GraphNodeTypeLabels[data.nodeType] || data.nodeType}
        </span>
      </div>
    </div>
  );
}

const nodeTypes = { starNode: StarNode };

// Edge label component
function EdgeLabel({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
      style={{
        background: `${color}15`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </div>
  );
}

export default function RelationGraph() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const {
    characters, relations, graphNodes,
    fetchCharacters, fetchRelations, fetchGraphNodes,
    saveRelations, saveGraphNodes,
  } = useProjectStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNodeForm, setNewNodeForm] = useState({ nodeType: 'location' as GraphNodeType, label: '', description: '' });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectForm, setConnectForm] = useState({ sourceId: '', targetId: '', relationType: 'other' as RelationType, label: '', description: '' });
  const graphRef = useRef<HTMLDivElement>(null);
  const [starFieldInitialized, setStarFieldInitialized] = useState(false);

  // Starfield background
  useEffect(() => {
    if (starFieldInitialized || !graphRef.current) return;
    const container = graphRef.current.querySelector('.react-flow__pane');
    if (!container) return;

    // Create star field particles
    const starField = document.createElement('div');
    starField.className = 'star-field absolute inset-0 pointer-events-none overflow-hidden';
    starField.style.zIndex = '0';

    const starCount = 120;
    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      const size = 1 + Math.random() * 2;
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const duration = 2 + Math.random() * 4;
      const delay = Math.random() * 3;

      star.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(201, 169, 110, ${0.15 + Math.random() * 0.25});
        animation: star-twinkle ${duration}s ${delay}s ease-in-out infinite;
        box-shadow: 0 0 ${size * 2}px rgba(201, 169, 110, ${0.1 + Math.random() * 0.15});
      `;
      starField.appendChild(star);
    }

    container.appendChild(starField);
    setStarFieldInitialized(true);
  }, [nodes.length, starFieldInitialized]);

  // Busy/connection node tracking
  const nodeMap = useMemo(() => {
    const map = new Map<string, number>();
    edges.forEach(e => {
      map.set(e.source, (map.get(e.source) || 0) + 1);
      map.set(e.target, (map.get(e.target) || 0) + 1);
    });
    return map;
  }, [edges]);

  useEffect(() => {
    if (projectId) {
      fetchCharacters(projectId);
      fetchRelations(projectId);
      fetchGraphNodes(projectId);
    }
  }, [projectId]);

  // Simple force-directed layout simulation
  const applyAutoLayout = useCallback(() => {
    setNodes(nds => {
      if (nds.length === 0) return nds;
      const center = { x: 400, y: 300 };
      const radius = Math.max(200, nds.length * 40);

      return nds.map((n, i) => {
        const angle = (2 * Math.PI * i) / nds.length - Math.PI / 2;
        if (nds.length === 1) return { ...n, position: center };
        return {
          ...n,
          position: {
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
          },
        };
      });
    });
  }, []);

  // Sync nodes from graphNodes + characters
  useEffect(() => {
    const allNodes: Node[] = [];

    for (const gn of graphNodes) {
      const posX = gn.posX || 200 + Math.random() * 400;
      const posY = gn.posY || 150 + Math.random() * 300;
      allNodes.push({
        id: `gn-${gn.id}`,
        type: 'starNode',
        position: { x: posX, y: posY },
        data: { label: gn.label, nodeType: gn.nodeType, description: gn.description, graphNodeId: gn.id },
      });
    }

    const graphNodeCharIds = new Set(graphNodes.filter(gn => gn.charId).map(gn => gn.charId));
    for (const char of characters) {
      if (!graphNodeCharIds.has(char.id)) {
        allNodes.push({
          id: `char-${char.id}`,
          type: 'starNode',
          position: { x: 200 + Math.random() * 400, y: 150 + Math.random() * 300 },
          data: { label: char.name, nodeType: 'character' as GraphNodeType, description: char.role || '', charId: char.id },
        });
      }
    }

    setNodes(allNodes);
  }, [graphNodes, characters]);

  // Sync edges from relations
  useEffect(() => {
    const newEdges: Edge[] = relations.map((rel: RelationEdge) => {
      const color = relationColors[rel.relationType] || '#888';
      return {
        id: `edge-${rel.id}`,
        source: rel.sourceCharId,
        target: rel.targetCharId,
        label: rel.label || RelationTypeLabels[rel.relationType as RelationType] || '关联',
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: '5,5',
        },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        data: { relationType: rel.relationType, description: rel.description, edgeId: rel.id },
      };
    });
    setEdges(newEdges);
  }, [relations]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge-new-${Date.now()}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#888', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#888' },
        label: '关联',
        data: { relationType: 'other', description: '' },
      };
      setEdges(eds => addEdge(newEdge, eds));
    },
    [setEdges],
  );

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const onPaneClick = () => {
    setSelectedEdge(null);
    setSelectedNode(null);
  };

  const getConnectedEdges = (nodeId: string): Edge[] => {
    return edges.filter(e => e.source === nodeId || e.target === nodeId);
  };

  const getOppositeNode = (edge: Edge, nodeId: string): Node | undefined => {
    const oppositeId = edge.source === nodeId ? edge.target : edge.source;
    return nodes.find(n => n.id === oppositeId);
  };

  const handleSave = async () => {
    setSaving(true);
    const edgesData = edges.map(e => ({
      id: e.id.startsWith('edge-new-') ? null : (e.id.replace('edge-', '')),
      sourceCharId: e.source,
      targetCharId: e.target,
      relationType: e.data?.relationType || 'other',
      label: typeof e.label === 'string' ? e.label : '',
      description: e.data?.description || '',
      sourceX: 0, sourceY: 0, targetX: 0, targetY: 0,
    }));
    const nodesData = nodes.map(n => ({
      id: n.id.startsWith('gn-') ? n.id.replace('gn-', '') : n.id,
      nodeType: n.data?.nodeType || 'character',
      label: n.data?.label || '',
      description: n.data?.description || '',
      charId: n.data?.charId || null,
      posX: n.position.x,
      posY: n.position.y,
      styleData: '{}',
    }));
    await saveRelations(projectId, edgesData);
    await saveGraphNodes(projectId, nodesData);
    setSaving(false);
  };

  const handleDeleteEdge = (edgeId?: string) => {
    const idToDelete = edgeId || selectedEdge?.id;
    if (!idToDelete) return;
    setEdges(eds => eds.filter(e => e.id !== idToDelete));
    if (selectedEdge?.id === idToDelete) setSelectedEdge(null);
  };

  const handleDeleteNode = () => {
    if (selectedNode) {
      setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
      setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  };

  const handleUpdateEdge = (edgeId: string, field: string, value: string) => {
    setEdges(eds => eds.map(e => {
      if (e.id !== edgeId) return e;
      if (field === 'relationType') {
        const color = relationColors[value] || '#888';
        return {
          ...e,
          data: { ...e.data, relationType: value },
          style: { ...e.style, stroke: color, strokeDasharray: '5,5' },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      }
      if (field === 'label') return { ...e, label: value };
      if (field === 'description') return { ...e, data: { ...e.data, description: value } };
      return e;
    }));
  };

  const handleExport = async () => {
    setExporting(true);
    const el = document.querySelector('.react-flow') as HTMLElement;
    if (el) {
      try {
        const url = await toPng(el, { backgroundColor: '#080812' });
        const a = document.createElement('a');
        a.href = url;
        a.download = '星图关系图.png';
        a.click();
      } catch (e) { console.error(e); }
    }
    setExporting(false);
  };

  const handleAddNode = () => {
    if (!newNodeForm.label.trim()) return;
    const newNode: Node = {
      id: `gn-new-${Date.now()}`,
      type: 'starNode',
      position: { x: 300 + Math.random() * 250, y: 200 + Math.random() * 250 },
      data: { label: newNodeForm.label, nodeType: newNodeForm.nodeType, description: newNodeForm.description },
    };
    setNodes(nds => [...nds, newNode]);
    setShowAddNode(false);
    setNewNodeForm({ nodeType: 'location', label: '', description: '' });
  };

  const handleConnectNodes = () => {
    if (!connectForm.sourceId || !connectForm.targetId || connectForm.sourceId === connectForm.targetId) return;
    const color = relationColors[connectForm.relationType] || '#888';
    const newEdge: Edge = {
      id: `edge-new-${Date.now()}`,
      source: connectForm.sourceId,
      target: connectForm.targetId,
      type: 'smoothstep',
      animated: true,
      label: connectForm.label || RelationTypeLabels[connectForm.relationType] || '关联',
      style: { stroke: color, strokeWidth: 2, strokeDasharray: '5,5' },
      markerEnd: { type: MarkerType.ArrowClosed, color },
      data: { relationType: connectForm.relationType, description: connectForm.description },
    };
    setEdges(eds => [...eds, newEdge]);
    setShowConnectModal(false);
    setConnectForm({ sourceId: '', targetId: '', relationType: 'other', label: '', description: '' });
  };

  const nodeTypeOptions: { value: GraphNodeType; label: string; icon: React.ReactNode }[] = [
    { value: 'character', label: '角色', icon: <User size={16} /> },
    { value: 'location', label: '地点', icon: <MapPin size={16} /> },
    { value: 'event', label: '事件', icon: <Calendar size={16} /> },
    { value: 'faction', label: '势力', icon: <Flag size={16} /> },
    { value: 'item', label: '物品', icon: <Box size={16} /> },
    { value: 'concept', label: '概念', icon: <Lightbulb size={16} /> },
  ];

  const nodeOptions = nodes.map(n => ({
    value: n.id,
    label: `${n.data?.label || n.id} (${GraphNodeTypeLabels[n.data?.nodeType as GraphNodeType] || '未知'})`,
  }));

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#c9a96e]/10 bg-[#080812]/90">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[#cad9e8] flex items-center gap-2">
            <Star size={18} className="text-[#c9a96e]" />
            星图关系图
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={applyAutoLayout} disabled={nodes.length === 0}>
            <Maximize2 size={14} />自动布局
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowAddNode(true)}>
            <Plus size={14} />添加节点
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowConnectModal(true)} disabled={nodes.length < 2}>
            <Link2 size={14} />连接节点
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
            <Save size={14} />{saving ? '保存中...' : '保存'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
            <Download size={14} />{exporting ? '导出中...' : '导出PNG'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex relative">
        {/* Canvas */}
        <div className="flex-1" ref={graphRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{
              animated: true,
              style: { strokeDasharray: '5,5' },
            }}
            className="!bg-[#080812]"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a3a2e" />
            <Controls className="!bg-[#0f0f1e] !border-[#c9a96e]/15 !rounded-xl" />
          </ReactFlow>
        </div>

        {/* Right panel */}
        {(selectedEdge || selectedNode) && (
          <div className="w-72 bg-[#0f0f1e]/98 border-l border-[#c9a96e]/10 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#f5f0e8]">
                {selectedEdge ? '关系配置' : '节点详情'}
              </h3>
              <button onClick={() => { setSelectedEdge(null); setSelectedNode(null); }} className="text-[#f5f0e8]/40 hover:text-[#f5f0e8]">
                <X size={16} />
              </button>
            </div>

            {selectedEdge && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#f5f0e8]/50 mb-1 block">关系类型</label>
                  <select
                    className="w-full bg-[#080812] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                    value={selectedEdge.data?.relationType || 'other'}
                    onChange={e => handleUpdateEdge(selectedEdge.id, 'relationType', e.target.value)}
                  >
                    {Object.entries(RelationTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#f5f0e8]/50 mb-1 block">关系标签</label>
                  <input
                    className="w-full bg-[#080812] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                    value={typeof selectedEdge.label === 'string' ? selectedEdge.label : ''}
                    onChange={e => handleUpdateEdge(selectedEdge.id, 'label', e.target.value)}
                    placeholder="如：师徒、父子..."
                  />
                </div>
                <div>
                  <label className="text-xs text-[#f5f0e8]/50 mb-1 block">关系描述</label>
                  <textarea
                    className="w-full bg-[#080812] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60 resize-none h-24"
                    value={selectedEdge.data?.description || ''}
                    onChange={e => handleUpdateEdge(selectedEdge.id, 'description', e.target.value)}
                    placeholder="描述这段关系..."
                  />
                </div>
                <Button variant="danger" size="sm" onClick={() => handleDeleteEdge()} className="w-full">
                  <Trash2 size={14} />删除连线
                </Button>
              </div>
            )}

            {selectedNode && (
              <div className="space-y-4">
                <div
                  className="rounded-lg p-3 border"
                  style={{
                    background: `linear-gradient(135deg, ${GraphNodeTypeColors[selectedNode.data?.nodeType as GraphNodeType] || '#c9a96e'}10 0%, transparent 100%)`,
                    borderColor: `${GraphNodeTypeColors[selectedNode.data?.nodeType as GraphNodeType] || '#c9a96e'}30`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: `${GraphNodeTypeColors[selectedNode.data?.nodeType as GraphNodeType] || '#c9a96e'}20`,
                      color: GraphNodeTypeColors[selectedNode.data?.nodeType as GraphNodeType] || '#c9a96e',
                    }}>
                      {GraphNodeTypeLabels[selectedNode.data?.nodeType as GraphNodeType] || '未知'}
                    </span>
                    <span className="text-xs text-[#f5f0e8]/30">
                      关联数: {getConnectedEdges(selectedNode.id).length}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#f5f0e8]">{selectedNode.data?.label}</p>
                  {selectedNode.data?.description && (
                    <p className="text-xs text-[#f5f0e8]/40 mt-1">{selectedNode.data?.description}</p>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-[#f5f0e8]/40 mb-2 uppercase tracking-wider">
                    关联关系
                  </h4>
                  {getConnectedEdges(selectedNode.id).length === 0 ? (
                    <p className="text-xs text-[#f5f0e8]/20 italic">暂无关联，拖拽或使用"连接节点"创建</p>
                  ) : (
                    <div className="space-y-2">
                      {getConnectedEdges(selectedNode.id).map(edge => {
                        const opposite = getOppositeNode(edge, selectedNode.id);
                        const color = relationColors[edge.data?.relationType] || '#888';
                        return (
                          <div
                            key={edge.id}
                            className="rounded-lg p-2.5 border"
                            style={{ background: `${color}08`, borderColor: `${color}20` }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                                <span className="text-xs font-medium" style={{ color }}>
                                  {RelationTypeLabels[edge.data?.relationType] || '关联'}
                                </span>
                                {typeof edge.label === 'string' && edge.label && (
                                  <span className="text-[10px] text-[#f5f0e8]/30">{edge.label}</span>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteEdge(edge.id)}
                                className="p-0.5 rounded text-[#f5f0e8]/20 hover:text-red-400 hover:bg-red-400/10"
                              >
                                <Unlink size={10} />
                              </button>
                            </div>
                            {opposite && (
                              <p className="text-[10px] text-[#f5f0e8]/25 mt-1">
                                → {opposite.data?.label || opposite.id}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Button variant="danger" size="sm" onClick={handleDeleteNode} className="w-full">
                  <Trash2 size={14} />删除节点
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Node Modal */}
      {showAddNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddNode(false)} />
          <div className="relative bg-[#0f0f1e] border border-[#c9a96e]/20 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#f5f0e8]">添加星辰节点</h2>
              <button onClick={() => setShowAddNode(false)} className="text-[#f5f0e8]/40 hover:text-[#f5f0e8]">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#f5f0e8]/50 mb-1 block">节点类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {nodeTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setNewNodeForm({ ...newNodeForm, nodeType: opt.value })}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all"
                      style={{
                        borderColor: newNodeForm.nodeType === opt.value
                          ? GraphNodeTypeColors[opt.value]
                          : '#c9a96e20',
                        background: newNodeForm.nodeType === opt.value
                          ? `${GraphNodeTypeColors[opt.value]}10`
                          : 'transparent',
                        color: newNodeForm.nodeType === opt.value
                          ? GraphNodeTypeColors[opt.value]
                          : '#f5f0e860',
                      }}
                    >
                      <span className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: `${GraphNodeTypeColors[opt.value]}20`, color: GraphNodeTypeColors[opt.value] }}>
                        {opt.icon}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label="名称"
                value={newNodeForm.label}
                onChange={e => setNewNodeForm({ ...newNodeForm, label: e.target.value })}
                placeholder="节点名称"
              />
              <div>
                <label className="text-xs text-[#f5f0e8]/50 mb-1 block">描述</label>
                <textarea
                  className="w-full bg-[#080812] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60 resize-none h-20"
                  value={newNodeForm.description}
                  onChange={e => setNewNodeForm({ ...newNodeForm, description: e.target.value })}
                  placeholder="简要描述..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowAddNode(false)}>取消</Button>
                <Button onClick={handleAddNode} disabled={!newNodeForm.label.trim()}>添加</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect Nodes Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConnectModal(false)} />
          <div className="relative bg-[#0f0f1e] border border-[#c9a96e]/20 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#f5f0e8]">连接星辰</h2>
              <button onClick={() => setShowConnectModal(false)} className="text-[#f5f0e8]/40 hover:text-[#f5f0e8]">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#f5f0e8]/50 mb-1 block">起始节点</label>
                <select
                  className="w-full bg-[#080812] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                  value={connectForm.sourceId}
                  onChange={e => setConnectForm({ ...connectForm, sourceId: e.target.value })}
                >
                  <option value="">选择节点</option>
                  {nodeOptions.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.value === connectForm.targetId}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#f5f0e8]/50 mb-1 block">目标节点</label>
                <select
                  className="w-full bg-[#080812] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                  value={connectForm.targetId}
                  onChange={e => setConnectForm({ ...connectForm, targetId: e.target.value })}
                >
                  <option value="">选择节点</option>
                  {nodeOptions.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.value === connectForm.sourceId}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#f5f0e8]/50 mb-1 block">关系类型</label>
                <select
                  className="w-full bg-[#080812] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                  value={connectForm.relationType}
                  onChange={e => setConnectForm({ ...connectForm, relationType: e.target.value as RelationType })}
                >
                  {Object.entries(RelationTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="关系标签（可选）"
                value={connectForm.label}
                onChange={e => setConnectForm({ ...connectForm, label: e.target.value })}
                placeholder="如：同门师兄弟"
              />
              <div>
                <label className="text-xs text-[#f5f0e8]/50 mb-1 block">关系描述（可选）</label>
                <textarea
                  className="w-full bg-[#080812] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60 resize-none h-20"
                  value={connectForm.description}
                  onChange={e => setConnectForm({ ...connectForm, description: e.target.value })}
                  placeholder="描述这段关系..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowConnectModal(false)}>取消</Button>
                <Button
                  onClick={handleConnectNodes}
                  disabled={!connectForm.sourceId || !connectForm.targetId || connectForm.sourceId === connectForm.targetId}
                >
                  创建连接
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}