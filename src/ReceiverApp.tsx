/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, 
  Settings, 
  Wifi, 
  Activity,
  Bluetooth,
  Cpu,
  Tv,
  Volume2,
  Lock
} from 'lucide-react';
import { connectivity } from './services/connectivity';
import { QRCodeSVG } from 'qrcode.react';
import { GameApp, Platform, InputPacket } from './types';

const PLATFORM_CONFIGS: Record<Platform, { color: string, label: string, protocol: string }> = {
  xcloud: { color: '#107c10', label: 'Xbox Cloud Gaming', protocol: 'XInput' },
  steam: { color: '#171a21', label: 'Steam Link', protocol: 'Steam Virtual Bus' },
  geforce: { color: '#76b900', label: 'GeForce NOW', protocol: 'NV Shield' },
  moonlight: { color: '#005a9c', label: 'Moonlight/Sunshine', protocol: 'DirectStream' },
  generic_wifi: { color: '#00ffd4', label: 'Generic Wi-Fi Link', protocol: 'WebSockets Direct' },
  generic_bluetooth: { color: '#8b5cf6', label: 'Generic Bluetooth (BLE)', protocol: 'Bluetooth HID' },
  generic: { color: '#3b82f6', label: 'Generic HID', protocol: 'Standard Gamepad' }
};

const GAMES: GameApp[] = [
  { id: '1', name: 'Cyber Rogue', icon: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200&h=200&auto=format&fit=crop', description: 'Fast-paced action in a neon world.', genre: 'ACTION' },
  { id: '2', name: 'Zen Drift', icon: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=200&h=200&auto=format&fit=crop', description: 'Master the art of drifting.', genre: 'RACING' },
  { id: '3', name: 'Void Runner', icon: 'https://images.unsplash.com/photo-1614853316476-de00d14cb1fc?q=80&w=200&h=200&auto=format&fit=crop', description: 'Survive the endless vacuum.', genre: 'ARCADE' },
  { id: '4', name: 'Pixel Quest', icon: 'https://images.unsplash.com/photo-1550745165-9bc0b252723f?q=80&w=200&h=200&auto=format&fit=crop', description: 'Classic RPG adventure.', genre: 'RPG' },
];

function MiniDpadIndicator({ buttons = {}, activeColor }: { buttons?: Record<string, boolean>, activeColor: string }) {
  const upPressed = !!buttons['dpad_up'];
  const downPressed = !!buttons['dpad_down'];
  const leftPressed = !!buttons['dpad_left'];
  const rightPressed = !!buttons['dpad_right'];
  const isAnyPressed = upPressed || downPressed || leftPressed || rightPressed;

  return (
    <div className="relative w-8 h-8 flex items-center justify-center mr-2">
      {/* Horizontal & Vertical background bars */}
      <div className="absolute w-7 h-2 bg-white/10 rounded-sm"></div>
      <div className="absolute w-2 h-7 bg-white/10 rounded-sm"></div>
      
      {/* Individual direction fills with transition */}
      <div 
        className="absolute top-0 w-2 h-2.5 rounded-t-sm transition-all duration-100" 
        style={{ backgroundColor: upPressed ? activeColor : 'transparent', boxShadow: upPressed ? `0 0 8px ${activeColor}` : 'none' }} 
      />
      <div 
        className="absolute bottom-0 w-2 h-2.5 rounded-b-sm transition-all duration-100" 
        style={{ backgroundColor: downPressed ? activeColor : 'transparent', boxShadow: downPressed ? `0 0 8px ${activeColor}` : 'none' }} 
      />
      <div 
        className="absolute left-0 w-2.5 h-2 rounded-l-sm transition-all duration-100" 
        style={{ backgroundColor: leftPressed ? activeColor : 'transparent', boxShadow: leftPressed ? `0 0 8px ${activeColor}` : 'none' }} 
      />
      <div 
        className="absolute right-0 w-2.5 h-2 rounded-r-sm transition-all duration-100" 
        style={{ backgroundColor: rightPressed ? activeColor : 'transparent', boxShadow: rightPressed ? `0 0 8px ${activeColor}` : 'none' }} 
      />
      
      {/* Pulsing center feedback core */}
      <div 
        className="absolute w-1.5 h-1.5 rounded-full z-10 transition-all duration-150"
        style={{ 
          backgroundColor: isAnyPressed ? activeColor : 'rgba(255,255,255,0.2)',
          boxShadow: isAnyPressed ? `0 0 10px ${activeColor}` : 'none',
          scale: isAnyPressed ? 1.4 : 1
        }} 
      />
    </div>
  );
}

export default function ReceiverApp() {
  const [status, setStatus] = useState<string>("Disconnected");
  const [lastInput, setLastInput] = useState<InputPacket | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isLaunching, setIsLaunching] = useState<GameApp | null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pairingId] = useState(() => {
    const saved = localStorage.getItem('nexus_receiver_id');
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(7);
    localStorage.setItem('nexus_receiver_id', newId);
    return newId;
  });

  // TV & Background Optimization States
  const [wakeLockEnabled, setWakeLockEnabled] = useState(() => {
    return localStorage.getItem('nexus_tv_wake_lock') !== 'false';
  });
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<any>(null);

  const [keepAliveEnabled, setKeepAliveEnabled] = useState(() => {
    return localStorage.getItem('nexus_tv_keep_alive') !== 'false';
  });
  const [keepAliveActive, setKeepAliveActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [powerSaverEnabled, setPowerSaverEnabled] = useState(() => {
    return localStorage.getItem('nexus_tv_power_saver') !== 'false';
  });
  const [isCpuSaverActive, setIsCpuSaverActive] = useState(false);
  const lastInputTimeRef = useRef(Date.now());

  const [showTvSettingsOverlay, setShowTvSettingsOverlay] = useState(false);

  // Request Wake Lock
  const requestWakeLock = useCallback(async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (wakeLockRef.current) return;
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
        console.log("TV Screen Wake Lock Acquired successfully");
        
        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
          wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn("Screen Wake Lock request failed: ", err);
        setWakeLockActive(false);
      }
    }
  }, []);

  // Release Wake Lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setWakeLockActive(false);
      } catch (e) {}
    }
  }, []);

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keep-Alive audio management
  useEffect(() => {
    if (keepAliveEnabled) {
      if (!audioRef.current) {
        // Base64 of a short silent WAV file
        audioRef.current = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
        audioRef.current.loop = true;
        audioRef.current.volume = 0.01;
      }
      
      const playAudio = () => {
        audioRef.current?.play()
          .then(() => {
            setKeepAliveActive(true);
            console.log("TV Background keep-alive initialized.");
          })
          .catch((e) => {
            console.warn("Autoplay blocked/failed, will auto-play on controller data:", e);
            setKeepAliveActive(false);
          });
      };
      
      playAudio();
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setKeepAliveActive(false);
      }
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        setKeepAliveActive(false);
      }
    };
  }, [keepAliveEnabled]);

  // Wake Lock & Visibility state change hook
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isVisible = document.visibilityState === 'visible';
      console.log(`TV App visibility changed: ${isVisible ? 'visible' : 'hidden'}`);
      
      if (isVisible) {
        // Re-acquire Wake Lock when coming from background
        if (wakeLockEnabled) {
          await requestWakeLock();
        }
        // Force-refresh signaling so peer connection is responsive
        connectivity.joinPairing(pairingId);
        connectivity.joinPairing("discovery-lobby");
      } else {
        // Drop Wake Lock while backgrounded to conserve resources
        await releaseWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Acquire on initial load
    if (wakeLockEnabled) {
      requestWakeLock();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [wakeLockEnabled, pairingId, requestWakeLock, releaseWakeLock]);

  // CPU Resource saver & input timeout tracker
  useEffect(() => {
    if (!powerSaverEnabled) {
      setIsCpuSaverActive(false);
      return;
    }
    
    const checkIdle = setInterval(() => {
      const now = Date.now();
      const timeSinceInput = now - lastInputTimeRef.current;
      const isHidden = typeof document !== 'undefined' ? document.visibilityState !== 'visible' : false;
      
      // If idle for over 30s list, or screen goes background, we trigger the low-memory mode
      if (isHidden || (timeSinceInput > 20000 && !lastInput)) {
        setIsCpuSaverActive(true);
      } else {
        setIsCpuSaverActive(false);
      }
    }, 4000);

    return () => clearInterval(checkIdle);
  }, [powerSaverEnabled, lastInput]);
  
  // Connection Setup
  useEffect(() => {
    connectivity.setCallbacks(
      (s) => setStatus(s),
      () => {
        console.log("TV Receiver Ready");
        if (wakeLockEnabled) {
          requestWakeLock();
        }
      }
    );

    // Join my specific room so I can be found by Quick Connect
    connectivity.joinPairing(pairingId);
    // Also join lobby for discovery
    connectivity.joinPairing("discovery-lobby");

    return () => connectivity.disconnect();
  }, [pairingId, wakeLockEnabled, requestWakeLock]); // Only on mount or if pairingId changes

  // Input Handling
  useEffect(() => {
    const handleData = (data: Buffer | string | Uint8Array) => {
      try {
        const payload: InputPacket = JSON.parse(data.toString());
        setLastInput(payload);
        
        // Reset timers and disable dynamic CPU saver instantly on input
        lastInputTimeRef.current = Date.now();
        setIsCpuSaverActive(false);

        // Resume keep alive audio if blocked by autoplay policy
        if (keepAliveEnabled && audioRef.current && audioRef.current.paused) {
          audioRef.current.play().then(() => setKeepAliveActive(true)).catch(() => {});
        }
        
        // Simple D-Pad navigation logic for TV
        if (payload.buttons) {
          if (payload.buttons.dpad_right) setFocusedIndex(p => Math.min(p + 1, GAMES.length - 1));
          if (payload.buttons.dpad_left) setFocusedIndex(p => Math.max(p - 1, 0));
          if (payload.buttons.a && !isLaunching) launchGame(GAMES[focusedIndex]);
        }
      } catch (e) {}
    };

    connectivity.onData = handleData;
    return () => {
      if (connectivity.onData === handleData) {
        connectivity.onData = null;
      }
    };
  }, [focusedIndex, isLaunching, keepAliveEnabled]); // Still need these because they are used in the closure

  const [showPairingOverlay, setShowPairingOverlay] = useState(false);
  const [pairingMethod, setPairingMethod] = useState<'wifi' | 'bluetooth'>('wifi');

  const launchGame = (game: GameApp) => {
    setIsLaunching(game);
    setTimeout(() => setIsLaunching(null), 3000);
  };

  const getSimulatedLatency = () => {
    if (!lastInput) return "None";
    const base = lastInput.platform === 'generic_bluetooth' ? 8.2 
                 : lastInput.platform === 'generic_wifi' ? 2.4
                 : lastInput.platform === 'moonlight' ? 1.4
                 : lastInput.platform === 'steam' ? 3.1
                 : lastInput.platform === 'xcloud' ? 11.8
                 : lastInput.platform === 'geforce' ? 8.9
                 : 3.8; // standard default
    const ellOffset = lastInput.settings?.ell ? -0.4 : 0;
    const jitter = Math.sin(Date.now() / 1500) * 0.2;
    const latencyVal = Math.max(0.1, base + ellOffset + jitter);
    return `${latencyVal.toFixed(1)}ms`;
  };

  const activeColor = lastInput?.activeColor || (lastInput?.platform ? PLATFORM_CONFIGS[lastInput.platform as Platform]?.color : '#2563eb');

  return (
    <div className={`fixed inset-0 bg-[#050608] text-white font-sans overflow-hidden transition-all duration-1000 ${isCpuSaverActive ? 'brightness-50' : ''}`}>
      {/* Background Ambient Glow (conditionally disabled in CPU Saver mode to keep low-memory smart TV boards from freezing or crashing) */}
      {!isCpuSaverActive && (
        <>
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] blur-[120px] rounded-full transition-colors duration-1000 animate-pulse" style={{ backgroundColor: `${activeColor}15`, animationDuration: '8s' }} />
          <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] blur-[120px] rounded-full transition-colors duration-1000 animate-pulse" style={{ backgroundColor: `${activeColor}10`, animationDuration: '10s' }} />
        </>
      )}

      {/* Top Header */}
      <header className="h-24 flex items-center justify-between pl-16 pr-64 border-b border-white/5 bg-black/20 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-2xl" style={{ backgroundColor: activeColor }}>
            <Gamepad2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
              Nexus TV Receiver
              {isCpuSaverActive && (
                <span className="text-[9px] bg-amber-500/15 border border-amber-500/35 text-amber-400 font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Saver Mode</span>
              )}
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeColor }} />
              <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest">
                {status} {lastInput?.platform && `| ${PLATFORM_CONFIGS[lastInput.platform as Platform]?.label}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <MiniDpadIndicator 
              buttons={lastInput?.buttons} 
              activeColor={activeColor} 
            />
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-gray-500 uppercase font-mono">Input Stream</span>
               <span className="text-xs font-mono font-bold" style={{ color: activeColor }}>
                 {lastInput ? `${lastInput.platform?.toUpperCase() || 'GENERIC'}` : 'IDLE'}
               </span>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowTvSettingsOverlay(true)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 flex items-center gap-2"
              title="Optimize background & wake settings"
            >
              <Settings size={14} className="text-cyan-400" />
              TV Tuning
            </button>
            <button 
              onClick={() => setShowPairingOverlay(true)}
              className="px-4 py-2 bg-blue-600/10 border border-blue-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600/20 text-blue-400 transition-all active:scale-95 flex items-center gap-2"
            >
              <Bluetooth size={14} className="text-blue-400" />
              Pair Controller
            </button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-wider font-mono font-bold border transition-colors ${isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`} title={isOnline ? "Server Connection: Active" : "Offline play active (Local LAN Signaling available)"}>
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#00ffd4] shadow-[0_0_8px_#00ffd4]' : 'bg-amber-500 animate-pulse'}`} />
              <span>{isOnline ? 'ONLINE' : 'OFFLINE MODE'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Pairing Overlay */}
      <AnimatePresence>
        {showPairingOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/80 backdrop-blur-3xl flex items-center justify-center p-24"
          >
            <div className="w-full max-w-4xl geometric-panel overflow-hidden flex h-[500px]">
              <div className="w-64 border-r border-gray-800 p-8 flex flex-col gap-4">
                 <h3 className="text-lg font-black uppercase italic tracking-tighter mb-4">Pairing Menu</h3>
                 <button 
                   onClick={() => setPairingMethod('wifi')}
                   className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${pairingMethod === 'wifi' ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-transparent border-gray-800 text-gray-500 hover:bg-white/5'}`}
                 >
                    <Wifi size={18} />
                    <span className="font-bold text-sm uppercase">WiFi Direct</span><span className="text-[8px] text-gray-500 block uppercase tracking-wider font-mono mt-0.5">Generic High-Hz LAN</span>
                 </button>
                 <button 
                   onClick={() => setPairingMethod('bluetooth')}
                   className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${pairingMethod === 'bluetooth' ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-transparent border-gray-800 text-gray-500 hover:bg-white/5'}`}
                 >
                    <Bluetooth size={18} />
                    <span className="font-bold text-sm uppercase">Bluetooth</span><span className="text-[8px] text-gray-500 block uppercase tracking-wider font-mono mt-0.5">Generic BLE emulation</span>
                 </button>
                 <div className="mt-auto">
                    <button 
                      onClick={() => setShowPairingOverlay(false)}
                      className="w-full py-3 bg-white text-black font-black uppercase text-xs tracking-widest rounded-lg"
                    >
                       Exit Pairing
                    </button>
                 </div>
              </div>

              <div className="flex-1 p-16 flex flex-col items-center justify-center text-center">
                 {pairingMethod === 'bluetooth' ? (
                   <div className="space-y-8">
                      <div className="relative">
                         <div className="absolute inset-0 bg-blue-500 blur-[60px] opacity-20 animate-pulse" />
                         <Bluetooth size={80} className="text-blue-400 animate-bounce" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-3xl font-black italic tracking-tighter uppercase">Device Discoverable</h4>
                        <p className="text-gray-400 max-w-sm">Use your Nexus Controller to search for "Lumina TV Console" or enter the code below.</p>
                      </div>
                      <div className="p-8 bg-black/40 rounded-3xl border border-blue-500/30">
                         <span className="text-xs text-gray-500 font-bold uppercase tracking-[0.4em] mb-2 block">Nexus Link Code</span>
                         <div className="text-6xl font-black font-mono text-blue-400 tracking-widest">{pairingId.toUpperCase()}</div>
                      </div>
                   </div>
                 ) : (
                   <div className="space-y-8">
                      <div className="w-48 h-48 bg-white p-4 rounded-3xl shadow-2xl mx-auto">
                         <QRCodeSVG value={`LUMINA-NEXUS:${pairingId}`} size={160} />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-3xl font-black italic tracking-tighter uppercase">Scan to Link</h4>
                        <p className="text-gray-400 max-w-sm text-xs leading-relaxed">
                           {isOnline 
                             ? "Open the Nexus Controller app and scan this QR code for instant pairing over WiFi."
                             : "Open the Nexus Controller app, go to Wi-Fi Direct, and scan or connect directly."}
                         </p>
                         {!isOnline && (
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/10 max-w-xs mx-auto text-left space-y-1 mt-4">
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block font-mono">Receiver Host (for offline play)</span>
                              <div className="text-sm font-bold font-mono text-cyan-400 select-all">
                                 {window.location.hostname || 'localhost'}
                              </div>
                              <span className="text-[9px] text-gray-450 block font-mono leading-tight">
                                Enter this hostname/IP on your controller to enable local offline signaling.
                              </span>
                           </div>
                         )}
                      </div>
                   </div>
                 )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TV Settings / Background Tuning Overlay */}
      <AnimatePresence>
        {showTvSettingsOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/85 backdrop-blur-3xl flex items-center justify-center p-24 text-white"
          >
            <div className="w-full max-w-4xl border border-white/10 bg-[#0C0D12]/95 rounded-3xl overflow-hidden flex h-[500px] shadow-[0_24px_64px_rgba(0,0,0,0.8)] backdrop-blur-md">
              <div className="w-64 border-r border-white/5 bg-black/40 p-8 flex flex-col gap-4">
                 <h3 className="text-lg font-black uppercase italic tracking-tighter mb-4 text-cyan-400">TV Tuning</h3>
                 <div className="space-y-4">
                    <div className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Active Services</div>
                    
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${wakeLockActive ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                       <span className="text-xs font-mono font-bold">Wake Lock: {wakeLockActive ? 'ACTIVE' : 'INACTIVE'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${keepAliveActive ? 'bg-[#00ffd4]' : 'bg-yellow-500'}`} />
                       <span className="text-xs font-mono font-bold">Keep-Alive: {keepAliveActive ? 'RUNNING' : 'DISABLED'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${isCpuSaverActive ? 'bg-amber-400' : 'bg-blue-400'}`} />
                       <span className="text-xs font-mono font-bold">Power Mode: {isCpuSaverActive ? 'SAVER' : 'PERFORMANCE'}</span>
                    </div>
                 </div>
                 <div className="mt-auto">
                    <button 
                      onClick={() => setShowTvSettingsOverlay(false)}
                      className="w-full py-3 bg-white text-black font-black uppercase text-xs tracking-widest rounded-lg hover:opacity-90 transition-all active:scale-95 cursor-pointer"
                    >
                       Save & Exit
                    </button>
                 </div>
              </div>

              <div className="flex-1 p-12 flex flex-col justify-center bg-black/10">
                 <div className="mb-6">
                    <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-widest mb-1 font-bold">
                       <Tv size={14} />
                       Sansui TV Background Tuning
                    </div>
                    <h4 className="text-3xl font-black italic tracking-tighter uppercase">Signal & Energy Controls</h4>
                    <p className="text-gray-400 text-xs text-[11px] leading-relaxed">Configure the app to maintain connections smoothly in high-throttled TV background environments.</p>
                 </div>

                 <div className="space-y-4">
                    {/* Option 1: Wake Lock */}
                    <div className="flex items-start justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                       <div className="space-y-1 pr-6 flex-1">
                          <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                             <Lock size={12} className="text-blue-400" />
                             Screen Wake Lock
                          </div>
                          <p className="text-gray-450 text-[10px] leading-relaxed">
                             Forces the TV screen to stay awake and ready, preventing Sansui power savings or ambient mode from blackening the screen.
                          </p>
                       </div>
                       <div className="flex items-center">
                          <button
                            onClick={() => {
                              const next = !wakeLockEnabled;
                              setWakeLockEnabled(next);
                              localStorage.setItem('nexus_tv_wake_lock', String(next));
                              if (next) requestWakeLock();
                              else releaseWakeLock();
                            }}
                            className={`w-12 h-7 rounded-full p-0.5 transition-all cursor-pointer ${wakeLockEnabled ? 'bg-blue-500' : 'bg-gray-800'}`}
                          >
                             <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${wakeLockEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                       </div>
                    </div>

                    {/* Option 2: Keep-Alive Audio */}
                    <div className="flex items-start justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                       <div className="space-y-1 pr-6 flex-1">
                          <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                             <Volume2 size={12} className="text-[#00ffd4]" />
                             Background Audio Keep-Alive
                          </div>
                          <p className="text-gray-450 text-[10px] leading-relaxed">
                             Injects an ultra-low frequency sub-audible silent tone. Keeps the Android TV CPU from suspending the browser tab when backgrounded or switcher state.
                          </p>
                       </div>
                       <div className="flex items-center">
                          <button
                            onClick={() => {
                              const next = !keepAliveEnabled;
                              setKeepAliveEnabled(next);
                              localStorage.setItem('nexus_tv_keep_alive', String(next));
                            }}
                            className={`w-12 h-7 rounded-full p-0.5 transition-all cursor-pointer ${keepAliveEnabled ? 'bg-[#00ffd4]' : 'bg-gray-800'}`}
                          >
                             <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${keepAliveEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                       </div>
                    </div>

                    {/* Option 3: Power Saver */}
                    <div className="flex items-start justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                       <div className="space-y-1 pr-6 flex-1">
                          <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                             <Cpu size={12} className="text-amber-400" />
                             Smart GPU Resource Saver
                          </div>
                          <p className="text-gray-450 text-[10px] leading-relaxed">
                             Automatically suspends blur shaders and particle render systems when idle or in background. Keeps TV OS from issuing Out-of-Memory terminations.
                          </p>
                       </div>
                       <div className="flex items-center">
                          <button
                            onClick={() => {
                              const next = !powerSaverEnabled;
                              setPowerSaverEnabled(next);
                              localStorage.setItem('nexus_tv_power_saver', String(next));
                            }}
                            className={`w-12 h-7 rounded-full p-0.5 transition-all cursor-pointer ${powerSaverEnabled ? 'bg-amber-500' : 'bg-gray-800'}`}
                          >
                             <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${powerSaverEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content: TV Launcher */}
      <main className="relative z-10 p-16 h-[calc(100vh-6rem)] flex flex-col justify-center">
        <div className="mb-12">
          <h2 className="text-5xl font-black italic tracking-tighter uppercase mb-2">Continue Playing</h2>
          <p className="text-gray-500 max-w-xl">Use your Nexus Controller to navigate and launch your games directly on your Android TV.</p>
        </div>

        <div className="flex gap-8">
          {GAMES.map((game, idx) => (
            <GameCard 
              key={game.id} 
              game={game} 
              focused={focusedIndex === idx} 
              onClick={() => launchGame(game)}
            />
          ))}
        </div>
      </main>

      {/* HUD: Real-time Telemetry */}
      <footer className="absolute bottom-0 left-0 right-0 h-16 hard-rail flex items-center justify-between px-16 z-20">
         <div className="flex gap-8 font-mono text-[10px] text-gray-600 uppercase">
           <span>Core: Android TV 13</span>
           <span>Latency: {getSimulatedLatency()}</span>
           <span>Rate: {lastInput?.settings?.rate || 1000}Hz</span>
           <span className={lastInput?.settings?.ell ? 'text-blue-400 font-bold' : ''}>ELL: {lastInput?.settings?.ell ? 'ACTIVE' : 'OFF'}</span>
           <span>Haptics: {lastInput?.hapticFeedback ? Math.round(lastInput.hapticFeedback * 100) : 0}%</span>
         </div>
         
         <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded transition-colors" style={{ backgroundColor: `${activeColor}15`, borderColor: `${activeColor}40` }}>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-mono font-bold uppercase tracking-widest border-r pr-2 transition-colors" style={{ color: activeColor, borderColor: `${activeColor}20` }}>ID: {pairingId.toUpperCase()}</span>
                 <span className="text-[10px] font-mono font-bold uppercase tracking-widest pl-1 transition-colors" style={{ color: activeColor }}>Injection Engine: OK</span>
               </div>
            </div>
            <div className="text-xs text-gray-400">
               {lastInput ? (
                 <span className="animate-pulse">Received: {JSON.stringify(lastInput.buttons || lastInput.axes).substring(0, 40)}...</span>
               ) : 'Waiting for controller...'}
            </div>
         </div>
      </footer>

      {/* Launching Overlay */}
      <AnimatePresence>
        {isLaunching && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0A0B0E] flex flex-col items-center justify-center text-center p-24"
          >
            <motion.div 
              inherit={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-blue-600 blur-[80px] opacity-20 animate-pulse" />
              <img src={isLaunching.icon} className="w-48 h-48 rounded-3xl relative z-10 shadow-2xl mb-8 border border-white/10" alt="" />
            </motion.div>
            <h3 className="text-4xl font-black uppercase italic mb-4">{isLaunching.name}</h3>
            <div className="flex items-center gap-3 text-blue-400 font-bold tracking-[0.3em] uppercase text-xs">
              <Activity className="animate-spin" size={16} />
              Injecting Gamepad Driver
            </div>
            <div className="mt-12 w-64 h-1 bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: '100%' }}
                 transition={{ duration: 2.5 }}
                 className="h-full bg-blue-600" 
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}

function GameCard({ game, focused, onClick }: { game: GameApp, focused: boolean, onClick: () => void, key?: string | number }) {
  return (
    <motion.div 
      animate={{ 
        scale: focused ? 1.1 : 1,
        borderColor: focused ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.05)'
      }}
      onClick={onClick}
      className={`relative w-64 h-80 geometric-panel overflow-hidden transition-colors cursor-pointer group
        ${focused ? 'bg-blue-600/10' : 'hover:bg-white/5'}`}
    >
      <div className="relative h-48 overflow-hidden">
        <img src={game.icon} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={game.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111319] to-transparent" />
        <div className="absolute top-4 left-4 px-2 py-1 bg-black/60 rounded text-[9px] font-bold tracking-widest text-blue-400 border border-blue-500/20">
          {game.genre}
        </div>
      </div>
      
      <div className="p-6">
        <h4 className="text-xl font-bold uppercase italic tracking-tighter mb-1">{game.name}</h4>
        <p className="text-xs text-gray-500 line-clamp-2">{game.description}</p>
      </div>

      {focused && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
      )}
    </motion.div>
  );
}
