"""Prepare shared VC-04 PBR atlases from the approved generated source image.

Run with Blender 4.5 LTS:
    blender --background --python prepare_vc04_texture_atlas.py
"""

from __future__ import annotations

from pathlib import Path

import bpy
import numpy as np


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
SOURCE_PATH = SCRIPT_DIR / "textures" / "vc04-material-atlas-source.png"
OUTPUT_DIR = (
    REPO_ROOT
    / "cloudflare"
    / "alife-app"
    / "public"
    / "virtual-church-assets"
    / "textures"
)

ATLAS_SIZE = 1024
EDGE_BLEND = 20

BASE_COLOR_PATH = OUTPUT_DIR / "church-material-atlas-basecolor.png"
ORM_PATH = OUTPUT_DIR / "church-material-atlas-orm.png"
NORMAL_PATH = OUTPUT_DIR / "church-material-atlas-normal.png"


def make_quadrant_tileable(quadrant: np.ndarray) -> None:
    """Blend paired edges while leaving the material centre unchanged."""
    for index in range(EDGE_BLEND):
        weight = index / max(1, EDGE_BLEND - 1)

        horizontal_average = (quadrant[:, index, :] + quadrant[:, -1 - index, :]) * 0.5
        quadrant[:, index, :] = (
            horizontal_average * (1.0 - weight) + quadrant[:, index, :] * weight
        )
        quadrant[:, -1 - index, :] = (
            horizontal_average * (1.0 - weight)
            + quadrant[:, -1 - index, :] * weight
        )

        vertical_average = (quadrant[index, :, :] + quadrant[-1 - index, :, :]) * 0.5
        quadrant[index, :, :] = (
            vertical_average * (1.0 - weight) + quadrant[index, :, :] * weight
        )
        quadrant[-1 - index, :, :] = (
            vertical_average * (1.0 - weight)
            + quadrant[-1 - index, :, :] * weight
        )


def save_pixels(
    name: str,
    pixels: np.ndarray,
    path: Path,
    color_space: str,
) -> None:
    image = bpy.data.images.new(name, width=ATLAS_SIZE, height=ATLAS_SIZE, alpha=True)
    image.colorspace_settings.name = color_space
    image.file_format = "PNG"
    image.filepath_raw = str(path)
    image.pixels.foreach_set(pixels.astype(np.float32, copy=False).ravel())
    image.save()
    bpy.data.images.remove(image)


def main() -> None:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(f"Missing VC-04 atlas source: {SOURCE_PATH}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    source = bpy.data.images.load(str(SOURCE_PATH), check_existing=False)
    source.scale(ATLAS_SIZE, ATLAS_SIZE)
    rgba = np.empty(ATLAS_SIZE * ATLAS_SIZE * 4, dtype=np.float32)
    source.pixels.foreach_get(rgba)
    rgba = rgba.reshape((ATLAS_SIZE, ATLAS_SIZE, 4))
    rgba[:, :, 3] = 1.0

    half = ATLAS_SIZE // 2
    quadrants = (
        rgba[:half, :half, :],
        rgba[:half, half:, :],
        rgba[half:, :half, :],
        rgba[half:, half:, :],
    )
    for quadrant in quadrants:
        make_quadrant_tileable(quadrant)

    save_pixels("VC04_Atlas_BaseColor", rgba, BASE_COLOR_PATH, "sRGB")

    luminance = (
        rgba[:, :, 0] * 0.2126
        + rgba[:, :, 1] * 0.7152
        + rgba[:, :, 2] * 0.0722
    )
    roughness = np.empty((ATLAS_SIZE, ATLAS_SIZE), dtype=np.float32)

    # Blender pixel rows run bottom-to-top. These constants therefore map to:
    # bottom-left concrete, bottom-right charcoal, top-left cedar, top-right metal.
    roughness[:half, :half] = 0.90 + (0.5 - luminance[:half, :half]) * 0.10
    roughness[:half, half:] = 0.68 + (0.5 - luminance[:half, half:]) * 0.12
    roughness[half:, :half] = 0.78 + (0.5 - luminance[half:, :half]) * 0.16
    roughness[half:, half:] = 0.42 + (0.5 - luminance[half:, half:]) * 0.20
    roughness = np.clip(roughness, 0.18, 0.98)

    metallic = np.zeros_like(roughness)
    metallic[:half, :half] = 0.05
    metallic[:half, half:] = 0.28
    metallic[half:, :half] = 0.0
    metallic[half:, half:] = 0.58
    orm_rgba = np.stack(
        (np.ones_like(roughness), roughness, metallic, np.ones_like(roughness)),
        axis=2,
    )
    save_pixels(
        "VC04_Atlas_ORM",
        orm_rgba,
        ORM_PATH,
        "Non-Color",
    )

    height = luminance.copy()
    # Architectural metal ribs and timber grain need stronger relief than the
    # concrete and charcoal quadrants.
    strength = np.full_like(height, 1.7)
    strength[:half, :half] = 1.0
    strength[:half, half:] = 0.7
    strength[half:, :half] = 2.3
    strength[half:, half:] = 2.8

    gradient_y, gradient_x = np.gradient(height)
    normal_x = -gradient_x * strength
    normal_y = -gradient_y * strength
    normal_z = np.ones_like(height)
    magnitude = np.sqrt(normal_x * normal_x + normal_y * normal_y + normal_z * normal_z)
    normal_rgba = np.stack(
        (
            normal_x / magnitude * 0.5 + 0.5,
            normal_y / magnitude * 0.5 + 0.5,
            normal_z / magnitude * 0.5 + 0.5,
            np.ones_like(height),
        ),
        axis=2,
    )
    save_pixels("VC04_Atlas_Normal", normal_rgba, NORMAL_PATH, "Non-Color")

    bpy.data.images.remove(source)
    print(f"VC04_BASE_COLOR={BASE_COLOR_PATH}")
    print(f"VC04_ORM={ORM_PATH}")
    print(f"VC04_NORMAL={NORMAL_PATH}")


if __name__ == "__main__":
    main()
