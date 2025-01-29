import { create } from 'zustand';

interface RenderStore {
  resolution: [number, number];
  framerate: number;
  concurrency: number;
  setResolution: (r: [number, number]) => void;
  setFramerate: (r: number) => void;
}

const useRenderStore = create<RenderStore>((set) => ({
  resolution: [1280, 720],
  framerate: 24,
  concurrency: 8,
  setResolution: (r) => set({ resolution: r }),
  setFramerate: (r) => set({ framerate: r })
}));

export default useRenderStore;
