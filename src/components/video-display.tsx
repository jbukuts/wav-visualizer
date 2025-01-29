import { useEffect, useRef } from 'react';

interface VideoDisplayProps {
  data: FileSystemFileHandle;
}

export default function VideoDisplay(props: VideoDisplayProps) {
  const { data } = props;
  const elementRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    let url: string;
    data.getFile().then(async (f) => {
      const buffer = await f.arrayBuffer();

      const blob = new Blob([buffer], { type: 'video/mp4' });
      url = URL.createObjectURL(blob);
      elementRef.current.src = url;
    });

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [data]);

  return <video controls ref={elementRef} />;
}
