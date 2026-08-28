"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexusDesktop", {
  fetchMapTile: (url) => ipcRenderer.invoke("map-tile:fetch", url),
});
