const express = require("express");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { google } = require("googleapis");

dotenv.config({ path: process.env.ENV_FILE || "/app/.env" });
dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const SHEETS_ID = process.env.SHEETS_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Sheet1";
const giftLocks = new Set();

function normalize(value) {
  return String(value || "").trim();
}

function isReservedFlag(value) {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  return ["true", "1", "yes", "sim", "x"].includes(normalized);
}

function isGiftItem(gift) {
  return /^\d+\./.test(gift);
}

function buildGiftSections(rows) {
  const sections = [];
  let currentSection = {
    title: "Presentes",
    gifts: [],
  };

  sections.push(currentSection);

  rows.forEach((row) => {
    const gift = normalize(row[0]);
    if (!gift) {
      return;
    }

    if (!isGiftItem(gift)) {
      currentSection = {
        title: gift,
        gifts: [],
      };
      sections.push(currentSection);
      return;
    }

    if (isGiftAvailable(row)) {
      currentSection.gifts.push(gift);
    }
  });

  return sections.filter((section) => section.gifts.length > 0);
}

function isGiftAvailable(row) {
  const gift = normalize(row[0]);
  const reservedBy = normalize(row[1]);
  const reservedFlag = row[2];

  if (!gift) {
    return false;
  }

  return isGiftItem(gift) && !reservedBy && !isReservedFlag(reservedFlag);
}

function resolveCredentialsPath() {
  if (process.env.SERVICE_ACCOUNT_FILE) {
    return process.env.SERVICE_ACCOUNT_FILE;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  const keysDir = "/app/keys";
  if (!fs.existsSync(keysDir)) {
    return null;
  }

  const jsonFiles = fs
    .readdirSync(keysDir)
    .filter((file) => file.endsWith(".json"));
  if (!jsonFiles.length) {
    return null;
  }

  return path.join(keysDir, jsonFiles[0]);
}

async function getSheetsClient() {
  const credentialsPath = resolveCredentialsPath();
  if (!credentialsPath) {
    throw new Error(
      "Credenciais nao encontradas. Configure SERVICE_ACCOUNT_FILE ou GOOGLE_APPLICATION_CREDENTIALS.",
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function readRowsAtoC(sheets) {
  const range = `${SHEET_NAME}!A2:C`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range,
  });

  return response.data.values || [];
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/gifts", async (req, res) => {
  if (!SHEETS_ID) {
    return res.status(500).json({ error: "SHEETS_ID nao configurado." });
  }

  try {
    const sheets = await getSheetsClient();
    const rows = await readRowsAtoC(sheets);

    const sections = buildGiftSections(rows);
    const gifts = sections.flatMap((section) => section.gifts);

    return res.json({ gifts, sections });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Falha ao carregar presentes.", details: error.message });
  }
});

app.post("/api/reserve", async (req, res) => {
  if (!SHEETS_ID) {
    return res.status(500).json({ error: "SHEETS_ID nao configurado." });
  }

  const gift = normalize(req.body.gift);
  const name = normalize(req.body.name);

  if (!gift) {
    return res.status(400).json({ error: "Presente e obrigatorio." });
  }

  if (name.length < 2) {
    return res
      .status(400)
      .json({ error: "Nome deve ter pelo menos 2 caracteres." });
  }

  if (giftLocks.has(gift)) {
    return res.status(409).json({
      error: "Este presente esta em processo de reserva. Tente novamente.",
    });
  }

  giftLocks.add(gift);

  try {
    const sheets = await getSheetsClient();
    const rows = await readRowsAtoC(sheets);

    const rowIndex = rows.findIndex(
      (row) => normalize(row[0]) === gift && isGiftAvailable(row),
    );

    if (rowIndex === -1) {
      return res
        .status(409)
        .json({ error: "Este presente ja foi reservado ou nao existe mais." });
    }

    const absoluteRow = rowIndex + 2;
    const rowRange = `${SHEET_NAME}!A${absoluteRow}:C${absoluteRow}`;
    const writeRange = `${SHEET_NAME}!B${absoluteRow}:C${absoluteRow}`;

    const rowSnapshot = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_ID,
      range: rowRange,
    });

    const currentRow = rowSnapshot.data.values?.[0] || [];
    if (normalize(currentRow[0]) !== gift || !isGiftAvailable(currentRow)) {
      return res
        .status(409)
        .json({ error: "Este presente ja foi reservado ou nao existe mais." });
    }

    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: SHEETS_ID,
      range: writeRange,
      valueInputOption: "USER_ENTERED",
      includeValuesInResponse: true,
      responseValueRenderOption: "UNFORMATTED_VALUE",
      requestBody: {
        values: [[name, "TRUE"]],
      },
    });

    const echoed = updateResponse.data.updatedData?.values?.[0] || [];
    if (normalize(echoed[0]) !== name || !isReservedFlag(echoed[1])) {
      return res
        .status(500)
        .json({ error: "Falha ao confirmar escrita da reserva." });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Falha ao reservar presente.", details: error.message });
  } finally {
    giftLocks.delete(gift);
  }
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
