/// <reference types="@types/wicg-file-system-access" />

interface WorkerInput {
  buffer: SharedArrayBuffer;
  samplesPerFrame: number;
  channels: number;
  frame: number;
  screenWidth: number;
  screenHeight: number;
  bgColor: string;
  fgColor: string;
}

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const {
    buffer,
    samplesPerFrame,
    frame,
    channels,
    screenWidth,
    screenHeight,
    bgColor,
    fgColor
  } = event.data;

  const arr = new Float32Array(buffer);
  const offset = frame * samplesPerFrame;
  const split = arr.length / channels;

  const canvas = new OffscreenCanvas(screenWidth, screenHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, screenWidth, screenHeight);

  for (let i = 0; i < samplesPerFrame; i++) {
    const x = (i / samplesPerFrame) * screenWidth;

    for (let j = 0; j < channels; j++) {
      const y = arr[j * split + i + offset];
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, 2 * Math.PI);
      ctx.fillStyle = fgColor;
      ctx.fill();
    }
  }

  const arrayBuffer = await canvas
    .convertToBlob({ type: 'image/png' })
    .then((blob) => blob.arrayBuffer());

  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(`${frame}.png`, { create: true });
  const writer = await handle.createWritable();
  await writer.write(arrayBuffer);
  await writer.close();

  // const syncHandle = await handle.createSyncAccessHandle();
  // syncHandle.write(arrayBuffer);
  // syncHandle.flush();
  // syncHandle.close();

  postMessage({ frame, handle });
};
