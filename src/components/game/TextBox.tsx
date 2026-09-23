import React, { useEffect, useRef } from 'react';

interface TextBoxProps {
  text: string;
}

export function TextBox({ text }: TextBoxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [text]);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[1200px] h-[180px] z-40 bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50 overflow-hidden pointer-events-auto">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-purple-300 to-transparent opacity-50" />
      
      <div 
        ref={scrollRef}
        className="h-full overflow-y-auto pr-6 text-gray-900 text-2xl leading-relaxed font-serif whitespace-pre-wrap scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent"
      >
        {text}
      </div>
    </div>
  );
}
