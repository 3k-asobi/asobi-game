export type GameMode = 'mix' | 'quiz';

export type GameState = 'start' | 'playing' | 'feedback' | 'result';

export type BasicColor = '赤' | '青' | '黄' | '白' | '黒' | '緑';

export interface ColorData {
  name: string;
  emoji: string;
  hex: string;
  formula: BasicColor[];
}

export interface BasicColorButton {
  id: BasicColor;
  name: string;
  hex: string;
  textColor: string;
}

export interface GameStats {
  score: number;
  totalAnswered: number;
  correctCount: number;
  incorrectCount: number;
  streak: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  accuracy: number;
  date: string;
  isNew?: boolean;
}

