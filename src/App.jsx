import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, 
  Paperclip, 
  FileText, 
  Bot, 
  User, 
  Network, 
  X, 
  BrainCircuit,
  UploadCloud,
  Layout,
  MessageSquare,
  Sparkles,
  Volume2,
  Loader2,
  StopCircle,
  Terminal,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';

// --- Styles & Constants ---
const COLORS = {
  primary: '#6366f1', // Indigo 500
  secondary: '#a5b4fc', // Indigo 300
  accent: '#10b981', // Emerald 500
  bg: '#f8fafc',
  card: '#ffffff',
  codeBg: '#1e293b', // Slate 800
  codeText: '#f1f5f9', // Slate 100
  text: '#1e293b',
  line: '#cbd5e1'
};

// --- API CONFIGURATION ---
// SECURITY NOTE: No API Key or System Prompts are stored here.
// All logic is handled by /functions/api/gemini.js

// --- Gemini API Helpers (Via Proxy) ---

const fetchGeminiProxy = async (payload, type = 'text') => {
  // Point to the Cloudflare Function we created
  const url = `/api/gemini`; 
  
  const model = type === 'tts' ? 'gemini-2.5-flash-preview-tts' : 'gemini-2.5-flash-preview-09-2025';
  
  // We send the payload + the requested model type to our backend
  const body = {
    ...payload,
    model: model
  };

  const delays = [1000, 2000, 4000, 8000, 16000];
  
  for (let i = 0; i <= delays.length; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        // If server returns 500/400, throw specific error
        if (response.status >= 400 && response.status < 500) {
             const errData = await response.json();
             throw new Error(errData.error || "Client Error");
        }
        if (response.status === 429 && i < delays.length) {
          await new Promise(resolve => setTimeout(resolve, delays[i]));
          continue;
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (i === delays.length) throw error;
    }
  }
};

// --- API Functions ---

const callGeminiForAnswer = async (query, contextText) => {
  // NOTE: System Prompt is NOT here. It is injected on the server.
  
  const userPrompt = `
  --- SOURCE MATERIAL / CONTEXT ---
  ${contextText ? contextText.substring(0, 30000) : "No source material provided."}
  ---------------------------------

  User Question: ${query}
  
  Answer based STRICTLY on the source material above:
  `;

  // We only send the user prompt. The system instructions are added in the backend.
  const payload = {
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  };

  try {
    const result = await fetchGeminiProxy(payload, 'text');
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(jsonText);
  } catch (e) {
    console.error("Gemini Text Error", e);
    return {
      text: "I'm sorry, I couldn't generate a response. Please ensure the backend is configured correctly.",
      mindMap: null
    };
  }
};

const callGeminiTTS = async (text) => {
  const payload = {
    contents: [{ parts: [{ text: text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Aoede" }
        }
      }
    }
  };

  try {
    const result = await fetchGeminiProxy(payload, 'tts');
    const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (audioData) {
      const binaryString = window.atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: 'audio/wav' });
    }
    return null;
  } catch (e) {
    console.error("Gemini TTS Error", e);
    return null;
  }
};

const callGeminiSummarize = async (text) => {
  const payload = {
    contents: [{ parts: [{ text: `Summarize the following text into 3-4 distinct bullet points of key takeaways:\n\n${text.substring(0, 10000)}` }] }]
  };
  try {
    const result = await fetchGeminiProxy(payload, 'text');
    return result.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) {
    return "Could not generate summary.";
  }
};


// --- Components ---

// 1. Mind Map Renderer (SVG Based)
const MindMapNode = ({ node, x, y, onToggle }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isCode = node.type === 'code';
  
  // Dynamic width calculation
  const charWidth = isCode ? 7.5 : 7; // Approx width per char
  const padding = 30;
  const minWidth = 140;
  const calculatedWidth = Math.max(minWidth, (node.label.length * charWidth) + padding);
  
  // Center offset
  const xOffset = -(calculatedWidth / 2);

  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x={xOffset}
        y={-25}
        width={calculatedWidth}
        height={50}
        rx={isCode ? 4 : 12}
        fill={node.type === 'root' ? COLORS.primary : (isCode ? COLORS.codeBg : COLORS.card)}
        stroke={node.type === 'root' ? 'none' : (isCode ? COLORS.codeText : COLORS.primary)}
        strokeWidth={isCode ? 1 : 2}
        strokeDasharray={isCode ? "0" : "0"}
        className={`shadow-sm transition-all duration-300 ${hasChildren ? 'cursor-pointer hover:stroke-indigo-400' : ''}`}
        filter="drop-shadow(0px 4px 4px rgba(0,0,0,0.05))"
        onClick={(e) => {
          if (hasChildren) {
             e.stopPropagation();
             onToggle(node.id);
          }
        }}
      />
      <foreignObject x={xOffset + 5} y={-20} width={calculatedWidth - 10} height={40} className="pointer-events-none">
        <div className={`flex items-center justify-center h-full px-2 text-xs font-medium text-center leading-tight 
          ${node.type === 'root' ? 'text-white' : (isCode ? 'text-slate-100 font-mono' : 'text-slate-700')}`}>
          {node.label}
        </div>
      </foreignObject>

      {/* Collapse/Expand Toggle Button */}
      {hasChildren && (
        <g 
          transform={`translate(${(-xOffset) + 12}, 0)`} // Position relative to dynamic width
          className="cursor-pointer hover:opacity-80"
          onClick={(e) => {
             e.stopPropagation();
             onToggle(node.id);
          }}
        >
          <circle cx="0" cy="0" r="10" fill={COLORS.bg} stroke={COLORS.primary} strokeWidth="2" />
          <text 
            x="0" 
            y="3.5" 
            textAnchor="middle" 
            fill={COLORS.primary} 
            fontSize="14" 
            fontWeight="bold"
            style={{ select: 'none', userSelect: 'none' }}
          >
            {node.isCollapsed ? '+' : '-'}
          </text>
        </g>
      )}
    </g>
  );
};

const MindMapRenderer = ({ data }) => {
  const [collapsed, setCollapsed] = useState(new Set());

  useEffect(() => {
    const initialCollapsed = new Set();
    const collapseRecursively = (node) => {
      if (node.children && node.children.length > 0) {
        if (node.id !== data.id) {
          initialCollapsed.add(node.id);
        }
        node.children.forEach(collapseRecursively);
      }
    };
    if (data) {
      collapseRecursively(data);
    }
    setCollapsed(initialCollapsed);
  }, [data]);

  const handleToggle = (id) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const calculateLayout = (root, collapsedSet) => {
    let nodes = [];
    let edges = [];
    const getLeafCount = (node) => {
      if (collapsedSet.has(node.id)) return 1;
      if (!node.children || node.children.length === 0) return 1;
      return node.children.reduce((acc, child) => acc + getLeafCount(child), 0);
    };

    let currentLeafY = 0;
    const X_GAP = 300;
    const Y_GAP = 80;

    const assignCoords = (node, depth) => {
      const isCollapsed = collapsedSet.has(node.id);
      const processedNode = { ...node, depth, isCollapsed };
      
      if (isCollapsed || !processedNode.children || processedNode.children.length === 0) {
        processedNode.x = depth * X_GAP + 100;
        processedNode.y = currentLeafY * Y_GAP + 50;
        currentLeafY++;
        return processedNode;
      }

      processedNode.children = processedNode.children.map(child => assignCoords(child, depth + 1));
      const firstChildY = processedNode.children[0].y;
      const lastChildY = processedNode.children[processedNode.children.length - 1].y;
      processedNode.x = depth * X_GAP + 100;
      processedNode.y = (firstChildY + lastChildY) / 2;
      return processedNode;
    };

    const layoutRoot = assignCoords(JSON.parse(JSON.stringify(root)), 0); 

    const collect = (node) => {
      const isCode = node.type === 'code';
      const charWidth = isCode ? 7.5 : 7;
      const width = Math.max(140, (node.label.length * charWidth) + 30);
      const halfWidth = width / 2;
      node.halfWidth = halfWidth;
      nodes.push(node);

      if (!node.isCollapsed && node.children) {
        node.children.forEach(child => {
          const childIsCode = child.type === 'code';
          const childCharWidth = childIsCode ? 7.5 : 7;
          const childWidth = Math.max(140, (child.label.length * childCharWidth) + 30);
          const childHalfWidth = childWidth / 2;

          edges.push({
            x1: node.x + halfWidth, 
            y1: node.y,
            x2: child.x - childHalfWidth, 
            y2: child.y
          });
          collect(child);
        });
      }
    };
    collect(layoutRoot);
    
    const maxX = nodes.reduce((max, n) => Math.max(max, n.x + (n.halfWidth || 70)), 0);
    const maxY = nodes.reduce((max, n) => Math.max(max, n.y), 0);

    return { 
        nodes, edges, width: Math.max(800, maxX + 200), height: Math.max(600, maxY + 200) 
    };
  };

  const { nodes, edges, width, height } = useMemo(() => calculateLayout(data, collapsed), [data, collapsed]);

  return (
    <div className="w-full h-full overflow-auto bg-slate-50 relative flex items-center justify-center">
      <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur p-2 rounded-lg shadow border border-slate-200 text-xs text-slate-500">
        <p>Interactive Mind Map • Code nodes show full commands</p>
      </div>
      <svg width={width} height={height} className="mx-auto my-auto min-w-full min-h-full transition-all duration-500 ease-in-out">
        {edges.map((edge, i) => (
          <path
            key={`edge-${i}`}
            d={`M ${edge.x1} ${edge.y1} C ${(edge.x1 + edge.x2) / 2} ${edge.y1}, ${(edge.x1 + edge.x2) / 2} ${edge.y2}, ${edge.x2} ${edge.y2}`}
            stroke={COLORS.line}
            strokeWidth="2"
            fill="none"
            className="transition-all duration-500"
          />
        ))}
        {nodes.map((node) => (
          <MindMapNode key={node.id} node={node} x={node.x} y={node.y} onToggle={handleToggle} />
        ))}
      </svg>
    </div>
  );
};


// 2. Chat Message Bubble
const ChatMessage = ({ message, onGenerateMindMap }) => {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef(null);

  const handlePlayAudio = async () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (audioUrl) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }
    setIsLoadingAudio(true);
    // Calls the proxy function
    const blob = await callGeminiTTS(message.content);
    if (blob) {
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setIsLoadingAudio(false);
      setTimeout(() => {
        if(audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
        }
      }, 100);
    } else {
      setIsLoadingAudio(false);
    }
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 mx-2 ${isUser ? 'bg-indigo-600' : 'bg-emerald-500'}`}>
          {isUser ? <User size={16} className="text-white" /> : <Sparkles size={16} className="text-white" />}
        </div>
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isUser 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
          }`}>
            {message.content}
            <audio 
                ref={audioRef} 
                src={audioUrl || ""} 
                onEnded={() => setIsPlaying(false)}
                className="hidden"
            />
          </div>
          {!isUser && (
            <div className="flex gap-2 mt-2">
                {message.mindMapData && (
                    <button
                    onClick={() => onGenerateMindMap(message.mindMapData)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full hover:bg-indigo-100 transition-colors border border-indigo-200"
                    >
                    <Network size={14} />
                    Generate Mindmap
                    </button>
                )}
                <button
                    onClick={handlePlayAudio}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-semibold rounded-full hover:bg-slate-100 transition-colors border border-slate-200"
                >
                    {isLoadingAudio ? <Loader2 size={14} className="animate-spin"/> : isPlaying ? <StopCircle size={14}/> : <Volume2 size={14} />}
                    {isPlaying ? "Stop" : "Listen"}
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// 3. Main App Layout
export default function MindMapApp() {
  const [activeTab, setActiveTab] = useState('chat');
  const [sourceText, setSourceText] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, role: 'system', content: 'Hello! I am your AI research assistant. Upload a PDF or paste notes in the "Knowledge Base" tab, then ask me anything.' }
  ]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeMindMap, setActiveMindMap] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!currentQuery.trim()) return;

    const userMsg = { id: Date.now(), role: 'user', content: currentQuery };
    setMessages(prev => [...prev, userMsg]);
    setCurrentQuery('');
    setIsTyping(true);

    // Call Proxy Function
    const response = await callGeminiForAnswer(userMsg.content, sourceText);
    
    const aiMsg = { 
        id: Date.now() + 1, 
        role: 'assistant', 
        content: response.text,
        mindMapData: response.mindMap
    };
    
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        setSourceText(prev => prev + `\n\n--- Imported from ${file.name} ---\n\n` + text);
        setActiveTab('knowledge');
      };
      reader.readAsText(file); 
    }
  };

  const handleSummarize = async () => {
    if (!sourceText) return;
    setIsSummarizing(true);
    const summary = await callGeminiSummarize(sourceText);
    setSourceText(prev => `*** AI SUMMARY ***\n${summary}\n\n` + prev);
    setIsSummarizing(false);
  }

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <div className="w-16 bg-slate-900 flex flex-col items-center py-6 gap-6 z-20 shadow-xl">
        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <BrainCircuit className="text-white" size={24} />
        </div>
        <div className="flex-1 flex flex-col gap-4 mt-8">
          <button 
            onClick={() => { setActiveTab('chat'); setActiveMindMap(null); }}
            className={`p-3 rounded-xl transition-all ${activeTab === 'chat' && !activeMindMap ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
            title="Chat"
          >
            <MessageSquare size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('knowledge')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'knowledge' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
            title="Knowledge Base"
          >
            <FileText size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex relative">
        <div className={`flex flex-col h-full bg-white transition-all duration-300 border-r border-slate-200 ${activeMindMap ? 'w-1/3' : 'w-full max-w-3xl mx-auto border-x'}`}>
          <div className="h-16 border-b border-slate-100 flex items-center px-6 justify-between shrink-0">
            <h2 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
              {activeTab === 'chat' ? 'Gemini Assistant' : 'Knowledge Base'}
              {activeTab === 'chat' && <Sparkles size={16} className="text-emerald-500" />}
            </h2>
            {activeTab === 'chat' && (
              <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded flex items-center gap-1">
                <Bot size={12}/> Gemini 2.5 Flash
              </span>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'knowledge' && (
              <div className="h-full flex flex-col p-6">
                <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex items-start gap-3">
                  <div className="mt-1 text-indigo-500"><UploadCloud size={20}/></div>
                  <div className="text-sm text-indigo-900">
                    <p className="font-semibold">Contextual Knowledge</p>
                    <p className="opacity-80 mt-1">Paste your notes or upload files.</p>
                  </div>
                </div>
                <div className="mb-4 px-4 py-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3">
                  <div className="mt-0.5 text-amber-500"><ShieldAlert size={18}/></div>
                  <div className="text-xs text-amber-900">
                    <p className="font-bold">Privacy Note:</p>
                    <p className="opacity-90 leading-relaxed">
                      Content uploaded here is sent to Google's AI for processing. 
                      <b> Do not upload</b> highly sensitive personal data.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-sm font-medium transition-colors"
                    >
                        <Paperclip size={16} />
                        Upload File
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileUpload}
                        accept=".txt,.md,.pdf" 
                    />
                  </div>
                  {sourceText && (
                      <button 
                        onClick={handleSummarize}
                        disabled={isSummarizing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors"
                      >
                        {isSummarizing ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                        {isSummarizing ? "Summarizing..." : "AI Summarize"}
                      </button>
                  )}
                </div>
                <textarea
                  className="flex-1 w-full p-4 rounded-lg border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-sm leading-relaxed"
                  placeholder="Paste your knowledge text here..."
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                  {messages.map((msg) => (
                    <ChatMessage 
                      key={msg.id} 
                      message={msg} 
                      onGenerateMindMap={(data) => setActiveMindMap(data)}
                    />
                  ))}
                  {isTyping && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm ml-12">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Gemini is thinking...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-slate-100 bg-white">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border-transparent focus:bg-white border focus:border-indigo-300 rounded-full outline-none transition-all shadow-sm text-sm"
                      placeholder="Ask about your documents..."
                      value={currentQuery}
                      onChange={(e) => setCurrentQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!currentQuery.trim() || isTyping}
                      className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {activeMindMap && (
          <div className="flex-1 h-full bg-slate-50 relative animate-in fade-in slide-in-from-right-10 duration-300">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              <button 
                onClick={() => setActiveMindMap(null)}
                className="p-2 bg-white/90 backdrop-blur rounded-full shadow-sm hover:bg-slate-100 text-slate-500 transition-colors border border-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="w-full h-full">
              <MindMapRenderer data={activeMindMap} />
            </div>
            <div className="absolute bottom-6 right-6 max-w-xs bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-200 pointer-events-none">
              <h4 className="font-semibold text-slate-800 text-sm mb-2 flex items-center gap-2">
                <Layout size={14} /> 
                Visualization Mode
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                This mind map is dynamically generated by Gemini. Dark nodes indicate <b>commands</b> or code snippets.
              </p>
            </div>
          </div>
        )}
        
        {!activeMindMap && (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-50/50">
             <div className="text-center p-8 opacity-40">
               <Network size={48} className="mx-auto mb-4 text-slate-400" />
               <p className="text-lg font-medium text-slate-600">No Mindmap Active</p>
               <p className="text-sm text-slate-500">Ask a question and click "Generate Mindmap" to visualize concepts.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}