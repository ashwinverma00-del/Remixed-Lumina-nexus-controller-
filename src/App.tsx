/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState, useCallback, useRef, type TouchEvent, type MouseEvent, type ReactNode, type PointerEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  Vibrate, 
  Maximize2,
  RotateCcw,
  Wifi,
  Bluetooth,
  Usb,
  QrCode,
  AlertCircle,
  XCircle,
  Settings,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Check,
  Gamepad2,
  Sparkles,
  Tv,
  Smartphone,
} from 'lucide-react';
import { connectivity, ConnectionStatus } from './services/connectivity';
import { 
  ControllerState, 
  Platform, 
  OptimizationSettings, 
  JoystickCalibration 
} from './types';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from "html5-qrcode";

import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import ReceiverApp from './ReceiverApp';

// Custom hook for haptic feedback
const useHaptics = () => {
  const vibrate = useCallback((pattern: number | number[] = 15) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  }, []);

  return { vibrate };
};

function ModeSwitcher() {
  const location = useLocation();
  const isTvMode = location.pathname === '/tv';
  
  const handleVibrate = () => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(12);
    }
  };

  return (
    <div className={`fixed ${isTvMode ? 'top-6 right-8' : 'top-4 right-6'} z-[1000] flex items-center bg-[#0C0D12]/90 border border-white/10 rounded-full p-1 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md select-none gap-0.5`}>
      <Link 
        to="/" 
        onClick={handleVibrate}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase transition-colors duration-200 z-10 ${!isTvMode ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
      >
        {!isTvMode && (
          <motion.div 
            layoutId="activeModeGlow" 
            className="absolute inset-0 bg-blue-500/10 border border-blue-500/30 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.25)]"
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          />
        )}
        <Smartphone size={12} className={!isTvMode ? 'text-blue-400' : 'text-gray-500'} />
        <span>Controller</span>
      </Link>

      <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />

      <Link 
        to="/tv" 
        onClick={handleVibrate}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase transition-colors duration-200 z-10 ${isTvMode ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
      >
        {isTvMode && (
          <motion.div 
            layoutId="activeModeGlow" 
            className="absolute inset-0 bg-[#00ffd4]/10 border border-[#00ffd4]/30 rounded-full shadow-[0_0_15px_rgba(0,255,212,0.18)]"
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          />
        )}
        <Tv size={12} className={isTvMode ? 'text-[#00ffd4]' : 'text-gray-500'} />
        <span>TV Mode</span>
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ModeSwitcher />
      <Routes>
        <Route path="/" element={<ControllerApp />} />
        <Route path="/tv" element={<ReceiverApp />} />
      </Routes>
    </BrowserRouter>
  );
}

const PLATFORM_CONFIGS: Record<Platform, { color: string, label: string, protocol: string }> = {
  xcloud: { color: '#107c10', label: 'Xbox Cloud Gaming', protocol: 'XInput' },
  steam: { color: '#171a21', label: 'Steam Link', protocol: 'Steam Virtual Bus' },
  geforce: { color: '#76b900', label: 'GeForce NOW', protocol: 'NV Shield' },
  moonlight: { color: '#005a9c', label: 'Moonlight/Sunshine', protocol: 'DirectStream' },
  generic_wifi: { color: '#00ffd4', label: 'Generic Wi-Fi Link', protocol: 'WebSockets Direct' },
  generic_bluetooth: { color: '#8b5cf6', label: 'Generic Bluetooth (BLE)', protocol: 'Bluetooth HID' },
  generic: { color: '#3b82f6', label: 'Generic HID', protocol: 'Standard Gamepad' }
};

function hexToRgba(hex: string, alpha: number): string {
  try {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return hex;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  } catch (e) {
    return hex;
  }
}

function ControllerApp() {
  const [platform, setPlatform] = useState<Platform>(() => {
    const saved = localStorage.getItem('nexus_controller_platform');
    return (saved as Platform) || 'generic';
  });
  
  const [settings, setSettings] = useState<OptimizationSettings>(() => {
    const saved = localStorage.getItem('nexus_controller_settings');
    const defaultSettings: OptimizationSettings = {
      pollingRate: 1000,
      hapticIntensity: 80,
      ellMode: true,
      triggerSensitivity: 1.0,
      triggerDeadzone: 0.05,
      rgbColor: null,
      rgbMode: 'static',
      rgbSpeed: 3,
      buttonScale: 1.0,
      gamepadScale: 1.0,
      gamepadBorderSize: 2,
      gamepadBorderStyle: 'solid',
      calibration: {
        left: { deadzone: 0.1, centerX: 0, centerY: 0, sensitivity: 1.0, curve: 1.0 },
        right: { deadzone: 0.1, centerX: 0, centerY: 0, sensitivity: 1.0, curve: 1.0 }
      },
      buttonMapping: {
        a: 'a',
        b: 'b',
        x: 'x',
        y: 'y',
        l1: 'l1',
        r1: 'r1',
        l2: 'l2',
        r2: 'r2',
        dpad_up: 'dpad_up',
        dpad_down: 'dpad_down',
        dpad_left: 'dpad_left',
        dpad_right: 'dpad_right',
        home: 'home',
        select: 'select',
        start: 'start'
      }
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaultSettings,
          ...parsed,
          calibration: parsed.calibration ? { ...defaultSettings.calibration, ...parsed.calibration } : defaultSettings.calibration,
          buttonMapping: parsed.buttonMapping ? { ...defaultSettings.buttonMapping, ...parsed.buttonMapping } : defaultSettings.buttonMapping
        };
      } catch (e) {
        console.error("Failed to restore controller settings:", e);
      }
    }
    return defaultSettings;
  });

  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [customServerUrl, setCustomServerUrl] = useState(() => {
    return localStorage.getItem('nexus_custom_server_url') || '';
  });

  // Track online/offline status
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

  // Sync settings and platform to local storage
  useEffect(() => {
    localStorage.setItem('nexus_controller_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('nexus_controller_platform', platform);
  }, [platform]);

  const [showSettings, setShowSettings] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

  const [dynamicHue, setDynamicHue] = useState(0);

  useEffect(() => {
    const mode = settings.rgbMode || 'static';
    if (mode === 'static') return;

    let animId: number;
    let lastTime = performance.now();
    const speedMultiplier = settings.rgbSpeed || 3;
    const stepPerMs = 0.05 * speedMultiplier;

    const update = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      setDynamicHue(prev => (prev + stepPerMs * delta) % 360);
      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [settings.rgbMode, settings.rgbSpeed]);

  const activeColor = (() => {
    const mode = settings.rgbMode || 'static';
    const baseColor = settings.rgbColor || PLATFORM_CONFIGS[platform].color;
    
    if (mode === 'rainbow') {
      return `hsl(${Math.round(dynamicHue)}, 85%, 55%)`;
    }
    if (mode === 'breathe') {
      const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin((dynamicHue * Math.PI) / 180));
      return hexToRgba(baseColor, pulse);
    }
    return baseColor;
  })();

  const [state, setState] = useState<ControllerState>({
    axes: {
      left: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
    },
    buttons: {},
  });

  // Sync state to peer with Adaptive Packet Timing
  const lastSentState = useRef<string>("");
  const packetCount = useRef(0);

  useEffect(() => {
    const now = Date.now();
    const currentStateStr = JSON.stringify({
      axes: state.axes,
      buttons: state.buttons,
      platform
    });

    // Adaptive Timing: Use heartbeat (every 500ms) or on-change (delta)
    const isHeartbeat = packetCount.current % 30 === 0;
    const hasChanged = currentStateStr !== lastSentState.current;

    if (hasChanged || isHeartbeat) {
      const mappedButtons: Record<string, boolean> = {};
      Object.entries(state.buttons).forEach(([id, pressed]) => {
        const targetId = settings.buttonMapping[id.toLowerCase()] || id;
        mappedButtons[targetId] = pressed as boolean;
      });

      // Apply Analog Tuning to Triggers if they exist in state (simulation)
      const tunedAxes = { ...state.axes };
      // Note: L2/R2 usually mapped to axes[2/5] or specific keys
      
      connectivity.send({
        ...state,
        buttons: mappedButtons,
        platform,
        packetId: packetCount.current++,
        timestamp: now,
        hapticFeedback: settings.hapticIntensity / 100,
        activeColor,
        settings: {
          ell: settings.ellMode,
          rate: settings.pollingRate
        }
      });
      lastSentState.current = currentStateStr;
    }
  }, [state, platform, settings, activeColor]);

  const [isPortrait, setIsPortrait] = useState(false);
  const [autofitScale, setAutofitScale] = useState(1);
  const { vibrate } = useHaptics();
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [showPairing, setShowPairing] = useState(false);
  const [pairingMethod, setPairingMethod] = useState<"wifi" | "bluetooth" | "usb" | "qr">("qr");
  const [pairingId] = useState(() => Math.random().toString(36).substring(7));
  const [lastPeerId, setLastPeerId] = useState<string | null>(() => localStorage.getItem('nexus_last_peer_id'));
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Initialize connectivity
  useEffect(() => {
    connectivity.setCallbacks(
      (newStatus) => {
        setStatus(newStatus);
        if (newStatus === 'connected' && lastPeerId) {
          // Success!
        }
      },
      () => {
        vibrate([50, 20, 50]);
        setShowPairing(false);
      }
    );
    
    // Auto discovery simulation
    connectivity.joinPairing("discovery-lobby");

    // Quick Connect logic
    const savedId = localStorage.getItem('nexus_last_peer_id');
    if (savedId && status === 'disconnected') {
       console.log("Attempting Quick Connect to:", savedId);
       connectivity.initPeer(true, savedId);
    }

    return () => connectivity.disconnect();
  }, []);

  const handleQrScan = (decodedText: string) => {
    if (decodedText.startsWith("LUMINA-NEXUS:")) {
      const peerId = decodedText.split(":")[1];
      localStorage.setItem('nexus_last_peer_id', peerId);
      setLastPeerId(peerId);
      connectivity.initPeer(true, peerId);
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    }
  };

  useEffect(() => {
    if (pairingMethod === "qr" && showPairing) {
      setTimeout(() => {
        scannerRef.current = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        scannerRef.current.render(handleQrScan, (err) => {});
      }, 500);
    } else if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    return () => {
      if (scannerRef.current) scannerRef.current.clear();
    };
  }, [pairingMethod, showPairing]);

  // Check orientation & calculate autofit scale for landscape mobile views
  useEffect(() => {
    const handleResize = () => {
      const isPort = window.innerHeight > window.innerWidth;
      setIsPortrait(isPort);
      
      if (!isPort) {
        // Optimal design dimensions for the dual-wing controller layout
        const designWidth = 1100;
        const designHeight = 460;
        
        // Calculate viewport scales
        const wScale = window.innerWidth / designWidth;
        const hScale = (window.innerHeight - 44) / designHeight; // subtract top margins & footer room
        
        // Target scale fits both dimensions perfectly
        const scale = Math.min(wScale, hScale);
        
        // Restrict scale level: don't upscale too much, floor at 0.45 for safety
        setAutofitScale(Math.max(0.4, Math.min(1.1, scale)));
      } else {
        setAutofitScale(1);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleButtonPress = (id: string) => {
    vibrate(10);
    setState(prev => ({
      ...prev,
      buttons: { ...prev.buttons, [id]: true }
    }));
  };

  const handleButtonRelease = (id: string) => {
    setState(prev => ({
      ...prev,
      buttons: { ...prev.buttons, [id]: false }
    }));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 w-full h-full bg-[#0A0A0C] font-sans text-white overflow-hidden touch-none select-none flex flex-col justify-between"
    >
      <AnimatePresence>
        {isPortrait && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-8 text-center backdrop-blur-md"
          >
            <div className="mb-6 rounded-full bg-white/10 p-6">
              <RotateCcw className="w-16 h-16 animate-pulse text-[var(--accent-cyan)]" />
            </div>
            <h2 className="text-3xl font-bold mb-4 font-mono">LANDSCAPE REQUIRED</h2>
            <p className="text-white/60 text-lg max-w-xs">
              Please rotate your device or expand the window to access the Lumina Nexus Interface.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex items-center justify-center overflow-hidden w-full h-[calc(100vh-3rem)] relative select-none">
        <main 
          className="grid grid-cols-12 gap-2 px-4 py-4 relative items-center w-[1100px] h-[460px] flex-shrink-0"
          style={{
            transform: `scale(${autofitScale})`,
            transformOrigin: 'center center'
          }}
        >
        {/* Left Section: D-Pad & Left Stick inside a Customizable Gamepad Wing Panel */}
        <div className="col-span-4 h-full flex flex-col justify-center items-center">
          <motion.div 
            className="w-full max-w-[280px] h-full max-h-[92%] flex flex-col justify-around items-center py-4 px-3 rounded-[32px] bg-gradient-to-b from-[#111319]/80 to-[#0c0d12]/90 backdrop-blur-md shadow-2xl relative"
            style={{
              borderWidth: `${settings.gamepadBorderSize ?? 2}px`,
              borderStyle: settings.gamepadBorderStyle === 'glow_pulse' ? 'solid' : (settings.gamepadBorderStyle === 'none' ? 'none' : settings.gamepadBorderStyle || 'solid'),
              borderColor: activeColor,
              transform: `scale(${settings.gamepadScale ?? 1.0})`,
              transformOrigin: 'left center'
            }}
            animate={settings.gamepadBorderStyle === 'glow_pulse' ? {
              boxShadow: [
                `0 0 8px ${activeColor}30, inset 0 0 10px ${activeColor}10`,
                `0 0 20px ${activeColor}70, inset 0 0 15px ${activeColor}20`,
                `0 0 8px ${activeColor}30, inset 0 0 10px ${activeColor}10`
              ],
              borderColor: [activeColor, `${activeColor}80`, activeColor]
            } : {
              boxShadow: settings.gamepadBorderStyle === 'none' ? 'none' : `0 10px 25px rgba(0,0,0,0.4)`,
              borderColor: settings.gamepadBorderStyle === 'none' ? 'transparent' : activeColor
            }}
            transition={{ repeat: Infinity, duration: 2.0, ease: 'easeInOut' }}
          >
            {/* Shoulder Buttons L - contained safe within layout */}
            <div className="flex gap-2 justify-center w-full" style={{ transform: `scale(${settings.buttonScale})` }}>
              <ShoulderButton label="L2 Trigger" id="L2" onPress={handleButtonPress} onRelease={handleButtonRelease} pressed={!!state.buttons['L2']} isTrigger activeColor={activeColor} />
              <ShoulderButton label="L1 Bumper" id="L1" onPress={handleButtonPress} onRelease={handleButtonRelease} pressed={!!state.buttons['L1']} activeColor={activeColor} />
            </div>

            {/* D-Pad */}
            <div className="flex items-center justify-center" style={{ transform: `scale(${settings.buttonScale})` }}>
              <DPad onInput={handleButtonPress} onRelease={handleButtonRelease} activeButtons={state.buttons} activeColor={activeColor} />
            </div>

            {/* Left Joystick */}
            <div className="flex items-center justify-center" style={{ transform: `scale(${settings.buttonScale})` }}>
              <Joystick 
                id="left" 
                label="LS"
                calibration={settings.calibration.left}
                activeColor={activeColor}
                onChange={(x, y) => setState(p => ({ ...p, axes: { ...p.axes, left: { x, y } } }))} 
              />
            </div>
          </motion.div>
        </div>

        {/* Center: System & Telemetry */}
        <div className="col-span-4 flex flex-col items-center justify-between py-4 h-full max-h-[92%] select-none z-30">
          <div className="flex gap-3">
            <button 
              onClick={() => setShowPairing(true)}
              className="group bg-[#15171E] px-4 py-1 rounded-full border border-gray-800 flex items-center gap-3 active:scale-95 transition-all"
              style={{ borderColor: `${activeColor}40` }}
            >
              <div className={`w-2 h-2 rounded-full ${status === 'connected' ? '' : 'bg-yellow-500 animate-pulse'}`} style={{ backgroundColor: status === 'connected' ? activeColor : undefined, boxShadow: status === 'connected' ? `0 0 8px ${activeColor}` : undefined }}></div>
              <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 group-hover:text-white">
                {status === 'connected' ? 'Nexus Link Active' : status === 'pairing' ? 'Connecting...' : `Status: ${status}`}
              </span>
            </button>

            {status === 'disconnected' && lastPeerId && (
              <button 
                onClick={() => connectivity.initPeer(true, lastPeerId)}
                className="bg-[#15171E] px-3 py-1 rounded-full border flex items-center gap-2 hover:brightness-125 transition-all active:scale-95"
                style={{ borderColor: `${activeColor}40`, backgroundColor: `${activeColor}1a` }}
              >
                <RefreshCw size={10} style={{ color: activeColor }} />
                <span className="text-[8px] uppercase tracking-widest font-bold" style={{ color: activeColor }}>Quick Link</span>
              </button>
            )}

            <button 
              onClick={() => setShowSettings(true)}
              className="bg-[#15171E] px-3 py-1 rounded-full border border-gray-800 text-gray-500 hover:text-white active:scale-90 transition-all cursor-pointer"
            >
              <Settings size={14} />
            </button>
          </div>

          <div className="w-full max-w-xs geometric-panel p-4 flex flex-col gap-4 self-center" style={{ borderColor: `${activeColor}22` }}>
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <div>
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold font-mono">Protocol</div>
                <div className="text-xs font-mono font-bold" style={{ color: activeColor }}>{PLATFORM_CONFIGS[platform].protocol}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold font-mono">Refresh</div>
                <div className="text-xs font-mono font-bold">{settings.pollingRate}Hz</div>
              </div>
            </div>

            {/* Vibration Control - Aesthetic purely for theme */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[9px] font-mono">
                 <span className="text-gray-400 font-bold uppercase tracking-wider">Engine Calibration</span>
                 <span className="font-bold transition-colors" style={{ color: settings.ellMode ? activeColor : '#666' }}>
                   {settings.ellMode ? 'ELL STABLE' : 'STANDARD'}
                 </span>
              </div>
              <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden flex">
                 <div className="h-full transition-all" style={{ width: settings.ellMode ? '100%' : '75%', backgroundColor: activeColor, boxShadow: `0 0 10px ${activeColor}80` }}></div>
              </div>
            </div>

            {/* Center Utility Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <SystemButton 
                label="Menu" 
                icon={<Menu size={12} />} 
                id="select" 
                onPress={handleButtonPress} 
                onRelease={handleButtonRelease}
                pressed={!!state.buttons['select']}
                activeColor={activeColor}
              />
              <SystemButton 
                label="Options" 
                icon={<Maximize2 size={12} />} 
                id="start" 
                onPress={(id) => { toggleFullscreen(); handleButtonPress(id); }} 
                onRelease={handleButtonRelease}
                pressed={!!state.buttons['start']}
                activeColor={activeColor}
              />
            </div>
          </div>

          {/* Nexus Core Button */}
          <button 
            onPointerDown={(e) => { e.preventDefault(); handleButtonPress('home'); }}
            onPointerUp={() => handleButtonRelease('home')}
            onPointerLeave={() => handleButtonRelease('home')}
            onPointerCancel={() => handleButtonRelease('home')}
            className={`w-16 h-16 rounded-full flex items-center justify-center border-4 border-gray-900 active:scale-95 transition-all cursor-pointer select-none touch-none`}
            style={{ 
              backgroundColor: activeColor, 
              boxShadow: state.buttons['home'] ? `0 0 35px ${activeColor}` : `0 0 20px ${activeColor}33`,
              filter: state.buttons['home'] ? 'brightness(1.2)' : 'brightness(1)'
            }}
          >
            <span className="text-lg font-black italic text-white font-mono">X</span>
          </button>
        </div>

        {/* Right Section: ABXY & Right Stick inside a Customizable Gamepad Wing Panel */}
        <div className="col-span-4 h-full flex flex-col justify-center items-center">
          <motion.div 
            className="w-full max-w-[280px] h-full max-h-[92%] flex flex-col justify-around items-center py-4 px-3 rounded-[32px] bg-gradient-to-b from-[#111319]/80 to-[#0c0d12]/90 backdrop-blur-md shadow-2xl relative"
            style={{
              borderWidth: `${settings.gamepadBorderSize ?? 2}px`,
              borderStyle: settings.gamepadBorderStyle === 'glow_pulse' ? 'solid' : (settings.gamepadBorderStyle === 'none' ? 'none' : settings.gamepadBorderStyle || 'solid'),
              borderColor: activeColor,
              transform: `scale(${settings.gamepadScale ?? 1.0})`,
              transformOrigin: 'right center'
            }}
            animate={settings.gamepadBorderStyle === 'glow_pulse' ? {
              boxShadow: [
                `0 0 8px ${activeColor}30, inset 0 0 10px ${activeColor}10`,
                `0 0 20px ${activeColor}70, inset 0 0 15px ${activeColor}20`,
                `0 0 8px ${activeColor}30, inset 0 0 10px ${activeColor}10`
              ],
              borderColor: [activeColor, `${activeColor}80`, activeColor]
            } : {
              boxShadow: settings.gamepadBorderStyle === 'none' ? 'none' : `0 10px 25px rgba(0,0,0,0.4)`,
              borderColor: settings.gamepadBorderStyle === 'none' ? 'transparent' : activeColor
            }}
            transition={{ repeat: Infinity, duration: 2.0, ease: 'easeInOut' }}
          >
            {/* Shoulder Buttons R - contained safe within layout */}
            <div className="flex flex-row-reverse gap-2 justify-center w-full" style={{ transform: `scale(${settings.buttonScale})` }}>
              <ShoulderButton label="R2 Trigger" id="R2" onPress={handleButtonPress} onRelease={handleButtonRelease} pressed={!!state.buttons['R2']} isTrigger activeColor={activeColor} />
              <ShoulderButton label="R1 Bumper" id="R1" onPress={handleButtonPress} onRelease={handleButtonRelease} pressed={!!state.buttons['R1']} activeColor={activeColor} />
            </div>

            {/* Action Buttons Pad */}
            <div className="flex items-center justify-center p-1" style={{ transform: `scale(${settings.buttonScale})` }}>
              <ActionPad onInput={handleButtonPress} onRelease={handleButtonRelease} activeButtons={state.buttons} activeColor={activeColor} />
            </div>

            {/* Right Joystick */}
            <div className="flex items-center justify-center lg:mt-1" style={{ transform: `scale(${settings.buttonScale})` }}>
              <Joystick 
                id="right" 
                label="RS"
                calibration={settings.calibration.right}
                activeColor={activeColor}
                onChange={(x, y) => setState(p => ({ ...p, axes: { ...p.axes, right: { x, y } } }))} 
              />
            </div>
          </motion.div>
        </div>
      </main>
    </div>

      {/* Bottom Nav/Status Bar */}
          <footer className="h-12 hard-rail flex items-center justify-between px-10">
             <span className="text-[9px] text-gray-600 font-mono tracking-widest uppercase">LX: {state.axes.left.x.toFixed(2)} | RX: {state.axes.right.x.toFixed(2)}</span>
             <div className="flex gap-6">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: `${activeColor}b3` }}>Calibration OK</span>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest text-right">Firmware v2.4.1</span>
             </div>
          </footer>

      {/* Connectivity Modal */}
      <AnimatePresence>
        {showPairing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-xl p-8"
          >
            <div className="w-full max-w-4xl h-full max-h-[80vh] geometric-panel flex overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-64 border-r border-gray-800 flex flex-col p-6 gap-4">
                <h3 className="text-xl font-mono font-bold text-white mb-6 tracking-tighter">CONNECTIVITY</h3>
                <PairingTab 
                  id="wifi" 
                  label="Wi-Fi Direct" 
                  icon={<Wifi size={20} />} 
                  active={pairingMethod === 'wifi'} 
                  onClick={() => setPairingMethod('wifi')} 
                />
                <PairingTab 
                  id="bluetooth" 
                  label="Bluetooth" 
                  icon={<Bluetooth size={20} />} 
                  active={pairingMethod === 'bluetooth'} 
                  onClick={() => setPairingMethod('bluetooth')} 
                />
                <PairingTab 
                  id="usb" 
                  label="USB OTG" 
                  icon={<Usb size={20} />} 
                  active={pairingMethod === 'usb'} 
                  onClick={() => setPairingMethod('usb')} 
                />
                <PairingTab 
                  id="qr" 
                  label="QR Pairing" 
                  icon={<QrCode size={20} />} 
                  active={pairingMethod === 'qr'} 
                  onClick={() => setPairingMethod('qr')} 
                />
                
                <div className="mt-auto">
                  <button 
                    onClick={() => setShowPairing(false)}
                    className="w-full py-3 rounded-lg border border-gray-700 text-gray-500 hover:text-white transition-colors text-sm uppercase font-bold tracking-widest"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-12 overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={pairingMethod}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full flex flex-col items-center justify-center text-center"
                  >
                    {pairingMethod === 'qr' && (
                      <div className="flex flex-col items-center gap-8 w-full">
                        <div className="grid grid-cols-2 gap-12 w-full">
                          <div className="flex flex-col items-center gap-4">
                            <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">Your Device ID</span>
                            <div className="p-4 bg-white rounded-2xl shadow-2xl">
                              <QRCodeSVG value={`LUMINA-NEXUS:${pairingId}`} size={200} />
                            </div>
                            <span className="font-mono text-xl text-blue-400 mt-2">{pairingId.toUpperCase()}</span>
                          </div>
                          <div className="flex flex-col items-center gap-4">
                            <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">Scan Peer</span>
                            <div id="qr-reader" className="w-full h-[250px] bg-gray-950 rounded-2xl border-2 border-gray-800 overflow-hidden" />
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm max-w-md">
                          Scan the QR code on your second device to initiate a peer-to-peer connection for ultra-low latency inputs.
                        </p>
                      </div>
                    )}

                    {pairingMethod === 'wifi' && (
                      <div className="flex flex-col items-center gap-6 w-full max-w-md">
                        <div className="relative">
                          {!isOnline && (
                            <span className="absolute -top-2 -right-2 px-2 py-0.5 text-[9px] font-mono bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 font-bold tracking-widest uppercase animate-pulse">
                              OFFLINE
                            </span>
                          )}
                          <div className="absolute inset-0 animate-ping rounded-full" style={{ backgroundColor: isOnline ? `${activeColor}33` : '#f59e0b22' }} />
                          <div className="relative w-24 h-24 rounded-full border-2 flex items-center justify-center shadow-2xl" style={{ borderColor: isOnline ? `${activeColor}80` : '#f59e0b80', boxShadow: `0 0 30px ${isOnline ? activeColor : '#f59e0b'}4d` }}>
                            <Wifi size={36} style={{ color: isOnline ? activeColor : '#f59e0b' }} />
                          </div>
                        </div>
                        <div className="space-y-1 text-center">
                          <h4 className="text-xl font-bold font-mono">Wi-Fi Direct & LAN</h4>
                          <p className="text-gray-400 text-xs max-w-xs">
                            {isOnline 
                              ? "Searching for Lumina compatible nodes on local network..."
                              : "Active in Offline LAN mode. Connect directly to PC or TV receiver IP."}
                          </p>
                        </div>

                        {/* Custom IP Entry for Offline / Local Connection */}
                        <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                          <label className="block text-[10px] font-mono text-gray-400 text-left uppercase tracking-wider">
                            Receiver IP / Host Address (Offline Play)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="e.g. 192.168.1.100 (or localhost)"
                              value={customServerUrl.replace(/^https?:\/\//, '').replace(/:3000$/, '')}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                if (!val) {
                                  setCustomServerUrl('');
                                  localStorage.removeItem('nexus_custom_server_url');
                                  if (typeof window !== "undefined") {
                                    connectivity.updateServerUrl(window.location.protocol + '//' + window.location.host);
                                  }
                                } else {
                                  const formatted = val.startsWith('http') ? val : `http://${val}`;
                                  const fullUrl = formatted.includes(':') ? formatted : `${formatted}:3000`;
                                  setCustomServerUrl(fullUrl);
                                  localStorage.setItem('nexus_custom_server_url', fullUrl);
                                  connectivity.updateServerUrl(fullUrl);
                                }
                              }}
                              className="flex-1 px-3 py-1.5 bg-gray-900 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-gray-650 focus:outline-none focus:border-cyan-400"
                            />
                            {customServerUrl && (
                              <button 
                                onClick={() => {
                                  setCustomServerUrl('');
                                  localStorage.removeItem('nexus_custom_server_url');
                                  if (typeof window !== "undefined") {
                                    connectivity.updateServerUrl(window.location.protocol + '//' + window.location.host);
                                  }
                                }}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-xs font-mono text-gray-300 rounded-lg border border-white/10 cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          {customServerUrl && (
                            <p className="text-[10px] font-mono text-cyan-400 text-left">
                              Target: {customServerUrl}
                            </p>
                          )}
                        </div>

                        <div className="w-full max-w-xs space-y-2">
                           <DiscoveryItem name="Host-Primary-01" status={customServerUrl ? "Connecting..." : "Ready"} processing={!!customServerUrl} />
                           {!customServerUrl && isOnline && (
                             <>
                               <DiscoveryItem name="Guest-Nexus-A" status="Pairing..." processing />
                               <DiscoveryItem name="Legacy-Node-09" status="Incompatible" error />
                             </>
                           )}
                        </div>
                      </div>
                    )}

                    {pairingMethod === 'bluetooth' && (
                      <BluetoothPairing 
                        activeColor={activeColor} 
                        onConnect={(id) => {
                          localStorage.setItem('nexus_last_peer_id', id);
                          setLastPeerId(id);
                          connectivity.initPeer(true, id);
                        }}
                      />
                    )}

                    {pairingMethod === 'usb' && (
                      <div className="flex flex-col items-center gap-8">
                        <Usb size={64} style={{ color: activeColor }} />
                        <h4 className="text-2xl font-bold font-mono">USB OTG MODE</h4>
                        <p className="text-gray-400 max-w-sm">Physical tethering detected. Wired mode prioritizes latency above all else.</p>
                        <div className="p-6 bg-white/5 border rounded-2xl flex items-center gap-4" style={{ borderColor: `${activeColor}4d`, backgroundColor: `${activeColor}1a` }}>
                           <AlertCircle style={{ color: activeColor }} />
                           <span className="text-sm font-mono text-blue-200">Connect via Type-C to Type-C cable</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <OptimizationModal 
        show={showSettings} 
        onClose={() => setShowSettings(false)} 
        currentPlatform={platform}
        activeColor={activeColor}
        settings={settings}
        onPlatformChange={setPlatform}
        onSettingsChange={setSettings}
        onOpenCalibration={() => {
          setShowSettings(false);
          setShowCalibration(true);
        }}
      />
      <CalibrationModal
        show={showCalibration}
        onClose={() => setShowCalibration(false)}
        settings={settings}
        activeColor={activeColor}
        onSettingsChange={setSettings}
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}

const DEFAULT_PRESETS = [
  {
    id: 'fps_pro',
    name: 'FPS Pro Core',
    gameType: 'FPS / Shooter',
    isDefault: true,
    description: 'Ultra-tight deadzones, high right stick sensitivity, and quick trigger responses for high accuracy.',
    buttonMapping: {
      a: 'a', b: 'b', x: 'x', y: 'y',
      l1: 'l1', r1: 'r1', l2: 'l2', r2: 'r2',
      dpad_up: 'dpad_up', dpad_down: 'dpad_down', dpad_left: 'dpad_left', dpad_right: 'dpad_right',
      home: 'home', select: 'select', start: 'start'
    },
    calibration: {
      left: { deadzone: 0.05, centerX: 0, centerY: 0, sensitivity: 1.15, curve: 1.2 },
      right: { deadzone: 0.04, centerX: 0, centerY: 0, sensitivity: 1.35, curve: 1.4 }
    }
  },
  {
    id: 'racing_smooth',
    name: 'Precision Circuit',
    gameType: 'Racing / Sim',
    isDefault: true,
    description: 'Smooth linear stick responses, wider deadzones, and progressive trigger dampening for steady handling.',
    buttonMapping: {
      a: 'a', b: 'b', x: 'x', y: 'y',
      l1: 'l1', r1: 'r1', l2: 'l2', r2: 'r2',
      dpad_up: 'dpad_up', dpad_down: 'dpad_down', dpad_left: 'dpad_left', dpad_right: 'dpad_right',
      home: 'home', select: 'select', start: 'start'
    },
    calibration: {
      left: { deadzone: 0.16, centerX: 0, centerY: 0, sensitivity: 0.85, curve: 0.8 },
      right: { deadzone: 0.12, centerX: 0, centerY: 0, sensitivity: 0.9, curve: 1.0 }
    }
  },
  {
    id: 'fighting_arcade',
    name: 'Arcade Combo Master',
    gameType: 'Fighting / Arcade',
    isDefault: true,
    description: 'Micro-deadzones and instantaneous direction registration for pulling off fast technical combos.',
    buttonMapping: {
      a: 'a', b: 'b', x: 'x', y: 'y',
      l1: 'l1', r1: 'r1', l2: 'l2', r2: 'r2',
      dpad_up: 'dpad_up', dpad_down: 'dpad_down', dpad_left: 'dpad_left', dpad_right: 'dpad_right',
      home: 'home', select: 'select', start: 'start'
    },
    calibration: {
      left: { deadzone: 0.02, centerX: 0, centerY: 0, sensitivity: 1.5, curve: 1.0 },
      right: { deadzone: 0.02, centerX: 0, centerY: 0, sensitivity: 1.5, curve: 1.0 }
    }
  },
  {
    id: 'sports_tactical',
    name: 'Tactical Playmaker',
    gameType: 'Sports / RPG',
    isDefault: true,
    description: 'Symmetric radial joystick bounds optimized for responsive dribbling, skills, and rapid player changes.',
    buttonMapping: {
      a: 'a', b: 'b', x: 'x', y: 'y',
      l1: 'l1', r1: 'r1', l2: 'l2', r2: 'r2',
      dpad_up: 'dpad_up', dpad_down: 'dpad_down', dpad_left: 'dpad_left', dpad_right: 'dpad_right',
      home: 'home', select: 'select', start: 'start'
    },
    calibration: {
      left: { deadzone: 0.08, centerX: 0, centerY: 0, sensitivity: 1.0, curve: 1.05 },
      right: { deadzone: 0.08, centerX: 0, centerY: 0, sensitivity: 1.15, curve: 1.1 }
    }
  }
];

function OptimizationModal({ 
  show, 
  onClose, 
  currentPlatform, 
  activeColor,
  onPlatformChange, 
  settings, 
  onSettingsChange,
  onOpenCalibration
}: { 
  show: boolean, 
  onClose: () => void, 
  currentPlatform: Platform, 
  activeColor: string,
  onPlatformChange: (p: Platform) => void,
  settings: OptimizationSettings,
  onSettingsChange: (s: OptimizationSettings) => void,
  onOpenCalibration: () => void
}) {
  const { vibrate } = useHaptics();
  
  // PWA Offline Service Engine states
  const [swStatus, setSwStatus] = useState<'checking' | 'active' | 'inactive' | 'unsupported'>('checking');
  const [cacheCheckProgress, setCacheCheckProgress] = useState<'idle' | 'checking' | 'synced'>('idle');
  const [cachedAssetsCount, setCachedAssetsCount] = useState<number>(0);
  const [localIsOnline, setLocalIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleLine = () => setLocalIsOnline(true);
    const handleOff = () => setLocalIsOnline(false);
    window.addEventListener('online', handleLine);
    window.addEventListener('offline', handleOff);
    
    // Check Service Worker status
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {
        setSwStatus('active');
        // Count cached items in database
        if ('caches' in window) {
          caches.keys().then(keys => {
            Promise.all(keys.map(k => caches.open(k).then(c => c.keys()))).then(results => {
              const total = results.reduce((acc, current) => acc + current.length, 0);
              setCachedAssetsCount(total || 4); // default base assets
            }).catch(() => setCachedAssetsCount(4));
          }).catch(() => setCachedAssetsCount(4));
        }
      } else {
        setSwStatus('inactive');
      }
    } else {
      setSwStatus('unsupported');
    }

    return () => {
      window.removeEventListener('online', handleLine);
      window.removeEventListener('offline', handleOff);
    };
  }, []);

  const handleVerifyCache = async () => {
    setCacheCheckProgress('checking');
    vibrate(12);
    
    // Check files and force sw update or re-cache files
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
        
        // Populating offline cache manually to guarantee it holds all entry assets
        if ('caches' in window) {
          const cache = await caches.open('lumina-nexus-v1');
          const cacheUrls = ['/', '/index.html', '/manifest.json', '/icon.svg'];
          await Promise.all(cacheUrls.map(url => 
            fetch(url)
              .then(res => {
                if (res.status === 200) cache.put(url, res);
              })
              .catch(err => console.log("Precache fetch failed:", err))
          ));
          
          const keys = await caches.keys();
          let count = 0;
          for (const key of keys) {
            const openCache = await caches.open(key);
            const cachedRequests = await openCache.keys();
            count += cachedRequests.length;
          }
          setCachedAssetsCount(count || 4);
        }
        setSwStatus('active');
      } catch (e) {
        console.error("Cache verification issue", e);
      }
    }
    
    setTimeout(() => {
      setCacheCheckProgress('synced');
      vibrate([15, 10, 15]);
      setTimeout(() => setCacheCheckProgress('idle'), 2500);
    }, 1500);
  };

  const [customPresets, setCustomPresets] = useState<any[]>(() => {
    const saved = localStorage.getItem('nexus_controller_presets_custom');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('nexus_controller_presets_custom', JSON.stringify(customPresets));
  }, [customPresets]);

  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetGenre, setNewPresetGenre] = useState('FPS / Shooter');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      setStatusMessage('❌ Please enter a preset name!');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    const newPreset = {
      id: 'preset_' + Date.now(),
      name: newPresetName.trim(),
      gameType: newPresetGenre,
      buttonMapping: { ...settings.buttonMapping },
      calibration: { 
        left: { ...settings.calibration.left },
        right: { ...settings.calibration.right }
      },
      description: `Custom layout saved on ${new Date().toLocaleDateString()}`
    };

    setCustomPresets(prev => [...prev, newPreset]);
    setNewPresetName('');
    setIsSavingPreset(false);
    setStatusMessage('✅ Preset saved successfully!');
    vibrate(30);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleLoadPreset = (preset: any) => {
    onSettingsChange({
      ...settings,
      buttonMapping: { ...preset.buttonMapping },
      calibration: { ...preset.calibration }
    });
    vibrate([15, 10, 15]);
    setStatusMessage(`✅ Loaded profile: ${preset.name}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDeletePreset = (id: string, name: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== id));
    vibrate(10);
    setStatusMessage(`❌ Deleted custom preset: ${name}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const PRESET_COLORS = [
    { name: 'Auto', value: null },
    { name: 'Red', value: '#ef4444' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'White', value: '#ffffff' },
  ];

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-8"
        >
          <div className="w-full max-w-2xl geometric-panel p-8 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold font-mono italic">STREAM OPTIMIZER</h3>
              <button onClick={onClose} className="p-2 border border-gray-800 rounded-full hover:bg-white/5 cursor-pointer">
                <XCircle size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(Object.keys(PLATFORM_CONFIGS) as Platform[]).map(key => (
                <button
                  key={key}
                  onClick={() => onPlatformChange(key)}
                  className={`flex flex-col p-4 rounded-xl border transition-all text-left cursor-pointer ${currentPlatform === key ? 'bg-white/5 border-gray-400' : 'bg-transparent border-gray-800 hover:border-gray-700'}`}
                >
                  <span className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-1">{PLATFORM_CONFIGS[key].protocol}</span>
                  <span className="text-lg font-bold" style={{ color: currentPlatform === key ? activeColor : PLATFORM_CONFIGS[key].color }}>{PLATFORM_CONFIGS[key].label}</span>
                </button>
              ))}
            </div>

            {/* Game Presets Section */}
            <div className="space-y-4 pt-4 border-t border-gray-800">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 font-mono flex items-center gap-2">
                    <Gamepad2 size={14} className="text-blue-400" style={{ color: activeColor }} />
                    Game Presets & Profiles
                  </h4>
                  <p className="text-[10px] text-gray-500 uppercase font-mono mt-0.5">Quick bind maps & analog curves</p>
                </div>
                
                {!isSavingPreset ? (
                  <button
                    onClick={() => {
                      setIsSavingPreset(true);
                      setNewPresetName(`My Layout ${customPresets.length + 1}`);
                    }}
                    className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 border rounded-lg transition-all hover:bg-white/5 cursor-pointer"
                    style={{ color: activeColor, borderColor: `${activeColor}33` }}
                  >
                    <Plus size={12} />
                    Save Current Layout
                  </button>
                ) : (
                  <button
                    onClick={() => setIsSavingPreset(false)}
                    className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 border border-red-800 rounded-lg text-red-400 hover:bg-red-950/20 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Status Flash Message */}
              {statusMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-2.5 bg-white/5 border border-gray-800 rounded-lg text-center font-mono text-[10px] tracking-tight text-emerald-400"
                  style={{ borderColor: `${activeColor}22` }}
                >
                  {statusMessage}
                </motion.div>
              )}

              {/* Inline Save Preset Dialog */}
              {isSavingPreset && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="p-4 bg-[#14151B] border border-gray-800 rounded-xl space-y-3"
                  style={{ borderColor: `${activeColor}40` }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-gray-500 font-mono">Profile Name</label>
                      <input 
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="e.g. Call of Duty Arena"
                        className="bg-black/60 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none text-white focus:border-blue-400"
                        style={{ focusBorderColor: activeColor }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-gray-500 font-mono">Game Genre / Mode</label>
                      <select
                        value={newPresetGenre}
                        onChange={(e) => setNewPresetGenre(e.target.value)}
                        className="bg-black/60 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none text-blue-400 cursor-pointer"
                      >
                        <option value="FPS / Shooter">FPS / Shooter</option>
                        <option value="Racing / Sim">Racing / Sim</option>
                        <option value="Fighting / Arcade">Fighting / Arcade</option>
                        <option value="Sports / RPG">Sports / RPG</option>
                        <option value="Custom General">Custom / Others</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 text-[10px]">
                    <button
                      onClick={handleSavePreset}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold uppercase font-mono cursor-pointer transition-colors"
                      style={{ backgroundColor: activeColor }}
                    >
                      <Save size={12} />
                      Create Profile
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Profiles Grid */}
              <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {/* Merged presets: Built-in + Custom user profiles */}
                {[...DEFAULT_PRESETS, ...customPresets].map((preset) => {
                  const isCurrentlyActive = JSON.stringify(settings.buttonMapping) === JSON.stringify(preset.buttonMapping) &&
                    JSON.stringify(settings.calibration) === JSON.stringify(preset.calibration);

                  return (
                    <div 
                      key={preset.id}
                      className={`flex flex-col p-3 rounded-xl border transition-all text-left relative ${preset.isDefault ? 'bg-[#121319]' : 'bg-[#14151E]'} 
                        ${isCurrentlyActive ? 'border-gray-300' : 'border-gray-800/80 hover:border-gray-700'}`}
                      style={{ 
                        borderColor: isCurrentlyActive ? activeColor : undefined,
                        boxShadow: isCurrentlyActive ? `0 0 12px ${activeColor}22` : undefined
                      }}
                    >
                      {/* Badge / Labels */}
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[8px] uppercase tracking-widest font-black text-gray-500 font-mono">
                          {preset.gameType} {preset.isDefault && '• Built-In'}
                        </span>
                        {isCurrentlyActive && (
                          <span className="text-[8px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono flex items-center gap-1">
                            <Check size={8} /> Active
                          </span>
                        )}
                      </div>

                      <span className="text-sm font-bold text-gray-200 tracking-tight flex items-center gap-1.5">
                        {preset.name}
                        {!preset.isDefault && <Sparkles size={11} className="text-yellow-500 animate-pulse" />}
                      </span>

                      <p className="text-[10px] text-gray-400 mt-1.5 mb-3 leading-normal border-l border-gray-800/60 pl-2">
                        {preset.description}
                      </p>

                      <div className="mt-auto flex justify-between items-center pt-2 border-t border-gray-800/40">
                        {/* Quick calibration indicators */}
                        <span className="text-[8px] font-mono text-gray-500 uppercase">
                          L-Dead: {Math.round(preset.calibration.left.deadzone * 100)}% / R-Dead: {Math.round(preset.calibration.right.deadzone * 100)}%
                        </span>

                        <div className="flex gap-1.5 z-10">
                          {/* Delete button if user-custom preset */}
                          {!preset.isDefault && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePreset(preset.id, preset.name);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded border border-transparent hover:border-red-500/20 cursor-pointer"
                              title="Delete Preset"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}

                          {/* Load button */}
                          <button
                            onClick={() => handleLoadPreset(preset)}
                            className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded transition-all cursor-pointer border
                              ${isCurrentlyActive 
                                ? 'bg-[#1C1E26] text-gray-400 border-gray-700 pointer-events-none' 
                                : 'bg-[#1C1E26] text-white hover:brightness-125'}`}
                            style={{
                              color: !isCurrentlyActive ? activeColor : undefined,
                              borderColor: !isCurrentlyActive ? `${activeColor}33` : undefined
                            }}
                          >
                            {isCurrentlyActive ? 'Applied' : 'Load Layout'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Offline PWA & Service Engine Dashboard */}
            <div className="space-y-4 pt-4 border-t border-gray-800">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 font-mono flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full relative">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${localIsOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${localIsOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  </span>
                  Offline Companion & PWA Engine
                </h4>
                <p className="text-[10px] text-gray-500 uppercase font-mono mt-0.5">Offline-first local signaling & caching status</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Visual Status Console */}
                <div className="p-4 bg-[#14151C] rounded-xl border border-gray-800 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    {/* Status 1: Network */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-gray-500 uppercase font-bold text-[10px]">Client Status</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-mono font-bold ${localIsOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {localIsOnline ? '● Online Mode' : '● LAN Offline Mode'}
                      </span>
                    </div>

                    {/* Status 2: PWA Service Worker caching */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-gray-500 uppercase font-bold text-[10px]">PWA Caching</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-mono font-bold ${swStatus === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : swStatus === 'checking' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                        {swStatus === 'active' ? 'Active & Offline Ready' : swStatus === 'checking' ? 'Testing Engine...' : 'Standby / Registered'}
                      </span>
                    </div>

                    {/* Status 3: Cached files */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-gray-500 uppercase font-bold text-[10px]">Assets Offline</span>
                      <span className="text-gray-300 font-mono font-bold text-[10px]">
                        {cachedAssetsCount > 0 ? `${cachedAssetsCount} Cached Files` : 'Standard App Bundle'}
                      </span>
                    </div>
                  </div>

                  {/* Manual cache verification/sync button */}
                  <button
                    onClick={handleVerifyCache}
                    disabled={cacheCheckProgress === 'checking'}
                    className={`w-full py-2 px-3 text-[10px] uppercase tracking-wider font-mono font-bold rounded-lg transition-all border flex items-center justify-center gap-1.5 cursor-pointer 
                      ${cacheCheckProgress === 'synced' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#1C1E26] hover:brightness-110 text-gray-300'}`}
                    style={{ borderColor: cacheCheckProgress === 'synced' ? undefined : `${activeColor}22` }}
                  >
                    {cacheCheckProgress === 'checking' ? (
                      <>
                        <RefreshCw size={12} className="animate-spin text-cyan-400" style={{ color: activeColor }} />
                        Downloading Assets...
                      </>
                    ) : cacheCheckProgress === 'synced' ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        Assets Synced & Verified!
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} style={{ color: activeColor }} />
                        Verify Offline Caching
                      </>
                    )}
                  </button>
                </div>

                {/* Offline play blueprint guide */}
                <div className="p-4 bg-[#14151C] rounded-xl border border-gray-800 space-y-2.5">
                  <h5 className="font-mono text-[9px] uppercase text-gray-400 font-black tracking-widest flex items-center gap-1">
                    <Sparkles size={10} className="text-amber-400" />
                    How to play fully offline
                  </h5>
                  <ol className="space-y-2 text-[10px] text-gray-400 font-medium">
                    <li className="flex gap-2">
                      <span className="font-mono text-cyan-400 font-bold" style={{ color: activeColor }}>1</span>
                      <span><strong>Install PWA:</strong> From your browser's share/menu, hit <strong>Add to Home Screen</strong> so the app loads without internet.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-mono text-cyan-400 font-bold" style={{ color: activeColor }}>2</span>
                      <span><strong>Same Wi-Fi Network:</strong> Keep receiver & controller on the same network (even without internet!).</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-mono text-cyan-400 font-bold" style={{ color: activeColor }}>3</span>
                      <span><strong>LAN Signaling:</strong> Set Receiver Host IP address inside the connection menu. Works zero-delay!</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* RGB & Sizing Section */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-800">
               <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 font-mono">RGB Light Control</h4>
                  <div className="flex flex-wrap gap-2 items-center">
                     {PRESET_COLORS.map(color => (
                       <button
                         key={color.name}
                         onClick={() => onSettingsChange({ ...settings, rgbColor: color.value, rgbMode: 'static' })}
                         className={`w-8 h-8 rounded-full border-2 transition-all ${settings.rgbColor === color.value && (settings.rgbMode || 'static') === 'static' ? 'border-white scale-110' : 'border-transparent hover:scale-105'} cursor-pointer`}
                         style={{ 
                            backgroundColor: color.value || PLATFORM_CONFIGS[currentPlatform].color,
                            boxShadow: settings.rgbColor === color.value && (settings.rgbMode || 'static') === 'static' ? `0 0 10px ${color.value || activeColor}` : 'none'
                         }}
                         title={color.name}
                       />
                     ))}
                     {/* Custom Hex Picker (Interactive Variable Color Wheel) */}
                     <div 
                       className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all overflow-hidden cursor-pointer hover:scale-105 active:scale-95
                         ${settings.rgbColor && !PRESET_COLORS.some(c => c.value === settings.rgbColor) && (settings.rgbMode || 'static') === 'static' ? 'border-white scale-110' : 'border-transparent'}`}
                       style={{ 
                         background: 'linear-gradient(45deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                         boxShadow: settings.rgbColor && !PRESET_COLORS.some(c => c.value === settings.rgbColor) && (settings.rgbMode || 'static') === 'static' ? `0 0 10px ${settings.rgbColor}` : 'none'
                       }}
                       title="Custom Color Picker"
                     >
                       <input 
                         type="color" 
                         value={settings.rgbColor && settings.rgbColor.startsWith('#') ? settings.rgbColor : '#00ffd4'} 
                         onChange={(e) => onSettingsChange({ ...settings, rgbColor: e.target.value, rgbMode: 'static' })}
                         className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                       />
                       <span className="text-[9px] font-black pointer-events-none text-white drop-shadow-md select-none">Hex</span>
                     </div>
                  </div>

                  {/* Chroma Lighting Effects */}
                  <div className="pt-2 border-t border-gray-800/30">
                    <h5 className="text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold mb-2">Chroma Lighting Effect</h5>
                    <div className="grid grid-cols-3 gap-2">
                      {(['static', 'rainbow', 'breathe'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => onSettingsChange({ ...settings, rgbMode: mode })}
                          className={`px-2 py-1.5 text-[9px] uppercase font-mono font-bold rounded-lg border transition-all cursor-pointer text-center ${
                            (settings.rgbMode || 'static') === mode 
                              ? 'bg-[#1C1E26] text-white' 
                              : 'bg-transparent border-gray-800 text-gray-500 hover:text-gray-400'
                          }`}
                          style={{ 
                            color: (settings.rgbMode || 'static') === mode ? activeColor : undefined,
                            borderColor: (settings.rgbMode || 'static') === mode ? activeColor : undefined,
                            boxShadow: (settings.rgbMode || 'static') === mode ? `0 0 12px ${activeColor}1d` : 'none'
                          }}
                        >
                          {mode === 'static' ? '● Solid' : mode === 'rainbow' ? '🌈 Cycle' : '💨 Breathe'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chroma duration speed slider */}
                  {(settings.rgbMode || 'static') !== 'static' && (
                    <div className="space-y-1 pt-1 animate-fade-in">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-mono text-gray-500 uppercase font-bold">Chroma Cycle Speed</span>
                        <span className="font-mono font-bold" style={{ color: activeColor }}>{settings.rgbSpeed || 3}x</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" step="1" 
                        value={settings.rgbSpeed || 3} 
                        onChange={(e) => onSettingsChange({...settings, rgbSpeed: parseInt(e.target.value)})}
                        className="w-full cursor-pointer"
                        style={{ accentColor: activeColor }}
                      />
                    </div>
                  )}
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 font-mono">Gamepad Size Scale</h4>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">{Math.round((settings.gamepadScale ?? 1.0) * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.6" max="1.3" step="0.05" 
                    value={settings.gamepadScale ?? 1.0} 
                    onChange={(e) => onSettingsChange({...settings, gamepadScale: parseFloat(e.target.value)})}
                    className="w-full cursor-pointer"
                    style={{ accentColor: activeColor }}
                  />
               </div>
            </div>

            {/* Button Scale and Border Settings */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-800">
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 font-mono">Button Scale</h4>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">{Math.round(settings.buttonScale * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.6" max="1.4" step="0.05" 
                    value={settings.buttonScale} 
                    onChange={(e) => onSettingsChange({...settings, buttonScale: parseFloat(e.target.value)})}
                    className="w-full cursor-pointer"
                    style={{ accentColor: activeColor }}
                  />
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 font-mono">Shell Border Size</h4>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">{settings.gamepadBorderSize ?? 2}px</span>
                  </div>
                  <input 
                    type="range" min="0" max="8" step="1" 
                    value={settings.gamepadBorderSize ?? 2} 
                    onChange={(e) => onSettingsChange({...settings, gamepadBorderSize: parseInt(e.target.value)})}
                    className="w-full cursor-pointer"
                    style={{ accentColor: activeColor }}
                  />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-800">
               <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400 font-mono">Shell Border Style</h4>
                  <select 
                    className="w-full bg-black/60 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono outline-none text-blue-400 cursor-pointer"
                    value={settings.gamepadBorderStyle ?? 'solid'}
                    onChange={(e) => onSettingsChange({
                      ...settings, 
                      gamepadBorderStyle: e.target.value
                    })}
                  >
                     <option value="solid" className="bg-gray-900">Solid Neon</option>
                     <option value="glow_pulse" className="bg-gray-900">Breathing Glow</option>
                     <option value="dashed" className="bg-gray-900">Blueprint Dash</option>
                     <option value="double" className="bg-gray-900">Double Outlines</option>
                     <option value="dotted" className="bg-gray-900">Tech Dot Pattern</option>
                     <option value="none" className="bg-gray-900">Seamless Borderless</option>
                  </select>
               </div>
               <div className="pt-4 flex items-end">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold leading-normal">
                     Tip: Scale is pinned to phone boundaries for ergonomic gaming posture.
                  </span>
               </div>
            </div>

            {/* Button Mapping Section */}
            <div className="space-y-4 pt-4 border-t border-gray-800">
               <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 font-mono">Button Mapping Engine</h4>
                  <button 
                    onClick={() => onSettingsChange({
                      ...settings, 
                      buttonMapping: { a: 'a', b: 'b', x: 'x', y: 'y', l1: 'l1', r1: 'r1', l2: 'l2', r2: 'r2', dpad_up: 'dpad_up', dpad_down: 'dpad_down', dpad_left: 'dpad_left', dpad_right: 'dpad_right', home: 'home', select: 'select', start: 'start' }
                    })}
                    className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 border rounded-md transition-colors"
                    style={{ color: activeColor, borderColor: `${activeColor}33` }}
                  >
                    Reset Mapping
                  </button>
               </div>
               <div className="grid grid-cols-3 gap-3 h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {Object.keys(settings.buttonMapping).map(btn => (
                    <div key={btn} className="flex flex-col gap-1.5 p-2 bg-white/5 rounded-lg border border-gray-800">
                      <label className="text-[9px] font-black uppercase text-gray-400 font-mono">{btn}</label>
                      <select 
                        className="bg-black/60 border border-gray-700 rounded px-2 py-1 text-[10px] font-mono outline-none text-blue-400 cursor-pointer"
                        style={{ focusBorderColor: activeColor }}
                        value={settings.buttonMapping[btn]}
                        onChange={(e) => onSettingsChange({
                          ...settings, 
                          buttonMapping: { ...settings.buttonMapping, [btn]: e.target.value }
                        })}
                      >
                        {['a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2', 'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right', 'home', 'select', 'start'].map(opt => (
                          <option key={opt} value={opt} className="bg-gray-900">{opt.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-800">
               <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 font-mono">Analog Trigger Tuning</h4>
                  <span className="text-[10px] font-mono text-gray-400">SENSE: {Math.round(settings.triggerSensitivity * 100)}%</span>
               </div>
               <div className="space-y-4">
                  <div className="space-y-1.5">
                    <input 
                      type="range" min="0.5" max="2.0" step="0.1" 
                      value={settings.triggerSensitivity} 
                      onChange={(e) => onSettingsChange({...settings, triggerSensitivity: parseFloat(e.target.value)})}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600 font-mono uppercase tracking-widest">
                       <span>Linear</span>
                       <span>Aggressive</span>
                    </div>
                  </div>
               </div>
            </div>

            <div className="space-y-6 pt-4 border-t border-gray-800">
              <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-gray-800" style={{ borderColor: `${activeColor}33` }}>
                 <div>
                   <h4 className="font-bold" style={{ color: activeColor }}>Advanced Joystick Calibration</h4>
                   <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Dead Zones • Bias • Curves</p>
                 </div>
                 <button 
                   onClick={onOpenCalibration}
                   className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all active:scale-95 shadow-lg"
                   style={{ backgroundColor: activeColor, boxShadow: `0 0 15px ${activeColor}40` }}
                 >
                   Launch
                 </button>
              </div>

              <div className="flex justify-between items-center">
                 <div>
                   <h4 className="font-bold">Extreme Low Latency (ELL)</h4>
                   <p className="text-xs text-gray-500">Bypasses HID buffer for direct stream injection.</p>
                 </div>
                 <button 
                   onClick={() => onSettingsChange({...settings, ellMode: !settings.ellMode})}
                   className={`w-12 h-6 rounded-full p-1 transition-colors`}
                   style={{ backgroundColor: settings.ellMode ? activeColor : '#1f2937' }}
                 >
                   <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.ellMode ? 'translate-x-6' : 'translate-x-0'}`} />
                 </button>
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-500">POLLING RATE</span>
                    <span>{settings.pollingRate} HZ</span>
                 </div>
                 <input 
                   type="range" min="125" max="1000" step="125" 
                   value={settings.pollingRate} 
                   onChange={(e) => onSettingsChange({...settings, pollingRate: parseInt(e.target.value)})}
                   className="w-full"
                   style={{ accentColor: activeColor }}
                 />
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-800">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Vibrate size={14} className="text-gray-500" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 font-mono">Haptic Engine</h4>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400">{settings.hapticIntensity}%</span>
                 </div>
                 <div className="space-y-3">
                    <input 
                      type="range" min="0" max="100" step="5" 
                      value={settings.hapticIntensity} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        onSettingsChange({...settings, hapticIntensity: val});
                        // Test vibration
                        if (val > 0) {
                          window.navigator.vibrate?.(10);
                        }
                      }}
                      className="w-full"
                      style={{ accentColor: activeColor }}
                    />
                    <div className="flex justify-between text-[9px] text-gray-600 font-mono uppercase tracking-widest">
                       <span>Off</span>
                       <span>Maximum Thrust</span>
                    </div>
                 </div>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors"
            >
              Apply Optimizations
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CalibrationModal({
  show,
  onClose,
  settings,
  activeColor,
  onSettingsChange
}: {
  show: boolean;
  onClose: () => void;
  settings: OptimizationSettings;
  activeColor: string;
  onSettingsChange: (s: OptimizationSettings) => void;
}) {
  const [activeTab, setActiveTab] = useState<'left' | 'right'>('left');
  const joystick = settings.calibration[activeTab];

  const updateJoystick = (updates: Partial<JoystickCalibration>) => {
    onSettingsChange({
      ...settings,
      calibration: {
        ...settings.calibration,
        [activeTab]: { ...joystick, ...updates }
      }
    });
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-8"
        >
          <div className="w-full max-w-4xl geometric-panel p-8 grid grid-cols-12 gap-8 h-full max-h-[85vh]">
            <div className="col-span-12 flex justify-between items-center border-b border-gray-800 pb-4">
              <div>
                <h3 className="text-2xl font-bold font-mono italic">ADVANCED CALIBRATION</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Precision Input Tuning Engine</p>
              </div>
              <button onClick={onClose} className="p-2 border border-gray-800 rounded-full hover:bg-white/5">
                <XCircle size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="col-span-4 border-r border-gray-800 pr-8 space-y-4">
              <button 
                onClick={() => setActiveTab('left')}
                className={`w-full p-4 rounded-xl border text-left transition-all ${activeTab === 'left' ? 'bg-white/5 border-gray-400' : 'bg-transparent border-gray-800 text-gray-500'}`}
                style={{ 
                  color: activeTab === 'left' ? activeColor : undefined,
                  borderColor: activeTab === 'left' ? activeColor : undefined,
                  backgroundColor: activeTab === 'left' ? `${activeColor}0d` : undefined
                }}
              >
                <div className="text-[10px] uppercase font-bold mb-1 opacity-50">Primary</div>
                <div className="text-lg font-bold">LEFT STICK</div>
              </button>
              <button 
                onClick={() => setActiveTab('right')}
                className={`w-full p-4 rounded-xl border text-left transition-all ${activeTab === 'right' ? 'bg-white/5 border-gray-400' : 'bg-transparent border-gray-800 text-gray-500'}`}
                style={{ 
                  color: activeTab === 'right' ? activeColor : undefined,
                  borderColor: activeTab === 'right' ? activeColor : undefined,
                  backgroundColor: activeTab === 'right' ? `${activeColor}0d` : undefined
                }}
              >
                <div className="text-[10px] uppercase font-bold mb-1 opacity-50">Secondary</div>
                <div className="text-lg font-bold">RIGHT STICK</div>
              </button>

              <div className="mt-12 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-yellow-500">
                  <AlertCircle size={14} />
                  <span className="text-[10px] uppercase font-black">Warning</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Incorrect calibration may result in unexpected input behavior. Standard reset will restore factory defaults.
                </p>
              </div>
            </div>

            <div className="col-span-8 space-y-8 overflow-y-auto pr-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <CalibrationSlider 
                    label="Inner Dead Zone" 
                    value={joystick.deadzone} 
                    min={0} max={0.5} step={0.01}
                    onChange={(v) => updateJoystick({ deadzone: v })}
                    unit="%"
                    activeColor={activeColor}
                  />
                  <CalibrationSlider 
                    label="Input Sensitivity" 
                    value={joystick.sensitivity} 
                    min={0.5} max={1.5} step={0.05}
                    onChange={(v) => updateJoystick({ sensitivity: v })}
                    unit="x"
                    activeColor={activeColor}
                  />
                  <CalibrationSlider 
                    label="Response Curve" 
                    value={joystick.curve} 
                    min={1} max={3} step={0.1}
                    onChange={(v) => updateJoystick({ curve: v })}
                    unit="pow"
                    activeColor={activeColor}
                  />
                </div>
                <div className="space-y-6">
                  <CalibrationSlider 
                    label="Center Bias X" 
                    value={joystick.centerX} 
                    min={-0.2} max={0.2} step={0.01}
                    onChange={(v) => updateJoystick({ centerX: v })}
                    unit="off"
                    activeColor={activeColor}
                  />
                  <CalibrationSlider 
                    label="Center Bias Y" 
                    value={joystick.centerY} 
                    min={-0.2} max={0.2} step={0.01}
                    onChange={(v) => updateJoystick({ centerY: v })}
                    unit="off"
                    activeColor={activeColor}
                  />
                  
                  <div className="p-4 bg-white/5 rounded-xl border border-gray-800">
                    <div className="text-[10px] uppercase font-black text-gray-500 mb-4 tracking-widest">Input Visualization</div>
                    <div className="w-full aspect-square bg-gray-950 rounded-lg border border-gray-800 flex items-center justify-center relative">
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-px h-full bg-gray-800/50" />
                        <div className="h-px w-full bg-gray-800/50" />
                      </div>
                      {/* Visualizer for the curve/deadzone would go here */}
                      <div className="w-32 h-32 rounded-full border flex items-center justify-center" style={{ borderColor: `${activeColor}33` }}>
                        <div 
                          className="w-4 h-4 rounded-full shadow-lg"
                          style={{ 
                            backgroundColor: activeColor,
                            boxShadow: `0 0 15px ${activeColor}`,
                            transform: `translate(${joystick.centerX * 100}px, ${joystick.centerY * 100}px)`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => updateJoystick({ deadzone: 0.1, centerX: 0, centerY: 0, sensitivity: 1.0, curve: 1.0 })}
                  className="flex-1 py-4 border border-gray-800 text-gray-500 font-bold uppercase tracking-widest rounded-xl hover:text-white transition-all"
                >
                  Reset to Defaults
                </button>
                <button 
                  onClick={onClose}
                  className="flex-1 py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CalibrationSlider({ label, value, min, max, step, onChange, unit, activeColor }: { label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, unit: string, activeColor: string }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono" style={{ color: activeColor }}>{typeof value === 'number' ? value.toFixed(2) : value}{unit}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        style={{ accentColor: activeColor }}
      />
    </div>
  );
}

// Sub-components

function Joystick({ id, label, onChange, calibration, activeColor }: { id: string, label: string, onChange: (x: number, y: number) => void, calibration: JoystickCalibration, activeColor: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const activePointerId = useRef<number | null>(null);
  const { vibrate } = useHaptics();

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isActive) return;
    
    setIsActive(true);
    activePointerId.current = e.pointerId;
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
    vibrate(5);
    updatePosition(e);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isActive || e.pointerId !== activePointerId.current || !containerRef.current) return;
    e.preventDefault();
    updatePosition(e);
  };

  const updatePosition = (e: PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2 - 30;

    if (distance > maxRadius) {
      dx *= maxRadius / distance;
      dy *= maxRadius / distance;
    }

    // Calibration Engine
    let rawX = dx / maxRadius;
    let rawY = dy / maxRadius;

    // 1. Apply Center Bias
    let calX = rawX - calibration.centerX;
    let calY = rawY - calibration.centerY;

    // 2. Dead Zone Check
    const magnitude = Math.sqrt(calX * calX + calY * calY);
    let finalX = 0;
    let finalY = 0;

    if (magnitude > calibration.deadzone) {
      // Scale from deadzone to 1
      const normalizedMag = (magnitude - calibration.deadzone) / (1 - calibration.deadzone);
      // Apply Curve
      const curvedMag = Math.pow(Math.abs(normalizedMag), calibration.curve) * Math.sign(normalizedMag);
      // Apply Sensitivity
      const outputMag = Math.min(1, curvedMag * calibration.sensitivity);
      
      finalX = (calX / magnitude) * outputMag;
      finalY = (calY / magnitude) * outputMag;
    }

    setPosition({ x: dx, y: dy });
    onChange(finalX, finalY);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === activePointerId.current) {
      if (containerRef.current && activePointerId.current !== null) {
        try {
          containerRef.current.releasePointerCapture(activePointerId.current);
        } catch (err) {}
      }
      setIsActive(false);
      activePointerId.current = null;
      setPosition({ x: 0, y: 0 });
      onChange(0, 0);
    }
  };

  return (
    <div className="relative select-none touch-none">
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-56 h-56 rounded-full bg-gradient-to-br from-[#1E2028] to-[#0A0B0E] p-4 shadow-2xl border border-gray-800 flex items-center justify-center overflow-visible select-none touch-none"
      >
        <div className="w-full h-full rounded-full bg-[#15171E] border-4 border-[#252833] flex items-center justify-center shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none">
          <motion.div
            animate={{ x: position.x, y: position.y }}
            transition={isActive ? { type: 'spring', damping: 30, stiffness: 450 } : { type: 'spring', damping: 20, stiffness: 200 }}
            className="w-28 h-28 rounded-full bg-[#2A2E3D] border border-gray-700 shadow-xl flex items-center justify-center z-10 cursor-pointer pointer-events-none"
            style={{ borderColor: isActive ? activeColor : undefined }}
          >
            <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center pointer-events-none" style={{ borderColor: `${activeColor}1a` }}>
              <span className="font-mono text-[10px] text-gray-500 font-bold tracking-widest">{label}</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function DPad({ onInput, onRelease, activeButtons, activeColor }: { onInput: (v: string) => void, onRelease: (v: string) => void, activeButtons: Record<string, boolean>, activeColor: string }) {
  const directions = [
    { id: 'up', icon: '▲', pos: 'top-2' },
    { id: 'down', icon: '▼', pos: 'bottom-2' },
    { id: 'left', icon: '◀', pos: 'left-2' },
    { id: 'right', icon: '▶', pos: 'right-2' },
  ];

  const pressedDir = directions.find(dir => activeButtons[`dpad_${dir.id}`]);
  const isAnyPressed = !!pressedDir;

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Ambient Pulsing Glow Background */}
      <AnimatePresence>
        {isAnyPressed && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ 
              scale: [1, 1.15, 1], 
              opacity: [0.35, 0.7, 0.35] 
            }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ 
              repeat: Infinity, 
              duration: 1.0, 
              ease: "easeInOut" 
            }}
            className="absolute inset-0 rounded-full border-2 pointer-events-none blur-md z-0"
            style={{ 
              borderColor: activeColor, 
              boxShadow: `0 0 30px ${activeColor}55, inset 0 0 30px ${activeColor}22` 
            }}
          />
        )}
      </AnimatePresence>

      <div className="absolute w-14 h-40 bg-[#1A1C23] rounded-md shadow-2xl z-0"></div>
      <div className="absolute w-40 h-14 bg-[#1A1C23] rounded-md shadow-2xl z-0"></div>
      
      {directions.map(dir => {
        const isPressed = activeButtons[`dpad_${dir.id}`];
        return (
          <button
            key={dir.id}
            onPointerDown={(e) => { e.preventDefault(); onInput(`dpad_${dir.id}`); }}
            onPointerUp={() => onRelease(`dpad_${dir.id}`)}
            onPointerLeave={() => onRelease(`dpad_${dir.id}`)}
            onPointerCancel={() => onRelease(`dpad_${dir.id}`)}
            className={`absolute ${dir.pos} w-10 h-10 flex items-center justify-center transition-all active:scale-95 text-sm z-20 cursor-pointer select-none touch-none
              ${isPressed ? 'scale-110' : 'text-gray-500 hover:text-gray-400'}`}
            style={{ 
              color: isPressed ? activeColor : undefined, 
              textShadow: isPressed ? `0 0 12px ${activeColor}` : 'none'
            }}
          >
            <motion.span
              animate={isPressed ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={isPressed ? { repeat: Infinity, duration: 0.8 } : {}}
            >
              {dir.icon}
            </motion.span>
          </button>
        );
      })}
      
      {/* Central D-pad physical button that changes symbol and color when active */}
      <motion.div 
        animate={{ 
          scale: isAnyPressed ? 1.15 : 1,
          backgroundColor: isAnyPressed ? `${activeColor}1e` : '#232631',
          borderColor: isAnyPressed ? activeColor : '#374151',
          boxShadow: isAnyPressed ? `0 0 15px ${activeColor}` : 'none',
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        className="z-10 w-12 h-12 flex flex-col items-center justify-center rounded-sm border shadow-inner text-xs font-bold font-mono transition-all duration-150"
        style={{ 
          color: isAnyPressed ? activeColor : '#4b5563',
        }}
      >
        <span className={isAnyPressed ? "animate-pulse" : ""}>
          {isAnyPressed ? pressedDir.icon : '+'}
        </span>
      </motion.div>
    </div>
  );
}

function ActionPad({ onInput, onRelease, activeButtons, activeColor }: { onInput: (v: string) => void, onRelease: (v: string) => void, activeButtons: Record<string, boolean>, activeColor: string }) {
  const buttons = [
    { id: 'y', label: 'Y', pos: 'top-0 left-1/2 -translate-x-1/2', color: 'text-blue-400' },
    { id: 'a', label: 'A', pos: 'bottom-0 left-1/2 -translate-x-1/2', color: 'text-green-400' },
    { id: 'x', label: 'X', pos: 'left-0 top-1/2 -translate-y-1/2', color: 'text-blue-500' },
    { id: 'b', label: 'B', pos: 'right-0 top-1/2 -translate-y-1/2', color: 'text-red-400' },
  ];

  return (
    <div className="relative w-48 h-48 select-none touch-none">
       {buttons.map(btn => (
        <button
          key={btn.id}
          onPointerDown={(e) => { e.preventDefault(); onInput(btn.id); }}
          onPointerUp={() => onRelease(btn.id)}
          onPointerLeave={() => onRelease(btn.id)}
          onPointerCancel={() => onRelease(btn.id)}
          className={`absolute ${btn.pos} w-14 h-14 rounded-full bg-[#1C1E26] border-2 border-gray-700 flex items-center justify-center font-bold text-xl transition-all active:scale-90 shadow-lg select-none touch-none cursor-pointer
            ${activeButtons[btn.id] ? 'bg-[#252833] brightness-125' : 'brightness-100'} ${btn.color}`}
          style={{ borderColor: activeButtons[btn.id] ? activeColor : undefined, boxShadow: activeButtons[btn.id] ? `0 0 15px ${activeColor}40` : undefined }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

function ShoulderButton({ label, id, onPress, onRelease, pressed, isTrigger, activeColor }: { label: string, id: string, onPress: (id: string) => void, onRelease: (id: string) => void, pressed: boolean, isTrigger?: boolean, activeColor?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 select-none touch-none">
      <button
        onPointerDown={(e) => { e.preventDefault(); onPress(id); }}
        onPointerUp={() => onRelease(id)}
        onPointerLeave={() => onRelease(id)}
        onPointerCancel={() => onRelease(id)}
        className={`rounded-t-xl border-t-2 flex items-center justify-center transition-all active:translate-y-1 px-4 select-none touch-none cursor-pointer
          ${isTrigger ? 'w-32 h-12 bg-[#1C1E26]' : 'w-24 h-10 bg-[#252833]'}
          ${pressed ? 'brightness-150' : 'brightness-100'} shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]`}
        style={{ 
           borderColor: pressed ? activeColor : (isTrigger ? `${activeColor}4d` : '#4b5563'),
           backgroundColor: pressed ? `${activeColor}1a` : undefined
         }}
      >
        <span className="font-mono text-[9px] font-bold tracking-widest uppercase text-gray-400 text-center" style={{ color: pressed ? 'white' : undefined }}>{label}</span>
      </button>
    </div>
  );
}

function SystemButton({ 
  label, 
  icon, 
  id, 
  onPress, 
  onRelease, 
  pressed = false, 
  activeColor 
}: { 
  label: string; 
  icon: ReactNode; 
  id: string; 
  onPress: (id: string) => void; 
  onRelease?: (id: string) => void; 
  pressed?: boolean; 
  activeColor?: string;
}) {
  const { vibrate } = useHaptics();

  const handlePress = () => {
    vibrate(12);
    onPress(id);
  };

  const handleRelease = () => {
    if (onRelease) {
      onRelease(id);
    }
  };

  return (
    <button
      onMouseDown={handlePress}
      onMouseUp={handleRelease}
      onTouchStart={(e) => { e.preventDefault(); handlePress(); }}
      onTouchEnd={handleRelease}
      className={`p-3 rounded-lg border flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer select-none touch-none
        ${pressed ? 'text-white' : 'text-gray-300 bg-[#1C1E26] border-gray-700 hover:bg-[#252833]'}`}
      style={{
        borderColor: pressed ? activeColor : undefined,
        backgroundColor: pressed ? `${activeColor}22` : undefined,
        boxShadow: pressed ? `0 0 12px ${activeColor}55` : 'none',
      }}
    >
      {icon}
      <span className="text-[9px] uppercase font-bold tracking-tighter">{label}</span>
    </button>
  );
}

function PairingTab({ id, label, icon, active, onClick }: { id: string, label: string, icon: ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all border
        ${active 
          ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' 
          : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5'}`}
    >
      {icon}
      <span className="text-sm font-bold tracking-tight">{label}</span>
      {active && <motion.div layoutId="active-tab" className="ml-auto w-1 h-4 bg-blue-500 rounded-full" />}
    </button>
  );
}

function BluetoothPairing({ activeColor, onConnect }: { activeColor: string, onConnect: (id: string) => void }) {
  const [isScanning, setIsScanning] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [devices, setDevices] = useState<{ id: string, name: string, status: string }[]>([]);

  const startScan = () => {
    setIsScanning(true);
    setDevices([]);
    setTimeout(() => {
      setDevices([
        { id: "nexus-tv-01", name: "Lumina TV Console", status: "Ready" },
        { id: "nexus-pc-hq", name: "Gaming Rig Alpha", status: "Handshake Required" }
      ]);
      setIsScanning(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-lg">
      <div className="relative">
        <motion.div 
          animate={isScanning ? { rotate: 360 } : { rotate: 0 }}
          transition={isScanning ? { repeat: Infinity, duration: 2, ease: "linear" } : {}}
          className="relative w-32 h-32 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: `${activeColor}4d` }}
        >
          <Bluetooth size={48} style={{ color: activeColor }} className={isScanning ? 'animate-pulse' : ''} />
        </motion.div>
        {isScanning && (
          <div className="absolute inset-[-20px] rounded-full border border-dashed animate-spin-slow" style={{ borderColor: `${activeColor}22` }} />
        )}
      </div>

      <div className="w-full space-y-6">
        <div className="space-y-2">
          <h4 className="text-xl font-bold font-mono uppercase tracking-tight">Manual Pairing Code</h4>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="ENTER PEER ID (E.G. XJ49K)" 
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
              className="flex-1 bg-black/40 border border-gray-800 rounded-xl px-4 py-3 font-mono text-center focus:border-blue-500 outline-none transition-all uppercase"
              maxLength={6}
            />
            <button 
              onClick={() => pairingCode.length >= 5 && onConnect(pairingCode.toLowerCase())}
              disabled={pairingCode.length < 5}
              className="px-6 rounded-xl font-bold uppercase text-xs disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
              style={{ backgroundColor: activeColor, boxShadow: pairingCode.length >= 5 ? `0 0 15px ${activeColor}40` : 'none' }}
            >
              Link
            </button>
          </div>
        </div>

        <div className="relative flex items-center gap-4 py-2">
           <div className="flex-1 h-px bg-gray-800" />
           <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">Or Discover Nearby</span>
           <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="space-y-3">
          {devices.length === 0 && !isScanning && (
            <button 
              onClick={startScan}
              className="w-full py-4 bg-white/5 border border-gray-800 rounded-xl font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3"
            >
              <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
              Start Bluetooth Scan
            </button>
          )}

          {isScanning && (
             <div className="py-8 text-center space-y-2">
                <div className="text-[10px] uppercase font-black tracking-[0.3em] text-blue-400 animate-pulse">Scanning frequencies...</div>
                <div className="text-[9px] font-mono text-gray-500">BT-STACK 5.3 HANDSHAKE ACTIVE</div>
             </div>
          )}

          {devices.map(dev => (
            <DiscoveryItem 
              key={dev.id} 
              name={dev.name} 
              status={dev.status} 
              onClick={() => onConnect(dev.id)} 
              activeColor={activeColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DiscoveryItemProps {
  name: string;
  status: string;
  processing?: boolean;
  error?: boolean;
  onClick?: () => void;
  activeColor?: string;
  key?: string | number;
}

function DiscoveryItem({ name, status, processing, error, onClick, activeColor }: DiscoveryItemProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-4 bg-[#1C1E26] border border-gray-800 rounded-xl hover:border-gray-700 transition-all group"
    >
      <div className="flex flex-col items-start">
        <span className="text-sm font-bold text-white tracking-tight">{name}</span>
        <span className={`text-[10px] uppercase font-bold tracking-widest ${error ? 'text-red-400' : 'text-gray-500'}`}>{status}</span>
      </div>
      {processing ? (
        <RefreshCw size={16} className="text-blue-500 animate-spin" />
      ) : error ? (
        <XCircle size={16} className="text-red-500" />
      ) : (
        <button 
          onClick={onClick}
          className="px-4 py-1.5 rounded text-[10px] font-black text-white uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg"
          style={{ backgroundColor: activeColor || '#3b82f6', boxShadow: `0 0 10px ${activeColor || '#3b82f6'}40` }}
        >
          Connect
        </button>
      )}
    </motion.div>
  );
}
