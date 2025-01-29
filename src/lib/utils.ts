import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function mapRange(
  x: number,
  in_min: number,
  in_max: number,
  out_min: number,
  out_max: number
) {
  return out_min + ((x - in_min) * (out_max - out_min)) / (in_max - in_min);
}
