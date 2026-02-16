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
    const [isConnected, setIsConnected] = React.useState(false);
    const [isReady, setIsReady] = React.useState(false);
    const [isInitialized, setIsInitialized] = React.useState(false);
    const [retryCount, setRetryCount] = React.useState(0);
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const esRef = useRef<EventSource | null>(null);

    const handleDisconnect = () => {
        setIsConnected(false);
        setIsReady(false); // Reset to show button
        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }
    };


    // 1. Initialize Xterm.js (Run once)
    useEffect(() => {
        if (!terminalRef.current || xtermRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
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
        setIsInitialized(true);

        // Welcome message
        term.write('\x1b[2mTerminal ready. Click "Connect" to start session.\x1b[0m\r\n');

        // Handle Input (only if connected)
        term.onData((data) => {
            if (esRef.current?.readyState !== EventSource.OPEN) return;
            fetch('/api/ssh/input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, user, data })
            }).catch(console.error);
        });

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            fitAddon.fit();
            if (esRef.current?.readyState === EventSource.OPEN) {
                const { cols, rows } = term;
                fetch('/api/ssh/input', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ host, user, cols, rows })
                }).catch(console.error);
            }
        });
        resizeObserver.observe(terminalRef.current);

        return () => {
            resizeObserver.disconnect();
            // term.dispose(); // Keep terminal to avoid unmount issues
        };
    }, []);

    // 2. Handle Connection (Run on isReady/retryCount)
    useEffect(() => {
        if (!isReady || !xtermRef.current) return;

        const term = xtermRef.current;
        const fitAddon = fitAddonRef.current!;

        setIsConnected(true);
        term.write('\x1b[2J\x1b[H'); // Clear
        term.write(`\x1b[32mConnecting to ${user}@${host}...\x1b[0m\r\n`);

        if (esRef.current) {
            esRef.current.close();
        }

        const es = new EventSource(`/api/ssh/stream?host=${host}&user=${user}&password=${encodedPass}&t=${Date.now()}`);
        esRef.current = es;

        es.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'output') {
                    term.write(payload.data);
                } else if (payload.type === 'error') {
                    term.write(`\r\n\x1b[31mError: ${payload.data}\x1b[0m\r\n`);
                } else if (payload.type === 'exit') {
                    term.write('\r\n\x1b[33mConnection closed by remote host.\x1b[0m\r\n');
                    handleDisconnect();
                }
            } catch (e) {
                console.error("Parse Error:", e);
            }
        };

        es.onerror = (err) => {
            console.error('SSE Error:', err);
            if (es.readyState !== EventSource.CLOSED) {
                term.write('\r\n\x1b[31mConnection lost.\x1b[0m\r\n');
                handleDisconnect();
            }
        };

        // Initial resize sync
        setTimeout(() => {
            fitAddon.fit();
            const { cols, rows } = term;
            fetch('/api/ssh/input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, user, cols, rows })
            }).catch(console.error);
        }, 500);

        return () => {
            es.close();
        };
    }, [isReady, retryCount, host, user, encodedPass]);

    const handleConnect = () => {
        setRetryCount(c => c + 1);
        setIsReady(true);
    };

    return (
        <div className="w-full h-full p-2 bg-[#050505] overflow-hidden relative group">
            <div ref={terminalRef} className={`w-full h-full transition-opacity duration-300 ${!isConnected ? 'opacity-50 blur-[1px]' : ''}`} />

            {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center z-10 transition-all duration-300">
                    <button
                        onClick={handleConnect}
                        className="group relative px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-mono text-sm rounded-xl border border-white/10 backdrop-blur-md shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                    >
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)] group-hover:bg-green-500 group-hover:shadow-[0_0_8px_rgba(34,197,94,0.5)] transition-all"></div>
                        <span>{isInitialized ? "Connect Terminal" : "Initialize Terminal"}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default TerminalComponent;
