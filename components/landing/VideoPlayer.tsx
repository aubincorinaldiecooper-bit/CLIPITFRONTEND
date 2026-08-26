'use client';

/* The source video. Holds on its poster until pressed; click anywhere to
   play or pause. The play button steps out of the way while it runs. */

import { useCallback, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

interface Props { src: string; poster?: string }

export default function VideoPlayer({ src, poster }: Props) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  }, []);

  return (
    <div className="group relative w-full overflow-hidden rounded-3xl bg-[#141110]">
      <video
        ref={video}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="block aspect-video w-full cursor-pointer object-cover"
      />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause the video' : 'Play the video'}
        aria-pressed={playing}
        className={'absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-white/95 transition-opacity ' +
          (playing ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : 'opacity-100')}
      >
        {playing
          ? <Pause className="h-6 w-6 text-[#121212]" fill="currentColor" />
          : <Play className="ml-1 h-6 w-6 text-[#121212]" fill="currentColor" />}
      </button>
    </div>
  );
}
