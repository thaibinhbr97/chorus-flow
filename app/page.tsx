'use client';

import { LyricsView } from '@/components/LyricsView';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Mic, Music, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface TrackInfo {
    name: string;
    artist: string;
    album: string;
    durationMs: number;
    playOffsetMs: number;
    sampleDurationMs?: number;
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

    // Ref to track the start time of the song (local timestamp when song started)
    const songStartRef = useRef<number | null>(null);
    const detectionLoopRef = useRef<boolean>(false);

    // Start/Stop Detection
    const toggleDetection = () => {
        if (isDetecting) {
            // Stop
            setIsDetecting(false);
            detectionLoopRef.current = false;
            setTrack(null);
            setLyrics([]);
            songStartRef.current = null;
            setStatusMessage('Ready to detect');
        } else {
            // Start
            setIsDetecting(true);
            detectionLoopRef.current = true;
            runDetectionLoop();
        }
    };

    // Continuous Detection Loop
    const runDetectionLoop = async () => {
        if (!detectionLoopRef.current) return;

        let foundTrack = false;

        try {
            setStatusMessage(track ? 'Syncing...' : 'Listening...');

            // 1. Record Audio
            await startRecording();
            // Record for 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));
            const audioBlob = await stopRecording();
            const recordingEndTime = Date.now(); // Capture end time

            if (!detectionLoopRef.current) return; // Check if stopped during recording

            setStatusMessage('Identifying...');

            // 2. Send to API
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

                // Update Lyrics if changed or empty
                if (data.lyrics && data.lyrics.syncedLyrics) {
                    const parsed = parseLrc(data.lyrics.syncedLyrics);
                    setLyrics(parsed);
                } else if (data.lyrics && Array.isArray(data.lyrics)) {
                    // Search result might be different
                }

                // Sync Time Logic
                // We anchor to the END of the recording (recordingEndTime).
                // If lyrics are too fast, we need to subtract LESS.
                // We assume playOffsetMs is close to the end time or we simply need to delay.

                const estimatedSongStart = recordingEndTime - data.track.playOffsetMs;

                if (!songStartRef.current) {
                    songStartRef.current = estimatedSongStart;
                } else {
                    const drift = estimatedSongStart - songStartRef.current;

                    // If drift is small (< 3s), smooth it out
                    if (Math.abs(drift) < 3000) {
                        // Apply 30% of the drift to avoid jumping
                        songStartRef.current += drift * 0.3;
                    } else {
                        // Hard reset for large jumps
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
            // Loop ONLY if we haven't found a track yet (Lock & Play mode)
            // If we found a track, we stop the loop and let the local timer handle the lyrics.
            if (detectionLoopRef.current && !foundTrack) {
                // Wait a bit before next loop to avoid spamming
                setTimeout(runDetectionLoop, 1000);
            } else if (foundTrack) {
                // Stop the loop ref, but keep isDetecting true so UI stays open
                detectionLoopRef.current = false;
                setStatusMessage('Locked');
            }
        }
    };

    // Re-sync function
    const handleResync = () => {
        setTrack(null);
        setLyrics([]);
        songStartRef.current = null;
        detectionLoopRef.current = true;
        runDetectionLoop();
    };

    // Timer for smooth UI updates & Auto-restart
    useEffect(() => {
        let animationFrameId: number;

        const updateTime = () => {
            if (songStartRef.current && isDetecting && track) {
                const now = Date.now();
                const newTime = (now - songStartRef.current) / 1000;
                setCurrentTime(newTime);

                // Auto-restart if song is over (with 2s buffer)
                if (newTime > (track.durationMs / 1000) + 2) {
                    console.log('Song finished, restarting detection...');
                    handleResync();
                }
            }
            animationFrameId = requestAnimationFrame(updateTime);
        };

        if (isDetecting && track) {
            updateTime();
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isDetecting, track]);

    // Helper to parse LRC
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
        <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white overflow-hidden relative">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 pointer-events-none" />

            <AnimatePresence mode="wait">
                {!isDetecting ? (
                    <motion.div
                        key="landing"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="z-10 flex flex-col items-center gap-8"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                            Chorus Flow
                        </h1>
                        <p className="text-gray-400 text-lg max-w-md text-center">
                            Tap to identify music and sing along with synchronized lyrics.
                        </p>

                        <button
                            onClick={toggleDetection}
                            className="group relative flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-purple-500/30 transition-transform hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping group-hover:animate-none" />
                            <Mic className="w-12 h-12 text-white" />
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="detecting"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="z-10 w-full h-screen flex flex-col"
                    >
                        {/* Header */}
                        <header className="flex items-center justify-between p-6 bg-black/50 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex items-center gap-4">
                                {track ? (
                                    <div className="flex flex-col">
                                        <h2 className="text-xl font-bold text-white leading-tight">{track.name}</h2>
                                        <p className="text-sm text-gray-400">{track.artist} • {track.album}</p>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>{statusMessage}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {track && (
                                    <button
                                        onClick={handleResync}
                                        className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
                                    >
                                        Re-sync
                                    </button>
                                )}
                                <button
                                    onClick={toggleDetection}
                                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-6 h-6 text-white" />
                                </button>
                            </div>
                        </header>

                        {/* Lyrics Area */}
                        <div className="flex-1 overflow-hidden relative">
                            {track ? (
                                <LyricsView lyrics={lyrics} currentTime={currentTime} />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                                        <Music className="w-16 h-16 relative z-10" />
                                    </div>
                                    <p>Listening for music...</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
