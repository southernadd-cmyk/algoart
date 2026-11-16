// Pixel size from JPEG or WebP headers, for responsive srcset widths.
export function imageSize(data, mime) {
  if (mime === "image/jpeg") {
    for (let i = 2; i + 9 < data.length;) {
      if (data[i] !== 0xff) { i++; continue; }
      const marker = data[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const length = data.readUInt16BE(i + 2);
      // SOF0–SOF15, excluding DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7)};
      }
      i += 2 + length;
    }
  } else if (mime === "image/webp" && data.length >= 30) {
    const chunk = data.subarray(12, 16).toString("latin1");
    if (chunk === "VP8 ") return {width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff};
    if (chunk === "VP8L") {
      const bits = data.readUInt32LE(21);
      return {width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1};
    }
    if (chunk === "VP8X") return {width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1};
  }
  return null;
}
