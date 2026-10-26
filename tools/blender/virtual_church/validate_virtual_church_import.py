"""Independently import and validate the VC-02 GLB deliverables in Blender."""

from __future__ import annotations

import json
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
ASSET_DIR = REPO_ROOT / "cloudflare" / "alife-app" / "public" / "virtual-church-assets" / "buildings"

ASSETS = (
    ("church-hero.glb", "high"),
    ("church-hero-medium.glb", "medium"),
    ("church-hero-low.glb", "low"),
    ("church-props.glb", "props"),
)


def world_bounds(mesh_objects: list[bpy.types.Object]) -> tuple[list[float], list[float]]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in mesh_objects
        for corner in obj.bound_box
    ]
    minimum = [min(point[axis] for point in points) for axis in range(3)]
    maximum = [max(point[axis] for point in points) for axis in range(3)]
    return minimum, maximum


def validate_asset(filename: str, lod: str) -> dict[str, object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = ASSET_DIR / filename
    bpy.ops.import_scene.gltf(filepath=str(path))

    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    cameras = [obj for obj in objects if obj.type == "CAMERA"]
    lights = [obj for obj in objects if obj.type == "LIGHT"]
    minimum, maximum = world_bounds(meshes)
    blender_dimensions = [maximum[index] - minimum[index] for index in range(3)]
    # Blender imports glTF Y-up data as Z-up. Convert the measured dimensions
    # back to the runtime contract: X facade, Y up, Z depth.
    runtime_dimensions = [
        blender_dimensions[0],
        blender_dimensions[2],
        blender_dimensions[1],
    ]
    errors: list[str] = []

    if not meshes:
        errors.append("no mesh objects imported")
    if cameras:
        errors.append("unexpected camera objects")
    if lights:
        errors.append("unexpected light objects")
    if bpy.data.actions:
        errors.append("unexpected animation actions")

    if lod != "props":
        if not (45.5 <= runtime_dimensions[0] <= 46.5):
            errors.append(f"facade width outside contract: {runtime_dimensions[0]:.3f} m")
        if not (9.5 <= runtime_dimensions[1] <= 10.2):
            errors.append(f"height outside contract: {runtime_dimensions[1]:.3f} m")
        # The photo-backed foyer extends the visible entrance shell to about
        # 13.19 m total depth. Keep this narrow so a future accidental full
        # interior or missing foyer cannot silently pass the import gate.
        if not (13.0 <= runtime_dimensions[2] <= 13.4):
            errors.append(f"depth outside contract: {runtime_dimensions[2]:.3f} m")

    return {
        "file": filename,
        "lod": lod,
        "objects": len(objects),
        "meshes": len(meshes),
        "materials": len(bpy.data.materials),
        "blenderBounds": {"min": minimum, "max": maximum},
        "runtimeDimensions": runtime_dimensions,
        "errors": errors,
    }


def main() -> None:
    results = [validate_asset(filename, lod) for filename, lod in ASSETS]
    report = {"assets": results, "passed": all(not item["errors"] for item in results)}
    print("VC02_IMPORT_REPORT=" + json.dumps(report, ensure_ascii=False))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
