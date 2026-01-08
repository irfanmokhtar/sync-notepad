import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

// Generate a random 6-character code
function generateSessionCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0/O, 1/I
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export default function Home() {
    const router = useRouter();
    const [sessionCode, setSessionCode] = useState<string | null>(null);
    const [joinCode, setJoinCode] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState('Connecting...');
    const [copied, setCopied] = useState(false);
    const channelRef = useRef<any>(null);

    // Check URL for session code on mount
    useEffect(() => {
        if (router.isReady) {
            const urlSession = router.query.session as string;
            if (urlSession) {
                setSessionCode(urlSession.toUpperCase());
            }
        }
    }, [router.isReady, router.query.session]);

    // Connect to Supabase channel when sessionCode is set
    useEffect(() => {
        if (!sessionCode) return;

        const channel = supabase.channel(`room-${sessionCode}`, {
            config: {
                broadcast: { self: false },
            },
        });

        channel
            .on('broadcast', { event: 'text-update' }, (payload) => {
                if (payload.payload && payload.payload.message !== undefined) {
                    setContent(payload.payload.message);
                }
            })
            .subscribe((status, err) => {
                console.log('Supabase subscription status:', status, err);
                if (status === 'SUBSCRIBED') {
                    setStatus('Connected');
                } else if (status === 'CLOSED') {
                    setStatus('Disconnected');
                } else if (status === 'CHANNEL_ERROR') {
                    setStatus('Error');
                } else if (status === 'TIMED_OUT') {
                    setStatus('Timed Out');
                }
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionCode]);

    const handleChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);

        if (channelRef.current && status === 'Connected') {
            channelRef.current.send({
                type: 'broadcast',
                event: 'text-update',
                payload: { message: val },
            });
        }
    };

    const handleCreateSession = () => {
        const code = generateSessionCode();
        setSessionCode(code);
        // Update URL without reload
        router.push(`/?session=${code}`, undefined, { shallow: true });
    };

    const handleJoinSession = () => {
        if (joinCode.trim().length >= 4) {
            const code = joinCode.trim().toUpperCase();
            setSessionCode(code);
            router.push(`/?session=${code}`, undefined, { shallow: true });
        }
    };

    const handleCopyLink = () => {
        const url = `${window.location.origin}/?session=${sessionCode}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLeaveSession = () => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }
        setSessionCode(null);
        setContent('');
        setStatus('Connecting...');
        router.push('/', undefined, { shallow: true });
    };

    // Lobby Screen
    if (!sessionCode) {
        return (
            <div className="lobby-container">
                <div className="lobby-card">
                    <h1>Sync Notepad</h1>
                    <p>Create a private session or join an existing one.</p>

                    <button className="btn btn-create" onClick={handleCreateSession}>
                        Create New Session
                    </button>

                    <div className="divider">or</div>

                    <div className="join-form">
                        <input
                            type="text"
                            placeholder="Enter session code"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            maxLength={6}
                        />
                        <button
                            className="btn btn-join"
                            onClick={handleJoinSession}
                            disabled={joinCode.trim().length < 4}
                        >
                            Join
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Notepad Screen
    return (
        <div className="container">
            <main>
                <textarea
                    value={content}
                    onChange={handleChange}
                    placeholder={status === 'Connected' ? "Start typing..." : "Waiting for connection..."}
                    spellCheck={false}
                    disabled={status !== 'Connected'}
                />
                <header>
                    <div className="session-info">
                        <span className="session-code">{sessionCode}</span>
                        <button className="btn-icon" onClick={handleCopyLink} title="Copy link">
                            {copied ? '✓' : '🔗'}
                        </button>
                        <button className="btn-icon btn-leave" onClick={handleLeaveSession} title="Leave session">
                            ✕
                        </button>
                    </div>
                    <span className={`status ${status.toLowerCase().replace(/[^a-z]/g, '')}`}>{status}</span>
                </header>
            </main>
        </div>
    );
}
