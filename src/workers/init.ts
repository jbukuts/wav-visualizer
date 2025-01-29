import { readFile } from 'wav-parse';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { MessageTypes, ProgressEnum } from '../enums';
import { mapRange } from '../lib/utils';
import { RANGES } from '../constants';
import type { RenderOpts } from '../App';

const BASE_URL = '/ffmpeg';

type WorkerInput = {
  file: File;
} & RenderOpts;

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const {
    file,
    resolution: [SCREEN_WIDTH, SCREEN_HEIGHT],
    framerate: FRAME_RATE,
    concurrency: CONCURRENCY,
    bgColor: BG_COLOR,
    fgColor: FG_COLOR
  } = event.data;

  // empty opfs
  const rootHandle = await navigator.storage.getDirectory();
  for await (const k of rootHandle.keys()) {
    await rootHandle.removeEntry(k, { recursive: true });
  }

  const ffmpeg = new FFmpeg();
  // ffmpeg.on('log', (e) => console.log(e));
  ffmpeg.on('progress', (e) => {
    postMessage({
      type: MessageTypes.PROGRESS,
      progress: e.progress,
      state: ProgressEnum.RENDERING_VIDEO
    });
  });
  await ffmpeg.load({
    coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm')
  });

  const audioBuffer = await file.arrayBuffer();
  await ffmpeg.writeFile(
    'audio.wav',
    new Uint8Array(structuredClone(audioBuffer!))
  );

  const data = readFile(audioBuffer!);
  const {
    amplitudeData,
    fmt: { channels, samplesRate, formatType, subCode, bitsPerSample }
  } = data;

  const fmt = formatType === 65534 ? subCode : formatType;
  if (!fmt || !(fmt in RANGES) || !(bitsPerSample in RANGES[fmt])) {
    postMessage({
      type: MessageTypes.ERR,
      message: 'WAV file encoding not supported'
    });
    return;
  }

  const [minAmplitude, maxAmplitude] = RANGES[fmt][bitsPerSample];
  const samplesPerFrame = samplesRate / FRAME_RATE;
  const audioLength = Math.floor(amplitudeData[0].length / samplesRate);
  const totalFrames = audioLength * FRAME_RATE;

  console.log('SAMP/FRAME', samplesPerFrame);
  console.log('LEN', audioLength);
  console.log('TOTAL_FRAMES', totalFrames);

  // created shared buffer
  const sharedBufferSize =
    Float32Array.BYTES_PER_ELEMENT * channels * amplitudeData[0].length;
  const sharedBuffer = new SharedArrayBuffer(sharedBufferSize);
  const sharedArray = new Float32Array(sharedBuffer);

  // put amplitude data in shared buffer
  for (let i = 0; i < channels; i++) {
    const l = amplitudeData[i].length;
    for (let j = 0; j < l; j++) {
      const orig = amplitudeData[i][j];
      const mapped = mapRange(
        orig,
        minAmplitude,
        maxAmplitude,
        0,
        SCREEN_HEIGHT
      );
      sharedArray[i * l + j] = SCREEN_HEIGHT - mapped;
    }
  }

  // create drawer threads
  const artists = new Array(CONCURRENCY).fill(undefined).map(() => {
    return new Worker(new URL('./drawer.ts', import.meta.url), {
      type: 'module'
    });
  });

  const fileHandles: FileSystemFileHandle[] = new Array(totalFrames).fill(
    undefined
  );

  const callArtist = (idx: number, frame: number) => {
    artists[idx].postMessage({
      buffer: sharedBuffer,
      samplesPerFrame,
      frame,
      channels,
      screenWidth: SCREEN_WIDTH,
      screenHeight: SCREEN_HEIGHT,
      bgColor: BG_COLOR,
      fgColor: FG_COLOR
    });
  };

  await Promise.all(
    artists.map(
      (_, idx) =>
        new Promise((resolve) => {
          artists[idx].onmessage = (event) => {
            const { frame, handle } = event.data;
            const next = frame + CONCURRENCY;
            fileHandles[frame] = handle;
            postMessage({
              type: MessageTypes.PROGRESS,
              progress: frame / totalFrames,
              state: ProgressEnum.DRAWING_FRAMES
            });
            if (next > totalFrames) return resolve(true);
            callArtist(idx, next);
          };

          callArtist(idx, idx);
        })
    )
  );

  await Promise.all(
    fileHandles.map(async (h, idx) => {
      const f = await h.getFile();
      postMessage({
        type: MessageTypes.PROGRESS,
        progress: idx / fileHandles.length,
        state: ProgressEnum.COLLECTING_FRAMES
      });
      await ffmpeg.writeFile(`frame-${idx}.png`, await fetchFile(f));
    })
  );

  for await (const k of rootHandle.keys()) {
    await rootHandle.removeEntry(k, { recursive: true });
  }

  await ffmpeg.exec([
    '-framerate',
    FRAME_RATE.toString(),
    '-i',
    'frame-%d.png',
    '-i',
    'audio.wav',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-strict',
    'experimental',
    '-shortest',
    '-threads',
    CONCURRENCY.toString(),
    'test.mp4'
  ]);

  const videoBytes = await ffmpeg.readFile('test.mp4');
  const root = await navigator.storage.getDirectory();
  const videoHandle = await root.getFileHandle('video.mp4', { create: true });
  const videoWriter = await videoHandle.createWritable();
  await videoWriter.write(videoBytes);
  await videoWriter.close();

  postMessage({ type: MessageTypes.COMPLETE, data: videoHandle });
};
