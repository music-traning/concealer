export type CharacterId = 'shinonome' | 'hoshino' | 'kirishima' | 'jinguji';
export type Expression = 'angry' | 'cry' | 'exasperated' | 'normal' | 'smile';

export interface CharacterState {
  id: CharacterId;
  name: string;
  trust: number; // 0 to 100
  expression: Expression;
}

export interface ChatMessage {
  role: 'user' | 'system';
  content: string;
}

export type BgId = 'conference_room' | 'hot_water_room' | 'night_office' | 'office';

export interface GameState {
  week: number;
  day: number; // 1 to 5
  step: number; // 1 to 5
  companyContribution: number;
  playerLevel: number;
  playerExp: number;
  characters: Record<CharacterId, CharacterState>;
  dailyHistory: ChatMessage[];
  sceneText: string;
  activeCharacterId: CharacterId;
  bgId: BgId;
  currentOptions: string[];
}

export interface Item {
  name: string;
  description: string;
}

export interface WeekendResponsePayload {
  text: string;
  unlocked_secret: string | null;
  acquired_item: Item | null;
  options: string[];
}

export interface TurnRequestPayload {
  action: string;
  state: GameState;
  unlockedSecrets?: string[];
  usedItem?: Item;
}

export interface TurnResponsePayload {
  text: string;
  speaker: string;
  bg_id: BgId;
  character_expressions: Record<CharacterId, Expression>;
  parameter_changes: Record<CharacterId, number> & { company_contribution?: number };
  options: string[];
}
