const { app, BrowserWindow, ipcMain, net, shell } = require("electron");
const path = require("node:path");

const DEVELOPMENT_URL = "http://127.0.0.1:5173";
const OPENSTREETMAP_TILE_HOST = "tile.openstreetmap.org";

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
    const response = await net.fetch(tileUrl.toString(), {
      cache: "force-cache",
      headers: {
        "User-Agent": `NexusSalesIntelligence/${app.getVersion()} (+https://github.com/CarlosRobertoCruz/nexus-sales-intelligence)`,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenStreetMap respondeu com ${response.status}`);
    return {
      contentType: response.headers.get("content-type") ?? "image/png",
      data: await response.arrayBuffer(),
    };
  } finally {
    clearTimeout(timeout);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
