import { useState, useEffect, useRef, useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameMode, GameState, BasicColor, ColorData, GameStats, LeaderboardEntry } from './types';
import { BASIC_COLORS, MIX_COLORS, QUIZ_COLORS } from './data';
import { audio } from './audio';
// @ts-ignore
import paintPaletteIcon from './assets/images/paint_palette_icon_1782649170637.jpg';

const isStorageAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch (e) {
    return false;
  }
};

const safeGetItem = (key: string): string | null => {
  if (!isStorageAvailable()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    console.error(`Failed to get item from localStorage: ${key}`, e);
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    console.error(`Failed to set item in localStorage: ${key}`, e);
  }
};

const getInitialHighScore = (key: string): number => {
  const saved = safeGetItem(key);
  if (saved) {
    const val = parseInt(saved, 10);
    return isNaN(val) ? 0 : val;
  }
  return 0;
};

const getInitialSoundEnabled = (): boolean => {
  const saved = safeGetItem('colormix_sound_enabled');
  return saved !== 'false'; // Default to true if not found, or if explicitly "true"
};

const getInitialLeaderboard = (mode: GameMode): LeaderboardEntry[] => {
  const saved = safeGetItem(`colormix_leaderboard_${mode}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }

  // Fallback to old names if exists
  const oldMode = mode === 'mix' ? 'normal' : 'hard';
  const oldSaved = safeGetItem(`colormix_leaderboard_${oldMode}`);
  if (oldSaved) {
    try {
      return JSON.parse(oldSaved);
    } catch (e) {
      console.error(e);
    }
  }
  
  // Default clean initial rankings to give the user something to compete against!
  if (mode === 'mix') {
    return [
      { id: 'cpu-1', name: 'パレット職人', score: 1800, accuracy: 100, date: '2026/06/25' },
      { id: 'cpu-2', name: 'みどり先生', score: 1400, accuracy: 93, date: '2026/06/26' },
      { id: 'cpu-3', name: '色彩ビギナー', score: 800, accuracy: 80, date: '2026/06/27' },
    ];
  } else {
    return [
      { id: 'cpu-1', name: 'カラー皇帝', score: 1500, accuracy: 94, date: '2026/06/25' },
      { id: 'cpu-2', name: 'ラベンダー妖精', score: 1100, accuracy: 88, date: '2026/06/26' },
      { id: 'cpu-3', name: 'じゅんびちゅう', score: 600, accuracy: 75, date: '2026/06/27' },
    ];
  }
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [gameMode, setGameMode] = useState<GameMode>('mix');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => getInitialSoundEnabled());
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    totalAnswered: 0,
    correctCount: 0,
    incorrectCount: 0,
    streak: 0,
  });
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [shuffledQuestions, setShuffledQuestions] = useState<ColorData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedColors, setSelectedColors] = useState<BasicColor[]>([]);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | null>(null);
  
  const [highScoreMix, setHighScoreMix] = useState<number>(() => {
    const saved = getInitialHighScore('colormix_high_mix');
    return saved > 0 ? saved : getInitialHighScore('colormix_high_normal');
  });
  const [highScoreQuiz, setHighScoreQuiz] = useState<number>(() => {
    const saved = getInitialHighScore('colormix_high_quiz');
    return saved > 0 ? saved : getInitialHighScore('colormix_high_hard');
  });
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [guideTab, setGuideTab] = useState<'formula' | 'color_dict'>('formula');

  const [leaderboardMix, setLeaderboardMix] = useState<LeaderboardEntry[]>(() => getInitialLeaderboard('mix'));
  const [leaderboardQuiz, setLeaderboardQuiz] = useState<LeaderboardEntry[]>(() => getInitialLeaderboard('quiz'));
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [leaderboardTab, setLeaderboardTab] = useState<'mix' | 'quiz'>('mix');
  const [registerName, setRegisterName] = useState<string>('');
  const [isLeaderboardSubmitted, setIsLeaderboardSubmitted] = useState<boolean>(false);
  const [newLeaderboardId, setNewLeaderboardId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  // Quiz mode options state
  const [quizOptions, setQuizOptions] = useState<string[]>([]);

  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [, startTransition] = useTransition();

  // Update sound engine enablement when state changes and save to localStorage
  useEffect(() => {
    audio.enabled = soundEnabled;
    safeSetItem('colormix_sound_enabled', soundEnabled ? 'true' : 'false');
  }, [soundEnabled]);

  // Scroll to top when game state changes, ensuring game starts at the top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [gameState]);

  // Utility to shuffle questions
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Start the game
  const startGame = (mode: GameMode) => {
    const questionsPool = mode === 'mix' ? MIX_COLORS : QUIZ_COLORS;
    const shuffled = shuffleArray(questionsPool);
    
    // Explicitly scroll to top on game start
    window.scrollTo({ top: 0, behavior: 'auto' });
    
    startTransition(() => {
      setGameMode(mode);
      setShuffledQuestions(shuffled);
      setCurrentQuestionIndex(0);
      setSelectedColors([]);
      setFeedbackType(null);
      setTimeLeft(60);
      setStats({
        score: 0,
        totalAnswered: 0,
        correctCount: 0,
        incorrectCount: 0,
        streak: 0,
      });
      setIsLeaderboardSubmitted(false);
      setNewLeaderboardId(null);
      setRegisterName('');
      setIsPaused(false);
      setShowExitConfirm(false);
      setGameState('playing');
    });

    audio.playTap();
  };

  // Timer Countdown Effect
  useEffect(() => {
    if ((gameState === 'playing' || gameState === 'feedback') && !isPaused && !showExitConfirm) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Game Over
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeout(() => {
              endGame();
            }, 0);
            return 0;
          }
          if (prev <= 11) {
            // Play ticking warning sound in last 10 seconds
            audio.playTick();
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, isPaused, showExitConfirm]);

  // Handle page visibility change (pause when app goes to background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Only pause if currently playing
        if (gameState === 'playing' || gameState === 'feedback') {
          setIsPaused(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameState]);

  // End Game and handle high scores
  const endGame = () => {
    audio.playGameOver();
    
    startTransition(() => {
      setGameState('result');
    });
    
    const score = stats.score;
    if (gameMode === 'mix') {
      const best = Math.max(highScoreMix, score);
      setHighScoreMix(best);
      safeSetItem('colormix_high_mix', best.toString());
    } else {
      const best = Math.max(highScoreQuiz, score);
      setHighScoreQuiz(best);
      safeSetItem('colormix_high_quiz', best.toString());
    }
  };

  // Return to Home
  const returnToHome = () => {
    audio.playTap();
    startTransition(() => {
      setGameState('start');
    });
  };

  // Check if current score qualifies for Top 10 leaderboard
  const qualifiesForLeaderboard = () => {
    const currentLeaderboard = gameMode === 'mix' ? leaderboardMix : leaderboardQuiz;
    if (currentLeaderboard.length < 10) return true;
    const lowestScore = currentLeaderboard[currentLeaderboard.length - 1].score;
    return stats.score > lowestScore;
  };

  // Submit name and score to leaderboard
  const submitToLeaderboard = (nameToRegister: string) => {
    const finalName = nameToRegister.trim() || '名無しプレイヤー';
    const accuracy = calculateAccuracy();
    const todayStr = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const entryId = 'user-' + Date.now();

    const newEntry: LeaderboardEntry = {
      id: entryId,
      name: finalName,
      score: stats.score,
      accuracy,
      date: todayStr,
      isNew: true
    };

    if (gameMode === 'mix') {
      const updatedList = [...leaderboardMix, newEntry]
        .sort((a, b) => b.score - a.score || b.accuracy - a.accuracy)
        .slice(0, 10); // Keep top 10

      const finalizedList = updatedList.map(item => ({
        ...item,
        isNew: item.id === entryId
      }));

      setLeaderboardMix(finalizedList);
      safeSetItem('colormix_leaderboard_mix', JSON.stringify(finalizedList));
    } else {
      const updatedList = [...leaderboardQuiz, newEntry]
        .sort((a, b) => b.score - a.score || b.accuracy - a.accuracy)
        .slice(0, 10); // Keep top 10

      const finalizedList = updatedList.map(item => ({
        ...item,
        isNew: item.id === entryId
      }));

      setLeaderboardQuiz(finalizedList);
      safeSetItem('colormix_leaderboard_quiz', JSON.stringify(finalizedList));
    }

    setNewLeaderboardId(entryId);
    setIsLeaderboardSubmitted(true);
    audio.playCorrect();
  };

  const currentQuestion = shuffledQuestions[currentQuestionIndex];

  // Quiz mode options generator
  useEffect(() => {
    if (gameState === 'playing' && gameMode === 'quiz' && currentQuestion) {
      const correctName = currentQuestion.name;
      const otherColors = QUIZ_COLORS.filter(c => c.name !== correctName);
      const shuffledOthers = shuffleArray(otherColors);
      const selectedOthers = shuffledOthers.slice(0, 3).map(c => c.name);
      const options = shuffleArray([correctName, ...selectedOthers]);
      setQuizOptions(options);
    }
  }, [currentQuestionIndex, shuffledQuestions, gameState, gameMode]);

  // Handle choice selection for quiz mode
  const handleQuizChoiceClick = (selectedName: string) => {
    if (gameState !== 'playing') return;

    const isCorrect = selectedName === currentQuestion.name;

    if (isCorrect) {
      audio.playCorrect();
      setFeedbackType('correct');
      setGameState('feedback');
      
      // Calculate score with streak multiplier
      const basePoints = 100;
      const streakBonus = stats.streak * 20; // 20 bonus points per streak level
      const pointsAdded = basePoints + streakBonus;

      setStats((prev) => ({
        ...prev,
        score: prev.score + pointsAdded,
        correctCount: prev.correctCount + 1,
        totalAnswered: prev.totalAnswered + 1,
        streak: prev.streak + 1,
      }));
    } else {
      audio.playIncorrect();
      setFeedbackType('incorrect');
      setGameState('feedback');

      setStats((prev) => ({
        ...prev,
        incorrectCount: prev.incorrectCount + 1,
        totalAnswered: prev.totalAnswered + 1,
        streak: 0, // Reset streak on wrong answer
      }));
    }

    // Auto proceed after 0.6 seconds
    setTimeout(() => {
      goToNextQuestion();
    }, 600);
  };

  // Handle Basic Color click
  const handleColorClick = (color: BasicColor) => {
    if (gameState !== 'playing') return;

    audio.playTap();

    let newSelection = [...selectedColors];
    if (newSelection.includes(color)) {
      // Deselect color if clicked again
      newSelection = newSelection.filter((c) => c !== color);
    } else {
      // Add color if space available
      const maxSlots = 2; // Fixed 2-color mix in new mode
      if (newSelection.length < maxSlots) {
        newSelection.push(color);
      }
    }

    setSelectedColors(newSelection);

    // Trigger automatic answer checking when slots are fully filled
    const targetLength = 2; // Fixed 2-color mix in new mode
    if (newSelection.length === targetLength) {
      evaluateAnswer(newSelection);
    }
  };

  // Clear current color selection
  const clearSelection = () => {
    audio.playTap();
    setSelectedColors([]);
  };

  // Evaluate the answer
  const evaluateAnswer = (selection: BasicColor[]) => {
    const formula = currentQuestion.formula;
    
    // Check if the selection matches formula (ignoring order)
    const isCorrect = selection.length === formula.length && 
      selection.every((c) => formula.includes(c));

    if (isCorrect) {
      audio.playCorrect();
      setFeedbackType('correct');
      setGameState('feedback');
      
      // Calculate score with streak multiplier
      const basePoints = 100;
      const streakBonus = stats.streak * 20; // 20 bonus points per streak level
      const pointsAdded = basePoints + streakBonus;

      setStats((prev) => ({
        ...prev,
        score: prev.score + pointsAdded,
        correctCount: prev.correctCount + 1,
        totalAnswered: prev.totalAnswered + 1,
        streak: prev.streak + 1,
      }));
    } else {
      audio.playIncorrect();
      setFeedbackType('incorrect');
      setGameState('feedback');

      setStats((prev) => ({
        ...prev,
        incorrectCount: prev.incorrectCount + 1,
        totalAnswered: prev.totalAnswered + 1,
        streak: 0, // Reset streak on wrong answer
      }));
    }

    // Auto proceed after 0.6 seconds
    setTimeout(() => {
      goToNextQuestion();
    }, 600);
  };

  // Move to next question
  const goToNextQuestion = () => {
    setSelectedColors([]);
    setFeedbackType(null);
    setGameState('playing');
    window.scrollTo({ top: 0, behavior: 'auto' });

    setCurrentQuestionIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      // If run out of shuffled questions, reshuffle the entire set
      if (nextIndex >= shuffledQuestions.length) {
        const pool = gameMode === 'mix' ? MIX_COLORS : QUIZ_COLORS;
        setShuffledQuestions(shuffleArray(pool));
        return 0;
      }
      return nextIndex;
    });
  };

  // Calculate Accuracy
  const calculateAccuracy = () => {
    if (stats.totalAnswered === 0) return 0;
    return Math.round((stats.correctCount / stats.totalAnswered) * 100);
  };

  // Calculate Rank (S, A, B, C, D)
  const getRankAndEval = () => {
    const correct = stats.correctCount;
    const accuracy = calculateAccuracy();
    
    let rank = 'D';
    let colorClass = 'text-slate-500 bg-slate-50';
    let message = 'まずは基本の赤・青・黄から練習してみましょう！';

    if (correct >= 15 && accuracy >= 80) {
      rank = 'S';
      colorClass = 'text-amber-500 bg-amber-50 border-amber-200 shadow-amber-100';
      message = '完璧！あなたは真の色彩マスターです！';
    } else if (correct >= 11) {
      rank = 'A';
      colorClass = 'text-purple-600 bg-purple-50 border-purple-200 shadow-purple-100';
      message = '素晴らしい！色の魔術師まであと一歩！';
    } else if (correct >= 7) {
      rank = 'B';
      colorClass = 'text-blue-600 bg-blue-50 border-blue-200 shadow-blue-100';
      message = 'お見事！色の組み合わせがかなり頭に入っていますね！';
    } else if (correct >= 3) {
      rank = 'C';
      colorClass = 'text-green-600 bg-green-50 border-green-200 shadow-green-100';
      message = 'ナイスファイト！もっと混ぜて慣れていきましょう！';
    }

    return { rank, colorClass, message };
  };

  const rankInfo = getRankAndEval();
  const isPlaying = gameState === 'playing' || gameState === 'feedback';

  return (
    <div id="game_root" className="min-h-screen bg-paint-texture flex flex-col justify-between font-sans text-slate-800 antialiased selection:bg-rose-200 selection:text-rose-900">
      
      {/* Main Container */}
      <main id="game_main_container" className={`flex-grow flex items-center justify-center ${isPlaying ? 'p-1.5 sm:p-4' : 'p-2 sm:p-4'}`}>
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            
            {/* 1. START SCREEN */}
            {gameState === 'start' && (
              <motion.div
                id="start_screen"
                key="start"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/60 border border-slate-100"
              >
                {/* Hero / Icon */}
                <div id="hero_visual" className="flex flex-col items-center text-center mb-6">
                  <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden flex items-center justify-center shadow-lg shadow-indigo-100/80 relative z-10 border-2 border-white bg-slate-50">
                      <img 
                        src={paintPaletteIcon} 
                        alt="絵の具パレット" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-br from-red-500 via-yellow-400 to-blue-600 blur-md opacity-25" />
                  </div>
                  
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2">
                    色混ぜマスター
                  </h2>
                  <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                    問題と同じ色を作るために、基本の絵の具を混ぜ合わせるカラーパズルゲーム！
                  </p>
                </div>

                {/* Rules / How to play */}
                <div id="instructions" className="bg-slate-50 rounded-2xl p-4 mb-6 text-sm text-slate-600 space-y-3.5 relative overflow-hidden">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold tracking-wider flex items-center gap-1">
                      ⏳ タイムアタック形式
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold">
                      制限時間: 各モード 60秒
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">A</span>
                    <p className="leading-relaxed text-xs">
                      <b className="text-slate-800 text-sm">混色当て</b><br />
                      制限時間内に、お題の色になるように2つの基本色をタップして混ぜ合わせるパズルモード。素早く混ぜて高得点を目指そう！
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center mt-0.5">B</span>
                    <p className="leading-relaxed text-xs">
                      <b className="text-slate-800 text-sm">色当てクイズ</b><br />
                      制限時間内に、表示された色を見て、その色の正しい名前を4つの選択肢から選んで答える新モード。マニアックな色彩知識に挑戦！
                    </p>
                  </div>
                </div>

                {/* Guide & Ranking Trigger Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <motion.button
                    id="open_guide_btn"
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      audio.playTap();
                      setShowGuide(true);
                    }}
                    className="py-3 px-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center border border-indigo-100 transition-all cursor-pointer shadow-sm shadow-indigo-100/50"
                  >
                    <span>色の図鑑</span>
                  </motion.button>

                  <motion.button
                    id="open_leaderboard_btn"
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      audio.playTap();
                      setLeaderboardTab(gameMode || 'mix');
                      setShowLeaderboard(true);
                    }}
                    className="py-3 px-3 rounded-2xl bg-amber-50/80 hover:bg-amber-100 text-amber-700 font-extrabold text-xs flex items-center justify-center border border-amber-100 transition-all cursor-pointer shadow-sm shadow-amber-100/50"
                  >
                    <span>ランキング</span>
                  </motion.button>
                </div>

                {/* Mode Select Buttons */}
                <div id="mode_selector" className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">ゲームモードを選択してスタート</h3>
                  
                  {/* Mix Mode Selection Card */}
                  <motion.button
                    id="select_mix_btn"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => startGame('mix')}
                    className="w-full text-left p-4 rounded-2xl border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50/20 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                        混
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          混色当て <span className="text-xs font-normal text-slate-500">(2色の混色)</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          ベストスコア: <span className="font-mono font-semibold text-slate-600">{highScoreMix}点</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-slate-400 group-hover:text-indigo-500 font-bold transition-colors select-none">&gt;</span>
                  </motion.button>

                  {/* Quiz Mode Selection Card */}
                  <motion.button
                    id="select_quiz_btn"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => startGame('quiz')}
                    className="w-full text-left p-4 rounded-2xl border-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50/20 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                        ク
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          色当てクイズ <span className="text-xs font-normal text-slate-500">(4択問題)</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          ベストスコア: <span className="font-mono font-semibold text-slate-600">{highScoreQuiz}点</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-slate-400 group-hover:text-rose-500 font-bold transition-colors select-none">&gt;</span>
                  </motion.button>
                </div>

                {/* Footer credit */}
                <div className="mt-6 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <span>⏳ 60秒スピード勝負！</span>
                  <span>•</span>
                  <span>スマホ＆PC対応</span>
                </div>
              </motion.div>
            )}

            {/* 2. PLAYING / FEEDBACK SCREEN */}
            {(gameState === 'playing' || gameState === 'feedback') && currentQuestion && (
              <motion.div
                id="playing_screen"
                key="playing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl p-2 sm:p-4 md:p-5 shadow-xl shadow-slate-200/60 border border-slate-100"
              >
                {/* Stats Header */}
                <div id="stats_header" className="grid grid-cols-3 gap-2 items-center mb-1.5 sm:mb-3 border-b border-slate-100 pb-1.5 sm:pb-2">
                  {/* Timer */}
                  <div className="flex items-center gap-1.5">
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-extrabold ${timeLeft <= 10 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-600'}`}>
                      残り
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">時間</div>
                      <div className={`text-sm sm:text-base font-mono font-extrabold leading-none ${timeLeft <= 10 ? 'text-red-600 font-black' : 'text-slate-800'}`}>
                        {timeLeft}秒
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">スコア</div>
                    <div className="text-base sm:text-lg font-mono font-black text-indigo-600">
                      {stats.score}
                    </div>
                  </div>

                  {/* Streak / High Score */}
                  <div className="flex items-center gap-1.5 justify-end">
                    {stats.streak > 0 && (
                      <motion.div 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: [1, 1.15, 1] }}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                      >
                        <span className="text-[10px] font-black font-mono">{stats.streak} 連続正解</span>
                      </motion.div>
                    )}
                    {stats.streak === 0 && (
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block font-semibold leading-none">ベスト</span>
                        <span className="text-xs font-mono font-bold text-slate-500">
                          {gameMode === 'mix' ? highScoreMix : highScoreQuiz}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar of timer */}
                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mb-2 sm:mb-3">
                  <div 
                    className={`h-full transition-all duration-1000 ${
                      timeLeft <= 10 ? 'bg-red-500' : timeLeft <= 25 ? 'bg-amber-400' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${(timeLeft / 60) * 100}%` }}
                  />
                </div>

                {/* Target Swatch Area */}
                <div id="target_swatch_container" className="relative mb-2 sm:mb-3 flex flex-col items-center">
                  
                  {/* Swatch color display - enlarged as requested */}
                  <div className="w-full h-40 sm:h-48 md:h-52 rounded-xl sm:rounded-2xl relative shadow-md overflow-hidden flex flex-col items-center justify-center">
                    
                    {/* The Color Background */}
                    <div 
                       className="absolute inset-0 w-full h-full transition-colors duration-500" 
                      style={{ backgroundColor: currentQuestion.hex }}
                    />
                    
                    {/* Subtle Overlay Pattern for contrast */}
                    <div className="absolute inset-0 bg-black/5 mix-blend-overlay pointer-events-none" />

                    {/* Content over color */}
                    <div className="relative z-10 flex flex-col items-center p-2 sm:p-3 bg-white/90 backdrop-blur-md rounded-lg sm:rounded-2xl shadow-lg shadow-slate-900/10 border border-white max-w-[85%] text-center">
                      {gameMode === 'quiz' ? (
                        <>
                          <h3 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-slate-900 leading-tight">
                            この色は何色？
                          </h3>
                          <p className="text-[8px] sm:text-[10px] text-slate-500 mt-0.5 font-bold tracking-wider">
                            正しい名前を4つの選択肢から選んでね！
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-slate-900 leading-tight">
                            {currentQuestion.name}
                          </h3>
                          <p className="text-[8px] sm:text-[10px] text-slate-500 mt-0.5 font-bold tracking-wider">
                            2つの色を混ぜてね
                          </p>
                        </>
                      )}
                    </div>

                    {/* Feedback Overlays */}
                    <AnimatePresence>
                      {feedbackType === 'correct' && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1.1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-20 bg-emerald-500/90 backdrop-blur-sm flex flex-col items-center justify-center text-white"
                        >
                          <div className="w-12 h-12 rounded-full border-4 border-white flex items-center justify-center mb-1 text-2xl font-black font-sans leading-none">
                            ✓
                          </div>
                          <span className="text-xl font-black tracking-widest">正解！</span>
                          {stats.streak > 1 && (
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full mt-1 font-mono font-bold">
                              +{100 + (stats.streak - 1) * 20}点 (連鎖中)
                            </span>
                          )}
                        </motion.div>
                      )}

                      {feedbackType === 'incorrect' && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1.1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-20 bg-rose-500/95 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 text-center"
                        >
                          <div className="w-12 h-12 rounded-full border-4 border-white flex items-center justify-center mb-1.5 text-2xl font-black font-sans leading-none">
                            ✕
                          </div>
                          <span className="text-lg font-black tracking-widest">不正解</span>
                          
                          {/* Educational formula / answer hint */}
                          <div className="mt-2 bg-black/10 px-3 py-1.5 rounded-xl text-xs max-w-xs">
                            <span className="block text-[10px] opacity-75 mb-0.5 font-bold">
                              {gameMode === 'quiz' ? '正しい色名:' : '正しく作れる組み合わせ:'}
                            </span>
                            <span className="font-bold tracking-wide">
                              {gameMode === 'quiz' ? currentQuestion.name : currentQuestion.formula.join(' ＋ ')}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>

                </div>

                {gameMode === 'quiz' ? (
                  /* quiz mode multiple choice buttons */
                  <div id="quiz_choices_area" className="mb-3 space-y-2">
                    <h4 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
                      名前の選択肢
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      {quizOptions.map((optionName, idx) => (
                        <motion.button
                          id={`quiz_choice_btn_${idx}`}
                          key={idx}
                          whileHover={{ scale: 1.02, y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleQuizChoiceClick(optionName)}
                          className="w-full py-3 sm:py-3.5 px-3 rounded-2xl bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 text-slate-800 font-extrabold text-xs sm:text-sm transition-all cursor-pointer shadow-sm text-center flex items-center justify-center min-h-[50px] sm:min-h-[56px] leading-snug"
                        >
                          {optionName}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* mix mode inputs */
                  <>
                    {/* Selected Color Slots (Mixed Indicator) */}
                    <div id="selection_slots_area" className="mb-2 sm:mb-4 bg-slate-50/70 rounded-xl p-2 sm:p-3.5 flex flex-col items-center">
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-400 mb-1.5">
                        {selectedColors.length === 0 ? (
                          '混ぜ合わせる色を選んでね'
                        ) : (
                          <span>
                            選択中 (あと{' '}
                            <span className="font-mono font-extrabold text-indigo-600">
                              {2 - selectedColors.length}
                            </span>{' '}
                            色)
                          </span>
                        )}
                      </span>

                      {/* Slot Circles */}
                      <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
                        {Array.from({ length: 2 }).map((_, index) => {
                          const selectedColorName = selectedColors[index];
                          const selectedColorObj = selectedColorName 
                            ? BASIC_COLORS.find((c) => c.id === selectedColorName) 
                            : null;

                          return (
                            <div key={index} className="flex items-center">
                              {index > 0 && <span className="text-slate-300 font-bold text-xs sm:text-sm mr-1.5 sm:mr-3">＋</span>}
                              
                              <motion.div
                                layout
                                className={`w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex flex-col items-center justify-center relative shadow-inner border transition-all cursor-pointer ${
                                  selectedColorObj 
                                    ? 'border-transparent shadow-md' 
                                    : 'border-dashed border-slate-300 bg-white hover:border-slate-400'
                                }`}
                                style={{ backgroundColor: selectedColorObj?.hex || 'transparent' }}
                                onClick={() => {
                                  if (selectedColorName) {
                                    handleColorClick(selectedColorName);
                                  }
                                }}
                                whileHover={selectedColorName ? { scale: 1.05 } : {}}
                                whileTap={selectedColorName ? { scale: 0.95 } : {}}
                              >
                                {selectedColorObj ? (
                                  <div className="text-center flex flex-col items-center justify-center px-1">
                                    <span 
                                      className="text-[9px] sm:text-xs font-black drop-shadow-sm tracking-tighter leading-none truncate max-w-full"
                                      style={{ color: selectedColorObj.textColor }}
                                    >
                                      {selectedColorObj.name}
                                    </span>
                                    <span className="absolute -top-0.5 -right-0.5 bg-slate-800 text-white w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full flex items-center justify-center text-[6px] sm:text-[8px] font-bold shadow-sm">
                                      ×
                                    </span>
                                  </div>
                                ) : (
                                  <div className="w-1 h-1 sm:w-2 sm:h-2 rounded-full bg-slate-300" />
                                )}
                              </motion.div>
                            </div>
                          );
                        })}

                        {selectedColors.length > 0 && (
                          <button
                            id="clear_selection_btn"
                            onClick={clearSelection}
                            className="ml-2 sm:ml-4 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-white text-slate-500 text-[10px] sm:text-xs font-extrabold border border-slate-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center cursor-pointer"
                            title="選択をクリア"
                          >
                            <span>やり直す</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Six Basic Color Buttons Grid */}
                    <div id="palette_buttons_area" className="mb-2">
                      <h4 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
                        絵の具パレット
                      </h4>
                      
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {BASIC_COLORS.map((color) => {
                          const isSelected = selectedColors.includes(color.id);
                          
                          return (
                            <motion.button
                              id={`color_btn_${color.id}`}
                              key={color.id}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleColorClick(color.id)}
                              className={`h-10 sm:h-13 md:h-15 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center relative cursor-pointer shadow-sm transition-all border ${
                                isSelected 
                                  ? 'ring-4 ring-indigo-500/40 ring-offset-1 border-transparent scale-102 shadow-md' 
                                  : color.id === '白'
                                    ? 'border-slate-200 hover:border-slate-300'
                                    : 'border-transparent hover:brightness-105'
                              }`}
                              style={{ backgroundColor: color.hex }}
                            >
                              {/* Selected Checkmark Indicator */}
                              {isSelected && (
                                <div className="absolute top-1 right-1 px-1 sm:px-1.5 py-0.5 rounded-md bg-indigo-600 text-white font-black text-[7px] sm:text-[8px] flex items-center justify-center shadow-sm">
                                  選択中
                                </div>
                              )}

                              <span 
                                className="text-xs sm:text-sm font-extrabold tracking-wide drop-shadow-sm"
                                style={{ color: color.textColor }}
                              >
                                {color.name}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Quit/Abort Button */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] sm:text-xs">
                  <span className="text-slate-400 font-mono">Q.{stats.totalAnswered + 1}</span>
                  <button
                    id="quit_game_btn"
                    onClick={() => {
                      audio.playTap();
                      setShowExitConfirm(true);
                    }}
                    className="text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 px-2 py-1 rounded-lg transition-all flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <span>タイトルに戻る</span>
                  </button>
                </div>

              </motion.div>
            )}

            {/* 3. RESULT SCREEN */}
            {gameState === 'result' && (
              <motion.div
                id="result_screen"
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/60 border border-slate-100"
              >
                {/* Header Title */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="px-4 py-2 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-xs uppercase tracking-widest mb-3 border border-indigo-100/50">
                    RESULT
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                    タイムアップ！
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    あなたの色混ぜテクニックの結果です
                  </p>
                </div>

                {/* Score and Rank layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  
                  {/* Rank Block */}
                  <div className={`p-5 rounded-2xl border flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-300 ${rankInfo.colorClass}`}>
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">
                      ランク評価
                    </span>
                    <span className="text-6xl font-black tracking-tighter my-2 animate-bounce">
                      {rankInfo.rank}
                    </span>
                    <p className="text-xs font-bold leading-normal px-2">
                      {rankInfo.message}
                    </p>
                  </div>

                  {/* Core Statistics Blocks */}
                  <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-between space-y-2.5">
                    
                    {/* Score */}
                    <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        最終スコア
                      </span>
                      <span className="text-lg font-mono font-black text-indigo-600">
                        {stats.score} 点
                      </span>
                    </div>

                    {/* Correct Answers */}
                    <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                      <span className="text-xs font-bold text-slate-400">正解数</span>
                      <span className="text-sm font-bold text-slate-800">
                        <span className="font-mono text-base text-emerald-600 font-extrabold">{stats.correctCount}</span> / {stats.totalAnswered} 問
                      </span>
                    </div>

                    {/* Accuracy rate */}
                    <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                      <span className="text-xs font-bold text-slate-400 font-bold">正答率</span>
                      <span className="text-sm font-bold text-slate-800">
                        <span className="font-mono text-base text-indigo-600 font-extrabold">{calculateAccuracy()}%</span>
                      </span>
                    </div>

                    {/* Mode info */}
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs font-bold text-slate-400">プレイモード</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/60 text-slate-600">
                        {gameMode === 'mix' ? '混色当て (2色)' : '色当てクイズ (4択)'}
                      </span>
                    </div>

                  </div>

                </div>

                {/* Leaderboard Registration and View */}
                {qualifiesForLeaderboard() ? (
                  !isLeaderboardSubmitted ? (
                    <div className="bg-amber-50/60 border border-amber-200/50 rounded-2xl p-4 mb-6">
                      <div className="flex items-center gap-2 mb-2 text-amber-800">
                        <span className="font-extrabold text-xs">トップ10 ランクイン！ランキングに登録できます</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={12}
                          value={registerName}
                          onChange={(e) => setRegisterName(e.target.value)}
                          placeholder="お名前を入力 (最大12文字)"
                          className="flex-grow bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                        />
                        <button
                          onClick={() => submitToLeaderboard(registerName)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-amber-100 cursor-pointer"
                        >
                          登録
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 mb-6">
                      <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-extrabold text-xs mb-3">
                        <span>ランキングに登録されました！</span>
                      </div>
                      
                      {/* Top 10 List representation */}
                      <div className="bg-white/90 rounded-xl p-3 border border-emerald-100/50 max-h-48 overflow-y-auto space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 block mb-1">現在のトップ10ランキング</span>
                        {(gameMode === 'mix' ? leaderboardMix : leaderboardQuiz).map((entry, index) => {
                          const isUser = entry.id === newLeaderboardId;
                          return (
                            <div 
                              key={entry.id} 
                              className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg ${isUser ? 'bg-indigo-50 border border-indigo-200/40 text-indigo-900 font-bold' : 'text-slate-600'}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-4 h-4 rounded-md flex items-center justify-center font-mono font-bold text-[9px] ${
                                  index === 0 ? 'bg-amber-100 text-amber-700' :
                                  index === 1 ? 'bg-slate-100 text-slate-600' :
                                  index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'
                                }`}>
                                  {index + 1}
                                </span>
                                <span className="truncate max-w-[120px] text-[11px]">{entry.name}</span>
                                {isUser && <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded font-bold">YOU</span>}
                              </div>
                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                <span className="font-mono text-slate-400 text-[9px]">正答率:{entry.accuracy}%</span>
                                <span className="font-mono font-bold text-indigo-600 text-[11px]">{entry.score}点</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-500">現在のランキング (トップ10)</span>
                      <span className="text-[10px] text-slate-400 font-medium">惜しい！あと少しでランクインでした</span>
                    </div>
                    <div className="bg-white/90 rounded-xl p-3 border border-slate-100 max-h-48 overflow-y-auto space-y-1">
                      {(gameMode === 'mix' ? leaderboardMix : leaderboardQuiz).map((entry, index) => (
                        <div 
                          key={entry.id} 
                          className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg text-slate-600"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-4 h-4 rounded-md flex items-center justify-center font-mono font-bold text-[9px] ${
                              index === 0 ? 'bg-amber-100 text-amber-700' :
                              index === 1 ? 'bg-slate-100 text-slate-600' :
                              index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'
                            }`}>
                              {index + 1}
                            </span>
                            <span className="truncate max-w-[120px] text-[11px]">{entry.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <span className="font-mono text-slate-400 text-[9px]">正答率:{entry.accuracy}%</span>
                            <span className="font-mono font-bold text-slate-700 text-[11px]">{entry.score}点</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Primary Actions */}
                <div className="space-y-3">
                  <motion.button
                    id="play_again_btn"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => startGame(gameMode)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center shadow-lg shadow-indigo-200 cursor-pointer text-sm"
                  >
                    <span>もう一度プレイする</span>
                  </motion.button>

                  <motion.button
                    id="return_title_btn"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={returnToHome}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center cursor-pointer text-sm transition-colors"
                  >
                    <span>タイトル画面に戻る</span>
                  </motion.button>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Dynamic Footer / Bottom Bar */}
      <footer id="app_header" className={`w-full max-w-lg mx-auto px-3.5 border-t border-slate-100 bg-white/80 backdrop-blur-md sticky bottom-0 z-40 transition-all ${
        isPlaying ? 'py-1.5 sm:py-2 flex flex-row items-center justify-between gap-1' : 'py-2.5 sm:py-3.5 flex flex-col gap-2'
      }`}>
        <div className="flex items-center justify-between w-full">
          <div id="header_logo" className="flex items-center gap-2 cursor-pointer" onClick={returnToHome}>
            <div className={`rounded-xl overflow-hidden flex items-center justify-center shadow-md shadow-rose-100 border border-slate-100 bg-white transition-all ${
              isPlaying ? 'w-7 h-7' : 'w-9 h-9'
            }`}>
              <img 
                src={paintPaletteIcon} 
                alt="色" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className={`font-bold tracking-tight text-slate-800 transition-all ${isPlaying ? 'text-xs sm:text-sm' : 'text-base'}`}>色混ぜマスター</h1>
              {!isPlaying && <p className="text-[10px] text-slate-400 font-mono">Color Mix Master</p>}
            </div>
          </div>

          <div id="header_actions" className="flex items-center gap-2">
            {/* Audio toggle button */}
            <button
              id="sound_toggle_btn"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                audio.playTap();
              }}
              className={`rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
                isPlaying ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px] rounded-xl'
              } ${
                soundEnabled 
                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
              title={soundEnabled ? '音声をオフにする' : '音声をオンにする'}
            >
              <span className="font-black tracking-wider">{soundEnabled ? "音量ON" : "音量OFF"}</span>
            </button>

            {/* Info button */}
            <button
              id="info_btn"
              onClick={() => {
                audio.playTap();
                setIsInfoOpen(true);
              }}
              className={`rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer bg-slate-100 text-slate-600 hover:bg-slate-200 ${
                isPlaying ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px] rounded-xl'
              }`}
              title="情報"
            >
              <span className="font-black tracking-wider">ℹ️ 情報</span>
            </button>
          </div>
        </div>

        {/* Tiny copyright note */}
        {!isPlaying && (
          <p className="text-[9px] text-slate-400 font-medium text-center border-t border-slate-100/50 pt-2">
            © 2026 色混ぜマスター • Designed with precision
          </p>
        )}
      </footer>

      {/* 4. COLOR GUIDE DICTIONARY MODAL */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            id="guide_modal_overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              audio.playTap();
              setShowGuide(false);
            }}
          >
            <motion.div
              id="guide_modal_card"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black">
                    図鑑
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">混色ルール ＆ 色の図鑑</h3>
                    <p className="text-[9px] text-slate-400 font-bold">Mixing Rules & Guide</p>
                  </div>
                </div>
                <button
                  id="close_guide_btn"
                  onClick={() => {
                    audio.playTap();
                    setShowGuide(false);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition-all cursor-pointer select-none"
                >
                  ✕
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50/50">
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    id="guide_tab_formula_btn"
                    onClick={() => {
                      audio.playTap();
                      setGuideTab('formula');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                      guideTab === 'formula'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    混色の組み合わせ
                  </button>
                  <button
                    id="guide_tab_color_dict_btn"
                    onClick={() => {
                      audio.playTap();
                      setGuideTab('color_dict');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                      guideTab === 'color_dict'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    色名図鑑
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-5 overflow-y-auto flex-grow">
                {guideTab === 'formula' ? (
                  <div className="space-y-5">
                    {/* Advisory Notice Section */}
                    <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-4 text-xs text-amber-950 leading-relaxed space-y-2">
                      <h4 className="font-extrabold flex items-center gap-1.5 text-amber-800">
                        色の混色ルールについて
                      </h4>
                      <p>
                        このゲームでは<b>絵の具の混色ルール</b>を採用しています。
                      </p>
                      <p>
                        色の作り方には絵の具・光・印刷など複数の方式があり、実際には同じ色でも作り方が異なる場合があります。
                      </p>
                      <p className="font-semibold bg-white/60 p-2 rounded-lg border border-amber-200/40">
                        このゲームでは、下記の混色の組み合わせを正解として判定します。
                      </p>
                    </div>

                    {/* Guide List */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 mb-3 px-1">混色当て（2色）の組み合わせ一覧</h4>

                      {/* List of Colors and Formulas */}
                      <div className="space-y-2.5">
                        {MIX_COLORS.map((color, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50/60 hover:bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-4 transition-colors"
                          >
                            {/* Target Color Preview */}
                            <div className="flex items-center gap-2.5 min-w-[100px]">
                              <div
                                className="w-8 h-8 rounded-full shadow-sm border border-black/5 flex-shrink-0"
                                style={{ backgroundColor: color.hex }}
                              />
                              <span className="text-xs font-extrabold text-slate-800 leading-none">
                                {color.name}
                              </span>
                            </div>

                            {/* Equals arrow / sign */}
                            <span className="text-[10px] font-bold text-slate-300">＝</span>

                            {/* Formula items */}
                            <div className="flex items-center gap-1 flex-wrap justify-end flex-grow">
                              {color.formula.map((componentColor, cIdx) => {
                                const basicColorObj = BASIC_COLORS.find((bc) => bc.id === componentColor);
                                return (
                                  <div key={cIdx} className="flex items-center">
                                    {cIdx > 0 && (
                                      <span className="text-[10px] text-slate-300 font-bold mx-0.5">＋</span>
                                    )}
                                    <span
                                      className="px-2 py-1 rounded-lg text-[9px] font-extrabold border shadow-sm leading-none"
                                      style={{
                                        backgroundColor: basicColorObj?.hex || '#FFFFFF',
                                        color: basicColorObj?.textColor || '#000000',
                                        borderColor: componentColor === '白' ? '#E2E8F0' : 'transparent',
                                      }}
                                    >
                                      {componentColor}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Dictionary Intro Section */}
                    <div className="bg-indigo-50/60 border border-indigo-100/60 rounded-2xl p-4 text-xs text-indigo-950 leading-relaxed space-y-1.5">
                      <h4 className="font-extrabold flex items-center gap-1.5 text-indigo-800">
                        🎨 新モード「色当てクイズ」対応
                      </h4>
                      <p>
                        「色当てクイズ」に出題される、ちょっとマニアックで美しい色たちの図鑑です。
                      </p>
                      <p className="text-slate-500 font-medium text-[11px]">
                        色見本とカラーコードから正しい名前を覚えて、ハイスコアを目指しましょう！
                      </p>
                    </div>

                    {/* List of Colors (Grid layout) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {QUIZ_COLORS.map((color, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl border border-slate-100 flex flex-col gap-2 transition-all hover:scale-[1.02]"
                        >
                          {/* Swatch */}
                          <div
                            className="w-full h-12 rounded-xl shadow-inner border border-black/5 relative overflow-hidden"
                            style={{ backgroundColor: color.hex }}
                          />
                          {/* Information */}
                          <div className="px-0.5 space-y-0.5">
                            <span className="text-xs font-black text-slate-800 block truncate">
                              {color.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-indigo-500/80 block tracking-wider leading-none">
                              {color.hex}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  id="guide_modal_ok_btn"
                  onClick={() => {
                    audio.playTap();
                    setShowGuide(false);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 cursor-pointer"
                >
                  了解しました
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. LEADERBOARD MODAL */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            id="leaderboard_modal_overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => {
              audio.playTap();
              setShowLeaderboard(false);
            }}
          >
            <motion.div
              id="leaderboard_modal_card"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-black">
                    順位
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">スコアランキング (TOP 10)</h3>
                    <p className="text-[9px] text-slate-400 font-bold">Score Leaderboard</p>
                  </div>
                </div>
                <button
                  id="close_leaderboard_btn"
                  onClick={() => {
                    audio.playTap();
                    setShowLeaderboard(false);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition-all cursor-pointer select-none"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-5 overflow-y-auto space-y-4 flex-grow">
                {/* Mode Selector Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    id="leaderboard_tab_mix"
                    onClick={() => {
                      audio.playTap();
                      setLeaderboardTab('mix');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      leaderboardTab === 'mix'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    混色当て (2色)
                  </button>
                  <button
                    id="leaderboard_tab_quiz"
                    onClick={() => {
                      audio.playTap();
                      setLeaderboardTab('quiz');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      leaderboardTab === 'quiz'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    色当てクイズ
                  </button>
                </div>

                {/* Score list */}
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {(leaderboardTab === 'mix' ? leaderboardMix : leaderboardQuiz).length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      まだランキングデータがありません。
                    </div>
                  ) : (
                    (leaderboardTab === 'mix' ? leaderboardMix : leaderboardQuiz).map((entry, index) => {
                      return (
                        <div
                          key={entry.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                            entry.isNew 
                              ? 'bg-indigo-50/70 border-indigo-200 shadow-sm shadow-indigo-100/50' 
                              : 'bg-slate-50/60 border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Rank Medal / Badge */}
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                              index === 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              index === 1 ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                              index === 2 ? 'bg-orange-100 text-orange-700 border border-orange-200' : 
                              'bg-white text-slate-400 border border-slate-100'
                            }`}>
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-extrabold text-slate-800 truncate block">
                                  {entry.name}
                                </span>
                                {entry.isNew && (
                                  <span className="text-[8px] font-bold bg-indigo-100 text-indigo-700 px-1 rounded-md py-0.5 uppercase tracking-wide">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-slate-400 font-medium font-mono">
                                {entry.date}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-right flex-shrink-0">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-mono font-black text-indigo-600">
                                {entry.score}点
                              </span>
                              <span className="text-[9px] font-semibold text-slate-400 font-mono">
                                正答率: {entry.accuracy}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  id="leaderboard_modal_close_btn"
                  onClick={() => {
                    audio.playTap();
                    setShowLeaderboard(false);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. PAUSE MODAL (一時停止画面) */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            id="pause_modal_overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              id="pause_modal_content"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100 flex flex-col items-center"
            >
              {/* Pause Icon/Visual representation */}
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600 shadow-inner">
                <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-2">ゲーム一時停止中</h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                画面が切り替わったため、ゲームを一時停止しました。<br />「再開する」を押すと、タイマーが再び動き出します。
              </p>

              {/* Action buttons */}
              <div className="flex flex-col gap-2.5 w-full">
                <button
                  id="resume_game_btn"
                  onClick={() => {
                    setIsPaused(false);
                    audio.playTap();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 transition-all cursor-pointer"
                >
                  ゲームを再開する
                </button>
                
                <button
                  id="quit_game_from_pause_btn"
                  onClick={() => {
                    setIsPaused(false);
                    returnToHome();
                    audio.playTap();
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all cursor-pointer"
                >
                  タイトルに戻る
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. INFO MODAL (情報・プライバシーポリシー画面) */}
      <AnimatePresence>
        {isInfoOpen && (
          <motion.div
            id="info_modal_overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsInfoOpen(false)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              id="info_modal_content"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col relative"
            >
              {/* Close Button Top Right */}
              <button
                id="close_info_modal_top_btn"
                onClick={() => {
                  setIsInfoOpen(false);
                  audio.playTap();
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                title="閉じる"
              >
                ✕
              </button>

              {/* Header */}
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                  <span className="text-xl">ℹ️</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">アプリ情報</h3>
                  <p className="text-[10px] text-slate-400 font-mono">App Information</p>
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-5 text-left mb-6 overflow-y-auto max-h-[60vh] pr-1">
                {/* Privacy Policy */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <h4 className="text-sm font-extrabold text-slate-800 mb-2 flex items-center gap-1.5">
                    <span>🔒</span> プライバシーポリシー
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    本アプリは、利用者の個人情報を一切収集・送信しません。ゲームの進行状況やハイスコアは、利用者の端末内（localStorage）にのみ保存されます。
                  </p>
                </div>

                {/* Credits */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <h4 className="text-sm font-extrabold text-slate-800 mb-2 flex items-center gap-1.5">
                    <span>✨</span> クレジット
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
                    <li className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">・</span>
                      <span>メインビジュアル：Google AI Studio (Gemini)</span>
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">・</span>
                      <span>開発・デザイン：色混ぜマスター制作チーム</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action button */}
              <button
                id="close_info_modal_btn"
                onClick={() => {
                  setIsInfoOpen(false);
                  audio.playTap();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 transition-all cursor-pointer"
              >
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. EXIT CONFIRM MODAL (ゲーム終了確認画面) */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            id="exit_confirm_modal_overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              id="exit_confirm_modal_content"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100 flex flex-col items-center"
            >
              {/* Alert Icon */}
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-4 text-rose-600 shadow-inner">
                <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-2">確認</h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                本当にタイトルに戻りますか？<br />
                <span className="text-rose-500 font-extrabold">（現在のスコアはリセットされます）</span>
              </p>

              {/* Action buttons */}
              <div className="flex flex-col gap-2.5 w-full">
                <button
                  id="exit_confirm_yes_btn"
                  onClick={() => {
                    setShowExitConfirm(false);
                    returnToHome();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-100 transition-all cursor-pointer"
                >
                  タイトルに戻る
                </button>
                
                <button
                  id="exit_confirm_no_btn"
                  onClick={() => {
                    setShowExitConfirm(false);
                    audio.playTap();
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all cursor-pointer"
                >
                  ゲームを続ける
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
