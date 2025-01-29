import { Input } from '@/components/ui/input';
import { ChangeEvent, useEffect, useReducer, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { MessageTypes, ProgressEnum } from './enums';
import VideoDisplay from '@/components/video-display';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useDebounceCallback } from 'usehooks-ts';

const STATES: Record<ProgressEnum, string> = {
  [ProgressEnum.DRAWING_FRAMES]: 'Drawing frames',
  [ProgressEnum.COLLECTING_FRAMES]: 'Collecting frames',
  [ProgressEnum.RENDERING_VIDEO]: 'Rendering'
};

const RESOLUTIONS = {
  '720p': [1280, 720],
  '1080p': [1920, 1080]
} as const;

export interface RenderOpts {
  resolution: readonly [number, number];
  framerate: number;
  concurrency: number;
  bgColor: string;
  fgColor: string;
}

function reducer(state: RenderOpts, action: Partial<RenderOpts>): RenderOpts {
  return { ...state, ...action };
}

function App() {
  const workerRef = useRef<Worker | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<FileSystemFileHandle | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [state, setState] = useState<ProgressEnum | null>(null);

  const [renderOpts, dispatch] = useReducer<
    React.Reducer<RenderOpts, Partial<RenderOpts>>
  >(reducer, {
    resolution: RESOLUTIONS['720p'],
    framerate: 24,
    concurrency: 8,
    bgColor: '#000000',
    fgColor: '#ffffff'
  });

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('./workers/init.ts', import.meta.url),
      {
        type: 'module'
      }
    );

    workerRef.current.onmessage = (event) => {
      const { type, ...rest } = event.data;

      switch (type) {
        case MessageTypes.PROGRESS:
          setProgress(rest.progress);
          setState(rest.state);
          break;
        case MessageTypes.COMPLETE:
          setProcessing(false);
          setState(null);
          setProgress(0);
          setData(rest.data as FileSystemFileHandle);
          break;
        default:
          setProcessing(false);
          setProgress(0);
      }
    };

    workerRef.current.onerror = () => {
      setProcessing(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    console.log(data);
  }, [data]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
  };

  const handleProcessing = async () => {
    if (file === null || workerRef.current === null) return;
    console.log(renderOpts);
    setProcessing(true);
    workerRef.current.postMessage({ file, ...renderOpts });
  };

  const debounceDispatch = useDebounceCallback(
    (v: Partial<RenderOpts>) => dispatch(v),
    100
  );

  return (
    <div className='flex w-[500px] flex-col gap-2'>
      <h1 className='text-base font-bold'>WAV File Visualizer</h1>
      <div className='flex gap-2'>
        <Input
          className='hover:cursor-pointer'
          disabled={processing}
          type='file'
          accept='audio/wav'
          onChange={handleFileChange}
        />
        <Button disabled={!file || processing} onClick={handleProcessing}>
          Process {processing && <Loader2 className='animate-spin' />}
        </Button>
      </div>
      <div className='mt-3 grid grid-cols-3 gap-2'>
        <Select
          value={renderOpts.framerate.toString()}
          onValueChange={(v) => dispatch({ framerate: Number(v) })}>
          <SelectTrigger>
            <SelectValue placeholder='Select framerate' />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Framerate</SelectLabel>
              <SelectItem value='24'>24fps</SelectItem>
              <SelectItem value='30'>30fps</SelectItem>
              <SelectItem value='60'>60fps</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          defaultValue='720p'
          onValueChange={(v) =>
            dispatch({ resolution: RESOLUTIONS[v as keyof typeof RESOLUTIONS] })
          }>
          <SelectTrigger>
            <SelectValue placeholder='Select resolution' />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Resolution</SelectLabel>
              {Object.keys(RESOLUTIONS).map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={renderOpts.concurrency.toString()}
          onValueChange={(v) => dispatch({ concurrency: Number(v) })}>
          <SelectTrigger>
            <SelectValue placeholder='Select thread usage' />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Threads</SelectLabel>
              {[2, 4, 8, 16].map((v) => (
                <SelectItem key={v} value={v.toString()}>
                  {v}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <Input
          type='color'
          value={renderOpts.bgColor}
          onChange={(v) => debounceDispatch({ bgColor: v.target.value })}
        />

        <Input
          type='color'
          value={renderOpts.fgColor}
          onChange={(v) => debounceDispatch({ fgColor: v.target.value })}
        />
      </div>

      {processing && (
        <>
          <Progress className='mt-4' value={progress * 100} />
          <div className='flex animate-pulse justify-between'>
            {state !== null && <p>{STATES[state]}</p>}
            <p>{Math.ceil(progress * 100)}%</p>
          </div>
        </>
      )}
      {data !== null && !processing && <VideoDisplay data={data} />}
    </div>
  );
}

export default App;
