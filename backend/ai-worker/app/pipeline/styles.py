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

# Strong CPU stylization filters — look clearly "animated", not a slight color grade.
# Keep graphs lightweight (480p) so Railway free tier does not OOM.
FFMPEG_STYLE_FILTERS: dict[StyleId, str] = {
    # Cel-shade anime: soft surfaces + boosted color + hard edges feel
    StyleId.anime: (
        "hqdn3d=6:4:8:6,"
        "eq=saturation=1.55:contrast=1.35:brightness=0.04:gamma=0.95,"
        "unsharp=5:5:1.8:5:5:0.0,"
        "curves=preset=lighter,"
        "hue=s=1.2,"
        "colorlevels=rimin=0.02:gimin=0.02:bimin=0.02:rimax=0.92:gimax=0.92:bimax=0.92"
    ),
    # Flat cartoon: heavy denoise + poster-like contrast + ink edges via unsharp
    StyleId.cartoon: (
        "hqdn3d=10:8:14:10,"
        "eq=saturation=1.75:contrast=1.5:gamma=1.08,"
        "unsharp=7:7:2.8:7:7:0.8,"
        "colorbalance=rs=0.08:gs=-0.03:bs=-0.06,"
        "colorlevels=rimin=0.05:gimin=0.05:bimin=0.05:rimax=0.88:gimax=0.88:bimax=0.88"
    ),
    # Soft 3D CGI / Pixar-ish: bloom-ish blur + warm grade + gentle contrast
    StyleId.three_d: (
        "gblur=sigma=0.85,"
        "eq=saturation=1.25:contrast=1.18:brightness=0.03:gamma=0.98,"
        "unsharp=3:3:0.7:3:3:0.0,"
        "colorbalance=rs=0.06:gs=-0.02:bs=-0.04,"
        "curves=preset=medium_contrast,"
        "vignette=PI/5"
    ),
    # Painted / artistic: warm vintage + grain + soft edges
    StyleId.artistic: (
        "eq=saturation=1.4:contrast=1.22:brightness=0.02,"
        "hue=h=12:s=1.1,"
        "curves=preset=vintage,"
        "gblur=sigma=0.4,"
        "unsharp=5:5:1.0:5:5:0.0,"
        "noise=alls=10:allf=t+u,"
        "colorbalance=rs=0.1:bs=-0.08"
    ),
}

# Optional filter_complex graphs (more "AI cartoon" look with edge blend).
# Placeholders: start from scaled [0:v] already applied by ffmpeg_ops when use_filter_complex.
FFMPEG_STYLE_COMPLEX: dict[StyleId, str] = {
    StyleId.anime: (
        "[base]split[a][b];"
        "[b]edgedetect=mode=colormerge:low=0.08:high=0.22[e];"
        "[a]hqdn3d=5:4:8:6,eq=saturation=1.5:contrast=1.3:brightness=0.03[c];"
        "[c][e]blend=all_mode=multiply:all_opacity=0.45,unsharp=5:5:1.4,format=yuv420p[styled]"
    ),
    StyleId.cartoon: (
        "[base]split[a][b];"
        "[b]edgedetect=mode=colormerge:low=0.1:high=0.28[e];"
        "[a]hqdn3d=12:9:14:10,eq=saturation=1.7:contrast=1.45[c];"
        "[c][e]blend=all_mode=multiply:all_opacity=0.55,format=yuv420p[styled]"
    ),
    StyleId.three_d: (
        "[base]gblur=sigma=0.9,eq=saturation=1.25:contrast=1.2:brightness=0.03,"
        "colorbalance=rs=0.06:bs=-0.04,vignette=PI/5,format=yuv420p[styled]"
    ),
    StyleId.artistic: (
        "[base]eq=saturation=1.4:contrast=1.2,hue=h=12,curves=preset=vintage,"
        "gblur=sigma=0.45,noise=alls=10:allf=t+u,format=yuv420p[styled]"
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


def cpu_style_filter(style: StyleId) -> tuple[str, bool]:
    """
    Return (filter_string, use_filter_complex).
    Prefer edgedetect complex for anime/cartoon when available.
    """
    complex_graph = FFMPEG_STYLE_COMPLEX.get(style)
    if complex_graph:
        return complex_graph, True
    return FFMPEG_STYLE_FILTERS[style], False
