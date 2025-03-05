import { center, sideLengthMeters, zoomLevel } from "./config";
import { Canvas, Image, loadImage } from "canvas";
import fs from "fs";



const latToTile = (lat: number, zoom: number) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** zoom;
const lngToTile = (lon: number, zoom: number) => (lon + 180) / 360 * 2 ** zoom;

function translateLatLng(latLng: [number, number], eastMeters: number, southMeters: number): [number, number] {
  const latDegreesPerMeter = 1 / 111320;
  const lngDegreesPerMeter = 1 / (111320 * Math.cos(latLng[0] * Math.PI / 180));
  return [
    latLng[0] - (southMeters * latDegreesPerMeter),
    latLng[1] + (eastMeters * lngDegreesPerMeter)
  ];
}

async function loadTileImage(x: number, y: number, zoom: number) {
  const url = `https://tile.openstreetmap.org/${zoom}/${Math.floor(x)}/${Math.floor(y)}.png`;
  const request = await fetch(url);
  const arrayBuffer = await request.arrayBuffer();
  const image = await loadImage(Buffer.from(arrayBuffer));
  return image;
}



const topLeft = translateLatLng(center, -sideLengthMeters / 2, -sideLengthMeters / 2);
const metersPerPixel = (40075016 * Math.cos(center[0] * Math.PI / 180) / 2 ** zoomLevel) / 256;
const pixelsAccross = sideLengthMeters / metersPerPixel;

(async () => {
  const canvas = new Canvas(pixelsAccross, pixelsAccross, "image");
  const context = canvas.getContext("2d");
  const startTileX = lngToTile(topLeft[1], zoomLevel);
  const startTileY = latToTile(topLeft[0], zoomLevel);
  const pxOffsetX = Math.floor(256 * (startTileX - Math.floor(startTileX)));
  const pxOffsetY = Math.floor(256 * (startTileY - Math.floor(startTileY)));

  for (let row = 0; row < Math.ceil(pixelsAccross / 256) + 1; row++) {
    const imagePromises: Promise<Image>[] = [];
    for (let col = 0; col < Math.ceil(pixelsAccross / 256) + 1; col++) {
      imagePromises.push(loadTileImage(Math.floor(startTileX + col), Math.floor(startTileY + row), zoomLevel));
    }

    const images = await Promise.all(imagePromises);
    images.forEach((image, col) => {
      context.drawImage(image, col * 256 - pxOffsetX, row * 256 - pxOffsetY);
    });
  }

  canvas.createPNGStream().pipe(fs.createWriteStream("./out.png"));
})();