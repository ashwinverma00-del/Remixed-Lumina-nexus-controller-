var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_http = require("http");
var import_socket = require("socket.io");
async function startServer() {
  const app = (0, import_express.default)();
  const httpServer = (0, import_http.createServer)(app);
  const io = new import_socket.Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3e3;
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("join-pairing", (pairId) => {
      socket.join(pairId);
      console.log(`Socket ${socket.id} joined pairing room: ${pairId}`);
      socket.to(pairId).emit("peer-discovered", {
        peerId: socket.id,
        type: "wifi-direct"
        // Simulated
      });
    });
    socket.on("signal", ({ to, signal }) => {
      io.to(to).emit("signal", { from: socket.id, signal });
    });
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in middleware mode...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        root: process.cwd()
      });
      app.use(vite.middlewares);
      console.log("Vite middleware mounted.");
    } catch (viteError) {
      console.error("Failed to start Vite server:", viteError);
    }
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    console.log(`Serving static files from: ${distPath}`);
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = import_path.default.join(distPath, "index.html");
      res.sendFile(indexPath);
    });
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Lumina Nexus Server status: OK`);
    console.log(`Listening on port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}
startServer().catch((err) => {
  console.error("Critical server startup error:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
