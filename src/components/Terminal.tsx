"use client";

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalComponentProps {
    host: string;
    user: string;
    encodedPass: string;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({ host, user, encodedPass }) => {
    const [isConnected, setIsConnected] = React.useState(true);
    const [retryCount, setRetryCount] = React.useState(0);
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const esRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        setIsConnected(true);

        // Initialize xterm.js if not already done
        if (!xtermRef.current) {
            const term = new Terminal({
                cursorBlink: true,
                fontSize: 12,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                theme: {
                    background: '#050505',
                    foreground: '#cccccc',
                    black: '#000000',
                    red: '#c0392b',
                    green: '#27ae60',
                    yellow: '#f1c40f',
                    blue: '#2980b9',
                    magenta: '#8e44ad',
                    cyan: '#16a085',
                    white: '#bdc3c7',
                    brightBlack: '#7f8c8d',
                    brightRed: '#e74c3c',
                    brightGreen: '#2ecc71',
                    brightYellow: '#f39c12',
                    brightBlue: '#3498db',
                    brightMagenta: '#9b59b6',
                    brightCyan: '#1abc9c',
                    brightWhite: '#ecf0f1'
                }
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);

            term.open(terminalRef.current);
            fitAddon.fit();

            xtermRef.current = term;
            fitAddonRef.current = fitAddon;

            // Handle Input
            term.onData((data) => {
                // strict check against esRef.current.readyState if needed, but for now just send
                fetch('/api/ssh/input', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ host, user, data })
                }).catch(console.error);
            });
        }

        const term = xtermRef.current!;
        const fitAddon = fitAddonRef.current!;

        // Connect to SSE Stream
        // Add timestamp to force new connection on retry
        const es = new EventSource(`/api/ssh/stream?host=${host}&user=${user}&password=${encodedPass}&t=${Date.now()}`);
        esRef.current = es;

        term.write('\x1b[2J\x1b[H'); // Clear screen
        term.write(`\x1b[32mConnecting to ${user}@${host}...\x1b[0m\r\n`);

        es.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'output') {
                    term.write(payload.data);
                } else if (payload.type === 'error') {
                    term.write(`\r\n\x1b[31mError: ${payload.data}\x1b[0m\r\n`);
                } else if (payload.type === 'exit') {
                    term.write('\r\n\x1b[33mConnection closed by remote host.\x1b[0m\r\n');
                    setIsConnected(false);
                    es.close();
                }
            } catch (e) {
                console.error("Parse Error:", e);
            }
        };

        es.onerror = (err) => {
            console.error('SSE Error:', err);
            // Don't show error if we manually closed it or if it's just a disconnect
            if (es.readyState !== EventSource.CLOSED) {
                term.write('\r\n\x1b[31mConnection lost.\x1b[0m\r\n');
                setIsConnected(false);
                es.close();
            }
        };

        const handleResize = () => {
            fitAddon.fit();
            const { cols, rows } = term;
            fetch('/api/ssh/input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, user, cols, rows })
            }).catch(console.error);
        };

        // ResizeObserver for container resize
        const resizeObserver = new ResizeObserver(() => {
            // requestAnimationFrame(() => fitAddon.fit()); 
            // Logic simplified to avoid loop, handleResize calls fit()
            handleResize();
        });
        resizeObserver.observe(terminalRef.current);

        // Initial fit
        setTimeout(handleResize, 100);

        return () => {
            resizeObserver.disconnect();
            es.close();
            // We do NOT dispose the terminal instance itself to keep text visible
            // But we can clear refs if we want to rebuild. 
            // Here we keep xterm instance alive to show history.
        };
    }, [host, user, encodedPass, retryCount]);

    return (
        <div className="w-full h-full p-2 bg-[#050505] overflow-hidden relative group">
            <div ref={terminalRef} className={`w-full h-full transition-opacity duration-300 ${!isConnected ? 'opacity-50 blur-[1px]' : ''}`} />

            {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-zinc-900/90 border border-white/10 p-6 rounded-2xl backdrop-blur-md shadow-2xl flex flex-col items-center gap-4 transform transition-all scale-100">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
                            <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h3 className="text-white font-bold text-sm">Session Ended</h3>
                            <p className="text-zinc-500 text-xs mt-1">The remote host closed the connection.</p>
                        </div>
                        <button
                            onClick={() => setRetryCount(c => c + 1)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-xs font-bold hover:bg-zinc-200 transition-colors mt-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reconnect Session
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TerminalComponent;
