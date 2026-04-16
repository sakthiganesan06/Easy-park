function safeFileBase(name) {
  return String(name || 'parking-slot')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'parking-slot';
}

export function downloadQrAsSvg(svgElement, displayName) {
  if (!svgElement) return false;
  const serialized = new XMLSerializer().serializeToString(svgElement);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileBase(displayName)}-easypark-qr.svg`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function downloadQrAsPng(svgElement, displayName) {
  if (!svgElement) return Promise.resolve(false);
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = 512;
      const h = 512;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            resolve(false);
            return;
          }
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${safeFileBase(displayName)}-easypark-qr.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
          resolve(true);
        },
        'image/png',
        1
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}
