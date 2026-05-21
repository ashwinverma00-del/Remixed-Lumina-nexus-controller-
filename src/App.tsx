/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState, useCallback, useRef, type TouchEvent, type MouseEvent, type ReactNode } from 'react';
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

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
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

export default function App() {
  return (
    <BrowserRouter>
      <div className="fixed top-2 right-2 z-[1000] opacity-20 hover:opacity-100 transition-opacity">
        <Link to="/tv" className="text-[10px] font-mono text-white/50 border border-white/20 px-2 py-1 rounded hover:bg-white/10 uppercase">
          TV Mode
        </Link>
      </div>
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
  generic: { color: '#3b82f6', label: 'Generic HID', protocol: 'Standard Gamepad' }
};

function ControllerApp() {
  const [platform, setPlatform] = useState<Platform>(() => {
    const saved = localStorage.getItem('nexus_controller_platform');
    return (saved as Platform) || 'generic';
  });
  
  const [settings, setSettings] = useState<OptimizationSettings>(() => {
    const saved = localStorage.getItem('nexus_controller_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to restore controller settings:", e);
      }
    }
    return {
      pollingRate: 1000,
      hapticIntensity: 80,
      ellMode: true,
      triggerSensitivity: 1.0,
      triggerDeadzone: 0.05,
      rgbColor: null,
      buttonScale: 1.0,
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

  const activeColor = settings.rgbColor || PLATFORM_CONFIGS[platform].color;

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
        settings: {
          ell: settings.ellMode,
          rate: settings.pollingRate
        }
      });
      lastSentState.current = currentStateStr;
    }
  }, [state, platform, settings]);

  const [isPortrait, setIsPortrait] = useState(false);
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

  // Check orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
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
      className="fixed inset-0 w-full h-full bg-[#0A0A0C] font-sans text-white overflow-hidden touch-none select-none"
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

      <main className="flex-1 grid grid-cols-12 gap-0 relative">
        {/* Left Section: D-Pad & Left Stick */}
        <div className="col-span-4 flex flex-col justify-around items-center py-12 relative" style={{ transform: `scale(${settings.buttonScale})` }}>
          {/* Shoulder Buttons L */}
          <div className="absolute -top-20 left-12 flex gap-4">
            <ShoulderButton label="L2 Trigger" id="L2" onPress={handleButtonPress} onRelease={handleButtonRelease} pressed={!!state.buttons['L2']} isTrigger activeColor={activeColor} />
            <ShoulderButton label="L1 Bumper" id="L1" onPress={handleButtonPress} onRelease={handleButtonRelease} pressed={!!state.buttons['L1']} activeColor={activeColor} />
          </div>

          <DPad onInput={handleButtonPress} onRelease={handleButtonRelease} activeButtons={state.buttons} activeColor={activeColor} />
          <Joystick 
            id="left" 
            label="LS"
            calibration={settings.calibration.left}
            activeColor={activeColor}
            onChange={(x, y) => setState(p => ({ ...p, axes: { ...p.axes, left: { x, y } } }))} 
          />
        </div>

        {/* Center: System & Telemetry */}
        <div className="col-span-4 flex flex-col items-center justify-start py-8 space-y-8">
          <div className="flex gap-4">
            <button 
              onClick={() => setShowPairing(true)}
              className="group bg-[#15171E] px-4 py-1 rounded-full border border-gray-800 flex items-center gap-3 active:scale-95 transition-all"
              style={{ borderColor: `${activeColor}40` }}
            >
              <div className={`w-2 h-2 rounded-full ${status === 'connected' ? '' : 'bg-yellow-500 animate-pulse'}`} style={{ backgroundColor: status === 'connected' ? activeColor : undefined, boxShadow: status === 'connected' ? `0 0 8px ${activeColor}` : undefined }}></div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 group-hover:text-white">
                {status === 'connected' ? 'Nexus Link Active' : status === 'pairing' ? 'Quick Connecting...' : `Status: ${status}`}
              </span>
            </button>

            {status === 'disconnected' && lastPeerId && (
              <button 
                onClick={() => connectivity.initPeer(true, lastPeerId)}
                className="bg-[#15171E] px-4 py-1 rounded-full border flex items-center gap-2 hover:brightness-125 transition-all active:scale-95"
                style={{ borderColor: `${activeColor}40`, backgroundColor: `${activeColor}1a` }}
              >
                <RefreshCw size={10} style={{ color: activeColor }} />
                <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: activeColor }}>Quick Connect</span>
              </button>
            )}

            <button 
              onClick={() => setShowSettings(true)}
              className="bg-[#15171E] px-3 py-1 rounded-full border border-gray-800 text-gray-500 hover:text-white active:scale-90 transition-all"
            >
              <Settings size={14} />
            </button>
          </div>

          <div className="w-full max-w-sm geometric-panel p-6 flex flex-col gap-6" style={{ borderColor: `${activeColor}33` }}>
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Protocol</div>
                <div className="text-sm font-mono" style={{ color: activeColor }}>{PLATFORM_CONFIGS[platform].protocol}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Refresh</div>
                <div className="text-sm font-mono">{settings.pollingRate}Hz</div>
              </div>
            </div>

            {/* Vibration Control - Aesthetic purely for theme */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Engine Stability</span>
                 <span className="text-[10px] font-bold uppercase transition-colors" style={{ color: settings.ellMode ? activeColor : '#666' }}>
                   {settings.ellMode ? 'OPTIMIZED' : 'STANDARD'}
                 </span>
              </div>
              <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden flex">
                 <div className="h-full transition-all" style={{ width: settings.ellMode ? '100%' : '75%', backgroundColor: activeColor, boxShadow: `0 0 10px ${activeColor}80` }}></div>
              </div>
            </div>

            {/* Center Utility Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <SystemButton label="Menu" icon={<Menu size={14} />} id="select" onPress={handleButtonPress} />
              <SystemButton label="Options" icon={<Maximize2 size={14} />} id="start" onPress={toggleFullscreen} />
            </div>
          </div>

          {/* Nexus Core Button */}
          <button 
            onMouseDown={() => handleButtonPress('home')}
            onMouseUp={() => handleButtonRelease('home')}
            onTouchStart={(e) => { e.preventDefault(); handleButtonPress('home'); }}
            onTouchEnd={() => handleButtonRelease('home')}
            className={`w-24 h-24 rounded-full flex items-center justify-center border-8 border-gray-900 active:scale-95 transition-all`}
            style={{ 
              backgroundColor: activeColor, 
              boxShadow: state.buttons['home'] ? `0 0 50px ${activeColor}99` : `0 0 30px ${activeColor}40`,
              filter: state.buttons['home'] ? 'brightness(1.25)' : 'brightness(1)'
            }}
          >
            <span className="text-2xl font-black italic text-white">X</span>
          </button>
        </div>

        {/* Right Section: ABXY & Right Stick */}
        <div className="col-span-4 flex flex-col justify-around items-center py-12 relative" style={{ transform: `scale(${settings.buttonScale})` }}>
           {/* Shoulder Buttons R */}
           <div className="absolute -top-20 right-12 flex flex-row-reverse gap-4">
            <ShoulderButton label="R2 Trigger" id="R2" onPress={handleButtonPress} onRelease={handleButtonRelease} pressed={!!state.buttons['R2']} isTrigger activeColor={activeColor} />
            <ShoulderButton label="R1 Bumper" id="R1" onPress={handleButtonPress} onRelease={handleButtonRelease} pressed={!!state.buttons['R1']} activeColor={activeColor} />
          </div>

          <ActionPad onInput={handleButtonPress} onRelease={handleButtonRelease} activeButtons={state.buttons} activeColor={activeColor} />
          <Joystick 
            id="right" 
            label="RS"
            calibration={settings.calibration.right}
            activeColor={activeColor}
            onChange={(x, y) => setState(p => ({ ...p, axes: { ...p.axes, right: { x, y } } }))} 
          />
        </div>
      </main>

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
          <div className="w-full max-w-2xl geometric-panel p-8 space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold font-mono italic">STREAM OPTIMIZER</h3>
              <button onClick={onClose} className="p-2 border border-gray-800 rounded-full hover:bg-white/5">
                <XCircle size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(Object.keys(PLATFORM_CONFIGS) as Platform[]).map(key => (
                <button
                  key={key}
                  onClick={() => onPlatformChange(key)}
                  className={`flex flex-col p-4 rounded-xl border transition-all text-left ${currentPlatform === key ? 'bg-white/5 border-gray-400' : 'bg-transparent border-gray-800 hover:border-gray-700'}`}
                >
                  <span className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-1">{PLATFORM_CONFIGS[key].protocol}</span>
                  <span className="text-lg font-bold" style={{ color: currentPlatform === key ? activeColor : PLATFORM_CONFIGS[key].color }}>{PLATFORM_CONFIGS[key].label}</span>
                </button>
              ))}
            </div>

            {/* RGB & Scale Section */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-800">
               <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 font-mono">RGB Light Control</h4>
                  <div className="flex flex-wrap gap-2">
                     {PRESET_COLORS.map(color => (
                       <button
                         key={color.name}
                         onClick={() => onSettingsChange({ ...settings, rgbColor: color.value })}
                         className={`w-8 h-8 rounded-full border-2 transition-all ${settings.rgbColor === color.value ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                         style={{ 
                            backgroundColor: color.value || PLATFORM_CONFIGS[currentPlatform].color,
                            boxShadow: settings.rgbColor === color.value ? `0 0 10px ${color.value || activeColor}` : 'none'
                         }}
                         title={color.name}
                       />
                     ))}
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 font-mono">Interface Scale</h4>
                    <span className="text-[10px] font-mono text-gray-400">{Math.round(settings.buttonScale * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="1.5" step="0.05" 
                    value={settings.buttonScale} 
                    onChange={(e) => onSettingsChange({...settings, buttonScale: parseFloat(e.target.value)})}
                    className="w-full accent-blue-500"
                    style={{ accentColor: activeColor }}
                  />
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
  const activeTouchId = useRef<number | null>(null);
  const { vibrate } = useHaptics();

  const handleTouchMove = (e: TouchEvent | MouseEvent) => {
    if (!isActive || !containerRef.current) return;
    
    let targetTouch: { clientX: number, clientY: number } | null = null;

    if ('touches' in e) {
      const touchEvent = e as TouchEvent;
      // Find the touch that started this movement
      for (let i = 0; i < touchEvent.touches.length; i++) {
        if (touchEvent.touches[i].identifier === activeTouchId.current) {
          targetTouch = touchEvent.touches[i];
          break;
        }
      }
      if (!targetTouch) return;
    } else {
      targetTouch = e as MouseEvent;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = targetTouch.clientX - centerX;
    let dy = targetTouch.clientY - centerY;
    
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

  const handleStart = (e: TouchEvent | MouseEvent) => {
    if ('touches' in e) {
      const touchEvent = e as TouchEvent;
      activeTouchId.current = touchEvent.changedTouches[0].identifier;
      touchEvent.preventDefault();
    }
    setIsActive(true);
    vibrate(5);
  };

  const handleEnd = () => {
    setIsActive(false);
    setPosition({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div className="relative">
      <div 
        ref={containerRef}
        onMouseDown={handleStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
        className="relative w-56 h-56 rounded-full bg-gradient-to-br from-[#1E2028] to-[#0A0B0E] p-4 shadow-2xl border border-gray-800 flex items-center justify-center overflow-visible"
      >
        <div className="w-full h-full rounded-full bg-[#15171E] border-4 border-[#252833] flex items-center justify-center shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]">
          <motion.div
            animate={{ x: position.x, y: position.y }}
            transition={isActive ? { type: 'spring', damping: 30, stiffness: 450 } : { type: 'spring', damping: 20, stiffness: 200 }}
            className={`w-28 h-28 rounded-full bg-[#2A2E3D] border border-gray-700 shadow-xl flex items-center justify-center z-10 cursor-pointer
              ${isActive ? '' : ''}`}
            style={{ borderColor: isActive ? activeColor : undefined }}
          >
            <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center" style={{ borderColor: `${activeColor}1a` }}>
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

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <div className="absolute w-14 h-40 bg-[#1A1C23] rounded-md shadow-2xl"></div>
      <div className="absolute w-40 h-14 bg-[#1A1C23] rounded-md shadow-2xl"></div>
      
      {directions.map(dir => (
        <button
          key={dir.id}
          onMouseDown={() => onInput(`dpad_${dir.id}`)}
          onMouseUp={() => onRelease(`dpad_${dir.id}`)}
          onTouchStart={(e) => { e.preventDefault(); onInput(`dpad_${dir.id}`); }}
          onTouchEnd={() => onRelease(`dpad_${dir.id}`)}
          className={`absolute ${dir.pos} w-10 h-10 flex items-center justify-center transition-all active:scale-90 text-sm
            ${activeButtons[`dpad_${dir.id}`] ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-gray-500'}`}
          style={{ color: activeButtons[`dpad_${dir.id}`] ? activeColor : undefined, textShadow: activeButtons[`dpad_${dir.id}`] ? `0 0 10px ${activeColor}80` : 'none' }}
        >
          {dir.icon}
        </button>
      ))}
      <div className="z-10 w-12 h-12 bg-[#232631] flex items-center justify-center rounded-sm border border-gray-700/50 shadow-inner text-gray-700 text-xs font-bold">
        +
      </div>
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
    <div className="relative w-48 h-48">
       {buttons.map(btn => (
        <button
          key={btn.id}
          onMouseDown={() => onInput(btn.id)}
          onMouseUp={() => onRelease(btn.id)}
          onTouchStart={(e) => { e.preventDefault(); onInput(btn.id); }}
          onTouchEnd={() => onRelease(btn.id)}
          className={`absolute ${btn.pos} w-14 h-14 rounded-full bg-[#1C1E26] border-2 border-gray-700 flex items-center justify-center font-bold text-xl transition-all active:scale-90 shadow-lg
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
    <div className="flex flex-col items-center gap-2">
      <button
        onMouseDown={() => onPress(id)}
        onMouseUp={() => onRelease(id)}
        onTouchStart={(e) => { e.preventDefault(); onPress(id); }}
        onTouchEnd={() => onRelease(id)}
        className={`rounded-t-xl border-t-2 flex items-center justify-center transition-all active:translate-y-1 px-4
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

function SystemButton({ label, icon, id, onPress }: { label: string, icon: ReactNode, id: string, onPress: (id: string) => void }) {
  const { vibrate } = useHaptics();
  const handleClick = () => {
    vibrate(15);
    onPress(id);
  };

  return (
    <button
      onClick={handleClick}
      className="bg-[#1C1E26] p-3 rounded-lg border border-gray-700 flex items-center justify-center gap-2 transition-all active:scale-95 hover:bg-[#252833]"
    >
      {icon}
      <span className="text-[9px] uppercase font-bold tracking-tighter text-gray-300">{label}</span>
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
