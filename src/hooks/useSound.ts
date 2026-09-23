import { useState, useEffect, useRef, useCallback } from 'react';

export function useSound(bgmSrc: string) {
  const [isSoundOn, setIsSoundOn] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const audioBufferCache = useRef<Record<string, AudioBuffer>>({});

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ストップ関数
    const stopBgm = () => {
      if (bgmSourceRef.current) {
        try {
          bgmSourceRef.current.stop();
        } catch (e) {}
        bgmSourceRef.current.disconnect();
        bgmSourceRef.current = null;
      }
    };

    const playBgm = async () => {
      stopBgm();
      if (!isSoundOn || !bgmSrc) return;

      initAudioContext();
      const ctx = audioContextRef.current;
      if (!ctx) return;

      // キャッシュになければFetchしてデコード
      if (!audioBufferCache.current[bgmSrc]) {
        try {
          const response = await fetch(bgmSrc);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          audioBufferCache.current[bgmSrc] = audioBuffer;
        } catch (err) {
          console.error("BGM Load Error:", err);
          return;
        }
      }

      const buffer = audioBufferCache.current[bgmSrc];
      if (!buffer) return;

      // 音量調整用のGainNode
      if (!bgmGainRef.current) {
        bgmGainRef.current = ctx.createGain();
        bgmGainRef.current.connect(ctx.destination);
      }
      bgmGainRef.current.gain.value = 0.2;

      // 再生用SourceNode
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true; // ← Web Audio APIならシームレスにループする
      source.connect(bgmGainRef.current);
      source.start();
      bgmSourceRef.current = source;
    };

    playBgm();

    return () => {
      stopBgm();
    };
  }, [bgmSrc, isSoundOn, initAudioContext]);

  const playSynthSE = useCallback((type: 'click' | 'action') => {
    if (!isSoundOn) return;
    initAudioContext();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'click') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'action') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }
  }, [isSoundOn]);

  const toggleSound = useCallback(() => {
    setIsSoundOn(prev => !prev);
  }, []);

  return { isSoundOn, toggleSound, playSynthSE };
}
