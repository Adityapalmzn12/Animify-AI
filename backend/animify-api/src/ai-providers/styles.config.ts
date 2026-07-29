export type AnimationStyle = 'anime' | 'cartoon' | '3d' | 'artistic' | string;

export interface StyleProfile {
  id: string;
  name: string;
  /** Wan / ComfyUI positive prompt (OSS GPU path) */
  wanPrompt: string;
  /** ffmpeg video filter chain for OSS CPU fallback */
  ffmpegFilter: string;
}

export const STYLE_PROFILES: Record<string, StyleProfile> = {
  anime: {
    id: 'anime',
    name: 'Anime Style',
    wanPrompt:
      'Japanese anime style, cel shading, clean line art, vibrant colors, studio anime quality, expressive eyes, smooth animation',
    ffmpegFilter:
      'eq=saturation=1.45:contrast=1.18:brightness=0.03,unsharp=5:5:1.2:5:5:0.0,hue=s=1.1,curves=preset=lighter',
  },
  cartoon: {
    id: 'cartoon',
    name: 'Cartoon',
    wanPrompt:
      '2D cartoon TV series style, bold outlines, flat colors, Saturday morning cartoon look, playful shapes',
    ffmpegFilter:
      'eq=saturation=1.55:contrast=1.35,unsharp=7:7:2.0:7:7:0.5,hqdn3d=4:3:6:4.5,eq=gamma=1.05',
  },
  '3d': {
    id: '3d',
    name: '3D Animation',
    wanPrompt:
      'Pixar-like 3D CGI animation, soft global illumination, subsurface skin, stylized proportions, cinematic lighting',
    ffmpegFilter:
      'eq=saturation=1.2:contrast=1.12:brightness=0.02,gblur=sigma=0.6,unsharp=3:3:0.6:3:3:0.0,colorbalance=rs=0.04:gs=-0.02:bs=-0.03',
  },
  artistic: {
    id: 'artistic',
    name: 'Artistic',
    wanPrompt:
      'painted impressionist animation, visible brush strokes, oil painting texture, rich color palette, artistic film look',
    ffmpegFilter:
      'eq=saturation=1.35:contrast=1.25,hue=h=8,curves=preset=vintage,unsharp=5:5:0.8:5:5:0.0,noise=alls=6:allf=t',
  },
};

export function resolveStyleProfile(style?: string | null): StyleProfile {
  const key = (style || 'anime').toLowerCase().trim();
  return STYLE_PROFILES[key] || STYLE_PROFILES.anime;
}
