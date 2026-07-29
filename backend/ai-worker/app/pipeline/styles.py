from __future__ import annotations

from app.schemas import StyleId

# Wan / ComfyUI positive prompts per template
STYLE_PROMPTS: dict[StyleId, str] = {
    StyleId.anime: (
        "Japanese anime style, cel shading, clean line art, vibrant colors, "
        "studio anime quality, expressive eyes, smooth animation"
    ),
    StyleId.cartoon: (
        "2D cartoon TV series style, bold outlines, flat colors, "
        "Saturday morning cartoon look, playful shapes"
    ),
    StyleId.three_d: (
        "Pixar-like 3D CGI animation, soft global illumination, "
        "subsurface skin, stylized proportions, cinematic lighting"
    ),
    StyleId.artistic: (
        "painted impressionist animation, visible brush strokes, "
        "oil painting texture, rich color palette, artistic film look"
    ),
}

STYLE_NEGATIVE = (
    "blurry, low quality, watermark, text, logo, deformed, artifact, noise"
)

# FFmpeg CPU fallback filter graphs (distinct looks per style)
FFMPEG_STYLE_FILTERS: dict[StyleId, str] = {
    StyleId.anime: (
        "eq=saturation=1.45:contrast=1.18:brightness=0.03,"
        "unsharp=5:5:1.2:5:5:0.0,"
        "hue=s=1.1,"
        "curves=preset=lighter"
    ),
    StyleId.cartoon: (
        "eq=saturation=1.55:contrast=1.35,"
        "unsharp=7:7:2.0:7:7:0.5,"
        "hqdn3d=4:3:6:4.5,"
        "eq=gamma=1.05"
    ),
    StyleId.three_d: (
        "eq=saturation=1.2:contrast=1.12:brightness=0.02,"
        "gblur=sigma=0.6,"
        "unsharp=3:3:0.6:3:3:0.0,"
        "colorbalance=rs=0.04:gs=-0.02:bs=-0.03"
    ),
    StyleId.artistic: (
        "eq=saturation=1.35:contrast=1.25,"
        "hue=h=8,"
        "curves=preset=vintage,"
        "unsharp=5:5:0.8:5:5:0.0,"
        "noise=alls=6:allf=t"
    ),
}

# ComfyUI workflow template filenames (relative to workflows/)
WORKFLOW_FILES: dict[StyleId, str] = {
    StyleId.anime: "wan_anime.json",
    StyleId.cartoon: "wan_cartoon.json",
    StyleId.three_d: "wan_3d.json",
    StyleId.artistic: "wan_artistic.json",
}


def prompt_for(style: StyleId) -> str:
    return STYLE_PROMPTS[style]
