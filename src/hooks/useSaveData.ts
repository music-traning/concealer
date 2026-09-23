import { useState, useEffect } from 'react';
import { GameState, Item } from '@/lib/types';

export interface SaveData {
  state: GameState;
  unlockedSecrets: string[];
  inventory: Item[];
  timestamp: number;
}

export function useSaveData() {
  const [saves, setSaves] = useState<(SaveData | null)[]>([null, null, null, null, null]);

  useEffect(() => {
    const loadedSaves = [1, 2, 3, 4, 5].map(slot => {
      try {
        const item = localStorage.getItem(`concealer_save_${slot}`);
        if (item) return JSON.parse(item) as SaveData;
      } catch (e) {
        console.error("Save load error", e);
      }
      return null;
    });
    setSaves(loadedSaves);
  }, []);

  const saveGame = (slotIndex: number, state: GameState, unlockedSecrets: string[], inventory: Item[]) => {
    const data: SaveData = {
      state,
      unlockedSecrets,
      inventory,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(`concealer_save_${slotIndex + 1}`, JSON.stringify(data));
      setSaves(prev => {
        const newSaves = [...prev];
        newSaves[slotIndex] = data;
        return newSaves;
      });
      return true;
    } catch (e) {
      console.error("Save error", e);
      return false;
    }
  };

  const clearSave = (slotIndex: number) => {
    try {
      localStorage.removeItem(`concealer_save_${slotIndex + 1}`);
      setSaves(prev => {
        const newSaves = [...prev];
        newSaves[slotIndex] = null;
        return newSaves;
      });
    } catch (e) {
      console.error("Clear error", e);
    }
  };

  return { saves, saveGame, clearSave };
}
