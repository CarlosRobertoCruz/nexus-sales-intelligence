const { app, BrowserWindow, ipcMain, net, session, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEVELOPMENT_URL = "http://127.0.0.1:5173";
const OPENSTREETMAP_TILE_HOST = "tile.openstreetmap.org";
const PROJECT_URL = "https://github.com/CarlosRobertoCruz/nexus-sales-intelligence";
const MAP_CACHE_MIGRATION = "map-cache-v2";

function getMapUserAgent() {
  return `NexusSalesIntelligence/${app.getVersion()} (+${PROJECT_URL})`;
}

function configureMapRequests() {
  const userAgent = getMapUserAgent();
  session.defaultSession.setUserAgent(userAgent, "pt-BR,pt;q=0.9,en;q=0.8");
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [`https://${OPENSTREETMAP_TILE_HOST}/*`] },
    (details, callback) => {
      details.requestHeaders["User-Agent"] = userAgent;
      callback({ requestHeaders: details.requestHeaders });
    },
  );
}

async function migrateLegacyMapCache() {
  const markerPath = path.join(app.getPath("userData"), MAP_CACHE_MIGRATION);
  try {
    await fs.access(markerPath);
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("Não foi possível verificar a migração do cache de mapas.", error);
      return;
    }
  }

  try {
    await session.defaultSession.clearCache();
    await fs.writeFile(markerPath, app.getVersion(), "utf8");
  } catch (error) {
    console.warn("Não foi possível renovar o cache antigo de mapas.", error);
  }
}

function getWindowIcon() {
  return app.isPackaged
    ? path.join(app.getAppPath(), "dist", "nexus-sales-intelligence-app-icon.ico")
    : path.join(app.getAppPath(), "public", "nexus-sales-intelligence-app-icon.ico");
}

function isExternalUrl(url) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#080712",
    autoHideMenuBar: true,
    icon: getWindowIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (url !== currentUrl && isExternalUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  } else {
    void mainWindow.loadURL(DEVELOPMENT_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.setAppUserModelId("com.nexusfibra.salesintelligence");

ipcMain.handle("map-tile:fetch", async (_event, requestedUrl) => {
  const tileUrl = new URL(requestedUrl);
  const isAllowedTile = tileUrl.protocol === "https:"
    && tileUrl.hostname === OPENSTREETMAP_TILE_HOST
    && /^\/\d+\/\d+\/\d+\.png$/.test(tileUrl.pathname);
  if (!isAllowedTile) throw new Error("Endereço de mapa não permitido.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await net.fetch(tileUrl.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`OpenStreetMap respondeu com ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) throw new Error("OpenStreetMap retornou um conteúdo inválido.");
    return {
      contentType,
      data: await response.arrayBuffer(),
    };
  } finally {
    clearTimeout(timeout);
  }
});

app.whenReady().then(async () => {
  configureMapRequests();
  await migrateLegacyMapCache();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
