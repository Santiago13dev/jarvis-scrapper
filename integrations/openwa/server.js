const fs = require("fs");
const path = require("path");
const http = require("http");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

const PORT = 8080;
// Las respuestas de los clientes se reenvían al backend para cortar seguimientos y avanzar el embudo
const BACKEND_WEBHOOK_URL = process.env.BACKEND_WEBHOOK_URL || "http://backend:8000/api/v1/whatsapp/webhook";
// Debe coincidir con OPENWA_WEBHOOK_SECRET del backend (obligatorio en producción)
const WEBHOOK_SECRET = process.env.OPENWA_WEBHOOK_SECRET || "";
let sessionStatus = "LOADING";
let qrDataUrl = null;
let client = null;

// Al recrear el contenedor cambia el hostname y Chromium cree que otro proceso usa el perfil:
// se borran los candados (Singleton*) que quedaron en el volumen de la sesión.
function removeStaleChromiumLocks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith("Singleton")) {
      fs.rmSync(full, { force: true });
    } else if (entry.isDirectory() && !entry.isSymbolicLink()) {
      removeStaleChromiumLocks(full);
    }
  }
}

function initClient() {
  try {
    removeStaleChromiumLocks("/data");
  } catch (err) {
    console.error("[wa] No se pudieron limpiar los candados de Chromium:", err.message);
  }
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: "/data" }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  client.on("qr", async (qr) => {
    sessionStatus = "QR_READY";
    qrDataUrl = await qrcode.toDataURL(qr);
    console.log("[wa] QR code received");
  });

  client.on("ready", () => {
    sessionStatus = "CONNECTED";
    qrDataUrl = null;
    console.log("[wa] WhatsApp connected!");
  });

  client.on("disconnected", () => {
    sessionStatus = "DISCONNECTED";
    qrDataUrl = null;
    console.log("[wa] Disconnected");
  });

  client.on("authenticated", () => {
    console.log("[wa] Authenticated");
  });

  client.on("auth_failure", (msg) => {
    console.error("[wa] Auth failure:", msg);
    sessionStatus = "ERROR";
  });

  client.on("message", async (msg) => {
    // Solo chats individuales: nada de grupos, estados ni mensajes propios
    if (msg.fromMe || !msg.from.endsWith("@c.us")) return;
    console.log(`[wa] Message from ${msg.from}: ${msg.body.substring(0, 50)}`);
    try {
      await fetch(BACKEND_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(WEBHOOK_SECRET ? { "X-Webhook-Secret": WEBHOOK_SECRET } : {}) },
        body: JSON.stringify({ session: "main", from: msg.from, body: msg.body }),
      });
    } catch (err) {
      console.error("[wa] No se pudo reenviar el mensaje al backend:", err.message);
    }
  });

  client.initialize().catch((err) => {
    console.error("[wa] Init failed:", err.message);
    sessionStatus = "ERROR";
    const failedClient = client;
    client = null;
    failedClient.destroy().catch(() => {}).finally(() => {
      setTimeout(initClient, 15000);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (url.pathname.match(/^\/session\/.*\/status$/)) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: sessionStatus === "CONNECTED" ? "WORKING" : sessionStatus }));
    return;
  }

  if (url.pathname === "/me") {
    const info = sessionStatus === "CONNECTED" && client && client.info ? client.info : null;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: sessionStatus === "CONNECTED" ? "WORKING" : sessionStatus,
      phone: info && info.wid ? info.wid.user : null,
      name: info ? info.pushname || null : null,
      platform: info ? info.platform || null : null,
    }));
    return;
  }

  if (url.pathname === "/logout" && req.method === "POST") {
    try {
      if (client) {
        await client.logout().catch(() => {});
        await client.destroy().catch(() => {});
      }
    } finally {
      client = null;
      sessionStatus = "LOADING";
      qrDataUrl = null;
      setTimeout(initClient, 2000);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/qr") {
    if (qrDataUrl) {
      const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(buf);
    } else {
      res.writeHead(404);
      res.end("QR not ready");
    }
    return;
  }

  if (url.pathname === "/send" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { phone, message } = JSON.parse(body);
        if (!client || sessionStatus !== "CONNECTED") {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "WhatsApp not connected" }));
          return;
        }
        const chatId = phone.replace(/[^0-9]/g, "") + "@c.us";
        const result = await client.sendMessage(chatId, message);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, messageId: result.id._serialized }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === "/" || url.pathname === "") {
    let body;
    if (sessionStatus === "CONNECTED") {
      body = `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2 style="color:green">WhatsApp Conectado</h2><p>La sesion esta activa.</p></body></html>`;
    } else if (sessionStatus === "QR_READY" && qrDataUrl) {
      body = `<html><body style="font-family:sans-serif;text-align:center;padding:20px"><h2>Escanea el QR con tu celular</h2><img src="${qrDataUrl}" style="max-width:300px;border:1px solid #ccc;border-radius:8px"/><p>Abrí WhatsApp → Dispositivos vinculados → Escanear código QR</p></body></html>`;
    } else {
      body = `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Conectando WhatsApp...</h2><p>Estado: ${sessionStatus}</p><p>Esperá unos segundos y recargá.</p></body></html>`;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[wa] HTTP server on port ${PORT}`);
  initClient();
});
