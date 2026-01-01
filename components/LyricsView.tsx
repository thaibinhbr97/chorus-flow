import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface LyricLine {
    time: number;
    text: string;
}

interface LyricsViewProps {
    lyrics: LyricLine[];
    currentTime: number;
}

export function LyricsView({ lyrics, currentTime }: LyricsViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const activeIndex = lyrics.reduce((acc, line, index) => {
        if (line.time <= currentTime) {
            return index;
        }
        return acc;
    }, -1);

    useEffect(() => {
        if (activeIndex >= 0 && containerRef.current) {
            const container = containerRef.current;
            const activeLine = container.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement;

            if (activeLine) {
                const containerHeight = container.clientHeight;
                const activeLineHeight = activeLine.clientHeight;
                const activeLineTop = activeLine.offsetTop;

                const targetScrollTop = activeLineTop - (containerHeight / 2) + (activeLineHeight / 2);

                container.scrollTo({
                    top: targetScrollTop,
                    behavior: 'smooth'
                });
            }
        }
    }, [activeIndex]);

    return (
        <div
            ref={containerRef}
            className={clsx(
                "w-full h-full overflow-y-auto px-6 no-scrollbar scroll-smooth relative",
                lyrics.length > 0 ? "py-32" : ""
            )}
        >
            <div className={clsx(
                "flex flex-col gap-12 items-center text-center max-w-4xl mx-auto",
                lyrics.length === 0 ? "h-full justify-center" : ""
            )}>
                <AnimatePresence mode="popLayout">
                    {lyrics.map((line, index) => {
                        const isActive = index === activeIndex;
                        const isPast = index < activeIndex;
                        const isNext = index === activeIndex + 1;

                        return (
                            <motion.div
                                key={index}
                                data-index={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{
                                    opacity: isActive ? 1 : isPast ? 0.2 : isNext ? 0.8 : 0.1,
                                    scale: isActive ? 1.05 : 1,
                                    filter: isActive ? 'blur(0px)' : isNext ? 'blur(0.5px)' : 'blur(2px)',
                                    y: 0
                                }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 100,
                                    damping: 20,
                                    opacity: { duration: 0.4 }
                                }}
                                className={clsx(
                                    "text-3xl md:text-5xl font-bold transition-all duration-500 cursor-default tracking-tight leading-tight",
                                    isActive ? "text-white drop-shadow-[0_0_20px_rgba(99,102,241,0.5)]" : "text-gray-500"
                                )}
                            >
                                {line.text}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                {lyrics.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-4 text-gray-500"
                    >
                        <p className="text-xl font-medium">Lyrics are on their way...</p>
                        <p className="text-sm">We're syncing the words to the beat</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
