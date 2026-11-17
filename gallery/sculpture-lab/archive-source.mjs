// Archive metadata owns the image location: R2 editions have no local JPEG.
export function archiveImageURL(entry, date, baseURL) {
  if (entry.media) {
    if (!entry.media.original) throw Error('Archive is missing its original R2 image');
    return new URL(entry.media.original, baseURL).href;
  }
  return new URL('../' + encodeURIComponent(date) + '/' +
    encodeURIComponent(entry.imageFile), baseURL).href;
}

export function loadArchiveImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Set before src: the lab reads pixels and uploads the image to WebGL.
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error('Unable to read archived source image'));
    image.src = url;
  });
}
