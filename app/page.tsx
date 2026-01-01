'use client';

import { LyricsView } from '@/components/LyricsView';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Mic, Music, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface TrackInfo {
    name: string;
    artist: string;
    album: string;
    durationMs: number;
    playOffsetMs: number;
    sampleDurationMs?: number;
    score?: number;
}

interface LyricLine {
    time: number;
    text: string;
}

export default function Home() {
    const { startRecording, stopRecording } = useAudioRecorder();
    const [isDetecting, setIsDetecting] = useState(false);
    const [track, setTrack] = useState<TrackInfo | null>(null);
    const [lyrics, setLyrics] = useState<LyricLine[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [statusMessage, setStatusMessage] = useState('Ready to detect');

    const songStartRef = useRef<number | null>(null);
    const detectionLoopRef = useRef<boolean>(false);

    const toggleDetection = () => {
        if (isDetecting) {
            setIsDetecting(false);
            detectionLoopRef.current = false;
            setTrack(null);
            setLyrics([]);
            songStartRef.current = null;
            setStatusMessage('Ready to detect');
        } else {
            setIsDetecting(true);
            detectionLoopRef.current = true;
            runDetectionLoop();
        }
    };

    const runDetectionLoop = useCallback(async () => {
        if (!detectionLoopRef.current) return;

        let foundTrack = false;

        try {
            setStatusMessage(track ? 'Syncing...' : 'Listening...');

            await startRecording();
            await new Promise(resolve => setTimeout(resolve, 12000));
            const audioBlob = await stopRecording();
            const recordingEndTime = Date.now();

            if (!detectionLoopRef.current) return;

            setStatusMessage('Identifying...');

            const formData = new FormData();
            formData.append('sample', audioBlob);

            const response = await fetch('/api/identify', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.identified && data.track) {
                foundTrack = true;
                setTrack(data.track);

                if (data.lyrics && data.lyrics.syncedLyrics) {
                    const parsed = parseLrc(data.lyrics.syncedLyrics);
                    setLyrics(parsed);
                }

                const estimatedSongStart = recordingEndTime - data.track.playOffsetMs;

                if (!songStartRef.current) {
                    songStartRef.current = estimatedSongStart;
                } else {
                    const drift = estimatedSongStart - songStartRef.current;
                    if (Math.abs(drift) < 3000) {
                        songStartRef.current += drift * 0.3;
                    } else {
                        songStartRef.current = estimatedSongStart;
                    }
                }

                const now = Date.now();
                const offsetSeconds = (now - songStartRef.current) / 1000;
                setCurrentTime(offsetSeconds);
            } else {
                if (!track) {
                    setStatusMessage('No match found. Retrying...');
                }
            }

        } catch (error) {
            console.error('Detection loop error:', error);
            setStatusMessage('Error. Retrying...');
        } finally {
            if (detectionLoopRef.current && !foundTrack) {
                setTimeout(runDetectionLoop, 1000);
            } else if (foundTrack) {
                detectionLoopRef.current = false;
                setStatusMessage('Locked');
            }
        }
    }, [startRecording, stopRecording, track]);

    const handleResync = useCallback(() => {
        setTrack(null);
        setLyrics([]);
        songStartRef.current = null;
        detectionLoopRef.current = true;
        runDetectionLoop();
    }, [runDetectionLoop]);

    useEffect(() => {
        let animationFrameId: number;

        const updateTime = () => {
            if (songStartRef.current && isDetecting && track) {
                const now = Date.now();
                const newTime = (now - songStartRef.current) / 1000;
                setCurrentTime(newTime);

                if (newTime > (track.durationMs / 1000) + 2) {
                    handleResync();
                }
            }
            animationFrameId = requestAnimationFrame(updateTime);
        };

        if (isDetecting && track) {
            updateTime();
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isDetecting, track, handleResync]);

    const parseLrc = (lrc: string): LyricLine[] => {
        if (!lrc) return [];
        const lines = lrc.split('\n');
        const result: LyricLine[] = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

        for (const line of lines) {
            const match = line.match(timeRegex);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = parseInt(match[3]);
                const time = minutes * 60 + seconds + milliseconds / 100;
                const text = line.replace(timeRegex, '').trim();
                if (text) {
                    result.push({ time, text });
                }
            }
        }
        return result;
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center overflow-hidden relative bg-aurora">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <AnimatePresence mode="wait">
                {!isDetecting ? (
                    <motion.div
                        key="landing"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="z-10 flex flex-col items-center gap-12 px-6"
                    >
                        <div className="flex flex-col items-center gap-4">
                            <motion.div
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-medium tracking-wider text-primary uppercase"
                            >
                                <Sparkles className="w-3 h-3" />
                                AI-Powered Music Recognition
                            </motion.div>
                            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-gradient text-center">
                                Chorus Flow
                            </h1>
                            <p className="text-gray-400 text-lg md:text-xl max-w-md text-center font-light leading-relaxed">
                                Experience music in a new dimension. Identify any song and see lyrics in real-time.
                            </p>
                        </div>

                        <button
                            onClick={toggleDetection}
                            className="group relative flex items-center justify-center w-40 h-40 rounded-full transition-all duration-500"
                        >
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-secondary opacity-20 group-hover:opacity-40 blur-2xl transition-opacity" />
                            <div className="absolute inset-0 rounded-full border border-white/10 group-hover:border-white/20 transition-colors" />
                            <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-white/5 glass group-hover:scale-110 transition-transform duration-500">
                                <Mic className="w-12 h-12 text-white group-hover:text-primary transition-colors" />
                            </div>

                            {/* Decorative Rings */}
                            <div className="absolute inset-[-10px] rounded-full border border-primary/20 animate-[spin_10s_linear_infinite]" />
                            <div className="absolute inset-[-20px] rounded-full border border-secondary/10 animate-[spin_15s_linear_infinite_reverse]" />
                        </button>

                        <div className="flex gap-8 text-gray-500 text-sm font-medium">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                High Accuracy
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                Real-time Sync
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="detecting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="z-10 w-full h-screen flex flex-col"
                    >
                        {/* Header */}
                        <header className="flex items-center justify-between p-6 glass sticky top-0 z-20 border-b border-white/5">
                            <div className="flex items-center gap-6">
                                {track ? (
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                                            <Music className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-xl font-bold text-white tracking-tight">{track.name}</h2>
                                                {track.score !== undefined && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${track.score > 80 ? 'bg-green-500/10 text-green-400' : track.score > 60 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {track.score}% Match
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-400 font-medium">{track.artist} • {track.album}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 text-gray-300">
                                        <div className="relative">
                                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                            <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
                                        </div>
                                        <span className="text-sm font-medium tracking-wide uppercase">{statusMessage}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {track && (
                                    <button
                                        onClick={handleResync}
                                        className="px-5 py-2 rounded-full glass hover:bg-white/10 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                                    >
                                        Re-sync
                                    </button>
                                )}
                                <button
                                    onClick={toggleDetection}
                                    className="p-2.5 rounded-full glass hover:bg-white/10 transition-all active:scale-90"
                                >
                                    <X className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
                                </button>
                            </div>
                        </header>

                        {/* Lyrics Area */}
                        <div className="flex-1 overflow-hidden relative">
                            {track ? (
                                <LyricsView lyrics={lyrics} currentTime={currentTime} />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-8">
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="text-xl font-medium text-white tracking-tight">Listening to your world</p>
                                        <p className="text-sm text-gray-500">Make sure the music is clear and audible</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer / Progress Bar */}
                        {track && (
                            <div className="p-6 glass border-t border-white/5">
                                <div className="max-w-3xl mx-auto flex items-center gap-4 text-xs font-medium text-gray-400 tabular-nums">
                                    <span>{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>
                                    <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white rounded-full"
                                            style={{
                                                width: `${Math.min(100, Math.max(0, (currentTime / (track.durationMs / 1000)) * 100))}%`
                                            }}
                                        />
                                    </div>
                                    <span>{new Date(track.durationMs).toISOString().substr(14, 5)}</span>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
