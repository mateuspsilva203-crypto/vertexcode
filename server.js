"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

// ---- .env simples (sem dependência extra) ----
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  for (const linha of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || "./data/leads.db");

if (!ADMIN_TOKEN || ADMIN_TOKEN.startsWith("troque-")) {
  console.warn("⚠️  Defina um ADMIN_TOKEN forte no arquivo .env (a listagem de leads fica bloqueada até lá).");
}

// ---- Banco de dados ----
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    empresa    TEXT NOT NULL,
    contato    TEXT NOT NULL,
    email      TEXT NOT NULL,
    ip         TEXT,
    criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_leads_criado ON leads (criado_em DESC);
`);
const inserirLead = db.prepare(
  "INSERT INTO leads (nome, empresa, contato, email, ip) VALUES (?, ?, ?, ?, ?)"
);
const listarLeads = db.prepare(
  "SELECT id, nome, empresa, contato, email, criado_em FROM leads ORDER BY id DESC LIMIT ?"
);

// ---- App ----
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  next();
});

app.use("/api", cors({
  origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : false,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Limite simples por IP: 5 envios a cada 10 minutos
const tentativas = new Map();
function limitar(req, res, next) {
  const agora = Date.now();
  const janela = 10 * 60 * 1000;
  const lista = (tentativas.get(req.ip) || []).filter((t) => agora - t < janela);
  if (lista.length >= 5) return res.status(429).json({ erro: "Muitas tentativas. Tente novamente mais tarde." });
  lista.push(agora);
  tentativas.set(req.ip, lista);
  next();
}
setInterval(() => {
  const agora = Date.now();
  for (const [ip, l] of tentativas) {
    if (!l.some((t) => agora - t < 10 * 60 * 1000)) tentativas.delete(ip);
  }
}, 10 * 60 * 1000).unref();

const limpa = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

// ---- Receber lead ----
app.post("/api/leads", limitar, (req, res) => {
  const b = req.body || {};

  // Campo isca: se veio preenchido, é robô. Finge sucesso e descarta.
  if (b.website) return res.status(201).json({ ok: true });

  const nome = limpa(b.nome, 120);
  const empresa = limpa(b.empresa, 150);
  const contato = limpa(b.contato, 30);
  const email = limpa(b.email, 160).toLowerCase();

  if (!nome || !empresa) return res.status(400).json({ erro: "Nome e empresa são obrigatórios." });
  if (contato.replace(/\D/g, "").length < 10) return res.status(400).json({ erro: "Contato inválido." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ erro: "E-mail inválido." });

  try {
    inserirLead.run(nome, empresa, contato, email, req.ip || null);
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error("Erro ao gravar lead:", e);
    res.status(500).json({ erro: "Não foi possível salvar agora." });
  }
});

// ---- Listar leads (protegido por senha) ----
function autorizar(req, res, next) {
  if (!ADMIN_TOKEN || ADMIN_TOKEN.startsWith("troque-")) {
    return res.status(503).json({ erro: "ADMIN_TOKEN não configurado no servidor." });
  }
  const recebido = (req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const a = crypto.createHash("sha256").update(recebido).digest();
  const b = crypto.createHash("sha256").update(ADMIN_TOKEN).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ erro: "Não autorizado." });
  next();
}

app.get("/api/leads", autorizar, (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 500, 5000);
  res.json(listarLeads.all(limite));
});

app.get("/api/leads.csv", autorizar, (req, res) => {
  const aspas = (v) => `"${String(v).replace(/"/g, '""')}"`;
  // Prefixo ' evita que o Excel execute fórmulas vindas de texto digitado
  const seguro = (v) => aspas(/^[=+\-@]/.test(String(v)) ? "'" + v : v);
  const linhas = listarLeads.all(100000).map((l) =>
    [l.id, seguro(l.nome), seguro(l.empresa), seguro(l.contato), seguro(l.email), l.criado_em].join(",")
  );
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="leads.csv"');
  res.send("﻿id,nome,empresa,contato,email,criado_em\n" + linhas.join("\n"));
});

// ---- Site estático ----
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`✅ Site no ar em http://localhost:${PORT}`);
  console.log(`📋 Painel de leads: http://localhost:${PORT}/admin.html`);
  console.log(`🗄️  Banco: ${DB_PATH}`);
});
