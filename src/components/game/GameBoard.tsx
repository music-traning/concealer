'use client';

import React, { useState, useEffect } from 'react';
import { GameState, TurnResponsePayload, CharacterId, Item, ChatMessage } from '@/lib/types';
import { StatusHud } from './StatusHud';
import { CharacterView } from './CharacterView';
import { ActionPanel } from './ActionPanel';
import { TextBox } from './TextBox';
import { useSound } from '@/hooks/useSound';
import { useSaveData } from '@/hooks/useSaveData';
import { SECRETS_DATA } from '@/constants/secrets';
import { ITEMS_DATA } from '@/constants/items';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const INITIAL_STATE: GameState = {
  week: 1,
  day: 1,
  step: 1,
  companyContribution: 50,
  playerLevel: 1,
  playerExp: 0,
  sceneText: "月曜日の朝。オフィスの空気は重く、今週のプロジェクト進捗会議が始まろうとしている。東雲が不機嫌そうに資料を睨み、神宮寺が何かを企むような笑みを浮かべている。\n\n「さて、先週の遅れをどう取り戻すつもりですか？」\n東雲の冷たい声が会議室に響いた。",
  activeCharacterId: 'shinonome',
  bgId: 'conference_room',
  dailyHistory: [],
  currentOptions: [
    "論理的に現在の進捗と遅れの原因を説明する",
    "星野先輩に目配せして助け舟を求める",
    "まずは深々と謝罪し、その場を凌ぐ"
  ],
  characters: {
    shinonome: { id: 'shinonome', name: '東雲（上司）', trust: 50, expression: 'angry' },
    hoshino: { id: 'hoshino', name: '星野（先輩）', trust: 50, expression: 'normal' },
    kirishima: { id: 'kirishima', name: '霧島（同僚）', trust: 50, expression: 'normal' },
    jinguji: { id: 'jinguji', name: '神宮寺（後輩）', trust: 50, expression: 'smile' },
  }
};

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [screenState, setScreenState] = useState<'TITLE' | 'GAME' | 'WEEKEND_SELECT' | 'WEEKEND_CHAT' | 'GAME_OVER'>('TITLE');
  const [scale, setScale] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const [targetNpc, setTargetNpc] = useState<CharacterId | null>(null);
  const [unlockedSecrets, setUnlockedSecrets] = useState<string[]>([]);
  const [inventory, setInventory] = useState<Item[]>([]);
  
  const { saves, saveGame, clearSave } = useSaveData();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const [dbSelectedTab, setDbSelectedTab] = useState<CharacterId>('shinonome');
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [selectedItemForNextTurn, setSelectedItemForNextTurn] = useState<Item | null>(null);

  type ToastType = 'info' | 'error' | 'success';
  const [toastMessages, setToastMessages] = useState<{id: number, text: string, type: ToastType}[]>([]);
  const addToast = (text: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToastMessages(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToastMessages(prev => prev.filter(msg => msg.id !== id));
    }, 4000);
  };

  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);
  
  // titleOpacity: タイトル画面全体の不透明度 (START時に0になる)
  const [titleOpacity, setTitleOpacity] = useState(1);
  // logoOpacity: 黒背景からロゴだけが浮かび上がるための不透明度
  const [logoOpacity, setLogoOpacity] = useState(0);
  
  const { isSoundOn, toggleSound, playSynthSE } = useSound(screenState === 'TITLE' ? '/title.mp3' : '/bgm.mp3');

  useEffect(() => {
    if (screenState === 'TITLE') {
      setTitleOpacity(1);
      const timer = setTimeout(() => setLogoOpacity(1), 100);
      return () => clearTimeout(timer);
    } else {
      setLogoOpacity(0);
    }
  }, [screenState]);

  useEffect(() => {
    const handleResize = () => {
      const scaleX = window.innerWidth / GAME_WIDTH;
      const scaleY = window.innerHeight / GAME_HEIGHT;
      setScale(Math.min(scaleX, scaleY));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAction = async (actionText: string, actionItem?: Item) => {
    if (loading || screenState !== 'GAME') return;
    
    const usedItem = actionItem || selectedItemForNextTurn;
    setSelectedItemForNextTurn(null);

    playSynthSE('action');
    setLoading(true);
    
    if (usedItem) {
      setInventory(prev => prev.filter(i => i.name !== usedItem.name));
    }

    try {
      const res = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionText, state: gameState, unlockedSecrets, usedItem }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || 'API Error');
      }

      const data: TurnResponsePayload = await res.json();

      setGameState(prev => {
        const isWarning = data.speaker === 'システム警告';
        
        let nextStep = isWarning ? prev.step : prev.step + 1;
        let nextDay = prev.day;
        
        // 警告時は履歴に残さない
        let newHistory = isWarning ? prev.dailyHistory : [
          ...prev.dailyHistory,
          { role: 'user', content: actionText },
          { role: 'system', content: data.text }
        ] as ChatMessage[];

        const newCharacters = { ...prev.characters };
        (['shinonome', 'hoshino', 'kirishima', 'jinguji'] as const).forEach(id => {
          const trustChange = data.parameter_changes[id] || 0;
          const expression = data.character_expressions[id] || 'normal';
          newCharacters[id] = {
            ...newCharacters[id],
            trust: Math.min(100, Math.max(0, newCharacters[id].trust + trustChange)),
            expression,
          };
        });

        const companyContribChange = data.parameter_changes.company_contribution || 0;
        const nextCompanyContribution = Math.min(100, Math.max(0, prev.companyContribution + companyContribChange));

        let nextExp = prev.playerExp + 20; // 1アクションで20EXP
        let nextLevel = prev.playerLevel;
        while (nextExp >= 100 && nextLevel < 50) {
          nextLevel++;
          nextExp -= 100;
        }

        if (nextCompanyContribution <= 0) {
          setScreenState('GAME_OVER');
        }

        return {
          ...prev,
          day: nextDay,
          step: nextStep,
          companyContribution: nextCompanyContribution,
          playerLevel: nextLevel,
          playerExp: nextExp,
          sceneText: data.text,
          activeCharacterId: (data.speaker === 'shinonome' || data.speaker === 'hoshino' || data.speaker === 'kirishima' || data.speaker === 'jinguji') ? data.speaker as CharacterId : prev.activeCharacterId,
          bgId: data.bg_id || prev.bgId,
          currentOptions: data.options && data.options.length > 0 ? data.options : prev.currentOptions,
          characters: newCharacters,
          dailyHistory: newHistory,
        };
      });

    } catch (error: any) {
      console.error("Game Action Error:", error);
      addToast(`エラーが発生しました: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNextDay = () => {
    playSynthSE('click');
    if (gameState.day >= 5) {
      setScreenState('WEEKEND_SELECT');
      return;
    }
    
    setIsTransitioning(true);
    
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        day: prev.day + 1,
        step: 1,
        dailyHistory: [],
        currentOptions: [
          "本日の業務タスクを確認する",
          "まずはメールのチェックから始める",
          "同僚に挨拶をして回る"
        ],
        sceneText: `WEEK ${prev.week} / DAY ${prev.day + 1} - 業務開始\n新しい1日が始まった。今日はどんなトラブルが起きるのだろうか。`
      }));
      setIsTransitioning(false);
    }, 2000);
  };

  const handleWeekendAction = async (actionText: string) => {
    if (loading || screenState !== 'WEEKEND_CHAT' || !targetNpc) return;
    playSynthSE('action');
    setLoading(true);

    try {
      const res = await fetch('/api/weekend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionText, state: gameState, targetNpc }),
      });

      if (!res.ok) throw new Error('API Error');

      const data = await res.json();

      setGameState(prev => {
        let newHistory = [
          ...prev.dailyHistory,
          { role: 'user', content: actionText },
          { role: 'system', content: data.text }
        ] as ChatMessage[];

        return {
          ...prev,
          step: prev.step + 1,
          dailyHistory: newHistory,
          currentOptions: data.options && data.options.length > 0 ? data.options : prev.currentOptions,
        };
      });

      if (data.unlocked_secret && targetNpc) {
        // 対象キャラの全秘密リストを取得
        const characterSecrets = SECRETS_DATA[targetNpc] || [];
        // まだ取得していない秘密をフィルタリング
        const lockedSecrets = characterSecrets.filter(s => !unlockedSecrets.includes(s.id));
        
        if (lockedSecrets.length > 0) {
          // ランダムに1つ選ぶ
          const randomSecret = lockedSecrets[Math.floor(Math.random() * lockedSecrets.length)];
          setUnlockedSecrets(prev => [...prev, randomSecret.id]);
          addToast(`【SECRET UNLOCKED】\n${gameState.characters[targetNpc].name}の秘密\n『${randomSecret.title}』を獲得した！`, 'success');
        } else {
          // 全て取得済みの場合は汎用テキストなど
          addToast(`これ以上、新しい秘密は引き出せなかったようだ…`, 'info');
        }
      }
      
      if (data.acquired_item) {
        // AIが生成したアイテムを破棄し、マスターデータからランダムに取得
        const randomItem = ITEMS_DATA[Math.floor(Math.random() * ITEMS_DATA.length)];
        setInventory(prev => [...prev, randomItem]);
        addToast(`【ITEM GET】\n『${randomItem.name}』を獲得した！`, 'success');
      }
    } catch (error: any) {
      console.error(error);
      addToast('通信エラーが発生しました。時間を置いてお試しください。', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startWeekendChat = (npcId: CharacterId) => {
    playSynthSE('click');
    setTargetNpc(npcId);
    setGameState(prev => ({
      ...prev,
      step: 1,
      dailyHistory: [],
      currentOptions: ["週末ですが、少しよろしいですか？", "お疲れ様です。昨日の件で...", "スタンプを送る"]
    }));
    setScreenState('WEEKEND_CHAT');
  };

  const endWeekend = () => {
    playSynthSE('action');
    setIsTransitioning(true);
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        week: prev.week + 1,
        day: 1,
        step: 1,
        dailyHistory: [],
        currentOptions: [
          "今週の業務タスクを確認する",
          "まずはメールのチェックから始める",
          "牽制として関係部署に挨拶をして回る"
        ],
        sceneText: `WEEK ${prev.week + 1} - 新たな週の始まり\n週末の裏工作を終え、また戦場へと戻ってきた。油断すれば一瞬で切り捨てられる。`
      }));
      setScreenState('GAME');
      setIsTransitioning(false);
    }, 2000);
  };

  const handleReset = () => {
    playSynthSE('action');
    setGameState(INITIAL_STATE);
    setUnlockedSecrets([]);
    setInventory([]);
    setScreenState('TITLE');
  };

  const handleRetry = () => {
    playSynthSE('action');
    // メタプログレッション: unlockedSecrets、レベル、経験値はリセットしない。
    // week, day, step, inventory, 好感度, companyContribution等は INITIAL_STATE にリセットされる
    setGameState(prev => ({
      ...INITIAL_STATE,
      playerLevel: prev.playerLevel,
      playerExp: prev.playerExp
    }));
    setInventory([]);
    setTitleOpacity(1);
    setScreenState('TITLE');
  };

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      <div className="fixed top-4 left-4 z-50 flex gap-2">
        <button 
          onClick={toggleSound}
          className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-full border border-white/20 transition-colors backdrop-blur-md flex items-center justify-center"
        >
          {isSoundOn ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          )}
        </button>
        {screenState !== 'TITLE' && (
          <>
            <button 
              onClick={() => { playSynthSE('click'); setIsDatabaseOpen(true); }}
              className="bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-full border border-white/20 transition-colors backdrop-blur-md font-bold tracking-widest text-[10px] flex items-center"
            >
              DATABASE
            </button>
            <button 
              onClick={() => { playSynthSE('click'); setShowSaveModal(true); }}
              className="bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-full border border-white/20 transition-colors backdrop-blur-md font-bold tracking-widest text-[10px] flex items-center"
            >
              SAVE
            </button>
            <button 
              onClick={() => { playSynthSE('click'); setShowLoadModal(true); }}
              className="bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-full border border-white/20 transition-colors backdrop-blur-md font-bold tracking-widest text-[10px] flex items-center"
            >
              LOAD
            </button>
          </>
        )}
      </div>

      {/* Database Modal */}
      {isDatabaseOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => { playSynthSE('click'); setIsDatabaseOpen(false); }}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[80vh] flex flex-col overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-slate-700 shrink-0">
              <h2 className="text-xl md:text-3xl font-bold tracking-widest text-purple-400">NPC SECRETS DATABASE</h2>
              <button onClick={() => { playSynthSE('click'); setIsDatabaseOpen(false); }} className="text-gray-400 hover:text-white text-2xl font-bold px-2 py-1">✕</button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Tabs */}
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-700 flex flex-row md:flex-col p-2 md:p-4 gap-2 bg-slate-800/50 overflow-x-auto shrink-0">
                {(['shinonome', 'hoshino', 'kirishima', 'jinguji'] as CharacterId[]).map(id => (
                  <button
                    key={id}
                    onClick={() => { playSynthSE('click'); setDbSelectedTab(id); }}
                    className={`p-3 md:p-4 text-center md:text-left rounded-xl font-bold transition-all shrink-0 text-sm md:text-base ${
                      dbSelectedTab === id 
                        ? 'bg-purple-600 text-white shadow-lg' 
                        : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-gray-200'
                    }`}
                  >
                    {gameState.characters[id].name}
                  </button>
                ))}
              </div>
              
              {/* Content */}
              <div className="flex-1 p-4 md:p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
                <div className="grid gap-4">
                  {SECRETS_DATA[dbSelectedTab]?.map(secret => {
                    const isUnlocked = unlockedSecrets.includes(secret.id);
                    return (
                      <div 
                        key={secret.id} 
                        className={`p-4 md:p-6 rounded-2xl border transition-all ${
                          isUnlocked 
                            ? 'bg-slate-800 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                            : 'bg-slate-900/50 border-slate-800 opacity-70'
                        }`}
                      >
                        <div className="flex items-start gap-3 md:gap-4">
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 ${
                            isUnlocked ? 'bg-purple-900/50 text-purple-400' : 'bg-slate-800 text-slate-600'
                          }`}>
                            {isUnlocked ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"></path><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            )}
                          </div>
                          <div>
                            <h3 className={`text-lg md:text-xl font-bold mb-1 md:mb-2 ${isUnlocked ? 'text-gray-100' : 'text-slate-500'}`}>
                              {isUnlocked ? secret.title : '???'}
                            </h3>
                            <p className={`text-sm md:text-base leading-relaxed ${isUnlocked ? 'text-gray-300' : 'text-slate-600 italic select-none'}`}>
                              {isUnlocked ? secret.description : 'この秘密はまだ解放されていません。週末のチャットで深層心理に迫ってください。'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { playSynthSE('click'); setShowSaveModal(false); }}
        >
          <div 
            className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl md:text-2xl font-bold tracking-widest">SAVE GAME</h2>
              <button onClick={() => { playSynthSE('click'); setShowSaveModal(false); }} className="text-gray-400 hover:text-white text-xl px-2 py-1">✕</button>
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600">
              {saves.map((save, idx) => (
                <div key={idx} className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      playSynthSE('action');
                      if (saveGame(idx, gameState, unlockedSecrets, inventory)) {
                        addToast('セーブしました。', 'success');
                        setShowSaveModal(false);
                      }
                    }}
                    className="flex-1 text-left p-3 md:p-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors flex justify-between items-center group"
                  >
                    <span className="font-bold text-gray-300 group-hover:text-white text-sm md:text-base">SLOT {idx + 1}</span>
                    {save ? (
                      <div className="text-right text-xs md:text-sm">
                        <div className="text-purple-400 font-bold">Lv.{save.state.playerLevel} / DAY {save.state.day}</div>
                        <div className="text-gray-500 text-[10px] md:text-xs mt-0.5">{new Date(save.timestamp).toLocaleString()}</div>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-xs md:text-sm">NO DATA</span>
                    )}
                  </button>
                  {save && (
                    <button
                      onClick={() => {
                        playSynthSE('click');
                        setConfirmDialog({
                          message: 'このデータを削除しますか？',
                          onConfirm: () => {
                            clearSave(idx);
                            addToast('データを削除しました。', 'info');
                          }
                        });
                      }}
                      className="px-3 md:px-4 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-700/50 rounded-xl transition-colors text-xs md:text-sm font-bold"
                    >
                      削除
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { playSynthSE('click'); setShowLoadModal(false); }}
        >
          <div 
            className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl md:text-2xl font-bold tracking-widest">LOAD GAME</h2>
              <button onClick={() => { playSynthSE('click'); setShowLoadModal(false); }} className="text-gray-400 hover:text-white text-xl px-2 py-1">✕</button>
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600">
              {saves.map((save, idx) => (
                <div key={idx} className="flex gap-2 shrink-0">
                  <button
                    disabled={!save}
                    onClick={() => {
                      if (!save) return;
                      playSynthSE('action');
                      setGameState(save.state);
                      setUnlockedSecrets(save.unlockedSecrets);
                      setInventory(save.inventory);
                      setShowLoadModal(false);
                      addToast('ロードしました。', 'success');
                      if (screenState === 'TITLE') {
                        setTitleOpacity(0);
                        setTimeout(() => setScreenState('GAME'), 1500);
                      }
                    }}
                    className={`flex-1 text-left p-3 md:p-4 rounded-xl transition-colors flex justify-between items-center ${
                      save 
                        ? 'bg-slate-800 hover:bg-slate-700 border border-slate-600 group' 
                        : 'bg-slate-800/50 border border-slate-700/50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className={`font-bold text-sm md:text-base ${save ? 'text-gray-300 group-hover:text-white' : 'text-gray-600'}`}>SLOT {idx + 1}</span>
                    {save ? (
                      <div className="text-right text-xs md:text-sm">
                        <div className="text-purple-400 font-bold">Lv.{save.state.playerLevel} / DAY {save.state.day}</div>
                        <div className="text-gray-500 text-[10px] md:text-xs mt-0.5">{new Date(save.timestamp).toLocaleString()}</div>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs md:text-sm">NO DATA</span>
                    )}
                  </button>
                  {save && (
                    <button
                      onClick={() => {
                        playSynthSE('click');
                        setConfirmDialog({
                          message: 'このデータを削除しますか？',
                          onConfirm: () => {
                            clearSave(idx);
                            addToast('データを削除しました。', 'info');
                          }
                        });
                      }}
                      className="px-3 md:px-4 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-700/50 rounded-xl transition-colors text-xs md:text-sm font-bold"
                    >
                      削除
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {isInventoryOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { playSynthSE('click'); setIsInventoryOpen(false); }}
        >
          <div 
            className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-[800px] max-h-[80vh] flex flex-col overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl md:text-2xl font-bold tracking-widest text-yellow-400 flex items-center gap-2">
                <span>💼</span> INVENTORY
              </h2>
              <button onClick={() => { playSynthSE('click'); setIsInventoryOpen(false); }} className="text-gray-400 hover:text-white text-xl px-2 py-1">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600">
              {inventory.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic">
                  アイテムを所持していません。週末のチャットで獲得しましょう。
                </div>
              ) : (
                <div className="grid gap-4">
                  {inventory.map((item, idx) => (
                    <div key={idx} className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-yellow-200 text-lg mb-1">{item.name}</h3>
                        <p className="text-gray-300 text-sm leading-relaxed">{item.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          playSynthSE('action');
                          setSelectedItemForNextTurn(item);
                          setIsInventoryOpen(false);
                        }}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold px-6 py-3 rounded-xl transition-colors shrink-0 shadow-lg"
                      >
                        使用する
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedItemForNextTurn && (
              <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-xl text-yellow-200 text-sm flex items-center justify-between shrink-0">
                <span>次のターンで <strong>{selectedItemForNextTurn.name}</strong> を使用します。</span>
                <button 
                  onClick={() => setSelectedItemForNextTurn(null)}
                  className="px-3 py-1 bg-red-900/50 text-red-200 rounded hover:bg-red-800 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div 
        className="relative shrink-0 bg-slate-900 shadow-2xl overflow-hidden"
        style={{ 
          width: `${GAME_WIDTH}px`, 
          height: `${GAME_HEIGHT}px`, 
          transform: `scale(${scale})`, 
          transformOrigin: 'center' 
        }}
      >
        {screenState === 'TITLE' && (
          <div 
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-[1500ms] ease-in-out pointer-events-auto"
            style={{ opacity: titleOpacity }}
          >
            <div 
              className="flex flex-col items-center transition-opacity duration-[2000ms] ease-in-out"
              style={{ opacity: logoOpacity }}
            >
              <h1 className="text-8xl font-black text-white tracking-[0.2em] mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-600">
                CONCEALER
              </h1>
              <p className="text-xl text-gray-400 tracking-[0.5em] mb-16 uppercase">Corporate Survival Simulator</p>
              <button 
                onClick={() => {
                  playSynthSE('action');
                  setTitleOpacity(0);
                  setTimeout(() => setScreenState('GAME'), 1500);
                }}
                className="px-12 py-4 bg-white hover:bg-gray-200 text-black font-bold tracking-[0.2em] text-xl rounded-full transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] w-64"
              >
                START GAME
              </button>
              <button 
                onClick={() => {
                  playSynthSE('click');
                  setShowLoadModal(true);
                }}
                className="mt-6 px-12 py-4 bg-transparent border border-gray-600 hover:bg-gray-800 text-gray-300 font-bold tracking-[0.2em] text-xl rounded-full transition-all w-64"
              >
                LOAD GAME
              </button>
            </div>
            
            <div className="absolute bottom-4 w-full text-center">
              <a 
                href="https://note.com/jazzy_begin" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs md:text-[10px] text-slate-500 hover:text-slate-300 transition-colors tracking-widest"
              >
                © 2026 United Make Associates
              </a>
            </div>
          </div>
        )}

        {/* 背景レイヤー */}
        <div className="absolute inset-0 z-0 bg-black">
          {/* 背景画像 */}
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
            style={{ backgroundImage: `url('/bg/${gameState.bgId}.png')` }}
          />
          {/* テキスト等を読みやすくするための暗いオーバーレイ */}
          <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-900/60 to-slate-900/80 pointer-events-none" />
        </div>
        
        {/* ---------------- GAME UI ---------------- */}
        {screenState === 'GAME' && (
          <>
            <CharacterView state={gameState} />
            <div className="absolute right-6 top-6 bottom-[220px] w-[540px] flex flex-col gap-3 z-20">
              <StatusHud state={gameState} />
              
              {gameState.step > 5 ? (
                <div className="w-full flex-1 flex flex-col justify-center bg-black/80 p-8 rounded-3xl text-center backdrop-blur-md border border-yellow-500/50 shadow-2xl pointer-events-auto">
                  <h3 className="text-2xl font-bold text-yellow-400 mb-6">本日の業務終了</h3>
                  <button 
                    onClick={handleNextDay} 
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-4 rounded-2xl font-bold text-xl w-full transition-colors shadow-lg"
                  >
                    {gameState.day >= 5 ? "週末へ向かう" : "翌日へ出社する"}
                  </button>
                </div>
              ) : (
                <ActionPanel 
                  options={gameState.currentOptions} 
                  onAction={handleAction} 
                  disabled={loading} 
                  inventory={inventory}
                  onOpenInventory={() => {
                    playSynthSE('click');
                    setIsInventoryOpen(true);
                  }}
                />
              )}
            </div>
            <TextBox 
              text={
                loading ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                    <div className="text-xl font-mono tracking-[0.3em] flex items-center">
                      THINKING
                      <span className="animate-[pulse_1s_infinite] delay-75 ml-1">.</span>
                      <span className="animate-[pulse_1s_infinite] delay-150">.</span>
                      <span className="animate-[pulse_1s_infinite] delay-300">.</span>
                    </div>
                    <div className="w-1/2 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
                    <div className="text-sm tracking-widest opacity-60">相手は冷酷に次の手を計算している</div>
                  </div>
                ) : (
                  gameState.sceneText
                )
              } 
            />
          </>
        )}

        {/* ---------------- GAME OVER UI ---------------- */}
        {screenState === 'GAME_OVER' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/95 backdrop-blur-md pointer-events-auto">
            <h1 className="text-9xl font-black text-red-600 tracking-[0.2em] mb-4 drop-shadow-[0_0_30px_rgba(220,38,38,1)]">
              FIRED
            </h1>
            <p className="text-2xl text-red-300 tracking-widest mb-16 font-serif">あなたは WEEK {gameState.week} まで生き延びましたが、ついに切り捨てられました。</p>
            
            {unlockedSecrets.length > 0 && (
              <div className="mb-12 bg-black/60 p-6 rounded-xl border border-red-500/50 max-w-2xl text-center shadow-2xl">
                <h3 className="text-red-400 font-bold mb-4 tracking-widest">しかし、あなたは以下の弱みを握っている...</h3>
                <ul className="text-gray-300 text-sm space-y-2">
                  {unlockedSecrets.map((sec, i) => {
                    // sec は IDなので本当は表示テキストにするべきだが、
                    // 前回の実装でここは ID のままになっていたので、一旦そのままか、
                    // マスターデータからタイトルを引くようにする
                    const secretData = SECRETS_DATA['shinonome'].find(s => s.id === sec) || 
                                       SECRETS_DATA['hoshino'].find(s => s.id === sec) ||
                                       SECRETS_DATA['kirishima'].find(s => s.id === sec) ||
                                       SECRETS_DATA['jinguji'].find(s => s.id === sec);
                    return <li key={i}>・{secretData ? secretData.title : sec}</li>;
                  })}
                </ul>
              </div>
            )}

            <button 
              onClick={handleRetry}
              className="px-12 py-4 bg-red-800 hover:bg-red-700 text-red-100 border border-red-500 font-bold tracking-[0.2em] text-xl rounded-full transition-all shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:shadow-[0_0_40px_rgba(255,0,0,0.6)]"
            >
              記憶を引き継いで再就職する
            </button>
          </div>
        )}

        {/* ---------------- WEEKEND_SELECT UI ---------------- */}
        {screenState === 'WEEKEND_SELECT' && (
          <div className="absolute inset-0 z-40 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white pointer-events-auto">
            <h2 className="text-3xl font-bold tracking-widest mb-12 text-gray-300">週末です。誰に連絡を取りますか？</h2>
            <div className="grid grid-cols-2 gap-6 w-full max-w-3xl">
              {(['shinonome', 'hoshino', 'kirishima', 'jinguji'] as CharacterId[]).map(id => {
                const char = gameState.characters[id];
                return (
                  <button
                    key={char.id}
                    onClick={() => startWeekendChat(char.id)}
                    className="bg-slate-800 hover:bg-slate-700 p-8 rounded-2xl border border-slate-600 shadow-xl transition-all flex flex-col items-center group"
                  >
                    <span className="text-2xl font-bold mb-2 group-hover:text-purple-400 transition-colors">{char.name}</span>
                    <span className="text-sm text-gray-400 font-mono">Trust: {char.trust}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- WEEKEND_CHAT UI ---------------- */}
        {screenState === 'WEEKEND_CHAT' && (
          <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex justify-center py-6 pointer-events-auto">
            <div className="w-[480px] h-full bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
              {/* Header */}
              <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center z-10 shrink-0">
                <span className="font-bold text-gray-200">{targetNpc && gameState.characters[targetNpc].name} とのチャット</span>
                <span className="text-xs text-gray-400 bg-slate-700 px-2 py-1 rounded">END TO END ENCRYPTED</span>
              </div>
              
              {/* Chat History */}
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 scrollbar-thin scrollbar-thumb-slate-600 relative">
                {gameState.dailyHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-green-600 text-white rounded-br-sm' : 'bg-slate-700 text-gray-100 rounded-bl-sm'} shadow-md whitespace-pre-wrap leading-relaxed text-sm`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/80 border border-slate-700 text-purple-400 px-6 py-4 rounded-2xl rounded-bl-sm shadow-[0_0_15px_rgba(168,85,247,0.15)] flex flex-col gap-2 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono tracking-widest text-slate-500 uppercase">System</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-sm tracking-widest">
                        <span>Thinking</span>
                        <span className="animate-[pulse_1s_infinite] delay-75">.</span>
                        <span className="animate-[pulse_1s_infinite] delay-150">.</span>
                        <span className="animate-[pulse_1s_infinite] delay-300">.</span>
                        <span className="ml-1 inline-block w-2 h-4 bg-purple-500 animate-[pulse_1s_infinite]"></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Action/Input Area */}
              <div className="p-3 bg-slate-800 border-t border-slate-700 shrink-0">
                {gameState.step > 5 ? (
                  <button
                    onClick={endWeekend}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold tracking-widest shadow-lg transition-colors"
                  >
                    チャットを終了して週明けへ
                  </button>
                ) : (
                  <ActionPanel
                    options={gameState.currentOptions}
                    onAction={handleWeekendAction}
                    disabled={loading || isTransitioning}
                  />
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* 出社トランジション・オーバーレイ */}
        <div 
          className={`absolute inset-0 bg-black z-50 flex flex-col items-center justify-center transition-opacity duration-1000 ${
            isTransitioning ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <h1 className="text-white text-5xl font-bold tracking-widest mb-4">
            WEEK {gameState.day === 5 ? gameState.week + 1 : gameState.week} 
          </h1>
          <h2 className="text-gray-300 text-3xl font-bold tracking-widest">
            DAY {gameState.day === 5 ? 1 : gameState.day + (isTransitioning ? 1 : 0)} - 業務開始
          </h2>
        </div>

      </div>

      {/* Toast Notifications */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-3 pointer-events-none">
        {toastMessages.map(msg => (
          <div 
            key={msg.id} 
            className={`animate-fade-in-down max-w-md px-6 py-4 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md border border-gray-700/50 flex items-center gap-3 ${
              msg.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' :
              msg.type === 'success' ? 'bg-indigo-950/90 border-indigo-500/50 text-indigo-200' :
              'bg-black/90 border-gray-600/50 text-gray-200'
            }`}
          >
            <span className="whitespace-pre-wrap text-sm md:text-base font-bold tracking-wider">{msg.text}</span>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/50 shadow-[0_0_30px_rgba(255,0,0,0.2)] p-8 rounded-2xl max-w-md w-full animate-fade-in text-center">
            <h3 className="text-xl text-white font-bold mb-8 tracking-widest">{confirmDialog.message}</h3>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => { playSynthSE('click'); setConfirmDialog(null); }}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg transition-colors font-bold"
              >
                キャンセル
              </button>
              <button 
                onClick={() => { playSynthSE('action'); confirmDialog.onConfirm(); setConfirmDialog(null); }}
                className="px-8 py-3 bg-red-800 hover:bg-red-700 text-white rounded-lg transition-colors shadow-[0_0_15px_rgba(255,0,0,0.4)] font-bold"
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
