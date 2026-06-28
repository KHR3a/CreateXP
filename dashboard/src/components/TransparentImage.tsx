'use client';
import { useEffect, useRef, useState } from 'react';

interface TransparentImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function TransparentImage({ src, alt, className, style }: TransparentImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // 左上のピクセル（[0,0]の位置）を背景色として取得
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      const tolerance = 25; // 許容誤差（多少の色ムラも透過する）

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // 背景色と近い色は完全に透明（Alpha=0）にする
        if (Math.abs(r - bgR) <= tolerance && 
            Math.abs(g - bgG) <= tolerance && 
            Math.abs(b - bgB) <= tolerance) {
          data[i + 3] = 0; 
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setLoaded(true);
    };
    img.src = src;
  }, [src]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`${className} ${!loaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`} 
      style={style}
      aria-label={alt}
    />
  );
}
