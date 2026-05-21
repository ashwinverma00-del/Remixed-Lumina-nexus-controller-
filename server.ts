import express from "express";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Pairing Room Logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-pairing", (pairId) => {
      socket.join(pairId);
      console.log(`Socket ${socket.id} joined pairing room: ${pairId}`);
      
      // In a real UDP/Bluetooth scenario, we'd detect neighbors.
      // Here we simulate discovery by listing room members or simply broadcasting.
      socket.to(pairId).emit("peer-discovered", {
        peerId: socket.id,
        type: "wifi-direct" // Simulated
      });
    });

    socket.on("signal", ({ to, signal }) => {
      io.to(to).emit("signal", { from: socket.id, signal });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in middleware mode...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        root: process.cwd(),
      });
      app.use(vite.middlewares);
      console.log("Vite middleware mounted.");
    } catch (viteError) {
      console.error("Failed to start Vite server:", viteError);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath);
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Lumina Nexus Server status: OK`);
    console.log(`Listening on port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error("Critical server startup error:", err);
  process.exit(1);
});
