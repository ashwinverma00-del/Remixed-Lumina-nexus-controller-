import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

import { InputPacket } from "../types";

export type ConnectionStatus = "disconnected" | "scanning" | "pairing" | "connected";

export interface PeerInfo {
  id: string;
  type: "wifi" | "bluetooth" | "usb" | "qr";
}

class ConnectivityManager {
  private socket: Socket | null = null;
  private peer: Peer.Instance | null = null;
  private onStatusChange: ((status: ConnectionStatus) => void) | null = null;
  private onReady: (() => void) | null = null;
  public onData: ((data: any) => void) | null = null;

  constructor() {
    this.initSocket();
  }

  private initSocket() {
    // Only initialize if window exists (client-side)
    if (typeof window !== "undefined") {
      if (this.socket) {
        this.socket.disconnect();
      }
      
      const savedUrl = localStorage.getItem("nexus_custom_server_url");
      if (savedUrl) {
        console.log("Connecting socket to custom server URL:", savedUrl);
        this.socket = io(savedUrl, {
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
        });
      } else {
        console.log("Connecting socket to default window origin");
        this.socket = io({
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
        });
      }
      this.setupSocket();
    }
  }

  public updateServerUrl(url: string) {
    if (typeof window !== "undefined") {
      if (url) {
        localStorage.setItem("nexus_custom_server_url", url);
      } else {
        localStorage.removeItem("nexus_custom_server_url");
      }
      this.initSocket();
    }
  }

  private setupSocket() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);
    });

    this.socket.on("signal", ({ from, signal }) => {
      console.log("Received signal from", from);
      if (this.peer) {
        this.peer.signal(signal);
      } else {
        // If we get a signal but have no peer, we are being called
        this.initPeer(false, from);
        this.peer?.signal(signal);
      }
    });

    this.socket.on("peer-discovered", (peer: PeerInfo) => {
      console.log("Peer discovered:", peer);
    });
  }

  public setCallbacks(onStatus: (s: ConnectionStatus) => void, onReady: () => void) {
    this.onStatusChange = onStatus;
    this.onReady = onReady;
  }

  public joinPairing(pairId: string) {
    this.socket?.emit("join-pairing", pairId);
    this.onStatusChange?.("scanning");
  }

  public initPeer(initiator: boolean, targetId: string) {
    this.onStatusChange?.("pairing");
    
    // @ts-ignore
    this.peer = new Peer({
      initiator: initiator,
      trickle: false,
    });

    this.peer.on("signal", (data) => {
      this.socket?.emit("signal", { to: targetId, signal: data });
    });

    this.peer.on("connect", () => {
      console.log("P2P Connected");
      this.onStatusChange?.("connected");
      this.onReady?.();
    });

    this.peer.on("data", (data) => {
      console.log("Received data:", data.toString());
      if (this.onData) {
        this.onData(data);
      }
    });

    this.peer.on("close", () => {
      this.onStatusChange?.("disconnected");
    });

    this.peer.on("error", (err) => {
      console.error("Peer error:", err);
      this.onStatusChange?.("disconnected");
    });
  }

  public send(data: InputPacket) {
    if (this.peer && this.peer.connected) {
      this.peer.send(JSON.stringify(data));
    }
  }

  public disconnect() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export const connectivity = new ConnectivityManager();
