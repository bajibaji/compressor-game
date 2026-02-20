import { useState, useEffect, useRef, useCallback } from 'react';
import { Power, RotateCcw, Play, Square, CheckCircle2, Trophy, HelpCircle, X } from 'lucide-react';
import LightRays from './components/LightRays';

// --- 类型定义 ---
type ParamType = 'linear' | 'log';

interface Tick {
  value: number;
  label: string;
}

interface ParamConfig {
  min: number;
  max: number;
  default: number;
  unit: string;
  label: string;
  type: ParamType;
  ticks?: Tick[];
}

interface ParamsState {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
}

// --- 工具函数：线性和对数映射 ---
const logMap = (value: number, min: number, max: number): number => {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  const scale = (Math.log(value) - minLog) / (maxLog - minLog);
  return scale;
};

const reverseLogMap = (scale: number, min: number, max: number): number => {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return Math.exp(minLog + scale * (maxLog - minLog));
};

const linearMap = (value: number, min: number, max: number): number => (value - min) / (max - min);
const reverseLinearMap = (scale: number, min: number, max: number): number => min + scale * (max - min);

// 参数配置定义
const PARAMS_CONFIG: Record<keyof ParamsState, ParamConfig> = {
  threshold: { min: -60, max: 0, default: -20, unit: 'dB', label: 'Threshold', type: 'linear' },
  ratio: { 
    min: 1, max: 20, default: 4, unit: ':1', label: 'Ratio', type: 'log',
    ticks: [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 4, label: '4' },
      { value: 10, label: '10' },
      { value: 20, label: '20' }
    ]
  },
  attack: { 
    min: 0.01, max: 30, default: 5, unit: 'ms', label: 'Attack', type: 'log',
    ticks: [
      { value: 0.01, label: '.01' },
      { value: 0.1, label: '.1' },
      { value: 0.3, label: '.3' },
      { value: 1, label: '1' },
      { value: 3, label: '3' },
      { value: 10, label: '10' },
      { value: 30, label: '30' }
    ]
  },
  release: { 
    min: 0.1, max: 1200, default: 200, unit: 'ms', label: 'Release', type: 'log',
    ticks: [
      { value: 0.1, label: '.1' },
      { value: 0.5, label: '.5' },
      { value: 2.5, label: '2.5' },
      { value: 10, label: '10' },
      { value: 50, label: '50' },
      { value: 250, label: '250' },
      { value: 1200, label: '1200' }
    ]
  }
};

const MAX_ROUNDS = 10;

// --- 高级拟真旋钮组件 Props ---
interface KnobProps {
  config: ParamConfig;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

const Knob = ({ config, value, onChange, disabled }: KnobProps) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = config.type === 'log' ? logMap(value, config.min, config.max) : linearMap(value, config.min, config.max);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY;
    const sensitivity = 0.005; 
    const newScale = Math.max(0, Math.min(1, startVal.current + deltaY * sensitivity));
    
    let newValue;
    if (config.type === 'log') {
      newValue = reverseLogMap(newScale, config.min, config.max);
    } else {
      newValue = reverseLinearMap(newScale, config.min, config.max);
    }
    onChange(newValue);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const displayValue = value < 0 ? Math.round(value) : value < 1 ? value.toFixed(2) : value < 10 ? value.toFixed(1) : Math.round(value);

  const scale = config.type === 'log' ? logMap(value, config.min, config.max) : linearMap(value, config.min, config.max);
  const rotation = -135 + scale * 270;
  const arcLength = 164.93; 
  const dashOffset = arcLength - (scale * arcLength);

  return (
    <div className="flex flex-col items-center justify-center m-2 mt-6">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[0_0_5px_rgba(6,182,212,0.6)]" viewBox="0 0 100 100">
          <path d="M 25.25 74.75 A 35 35 0 1 1 74.75 74.75" fill="none" stroke="#1f2937" strokeWidth="5" strokeLinecap="round" />
          <path 
            d="M 25.25 74.75 A 35 35 0 1 1 74.75 74.75" 
            fill="none" stroke="#06b6d4" strokeWidth="5" strokeLinecap="round" 
            strokeDasharray={arcLength} strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
          />
        </svg>

        {config.ticks && config.ticks.map(tick => {
          const tickScale = config.type === 'log' ? logMap(tick.value, config.min, config.max) : linearMap(tick.value, config.min, config.max);
          const deg = -135 + tickScale * 270;
          return (
            <div key={tick.value} className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${deg}deg)` }}>
              <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[2.5px] h-[6px] bg-gray-300 rounded-full"></div>
              <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 flex justify-center items-center">
                <div className="text-[12px] font-bold text-gray-200 tracking-tighter drop-shadow-md" style={{ transform: `rotate(${-deg}deg)` }}>
                  {tick.label}
                </div>
              </div>
            </div>
          );
        })}

        <div 
          className={`relative w-20 h-20 z-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 shadow-[5px_5px_15px_rgba(0,0,0,0.6),-2px_-2px_10px_rgba(255,255,255,0.1)] flex items-center justify-center border-4 border-gray-800 cursor-ns-resize transition-transform ${disabled ? 'opacity-50 pointer-events-none' : 'hover:scale-105'}`}
          onMouseDown={handleMouseDown}
          ref={knobRef}
        >
          <div className="absolute w-full h-full rounded-full" style={{ transform: `rotate(${rotation}deg)` }}>
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-4 bg-cyan-400 rounded-full shadow-[0_0_5px_rgba(6,182,212,0.8)]"></div>
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-600 to-gray-500 shadow-inner"></div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">{config.label}</div>
        <div className="select-none text-cyan-400 font-mono text-lg bg-gray-900 px-3 py-1 rounded border border-gray-700 mt-1 shadow-inner">
          {displayValue} <span className="select-none text-xs text-gray-500">{config.unit}</span>
        </div>
      </div>
    </div>
  );
};

// --- 引导弹窗组件 ---
const TutorialModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#1a1c20] border border-orange-500/30 rounded-3xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(249,115,22,0.2)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-600"></div>
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center">
            <HelpCircle size={48} className="text-orange-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-white">挑战说明</h2>
          
          <p className="text-gray-300 leading-relaxed text-lg">
            点击开始播放后会播放压缩后的音频，你觉得他用了什么参数就在界面上调，越接近正确答案分数越高
          </p>
          
          <button
            onClick={onClose}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20"
          >
            知道了，开始挑战
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 主应用组件 ---
export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isBypass, setIsBypass] = useState(false);
  const [gameState, setGameState] = useState<'playing' | 'revealed' | 'finished'>('playing');
  const [currentRound, setCurrentRound] = useState(1);
  const [score, setScore] = useState<number | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [scoreDetails, setScoreDetails] = useState<Record<string, number>>({});

  const [targetParams, setTargetParams] = useState<ParamsState>({
    threshold: 0, ratio: 1, attack: 1, release: 100
  });

  const [userParams, setUserParams] = useState<ParamsState>({
    threshold: PARAMS_CONFIG.threshold.default,
    ratio: PARAMS_CONFIG.ratio.default,
    attack: PARAMS_CONFIG.attack.default,
    release: PARAMS_CONFIG.release.default
  });

  // 音频相关的 Refs 添加类型定义
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const compNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const makeupGainRef = useRef<GainNode | null>(null);
  
  const drumBufferRef = useRef<AudioBuffer | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const isEngineReady = useRef(false);

  const generateTestDrumLoop = async (ctx: AudioContext | OfflineAudioContext) => {
    const offlineCtx = new OfflineAudioContext(2, ctx.sampleRate * 2, ctx.sampleRate);
    const bpm = 120;
    const beatLen = 60 / bpm;

    const createKick = (time: number) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.connect(gain);
      gain.connect(offlineCtx.destination);
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
      gain.gain.setValueAtTime(1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
      osc.start(time);
      osc.stop(time + 0.5);
    };

    const createHihat = (time: number, loud = false) => {
      const bufferSize = offlineCtx.sampleRate * 0.1;
      const buffer = offlineCtx.createBuffer(1, bufferSize, offlineCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = offlineCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      const gain = offlineCtx.createGain();
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(offlineCtx.destination);
      gain.gain.setValueAtTime(loud ? 0.3 : 0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
      noise.start(time);
    };

    for (let i = 0; i < 4; i++) {
      const t = i * beatLen;
      if (i === 0 || i === 2) createKick(t);
      createHihat(t, true);
      createHihat(t + beatLen/2, false);
      if (i === 1 || i === 3) {
         createKick(t); 
         createHihat(t, true);
      }
    }
    return await offlineCtx.startRendering();
  };

  const generateSynthLoop = async (ctx: AudioContext) => {
    const bpm = 120;
    const beatLen = 60 / bpm;
    const totalBeats = 16; 
    const offlineCtx = new OfflineAudioContext(2, ctx.sampleRate * totalBeats * beatLen, ctx.sampleRate);

    const oscTypes: OscillatorType[] = ['sawtooth', 'square', 'triangle'];
    const synthType = oscTypes[Math.floor(Math.random() * oscTypes.length)];
    const filterStartFreq = 1000 + Math.random() * 4000; 
    const filterEndFreq = 100 + Math.random() * 600;    
    const filterQ = 0.5 + Math.random() * 8;            
    const octaveShift = Math.random() > 0.5 ? 12 : 24;  

    const chords = [
      { notes: [65, 69, 72], duration: 2 }, 
      { notes: [67, 71, 74], duration: 2 }, 
      { notes: [64, 67, 71], duration: 2 }, 
      { notes: [69, 72, 76], duration: 2 }, 
      { notes: [62, 65, 69], duration: 2 }, 
      { notes: [67, 71, 74], duration: 2 }, 
      { notes: [60, 64, 67], duration: 4 }  
    ];

    const mtof = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

    let time = 0;
    for (const chord of chords) {
      const durationTime = chord.duration * beatLen;
      const numPlucks = chord.duration * 2; 
      const pluckLen = beatLen / 2;

      for (let p = 0; p < numPlucks; p++) {
        const pTime = time + p * pluckLen;
        
        chord.notes.forEach(midi => {
          const osc = offlineCtx.createOscillator();
          osc.type = synthType;
          osc.frequency.value = mtof(midi - octaveShift);

          const filter = offlineCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.Q.value = filterQ;

          const gain = offlineCtx.createGain();

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(offlineCtx.destination);

          filter.frequency.setValueAtTime(filterStartFreq, pTime);
          filter.frequency.exponentialRampToValueAtTime(filterEndFreq, pTime + 0.3);

          const velocity = (p % 2 === 0) ? 0.7 : 0.2; 
          gain.gain.setValueAtTime(0.01, pTime);
          gain.gain.linearRampToValueAtTime(velocity, pTime + 0.01); 
          gain.gain.exponentialRampToValueAtTime(0.01, pTime + pluckLen - 0.02);

          osc.start(pTime);
          osc.stop(pTime + pluckLen);
        });
      }
      time += durationTime;
    }
    return await offlineCtx.startRendering();
  };

  const initAudio = async () => {
    if (!audioCtxRef.current) {
      // 兼容某些浏览器的 webkitAudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      
      if (!drumBufferRef.current) {
        drumBufferRef.current = await generateTestDrumLoop(ctx);
      }
      
      if (Math.random() > 0.5) {
        currentBufferRef.current = await generateSynthLoop(ctx);
      } else {
        currentBufferRef.current = drumBufferRef.current;
      }

      compNodeRef.current = ctx.createDynamicsCompressor();
      dryGainRef.current = ctx.createGain();
      wetGainRef.current = ctx.createGain();
      makeupGainRef.current = ctx.createGain();

      compNodeRef.current.connect(makeupGainRef.current);
      makeupGainRef.current.connect(wetGainRef.current);
      
      dryGainRef.current.connect(ctx.destination);
      wetGainRef.current.connect(ctx.destination);

      isEngineReady.current = true;
      generateNewRoundParams(); 
    }
  };

  const stopCurrentSource = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  };

  const startCurrentSource = () => {
    const ctx = audioCtxRef.current;
    if (!ctx || !compNodeRef.current || !dryGainRef.current || !currentBufferRef.current) return;

    const source = ctx.createBufferSource();
    source.buffer = currentBufferRef.current;
    source.loop = true;
    
    source.connect(compNodeRef.current); 
    source.connect(dryGainRef.current);  
    
    source.start();
    sourceNodeRef.current = source;
  };

  const togglePlay = async () => {
    if (!isEngineReady.current) await initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') await ctx.resume();

    if (isPlaying) {
      stopCurrentSource();
      setIsPlaying(false);
    } else {
      startCurrentSource();
      setIsPlaying(true);
      applyParamsToAudio(gameState === 'playing' ? targetParams : userParams, isBypass);
    }
  };

  const applyParamsToAudio = useCallback((params: ParamsState, bypassState: boolean) => {
    if (!isEngineReady.current || !compNodeRef.current || !audioCtxRef.current || !makeupGainRef.current || !dryGainRef.current || !wetGainRef.current) return;
    const t = audioCtxRef.current.currentTime;

    compNodeRef.current.threshold.setTargetAtTime(params.threshold, t, 0.05);
    compNodeRef.current.ratio.setTargetAtTime(params.ratio, t, 0.05);
    compNodeRef.current.attack.setTargetAtTime(params.attack / 1000, t, 0.05);
    compNodeRef.current.release.setTargetAtTime(params.release / 1000, t, 0.05);

    const thresholdLin = Math.abs(params.threshold);
    const reductionFactor = 1 - (1 / params.ratio);
    
    const makeupGainDB = thresholdLin * reductionFactor * 0.15; 
    const makeupGainLinear = Math.pow(10, makeupGainDB / 20);
    
    makeupGainRef.current.gain.setTargetAtTime(makeupGainLinear, t, 0.1);

    dryGainRef.current.gain.setTargetAtTime(bypassState ? 1 : 0, t, 0.05);
    wetGainRef.current.gain.setTargetAtTime(bypassState ? 0 : 1, t, 0.05);

  }, []);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('hasSeenTutorial', 'true');
  };

  useEffect(() => {
    if (gameState === 'playing') {
      applyParamsToAudio(targetParams, isBypass);
    } else if (gameState === 'revealed') {
      applyParamsToAudio(userParams, isBypass);
    }
  }, [userParams, isBypass, gameState, targetParams, applyParamsToAudio]);

  const generateNewRoundParams = () => {
    setTargetParams({
      threshold: -10 - Math.random() * 40,
      ratio: 2 + Math.random() * 10,       
      attack: reverseLogMap(Math.random(), PARAMS_CONFIG.attack.min, PARAMS_CONFIG.attack.max),
      release: reverseLogMap(Math.random(), PARAMS_CONFIG.release.min, PARAMS_CONFIG.release.max)
    });
    
    setUserParams({
      threshold: PARAMS_CONFIG.threshold.default,
      ratio: PARAMS_CONFIG.ratio.default,
      attack: PARAMS_CONFIG.attack.default,
      release: PARAMS_CONFIG.release.default
    });
  };

  const nextRound = async () => {
    if (currentRound >= MAX_ROUNDS) {
      setGameState('finished');
      stopCurrentSource();
      setIsPlaying(false);
      return;
    }

    if (Math.random() > 0.5 && audioCtxRef.current) {
      currentBufferRef.current = await generateSynthLoop(audioCtxRef.current);
    } else {
      currentBufferRef.current = drumBufferRef.current;
    }
    
    if (isPlaying) {
      stopCurrentSource();
      startCurrentSource();
    }

    generateNewRoundParams();
    setCurrentRound(r => r + 1);
    setGameState('playing');
    setScore(null);
    setIsBypass(false);
  };

  const resetGame = async () => {
    if (Math.random() > 0.5 && audioCtxRef.current) {
      currentBufferRef.current = await generateSynthLoop(audioCtxRef.current);
    } else {
      currentBufferRef.current = drumBufferRef.current;
    }
    setTotalScore(0);
    setCurrentRound(1);
    generateNewRoundParams();
    setGameState('playing');
    setScore(null);
    setIsBypass(false);
  };

  const submitGuess = () => {
    const calcScore = (user: number, target: number, min: number, max: number, type: ParamType) => {
      let diffRatio;
      if (type === 'log') {
        const uLog = logMap(user, min, max);
        const tLog = logMap(target, min, max);
        diffRatio = Math.abs(uLog - tLog);
      } else {
        const uLin = linearMap(user, min, max);
        const tLin = linearMap(target, min, max);
        diffRatio = Math.abs(uLin - tLin);
      }
      return Math.max(0, 100 - (diffRatio * 150)); 
    };

    const sThresh = calcScore(userParams.threshold, targetParams.threshold, PARAMS_CONFIG.threshold.min, PARAMS_CONFIG.threshold.max, PARAMS_CONFIG.threshold.type);
    const sRatio = calcScore(userParams.ratio, targetParams.ratio, PARAMS_CONFIG.ratio.min, PARAMS_CONFIG.ratio.max, PARAMS_CONFIG.ratio.type);
    const sAttack = calcScore(userParams.attack, targetParams.attack, PARAMS_CONFIG.attack.min, PARAMS_CONFIG.attack.max, PARAMS_CONFIG.attack.type);
    const sRelease = calcScore(userParams.release, targetParams.release, PARAMS_CONFIG.release.min, PARAMS_CONFIG.release.max, PARAMS_CONFIG.release.type);

    const roundScore = Math.round((sThresh * 0.35 + sRatio * 0.35 + sAttack * 0.15 + sRelease * 0.15));

    setScoreDetails({
      threshold: Math.round(sThresh),
      ratio: Math.round(sRatio),
      attack: Math.round(sAttack),
      release: Math.round(sRelease)
    });
    setScore(roundScore);
    setTotalScore(prev => prev + roundScore);
    setGameState('revealed');
  };

  if (gameState === 'finished') {
    const averageScore = Math.round(totalScore / MAX_ROUNDS);
    let rank = '木耳';
    if (averageScore > 90) rank = '混音大师';
    else if (averageScore > 75) rank = '高级混音师';
    else if (averageScore > 60) rank = '外行爱好者';
    
    return (
      <div className="select-none min-h-screen bg-neutral-950 text-gray-200 font-sans p-6 flex flex-col items-center justify-center">
        <div className="bg-[#1a1c20] p-12 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-2xl text-center">
          <Trophy size={64} className="mx-auto text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
          <h1 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">
            挑战完成
          </h1>
          <p className="text-gray-400 mb-8">10 轮盲猜训练已结束</p>
          
          <div className="bg-black/50 p-8 rounded-2xl mb-8">
            <div className="text-sm text-gray-500 uppercase tracking-widest mb-2">最终平均分</div>
            <div className="text-7xl font-mono text-orange-500 font-black mb-4">
              {averageScore}
            </div>
            <div className="inline-block bg-gray-800 text-yellow-400 px-6 py-2 rounded-full font-bold text-lg border border-yellow-500/30">
              评级：{rank}
            </div>
          </div>

          <button 
            onClick={resetGame}
            className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold text-xl px-12 py-4 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            再来一局
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="select-none min-h-screen bg-neutral-950 text-gray-200 font-sans p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 背景光效 */}
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }} className="pointer-events-none opacity-40">
       <LightRays
    raysOrigin="top-center"
    raysColor="#ffffff"
    raysSpeed={0.6}
    lightSpread={1.3}
    rayLength={2.1}
    pulsating={false}
    fadeDistance={2.2}
    saturation={1}
    followMouse
    mouseInfluence={0.1}
    noiseAmount={0}
    distortion={0}
  /> 
  </div>

      <TutorialModal isOpen={showTutorial} onClose={closeTutorial} />
      
      <div className="relative z-10 mb-6 text-center space-y-2">
        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">
          压缩盲听挑战
        </h1>
        <div className="text-gray-500 font-mono text-sm flex items-center justify-center gap-4">
          <span>CODING BY DANJUAN</span>
          <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
          <span className="text-orange-400 font-bold bg-orange-900/30 px-2 py-0.5 rounded">Round {currentRound} / {MAX_ROUNDS}</span>
        </div>
      </div>

      <div className="bg-[#1a1c20] p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)] border border-gray-800 w-full max-w-4xl relative overflow-hidden">
        
        <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-gray-800 shadow-inner border border-gray-900"></div>
        <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-gray-800 shadow-inner border border-gray-900"></div>
        <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-gray-800 shadow-inner border border-gray-900"></div>
        <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-gray-800 shadow-inner border border-gray-900"></div>

        <div className="flex justify-between items-center mb-10 bg-black/40 p-4 rounded-xl border border-gray-800/50">
          <div className="flex gap-4">
            <button 
              onClick={togglePlay}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${isPlaying ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            >
              {isPlaying ? <Square size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
              {isPlaying ? 'STOP' : '开始播放'}
            </button>

            <button 
              onClick={() => setIsBypass(!isBypass)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-all relative"
            >
              <Power size={20} className={isBypass ? 'text-red-500' : 'text-gray-500'} />
              BYPASS
              <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isBypass ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]' : 'bg-gray-900 shadow-inner'}`}></div>
            </button>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-gray-500 font-mono text-xs mb-1 uppercase tracking-widest">Target State</span>
            {gameState === 'playing' ? (
              <div className="text-orange-400 font-mono animate-pulse flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                HEARING TARGET
              </div>
            ) : (
              <div className="text-green-400 font-mono flex items-center gap-2">
                <CheckCircle2 size={16} />
                REVEALED
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <Knob config={PARAMS_CONFIG.threshold} value={gameState === 'playing' ? userParams.threshold : targetParams.threshold} onChange={(v: number) => setUserParams(p => ({...p, threshold: v}))} disabled={gameState === 'revealed'} />
          <Knob config={PARAMS_CONFIG.ratio} value={gameState === 'playing' ? userParams.ratio : targetParams.ratio} onChange={(v: number) => setUserParams(p => ({...p, ratio: v}))} disabled={gameState === 'revealed'} />
          <Knob config={PARAMS_CONFIG.attack} value={gameState === 'playing' ? userParams.attack : targetParams.attack} onChange={(v: number) => setUserParams(p => ({...p, attack: v}))} disabled={gameState === 'revealed'} />
          <Knob config={PARAMS_CONFIG.release} value={gameState === 'playing' ? userParams.release : targetParams.release} onChange={(v: number) => setUserParams(p => ({...p, release: v}))} disabled={gameState === 'revealed'} />
        </div>

        {gameState === 'revealed' && score !== null && (
          <div className="mb-10 bg-gray-900/80 border border-orange-500/30 p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <div className="text-gray-400 uppercase tracking-widest text-sm mb-2">Round {currentRound} Score</div>
                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-orange-300 to-orange-600 drop-shadow-lg">
                  {score} <span className="text-2xl text-gray-600">/100</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 font-mono text-sm flex-grow bg-black/50 p-4 rounded-lg">
                {Object.keys(scoreDetails).map(key => (
                  <div key={key} className="flex justify-between border-b border-gray-800 pb-1">
                    <span className="text-gray-500 capitalize">{key}</span>
                    <span className={scoreDetails[key] > 80 ? 'text-green-400' : scoreDetails[key] > 50 ? 'text-yellow-400' : 'text-red-400'}>
                      {scoreDetails[key]} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 text-center text-xs text-gray-500">
              总分: {totalScore}
            </div>
          </div>
        )}

        <div className="flex justify-center border-t border-gray-800 pt-8">
          {gameState === 'playing' ? (
            <button 
              onClick={submitGuess}
              className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <CheckCircle2 />
              提交
            </button>
          ) : (
            <button 
              onClick={nextRound}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl px-12 py-4 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              {currentRound >= MAX_ROUNDS ? 'FINISH' : <><RotateCcw /> 下一个</>}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}