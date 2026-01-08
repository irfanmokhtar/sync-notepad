
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
    const [content, setContent] = useState('');
    const [status, setStatus] = useState('Connecting...');
    const channelRef = useRef<any>(null);

    useEffect(() => {
        // 1. Subscribe to the channel
        const channel = supabase.channel('room-1', {
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
                    setStatus('Error: Check Credentials');
                } else if (status === 'TIMED_OUT') {
                    setStatus('Timed Out');
                }
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

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

    return (
        <div className="container">
            <header>
                <h1>Sync Notepad</h1>
                <div className="header-controls">
                    <span className={`status ${status.toLowerCase().replace(/[^a-z]/g, '')}`}>{status}</span>
                </div>
            </header>
            <main>
                <textarea
                    value={content}
                    onChange={handleChange}
                    placeholder={status === 'Connected' ? "Start typing..." : "Waiting for connection..."}
                    spellCheck={false}
                    disabled={status !== 'Connected'}
                />
            </main>
        </div>
    );
}

