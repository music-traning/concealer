import React from 'react';
import { GameState } from '@/lib/types';
import Image from 'next/image';

interface CharacterViewProps {
  state: GameState;
}

export function CharacterView({ state }: CharacterViewProps) {
  const activeCharId = state.activeCharacterId;
  const activeChar = state.characters[activeCharId];

  if (!activeChar) return null;

  const imgSrc = `/assets/${activeChar.id}/${activeChar.expression}.png`;

  return (
    <div className="absolute left-0 bottom-0 z-10 w-[700px] h-[720px] pointer-events-none"> 
      <Image
        src={imgSrc}
        alt={`${activeChar.name} - ${activeChar.expression}`}
        fill
        className="object-contain object-left-bottom"
        priority
        sizes="700px"
      />
    </div>
  );
}
