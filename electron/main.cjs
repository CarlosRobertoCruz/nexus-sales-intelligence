const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const DEVELOPMENT_URL = "http://127.0.0.1:5173";

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

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
