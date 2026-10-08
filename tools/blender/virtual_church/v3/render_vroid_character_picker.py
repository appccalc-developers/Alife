"""Render an exact, transparent picker portrait from the released VRoid GLB.

Usage:
  blender --background --factory-startup --python render_vroid_character_picker.py -- \
    <released-character.glb> <output.webp>
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(args) != 2:
    raise SystemExit("Expected <released-character.glb> <output.webp>")

input_path = Path(args[0]).resolve()
output_path = Path(args[1]).resolve()
if not input_path.is_file():
    raise FileNotFoundError(input_path)
output_path.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(input_path))

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 768
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.image_settings.quality = 92
scene.render.film_transparent = True
scene.render.filepath = str(output_path)
scene.render.image_settings.color_mode = "RGBA"

scene.view_settings.look = "AgX - Medium High Contrast"

world = bpy.data.worlds.new("PickerWorld")
world.use_nodes = True
background = world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.78, 0.86, 0.83, 1.0)
background.inputs["Strength"].default_value = 0.55
scene.world = world

armature = next((obj for obj in scene.objects if obj.type == "ARMATURE"), None)
if armature is None:
    raise RuntimeError("Released character has no armature")

idle_action = bpy.data.actions.get("Idle_A")
if idle_action is not None:
    armature.animation_data_create()
    armature.animation_data.action = idle_action
    first_frame, last_frame = idle_action.frame_range
    scene.frame_set(round(first_frame + (last_frame - first_frame) * 0.5))

mesh_objects = [obj for obj in scene.objects if obj.type == "MESH" and not obj.hide_render]
if not mesh_objects:
    raise RuntimeError("Released character has no visible mesh")

depsgraph = bpy.context.evaluated_depsgraph_get()
minimum = Vector((math.inf, math.inf, math.inf))
maximum = Vector((-math.inf, -math.inf, -math.inf))
for source_object in mesh_objects:
    evaluated = source_object.evaluated_get(depsgraph)
    evaluated_mesh = evaluated.to_mesh()
    try:
        for vertex in evaluated_mesh.vertices:
            point = evaluated.matrix_world @ vertex.co
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)
    finally:
        evaluated.to_mesh_clear()

camera_data = bpy.data.cameras.new("CharacterPickerCamera")
camera_data.lens = 52
camera = bpy.data.objects.new("CharacterPickerCamera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera

# The exported action contains animated helper/control bounds outside the
# visible 1.7 m avatar. A fixed human-scale camera therefore frames the actual
# released mesh reliably. Keep the figure close enough to fill the character
# card: the former 3.45 m camera left the released mesh inside only 28% of the
# image width, making the face unreadable at the panel's 288 px display height.
# A restrained X offset preserves the three-quarter view needed to read the
# face, ponytail and layered costume without turning the portrait into a side
# view.
presentation_target = Vector((0.0, 0.0, 0.86))
camera.location = Vector((0.30, -2.85, 0.92))
camera.rotation_euler = (presentation_target - camera.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name: str, location: tuple[float, float, float], energy: float, size: float, color: tuple[float, float, float]) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = Vector(location)
    light.rotation_euler = (presentation_target - light.location).to_track_quat("-Z", "Y").to_euler()


add_area_light("PickerKey", (-2.6, -3.6, 4.2), 820, 3.2, (1.0, 0.92, 0.86))
add_area_light("PickerFill", (2.8, -2.0, 2.2), 480, 3.0, (0.80, 0.91, 1.0))
add_area_light("PickerRim", (1.6, 2.4, 3.5), 560, 2.4, (1.0, 0.86, 0.72))

bpy.ops.render.render(write_still=True)
print(
    {
        "input": str(input_path),
        "output": str(output_path),
        "action": idle_action.name if idle_action else None,
        "dimensions": [scene.render.resolution_x, scene.render.resolution_y],
        "bounds": [list(minimum), list(maximum)],
    }
)
