import { useCallback, useRef, useState } from 'react';

export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Initialize AudioContext for processing
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioContext = new AudioContextClass();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);

            // 1. High-Pass Filter (Remove low-frequency rumble < 200Hz)
            const highPassFilter = audioContext.createBiquadFilter();
            highPassFilter.type = 'highpass';
            highPassFilter.frequency.setValueAtTime(200, audioContext.currentTime);

            // 2. Dynamics Compressor (Normalize levels)
            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
            compressor.knee.setValueAtTime(40, audioContext.currentTime);
            compressor.ratio.setValueAtTime(12, audioContext.currentTime);
            compressor.attack.setValueAtTime(0, audioContext.currentTime);
            compressor.release.setValueAtTime(0.25, audioContext.currentTime);

            // Create a destination for the processed stream
            const destination = audioContext.createMediaStreamDestination();

            // Connect: Source -> HighPass -> Compressor -> Destination
            source.connect(highPassFilter);
            highPassFilter.connect(compressor);
            compressor.connect(destination);

            // Use the processed stream for MediaRecorder
            mediaRecorderRef.current = new MediaRecorder(destination.stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            throw error;
        }
    }, []);

    const stopRecording = useCallback((): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            if (!mediaRecorderRef.current) {
                reject(new Error('No recorder instance found'));
                return;
            }

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                chunksRef.current = [];
                setIsRecording(false);

                // Cleanup
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }

                resolve(blob);
            };

            mediaRecorderRef.current.stop();
        });
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording
    };
}
