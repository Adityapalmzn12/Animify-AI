export type AnimationStyle = 'anime' | 'cartoon' | '3d' | 'artistic' | string;

export interface StyleProfile {
  id: string;
  name: string;
  /** Wan / ComfyUI positive prompt (OSS GPU path) */
  wanPrompt: string;
  /** ffmpeg -vf chain for OSS CPU path (must not produce odd dimensions alone) */
  ffmpegFilter: string;
}

/** Shared scale that keeps free-tier memory low and even H.264 dimensions. */
export const SAFE_SCALE =
  "scale='min(480,iw)':'min(480,ih)':force_original_aspect_ratio=decrease:flags=fast_bilinear,scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=24,format=yuv420p";

export const STYLE_PROFILES: Record<string, StyleProfile> = {
  anime: {
    id: 'anime',
    name: 'Anime Style',
    wanPrompt:
      'Japanese anime style, cel shading, clean line art, vibrant colors, studio anime quality, expressive eyes, smooth animation',
    ffmpegFilter:
      'hqdn3d=6:4:8:6,eq=saturation=1.55:contrast=1.35:brightness=0.04:gamma=0.95,unsharp=5:5:1.8:5:5:0.0,curves=preset=lighter,hue=s=1.2,colorlevels=rimin=0.02:gimin=0.02:bimin=0.02:rimax=0.92:gimax=0.92:bimax=0.92',
  },
  cartoon: {
    id: 'cartoon',
    name: 'Cartoon',
    wanPrompt:
      '2D cartoon TV series style, bold outlines, flat colors, Saturday morning cartoon look, playful shapes',
    ffmpegFilter:
      'hqdn3d=10:8:14:10,eq=saturation=1.75:contrast=1.5:gamma=1.08,unsharp=7:7:2.8:7:7:0.8,colorbalance=rs=0.08:gs=-0.03:bs=-0.06,colorlevels=rimin=0.05:gimin=0.05:bimin=0.05:rimax=0.88:gimax=0.88:bimax=0.88',
  },
  '3d': {
    id: '3d',
    name: '3D Animation',
    wanPrompt:
      'Pixar-like 3D CGI animation, soft global illumination, subsurface skin, stylized proportions, cinematic lighting',
    ffmpegFilter:
      'gblur=sigma=0.85,eq=saturation=1.25:contrast=1.18:brightness=0.03:gamma=0.98,unsharp=3:3:0.7:3:3:0.0,colorbalance=rs=0.06:gs=-0.02:bs=-0.04,curves=preset=medium_contrast,vignette=PI/5',
  },
  artistic: {
    id: 'artistic',
    name: 'Artistic',
    wanPrompt:
      'painted impressionist animation, visible brush strokes, oil painting texture, rich color palette, artistic film look',
    ffmpegFilter:
      'eq=saturation=1.4:contrast=1.22:brightness=0.02,hue=h=12:s=1.1,curves=preset=vintage,gblur=sigma=0.4,unsharp=5:5:1.0:5:5:0.0,noise=alls=10:allf=t+u,colorbalance=rs=0.1:bs=-0.08',
  },
};

export function resolveStyleProfile(style?: string | null): StyleProfile {
  const key = (style || 'anime').toLowerCase().trim();
  return STYLE_PROFILES[key] || STYLE_PROFILES.anime;
}
