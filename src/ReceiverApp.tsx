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
  Bluetooth
} from 'lucide-react';
import { connectivity } from './services/connectivity';
import { QRCodeSVG } from 'qrcode.react';
import { GameApp, Platform, InputPacket } from './types';

const PLATFORM_CONFIGS: Record<Platform, { color: string, label: string, protocol: string }> = {
  xcloud: { color: '#107c10', label: 'Xbox Cloud Gaming', protocol: 'XInput' },
  steam: { color: '#171a21', label: 'Steam Link', protocol: 'Steam Virtual Bus' },
  geforce: { color: '#76b900', label: 'GeForce NOW', protocol: 'NV Shield' },
  moonlight: { color: '#005a9c', label: 'Moonlight/Sunshine', protocol: 'DirectStream' },
  generic: { color: '#3b82f6', label: 'Generic HID', protocol: 'Standard Gamepad' }
};

const GAMES: GameApp[] = [
  { id: '1', name: 'Cyber Rogue', icon: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200&h=200&auto=format&fit=crop', description: 'Fast-paced action in a neon world.', genre: 'ACTION' },
  { id: '2', name: 'Zen Drift', icon: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=200&h=200&auto=format&fit=crop', description: 'Master the art of drifting.', genre: 'RACING' },
  { id: '3', name: 'Void Runner', icon: 'https://images.unsplash.com/photo-1614853316476-de00d14cb1fc?q=80&w=200&h=200&auto=format&fit=crop', description: 'Survive the endless vacuum.', genre: 'ARCADE' },
  { id: '4', name: 'Pixel Quest', icon: 'https://images.unsplash.com/photo-1550745165-9bc0b252723f?q=80&w=200&h=200&auto=format&fit=crop', description: 'Classic RPG adventure.', genre: 'RPG' },
];

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
  
  // Connection Setup
  useEffect(() => {
    connectivity.setCallbacks(
      (s) => setStatus(s),
      () => console.log("TV Receiver Ready")
    );

    // Join my specific room so I can be found by Quick Connect
    connectivity.joinPairing(pairingId);
    // Also join lobby for discovery
    connectivity.joinPairing("discovery-lobby");

    return () => connectivity.disconnect();
  }, [pairingId]); // Only on mount or if pairingId changes

  // Input Handling
  useEffect(() => {
    const handleData = (data: Buffer | string | Uint8Array) => {
      try {
        const payload: InputPacket = JSON.parse(data.toString());
        setLastInput(payload);
        
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
  }, [focusedIndex, isLaunching]); // Still need these because they are used in the closure

  const [showPairingOverlay, setShowPairingOverlay] = useState(false);
  const [pairingMethod, setPairingMethod] = useState<'wifi' | 'bluetooth'>('wifi');

  const launchGame = (game: GameApp) => {
    setIsLaunching(game);
    setTimeout(() => setIsLaunching(null), 3000);
  };

  return (
    <div className="fixed inset-0 bg-[#050608] text-white font-sans overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-900/10 blur-[120px] rounded-full" />

      {/* Top Header */}
      <header className="h-24 flex items-center justify-between px-16 border-b border-white/5 bg-black/20 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-2xl" style={{ backgroundColor: lastInput?.platform ? PLATFORM_CONFIGS[lastInput.platform as Platform]?.color : '#2563eb' }}>
            <Gamepad2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter uppercase">Nexus TV Receiver</h1>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-blue-400' : 'bg-yellow-500 animate-pulse'}`} />
              <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest">
                {status} {lastInput?.platform && `| ${PLATFORM_CONFIGS[lastInput.platform as Platform]?.label}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
             <span className="text-[10px] text-gray-500 uppercase font-mono">Input Stream</span>
             <span className="text-xs font-mono" style={{ color: lastInput?.platform ? PLATFORM_CONFIGS[lastInput.platform as Platform]?.color : '#3b82f6' }}>
               {lastInput ? `${lastInput.platform?.toUpperCase() || 'GENERIC'}` : 'IDLE'}
             </span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setShowPairingOverlay(true)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 flex items-center gap-2"
            >
              <Bluetooth size={14} className="text-blue-400" />
              Pair Controller
            </button>
            <Settings size={20} className="text-gray-600" />
            <Wifi size={20} className="text-gray-600" />
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
                    <span className="font-bold text-sm uppercase">WiFi Direct</span>
                 </button>
                 <button 
                   onClick={() => setPairingMethod('bluetooth')}
                   className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${pairingMethod === 'bluetooth' ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-transparent border-gray-800 text-gray-500 hover:bg-white/5'}`}
                 >
                    <Bluetooth size={18} />
                    <span className="font-bold text-sm uppercase">Bluetooth</span>
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
           <span>Latency: 4ms</span>
           <span>Rate: {lastInput?.settings?.rate || 1000}Hz</span>
           <span className={lastInput?.settings?.ell ? 'text-blue-400 font-bold' : ''}>ELL: {lastInput?.settings?.ell ? 'ACTIVE' : 'OFF'}</span>
           <span>Haptics: {lastInput?.hapticFeedback ? Math.round(lastInput.hapticFeedback * 100) : 0}%</span>
         </div>
         
         <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded bg-blue-600/10 border border-blue-500/30">
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-widest border-r border-blue-500/20 pr-2">ID: {pairingId.toUpperCase()}</span>
                 <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-widest pl-1">Injection Engine: OK</span>
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
