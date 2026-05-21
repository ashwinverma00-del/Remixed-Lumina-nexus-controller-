export interface GameApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  genre: string;
}

export type Platform = 'xcloud' | 'steam' | 'geforce' | 'moonlight' | 'generic';

export interface JoystickCalibration {
  deadzone: number;
  centerX: number;
  centerY: number;
  sensitivity: number;
  curve: number;
}

export interface OptimizationSettings {
  pollingRate: number;
  hapticIntensity: number;
  ellMode: boolean;
  buttonMapping: Record<string, string>;
  triggerSensitivity: number;
  triggerDeadzone: number;
  rgbColor: string | null;
  buttonScale: number;
  calibration: {
    left: JoystickCalibration;
    right: JoystickCalibration;
  };
}

export interface ControllerState {
  axes: {
    left: { x: number; y: number };
    right: { x: number; y: number };
  };
  buttons: Record<string, boolean>;
}

export interface InputPacket extends ControllerState {
  platform: Platform;
  packetId: number;
  timestamp: number;
  hapticFeedback: number;
  settings: {
    ell: boolean;
    rate: number;
  };
}
