type DesktopMapTile = {
  contentType: string;
  data: ArrayBuffer;
};

interface Window {
  nexusDesktop?: {
    fetchMapTile: (url: string) => Promise<DesktopMapTile>;
  };
}
