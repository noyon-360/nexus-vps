"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageSquare, X, Send, Bot, ShieldAlert, 
    Wifi, WifiOff, Loader2, ChevronRight, 
    Terminal, Zap, Sparkles, AlertTriangle
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { connectVpsToAI, sendAiTask } from '@/app/actions/ai-expert';

const BACKEND_URL = "http://13.200.253.221:3000";

interface AIBotProps {
    vps: {
        ip: string;
        username: string;
        password?: string;
    };
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export function AIBot({ vps }: AIBotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [aiLogs, setAiLogs] = useState<string[]>([]);
    const [showWarning, setShowWarning] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const logScrollRef = useRef<HTMLDivElement>(null);

    // Track logs of current interaction to add to messages on completion
    const currentLogsRef = useRef<string[]>([]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, suggestions, isThinking, aiLogs]);

    useEffect(() => {
        if (logScrollRef.current) {
            logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
        }
    }, [aiLogs]);

    useEffect(() => {
        // Initialize Socket.io
        socketRef.current = io(BACKEND_URL);

        socketRef.current.on('status', (data) => {
            console.log('Socket Status:', data);
        });

        socketRef.current.on('ai-status', (data) => {
            if (data.status === 'Processing') {
                setIsThinking(true);
            } else if (data.status === 'Complete') {
                setIsThinking(false);
                
                // Aggregate logs into a single assistant message
                if (currentLogsRef.current.length > 0) {
                    const finalResponse = currentLogsRef.current.join('');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: finalResponse,
                        timestamp: new Date()
                    }]);
                    currentLogsRef.current = [];
                }

                if (data.suggestions) {
                    setSuggestions(data.suggestions);
                }
            }
        });

        socketRef.current.on('ai-log', (data) => {
            const output = data.output;
            setAiLogs(prev => [...prev, output]);
            currentLogsRef.current.push(output);
        });

        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const result = await connectVpsToAI({
                vps: {
                    ip: vps.ip,
                    username: vps.username,
                    password: vps.password
                }
            });

            if (result.success && result.sessionId) {
                setSessionId(result.sessionId);
                setIsConnected(true);
                setShowWarning(false);
                setMessages([{
                    role: 'assistant',
                    content: `Successfully connected to **${vps.ip}**. I am ready to help you manage this VPS.`,
                    timestamp: new Date()
                }]);
                if (result.suggestions) {
                    setSuggestions(result.suggestions);
                }
                
                // Join room for real-time updates
                socketRef.current?.emit('join', result.sessionId);
            } else {
                alert(`Connection Failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Connect error:', error);
            alert('Failed to reach NexusAI Backend via Proxy');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSendMessage = async (text: string = input) => {
        if (!text.trim() || !sessionId || isThinking) return;

        const newUserMessage: Message = {
            role: 'user',
            content: text,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setSuggestions([]);
        setAiLogs([]); // Clear real-time logs for the NEXT interaction
        currentLogsRef.current = [];
        setIsThinking(true);

        try {
            const result = await sendAiTask(sessionId, text);

            if (!result.success) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Error: ${result.error || 'Failed to process request'}`,
                    timestamp: new Date()
                }]);
                setIsThinking(false);
            }
        } catch (error) {
            console.error('AI error:', error);
            setIsThinking(false);
        }
    };

    return (
        <div className={`fixed z-[100] font-sans transition-all duration-500 ease-in-out ${
            isFullscreen 
                ? 'inset-0 p-4' 
                : 'bottom-8 right-8'
        }`}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
                        className={`${
                            isFullscreen 
                                ? 'w-full h-full rounded-[3rem]' 
                                : 'w-[400px] h-[600px] rounded-[2.5rem]'
                        } bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden transition-all duration-500`}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-brand-primary/20 flex items-center justify-center text-brand-primary relative">
                                    <Bot size={20} />
                                    {isConnected && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0a0a0a] animate-pulse"></div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">NexusAI Expert</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-zinc-500'}`}></div>
                                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                                            {isConnected ? `Connected to ${vps.ip}` : 'Waiting for Connection'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsFullscreen(!isFullscreen)}
                                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all group"
                                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
                                >
                                    {isFullscreen ? <X size={16} /> : <Zap size={16} className="group-hover:fill-brand-primary transition-all" />}
                                </button>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-grow flex flex-col relative overflow-hidden">
                            {showWarning ? (
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
                                    <div className="w-16 h-16 rounded-3xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 animate-bounce group">
                                        <AlertTriangle size={32} />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-lg font-bold text-white">Security Warning</h4>
                                        <p className="text-xs text-zinc-400 leading-relaxed">
                                            NexusAI will have full technical access to your VPS to perform maintenance, setup, and troubleshooting tasks.
                                        </p>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] text-zinc-500 text-left space-y-2 w-full">
                                        <p>• AI can execute bash commands</p>
                                        <p>• AI can modify server configurations</p>
                                        <p>• Session data is encrypted</p>
                                    </div>
                                    <button
                                        onClick={handleConnect}
                                        disabled={isConnecting}
                                        className="w-full py-4 bg-brand-primary text-black font-black uppercase text-xs rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        {isConnecting ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>Linking Systems...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Zap size={16} className="fill-current" />
                                                <span>Authorize & Connect</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Messages & Logs */}
                                    <div 
                                        ref={scrollRef}
                                        className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar"
                                    >
                                        {messages.map((msg, i) => (
                                            <div 
                                                key={i} 
                                                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                            >
                                                <div 
                                                    className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                                                        msg.role === 'user' 
                                                            ? 'bg-brand-primary text-black font-bold rounded-tr-none shadow-[0_4px_12px_rgba(246,148,77,0.2)]' 
                                                            : 'bg-white/5 text-zinc-300 border border-white/10 rounded-tl-none'
                                                    }`}
                                                >
                                                    {msg.content}
                                                </div>
                                                <span className="text-[8px] text-zinc-600 mt-1 uppercase font-bold tracking-widest px-2">
                                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        ))}

                                        {/* AI Activity Logs */}
                                        {aiLogs.length > 0 && (
                                            <div className="space-y-2 animate-in fade-in duration-500">
                                                <div className="flex items-center gap-2 px-2">
                                                    <Terminal size={10} className="text-brand-primary" />
                                                    <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Live Execution Logs</span>
                                                </div>
                                                <div 
                                                    ref={logScrollRef}
                                                    className={`bg-black border border-white/5 rounded-2xl p-4 font-mono text-[9px] text-[#00ff00]/60 overflow-y-auto custom-scrollbar transition-all ${isFullscreen ? 'max-h-80' : 'max-h-40'}`}
                                                >
                                                    {aiLogs.map((log, i) => (
                                                        <div key={i} className="mb-1 border-b border-white/[0.02] last:border-0 pb-1">
                                                            <span className="text-zinc-800 mr-2 select-none">{i+1}</span>
                                                            {log}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {isThinking && (
                                            <div className="flex items-center gap-3 animate-in fade-in duration-300">
                                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-brand-primary">
                                                    <Loader2 size={14} className="animate-spin" />
                                                </div>
                                                <div className="flex gap-1">
                                                    <div className="w-1.5 h-1.5 bg-brand-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                    <div className="w-1.5 h-1.5 bg-brand-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                    <div className="w-1.5 h-1.5 bg-brand-primary/40 rounded-full animate-bounce"></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* AI Suggestions */}
                                        {!isThinking && suggestions.length > 0 && (
                                            <div className="pt-2 animate-in fade-in duration-700">
                                                <div className="flex items-center gap-2 mb-3 px-2">
                                                    <Sparkles size={10} className="text-blue-400" />
                                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Suggestions</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {suggestions.map((s, i) => (
                                                        <button 
                                                            key={i}
                                                            onClick={() => handleSendMessage(s)}
                                                            className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all font-medium"
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Input Footer */}
                                    <div className="p-6 bg-black/40 backdrop-blur-md border-t border-white/5 shrink-0">
                                        <div className="relative group">
                                            <input 
                                                type="text"
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                                placeholder={isConnected ? "Ask NexusAI to manage your VPS..." : "Authorize connection first"}
                                                disabled={!isConnected || isThinking}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-14 py-4 text-xs text-white focus:outline-none focus:border-brand-primary/50 placeholder:text-zinc-600 transition-all disabled:opacity-50"
                                            />
                                            <div className="absolute left-4 top-4 text-zinc-600 group-focus-within:text-brand-primary transition-colors">
                                                <MessageSquare size={16} />
                                            </div>
                                            <button 
                                                onClick={() => handleSendMessage()}
                                                disabled={!isConnected || isThinking || !input.trim()}
                                                className="absolute right-2 top-2 w-10 h-10 bg-brand-primary text-black rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-0 disabled:scale-90"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Button */}
            {!isFullscreen && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-2xl transition-all duration-500 group relative ${
                        isOpen 
                            ? 'bg-white text-black' 
                            : 'bg-brand-primary text-black hover:shadow-brand-primary/30'
                    }`}
                >
                    <div className="absolute inset-0 rounded-[2rem] bg-brand-primary animate-ping opacity-20 group-hover:opacity-40"></div>
                    {isOpen ? <X size={24} /> : <Bot size={24} className="group-hover:rotate-12 transition-transform" />}
                    
                    {/* Notification Badge */}
                    {!isOpen && !isConnected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-4 border-black flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        </div>
                    )}
                </motion.button>
            )}
            
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(246, 148, 77, 0.3);
                }
            `}</style>
        </div>
    );
}
