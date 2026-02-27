import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Square, X, ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Slide {
  title: string;
  points: string[];
  narration: string;
  color: "blue" | "purple" | "green" | "orange" | "pink" | "cyan";
}

interface Props {
  title: string;
  slides: Slide[];
  onClose: () => void;
}

const colorThemes: Record<string, { gradient: string; accent: string; glow: string; dot: string }> = {
  blue: { gradient: "from-[#0a1628] via-[#0d2847] to-[#0a1628]", accent: "bg-blue-500", glow: "shadow-blue-500/20", dot: "bg-blue-400" },
  purple: { gradient: "from-[#150a28] via-[#1e0d47] to-[#150a28]", accent: "bg-purple-500", glow: "shadow-purple-500/20", dot: "bg-purple-400" },
  green: { gradient: "from-[#0a1f12] via-[#0d3320] to-[#0a1f12]", accent: "bg-emerald-500", glow: "shadow-emerald-500/20", dot: "bg-emerald-400" },
  orange: { gradient: "from-[#1f150a] via-[#33200d] to-[#1f150a]", accent: "bg-orange-500", glow: "shadow-orange-500/20", dot: "bg-orange-400" },
  pink: { gradient: "from-[#1f0a18] via-[#330d28] to-[#1f0a18]", accent: "bg-pink-500", glow: "shadow-pink-500/20", dot: "bg-pink-400" },
  cyan: { gradient: "from-[#0a1a1f] via-[#0d2d33] to-[#0a1a1f]", accent: "bg-cyan-500", glow: "shadow-cyan-500/20", dot: "bg-cyan-400" },
};

export function VideoPlayer({ title, slides, onClose }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(5000);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slide = slides[currentSlide];
  const theme = colorThemes[slide?.color] || colorThemes.blue;

  const stopSpeech = useCallback(() => {
    speechSynthesis.cancel();
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSlideProgress(0);
  }, []);

  const speakSlide = useCallback((index: number) => {
    stopSpeech();
    if (isMuted || !slides[index]) {
      // If muted, auto-advance after a delay
      durationRef.current = 4000;
      startTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / durationRef.current, 1);
        setSlideProgress(progress);
        if (progress >= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            if (index < slides.length - 1) {
              setCurrentSlide(index + 1);
            } else {
              setIsPlaying(false);
              setSlideProgress(0);
            }
          }, 300);
        }
      }, 50);
      return;
    }

    const text = slides[index].narration;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;

    const wordCount = text.split(/\s+/).length;
    const estimatedMs = Math.max((wordCount / 140) * 60 * 1000, 3000);
    durationRef.current = estimatedMs;
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setSlideProgress(Math.min(elapsed / durationRef.current, 1));
    }, 50);

    utterance.onend = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setSlideProgress(1);
      setTimeout(() => {
        if (index < slides.length - 1) {
          setCurrentSlide(index + 1);
        } else {
          setIsPlaying(false);
          setSlideProgress(0);
        }
      }, 500);
    };

    utterance.onerror = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPlaying(false);
    };

    speechSynthesis.speak(utterance);
  }, [isMuted, slides, stopSpeech]);

  useEffect(() => {
    if (isPlaying) speakSlide(currentSlide);
  }, [currentSlide, isPlaying, speakSlide]);

  useEffect(() => {
    return () => {
      speechSynthesis.cancel();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimer();
  }, [isPlaying, resetControlsTimer]);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => { setIsPlaying(false); speechSynthesis.cancel(); if (intervalRef.current) clearInterval(intervalRef.current); };
  const handleStop = () => { setIsPlaying(false); stopSpeech(); setCurrentSlide(0); };

  const goToSlide = (index: number) => {
    if (index < 0 || index >= slides.length) return;
    stopSpeech();
    setCurrentSlide(index);
    if (isPlaying) speakSlide(index);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) speechSynthesis.cancel();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); isPlaying ? handlePause() : handlePlay(); }
      if (e.key === "ArrowRight") goToSlide(currentSlide + 1);
      if (e.key === "ArrowLeft") goToSlide(currentSlide - 1);
      if (e.key === "m") toggleMute();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentSlide, isPlaying, isMuted]);

  if (!slide) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* Top bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${theme.dot} animate-pulse`} />
              <h2 className="text-white/90 text-sm font-medium">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main slide area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-1/3 h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute bottom-0 right-0 w-1/3 h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className={`absolute top-20 right-20 w-64 h-64 rounded-full ${theme.accent} opacity-5 blur-3xl`} />
        <div className={`absolute bottom-20 left-20 w-48 h-48 rounded-full ${theme.accent} opacity-5 blur-3xl`} />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.97 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-[1] max-w-4xl w-full mx-auto px-12"
          >
            {/* Slide number badge */}
            <div className="flex items-center gap-2 mb-8">
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${theme.accent} text-white`}>
                {currentSlide + 1} / {slides.length}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-10 leading-tight tracking-tight">
              {slide.title}
            </h1>

            {/* Points */}
            <div className="space-y-5">
              {slide.points.map((point, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.15 }}
                  className="flex items-start gap-4"
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${theme.dot} mt-2 shrink-0`} />
                  <p className="text-lg md:text-xl text-white/85 leading-relaxed">{point}</p>
                </motion.div>
              ))}
            </div>

            {/* Narration subtitle */}
            {isPlaying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-12 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <p className="text-sm text-white/60 italic leading-relaxed">{slide.narration}</p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Side navigation arrows */}
        <AnimatePresence>
          {showControls && (
            <>
              {currentSlide > 0 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => goToSlide(currentSlide - 1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </motion.button>
              )}
              {currentSlide < slides.length - 1 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => goToSlide(currentSlide + 1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </motion.button>
              )}
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent pt-16 pb-6 px-6"
          >
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-4 max-w-4xl mx-auto">
              {slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className="flex-1 h-1 rounded-full overflow-hidden bg-white/20 cursor-pointer group"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-100 ${
                      i < currentSlide ? "bg-white w-full" :
                      i === currentSlide ? `${colorThemes[s.color]?.accent || "bg-white"} group-hover:brightness-110` :
                      "bg-transparent"
                    }`}
                    style={i === currentSlide ? { width: `${slideProgress * 100}%` } : undefined}
                  />
                </button>
              ))}
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToSlide(currentSlide - 1)}
                  disabled={currentSlide === 0}
                  className="p-2.5 rounded-full hover:bg-white/10 text-white/70 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {!isPlaying ? (
                  <button onClick={handlePlay} className={`p-3.5 rounded-full ${theme.accent} text-white shadow-lg ${theme.glow} hover:brightness-110 transition-all`}>
                    <Play className="w-5 h-5 ml-0.5" />
                  </button>
                ) : (
                  <button onClick={handlePause} className={`p-3.5 rounded-full ${theme.accent} text-white shadow-lg ${theme.glow} hover:brightness-110 transition-all`}>
                    <Pause className="w-5 h-5" />
                  </button>
                )}

                <button onClick={handleStop} className="p-2.5 rounded-full hover:bg-white/10 text-white/70 transition-colors">
                  <Square className="w-4 h-4" />
                </button>

                <button
                  onClick={() => goToSlide(currentSlide + 1)}
                  disabled={currentSlide === slides.length - 1}
                  className="p-2.5 rounded-full hover:bg-white/10 text-white/70 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={toggleMute} className="p-2.5 rounded-full hover:bg-white/10 text-white/70 transition-colors">
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <span className="text-xs text-white/50 font-medium">
                  {currentSlide + 1} of {slides.length}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
