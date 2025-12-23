import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface LyricLine {
    time: number; // in seconds
    text: string;
}

interface LyricsViewProps {
    lyrics: LyricLine[];
    currentTime: number; // in seconds
}

export function LyricsView({ lyrics, currentTime }: LyricsViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const activeLineRef = useRef<HTMLDivElement>(null);

    // Find the index of the current line
    // The current line is the last line whose time is <= currentTime
    const activeIndex = lyrics.reduce((acc, line, index) => {
        if (line.time <= currentTime) {
            return index;
        }
        return acc;
    }, -1);

    useEffect(() => {
        if (activeIndex >= 0 && activeLineRef.current && containerRef.current) {
            const container = containerRef.current;
            const activeLine = activeLineRef.current;

            const containerHeight = container.clientHeight;
            const activeLineHeight = activeLine.clientHeight;
            const activeLineTop = activeLine.offsetTop;

            // Calculate the scroll position to center the active line
            const targetScrollTop = activeLineTop - (containerHeight / 2) + (activeLineHeight / 2);

            container.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
            });
        }
    }, [activeIndex]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-y-auto px-4 py-8 no-scrollbar scroll-smooth relative"
        >
            <div className="flex flex-col gap-6 items-center text-center">
                {lyrics.map((line, index) => {
                    const isActive = index === activeIndex;
                    const isPast = index < activeIndex;

                    return (
                        <motion.div
                            key={index}
                            ref={isActive ? activeLineRef : null}
                            initial={{ opacity: 0.5, scale: 0.95 }}
                            animate={{
                                opacity: isActive ? 1 : isPast ? 0.4 : 0.6,
                                scale: isActive ? 1.1 : 1,
                                filter: isActive ? 'blur(0px)' : 'blur(1px)',
                                color: isActive ? '#ffffff' : '#a1a1aa'
                            }}
                            transition={{ duration: 0.01 }}
                            className={clsx(
                                "text-2xl md:text-4xl font-bold transition-colors duration-300 cursor-default",
                                isActive && "text-white drop-shadow-lg"
                            )}
                        >
                            {line.text}
                        </motion.div>
                    );
                })}
                {lyrics.length === 0 && (
                    <div className="text-gray-400">No synced lyrics available</div>
                )}
            </div>
        </div>
    );
}
