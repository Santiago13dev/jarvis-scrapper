const http = require("http");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

const PORT = 8080;
let sessionStatus = "LOADING";
let qrDataUrl = null;
let client = null;

function initClient() {
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
    console.log(`[wa] Message from ${msg.from}: ${msg.body.substring(0, 50)}`);
  });

  client.initialize().catch((err) => {
    console.error("[wa] Init failed:", err.message);
    sessionStatus = "ERROR";
    setTimeout(initClient, 15000);
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
