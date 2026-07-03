import { ColorData, BasicColorButton } from './types';

export const BASIC_COLORS: BasicColorButton[] = [
  { id: '赤', name: '赤', hex: '#EF4444', textColor: '#FFFFFF' },
  { id: '青', name: '青', hex: '#3B82F6', textColor: '#FFFFFF' },
  { id: '黄', name: '黄', hex: '#FACC15', textColor: '#1F2937' },
  { id: '白', name: '白', hex: '#FFFFFF', textColor: '#1F2937' },
  { id: '黒', name: '黒', hex: '#111827', textColor: '#FFFFFF' },
  { id: '緑', name: '緑', hex: '#22C55E', textColor: '#FFFFFF' },
];

export const MIX_COLORS: ColorData[] = [
  {
    name: '灰色',
    emoji: '🩶',
    hex: '#8E9196',
    formula: ['黒', '白'],
  },
  {
    name: '茶色',
    emoji: '🟫',
    hex: '#78350F',
    formula: ['赤', '緑'],
  },
  {
    name: 'ピンク',
    emoji: '🩷',
    hex: '#FF8DA1',
    formula: ['赤', '白'],
  },
  {
    name: 'クリーム色',
    emoji: '🥛',
    hex: '#FFFDD0',
    formula: ['黄', '白'],
  },
  {
    name: '紫色',
    emoji: '🟪',
    hex: '#8B5CF6',
    formula: ['赤', '青'],
  },
  {
    name: '緑色',
    emoji: '🟩',
    hex: '#22C55E',
    formula: ['青', '黄'],
  },
  {
    name: '黄緑色',
    emoji: '🍏',
    hex: '#A3E635',
    formula: ['緑', '黄'],
  },
  {
    name: 'オレンジ色',
    emoji: '🟧',
    hex: '#F97316',
    formula: ['赤', '黄'],
  },
  {
    name: '水色',
    emoji: '🩵',
    hex: '#38BDF8',
    formula: ['青', '白'],
  },
  {
    name: '紺色',
    emoji: '🌌',
    hex: '#1E3A8A',
    formula: ['青', '黒'],
  },
  {
    name: '黄土色',
    emoji: '🍂',
    hex: '#C27D38',
    formula: ['黄', '黒'],
  },
];

export const QUIZ_COLORS: ColorData[] = [
  {
    name: 'マゼンタ',
    emoji: '🌺',
    hex: '#FF00FF',
    formula: [],
  },
  {
    name: 'コバルトブルー',
    emoji: '💙',
    hex: '#0047AB',
    formula: [],
  },
  {
    name: '琥珀色',
    emoji: '🍯',
    hex: '#FFBF00',
    formula: [],
  },
  {
    name: 'テラコッタ',
    emoji: '🧱',
    hex: '#E2725B',
    formula: [],
  },
  {
    name: 'シアン',
    emoji: '🌐',
    hex: '#00FFFF',
    formula: [],
  },
  {
    name: 'ターコイズブルー',
    emoji: '💎',
    hex: '#30D5C8',
    formula: [],
  },
  {
    name: 'ピスタチオグリーン',
    emoji: '🥑',
    hex: '#93C572',
    formula: [],
  },
  {
    name: 'サーモンピンク',
    emoji: '🍣',
    hex: '#FA8072',
    formula: [],
  },
  {
    name: 'サファイアブルー',
    emoji: '☄️',
    hex: '#0F52BA',
    formula: [],
  },
  {
    name: 'エメラルドグリーン',
    emoji: '💚',
    hex: '#50C878',
    formula: [],
  },
  {
    name: 'バーガンディ',
    emoji: '🍷',
    hex: '#800020',
    formula: [],
  },
  {
    name: 'カーキ',
    emoji: '🥾',
    hex: '#C3B091',
    formula: [],
  },
  {
    name: 'ラベンダー',
    emoji: '🪻',
    hex: '#E6E6FA',
    formula: [],
  },
  {
    name: '珊瑚色',
    emoji: '🪸',
    hex: '#F88379',
    formula: [],
  },
  {
    name: '抹茶色',
    emoji: '🍵',
    hex: '#7D8F62',
    formula: [],
  },
];
