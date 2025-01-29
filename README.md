# wav-visualizer

A small web application that can render an amplitude visual video for a supplied WAV file; _entirely in the browser_.

Built using:

- [`wav-parse`](https://github.com/jbukuts/wav-parse)
- [`ffmpeg.wasm`](https://ffmpegwasm.netlify.app/docs/overview)
- Cool web standards
  - [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
  - [Origin Private File System](https://web.dev/articles/origin-private-file-system)
  - [OffscreenCanvas API](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/OffscreenCanvas)
  - [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)

## How does it work?

I won't speak too much on how a WAV file is actually parsed. For that step feel free to read parser's README [here](https://github.com/jbukuts/wav-parse).

After the WAV file is parsed and it's amplitude data is read we then have to normalize the amplitude values to fit into the desired resolutions screen height. Then the process of drawing each individual frame can begin. 

Since each frame is not dependent on one another this task is parallelized via Web Workers. Within each worker the frame is drawn as an image using the OffScreenCanvas API.

> Note: To avoid transferring/copying the ampitude data from the main thread to each worker a SharedArrayBuffer is created beforehand and the amplitude data is dumped into it so it can be accessed in all of the worker threads.

However, even a short video can still contain thousands a frames which would be ineffiecient if we tried to store all of them in-memory. To offload this we write each frame as an image file to Origin Private File System (OPFS) temporarily. This allows us to perists byte data into a safe context where it can be retrieved later during the final render/encoding step. Because of this the only thing we need to store in-memory are handles that will allow us to access the files at a later time.

Last is the rendering/encoding step which is handled via `ffmpeg.wasm`. This collects the all the images stored in the OPFS and encodes them as a single `.mp4` file with the WAV audio added.

## Getting started 

To get this app running locally start by cloning the repo and installing dependencies via:

```bash
npm ci
```

After that you can start the local web server via:

```bash
npm run dev
```

And the local dev server will be accessible at http://localhost:5173
