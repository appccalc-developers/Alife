"""Build Alife VC-02 entrance assets with Blender.

Run with Blender 4.5 LTS:
    blender --background --python build_virtual_church_assets.py

The generated GLB files use the same local coordinate contract as the
procedural entrance group in VirtualChurchView.tsx:
    X = facade horizontal axis
    Y = up
    Z = depth (negative points from the facade into the car park)
    1 unit = 1 metre
"""

from __future__ import annotations

import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
ASSET_DIR = REPO_ROOT / "cloudflare" / "alife-app" / "public" / "virtual-church-assets" / "buildings"
SOURCE_BLEND = SCRIPT_DIR / "church-hero-source.blend"
DATA_ROOT = Path(
    os.environ.get(
        "ALIFE_DATA_ROOT",
        r"C:\Data\Alife" if os.name == "nt" else "/tmp/Alife",
    )
)
PREVIEW_PATH = DATA_ROOT / "Temp" / "virtual-church" / "vc-02-church-hero-preview.png"
SKIP_PREVIEW = os.environ.get("ALIFE_VC_SKIP_PREVIEW") == "1"
TEXTURE_DIR = REPO_ROOT / "cloudflare" / "alife-app" / "public" / "virtual-church-assets" / "textures"
BASE_COLOR_ATLAS = TEXTURE_DIR / "church-material-atlas-basecolor.png"
ORM_ATLAS = TEXTURE_DIR / "church-material-atlas-orm.png"
NORMAL_ATLAS = TEXTURE_DIR / "church-material-atlas-normal.png"

METRES_PER_UNIT = 1.0
ENTRANCE_START = (-4.01, -15.68)
ENTRANCE_END = (3.48, -24.89)
STREET_HIGH_START = (-9.76, 22.54)
STREET_HIGH_END = (-24.81, 10.34)

ROOF_LOW_HEIGHT = 6.5
ROOF_PEAK_HEIGHT = 10.2
FOYER_HEIGHT = 6.3
TIMBER_ENTRANCE_HEIGHT = 3.8
ENTRANCE_DOOR_HEIGHT = 2.35
ENTRANCE_DOOR_WIDTH = 0.95

ENTRANCE_DX = ENTRANCE_END[0] - ENTRANCE_START[0]
ENTRANCE_DZ = ENTRANCE_END[1] - ENTRANCE_START[1]
ENTRANCE_LENGTH = math.hypot(ENTRANCE_DX, ENTRANCE_DZ)
ENTRANCE_ANGLE = -math.atan2(ENTRANCE_DZ, ENTRANCE_DX)
ENTRANCE_MID = (
    (ENTRANCE_START[0] + ENTRANCE_END[0]) / 2,
    (ENTRANCE_START[1] + ENTRANCE_END[1]) / 2,
)

FACADE_RIGHT = ENTRANCE_LENGTH / 2
FOYER_WIDTH = 15.0
FOYER_START = FACADE_RIGHT - FOYER_WIDTH
FOYER_END = FACADE_RIGHT
FOYER_CENTRE = (FOYER_START + FOYER_END) / 2
CEDAR_WIDTH = 18.0
CEDAR_END = FOYER_START + 4.2
CEDAR_START = CEDAR_END - CEDAR_WIDTH
CEDAR_CENTRE = (CEDAR_START + CEDAR_END) / 2
CEDAR_PROJECTION = 2.7
AUDITORIUM_WIDTH = 26.0
AUDITORIUM_END = CEDAR_START + 9.4
AUDITORIUM_START = AUDITORIUM_END - AUDITORIUM_WIDTH
AUDITORIUM_UPPER_BASE = 2.35

RECESS_WIDTH = CEDAR_WIDTH * 0.68
RECESS_CENTRE = CEDAR_START + CEDAR_WIDTH * 0.64
RECESS_START = RECESS_CENTRE - RECESS_WIDTH / 2
RECESS_END = RECESS_CENTRE + RECESS_WIDTH / 2
RECESS_HEIGHT = ENTRANCE_DOOR_HEIGHT
LEFT_CEDAR_WIDTH = RECESS_START - CEDAR_START
RIGHT_CEDAR_WIDTH = CEDAR_END - RECESS_END
CEDAR_SPANDREL_HEIGHT = TIMBER_ENTRANCE_HEIGHT - RECESS_HEIGHT

DOOR_PANEL_COUNT = 4
DOOR_BANK_WIDTH = DOOR_PANEL_COUNT * ENTRANCE_DOOR_WIDTH
DOOR_BANK_START = RECESS_START + RECESS_WIDTH * 0.315
DOOR_BANK_END = DOOR_BANK_START + DOOR_BANK_WIDTH
DOOR_BANK_CENTRE = (DOOR_BANK_START + DOOR_BANK_END) / 2
LEFT_RECESS_WIDTH = DOOR_BANK_START - RECESS_START
FIXED_GLASS_WIDTH = LEFT_RECESS_WIDTH * 0.34
RIBBED_WALL_WIDTH = LEFT_RECESS_WIDTH - FIXED_GLASS_WIDTH
WHITE_PIER_WIDTH = RECESS_WIDTH * 0.1
WHITE_PIER_START = DOOR_BANK_END
WHITE_PIER_END = WHITE_PIER_START + WHITE_PIER_WIDTH
DARK_RETURN_WIDTH = max(0.2, RECESS_END - WHITE_PIER_END)
DARK_RETURN_CENTRE = WHITE_PIER_END + DARK_RETURN_WIDTH / 2

CEDAR_FRONT_Z = -CEDAR_PROJECTION - 0.12
PORTAL_MOUTH_Z = -CEDAR_PROJECTION + 0.12
REAR_PANEL_Z = -0.62
REAR_FACADE_Z = REAR_PANEL_Z - 0.08
DOOR_PANEL_Z = REAR_FACADE_Z - 0.035
DOOR_FRAME_Z = DOOR_PANEL_Z - 0.025
DOOR_HANDLE_Z = DOOR_PANEL_Z - 0.115
PORTAL_BACK_Z = REAR_FACADE_Z - 0.01
PORTAL_DEPTH = PORTAL_BACK_Z - PORTAL_MOUTH_Z
PORTAL_CENTRE_Z = (PORTAL_MOUTH_Z + PORTAL_BACK_Z) / 2

FOYER_WHITE_WIDTH = FOYER_WIDTH * 0.39
FOYER_GLASS_START = FOYER_START + 0.34
FOYER_GLASS_END = FOYER_END - FOYER_WHITE_WIDTH
FOYER_GLASS_WIDTH = FOYER_GLASS_END - FOYER_GLASS_START
FOYER_GLASS_CENTRE = (FOYER_GLASS_START + FOYER_GLASS_END) / 2
FOYER_WHITE_CENTRE = (FOYER_GLASS_END + FOYER_END) / 2
LOWER_FOYER_GLASS_HEIGHT = 2.35
FOYER_BAND_HEIGHT = 1.45
UPPER_FOYER_GLASS_HEIGHT = FOYER_HEIGHT - LOWER_FOYER_GLASS_HEIGHT - FOYER_BAND_HEIGHT - 0.45

# The public GLB only needs the photographed first view through the entrance
# glazing. It remains a non-walkable visual volume until a measured floor plan
# establishes the stairs, service window, corridor doors and room connections.
INTERIOR_FRONT_Z = -0.52
INTERIOR_BACK_Z = 6.40
INTERIOR_MIN_X = RECESS_START + 0.12
INTERIOR_MAX_X = FOYER_GLASS_END + 0.50
INTERIOR_WIDTH = INTERIOR_MAX_X - INTERIOR_MIN_X
INTERIOR_DEPTH = INTERIOR_BACK_Z - INTERIOR_FRONT_Z
INTERIOR_CENTRE_X = (INTERIOR_MIN_X + INTERIOR_MAX_X) / 2
INTERIOR_CENTRE_Z = (INTERIOR_FRONT_Z + INTERIOR_BACK_Z) / 2
INTERIOR_HEIGHT = 6.05

ATLAS_QUADRANTS: dict[str, tuple[float, float, float, float]] = {
    "M_Concrete": (0.0, 0.0, 0.5, 0.5),
    "M_Charcoal": (0.5, 0.0, 1.0, 0.5),
    "M_CedarLight": (0.0, 0.5, 0.5, 1.0),
    "M_CedarDark": (0.0, 0.5, 0.5, 1.0),
    "M_SilverMetal": (0.5, 0.5, 1.0, 1.0),
}


def to_blender(point: tuple[float, float, float]) -> tuple[float, float, float]:
    """Convert Three.js-style local XYZ to Blender XYZ."""
    x, y_up, z_depth = point
    return x, -z_depth, y_up


def size_to_blender(size: tuple[float, float, float]) -> tuple[float, float, float]:
    x, y_up, z_depth = size
    return x, z_depth, y_up


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def add_empty(
    name: str,
    collection: bpy.types.Collection,
    location: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.location = to_blender(location)
    obj.empty_display_type = "PLAIN_AXES"
    return obj


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)


def add_box(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=to_blender(location))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size_to_blender(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    move_to_collection(obj, collection)
    obj.parent = parent
    if bevel > 0:
        modifier = obj.modifiers.new("EdgeSoftening", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def add_cylinder(
    name: str,
    radius: float,
    height: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    vertices: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=height,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    move_to_collection(obj, collection)
    obj.parent = parent
    return obj


def add_cone(
    name: str,
    radius: float,
    height: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    vertices: int = 7,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius,
        radius2=0.025,
        depth=height,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    move_to_collection(obj, collection)
    obj.parent = parent
    return obj


def add_beam_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    thickness: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    """Create a slim square-section beam between two Three.js-space points."""

    start_blender = Vector(to_blender(start))
    end_blender = Vector(to_blender(end))
    direction = end_blender - start_blender
    length = direction.length
    if length <= 1e-6:
        raise ValueError(f"{name}: beam endpoints must differ")
    bpy.ops.mesh.primitive_cube_add(location=(start_blender + end_blender) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (thickness, thickness, length)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    assign_material(obj, material)
    move_to_collection(obj, collection)
    obj.parent = parent
    return obj


def add_horizontal_ring(
    name: str,
    radius: float,
    thickness: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    segments: int,
) -> bpy.types.Object:
    """Create a low-poly ring whose normal follows the Three.js up axis."""

    bpy.ops.mesh.primitive_torus_add(
        major_segments=segments,
        minor_segments=4,
        major_radius=radius,
        minor_radius=thickness,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    move_to_collection(obj, collection)
    obj.parent = parent
    return obj


def add_sloped_prism(
    name: str,
    x0: float,
    x1: float,
    bottom: float,
    top0: float,
    top1: float,
    front_z: float,
    back_z: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    bevel: float = 0.0,
) -> bpy.types.Object:
    vertices_three = [
        (x0, bottom, front_z),
        (x1, bottom, front_z),
        (x1, top1, front_z),
        (x0, top0, front_z),
        (x0, bottom, back_z),
        (x1, bottom, back_z),
        (x1, top1, back_z),
        (x0, top0, back_z),
    ]
    faces = [
        (0, 1, 2, 3),
        (5, 4, 7, 6),
        (4, 0, 3, 7),
        (1, 5, 6, 2),
        (3, 2, 6, 7),
        (4, 5, 1, 0),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata([to_blender(vertex) for vertex in vertices_three], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = parent
    assign_material(obj, material)
    if bevel > 0:
        modifier = obj.modifiers.new("EdgeSoftening", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
    return obj


def create_material(
    name: str,
    base_color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    transmission: float = 0.0,
    emission_color: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = base_color
    node = material.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = base_color
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = metallic
    transmission_input = node.inputs.get("Transmission Weight")
    if transmission_input is not None:
        transmission_input.default_value = transmission
    if emission_color is not None:
        node.inputs["Emission Color"].default_value = emission_color
        node.inputs["Emission Strength"].default_value = emission_strength
    return material


def configure_atlas_material(
    material: bpy.types.Material,
    images: dict[str, bpy.types.Image],
) -> None:
    quadrant = ATLAS_QUADRANTS.get(material.name)
    if quadrant is None:
        return

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")

    base_texture = nodes.new("ShaderNodeTexImage")
    base_texture.name = "VC04_BaseColorAtlas"
    base_texture.label = "Shared base-color atlas"
    base_texture.image = images["base_color"]
    base_texture.interpolation = "Linear"
    base_texture.extension = "CLIP"
    links.new(base_texture.outputs["Color"], principled.inputs["Base Color"])

    orm_texture = nodes.new("ShaderNodeTexImage")
    orm_texture.name = "VC04_ORMAtlas"
    orm_texture.label = "Shared AO/roughness/metallic atlas"
    orm_texture.image = images["orm"]
    orm_texture.interpolation = "Linear"
    orm_texture.extension = "CLIP"
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(orm_texture.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], principled.inputs["Roughness"])
    links.new(separate.outputs["Blue"], principled.inputs["Metallic"])

    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.name = "VC04_NormalAtlas"
    normal_texture.label = "Shared tangent-space normal atlas"
    normal_texture.image = images["normal"]
    normal_texture.interpolation = "Linear"
    normal_texture.extension = "CLIP"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.62
    links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])

    material["vc04AtlasQuadrant"] = list(quadrant)


def apply_atlas_uv(
    obj: bpy.types.Object,
    quadrant: tuple[float, float, float, float],
) -> None:
    mesh = obj.data
    uv_layer = mesh.uv_layers.get("MaterialAtlasUV") or mesh.uv_layers.new(
        name="MaterialAtlasUV"
    )
    mesh.uv_layers.active = uv_layer
    uv_layer.active_render = True
    u0, v0, u1, v1 = quadrant
    inset = 0.004
    u0 += inset
    v0 += inset
    u1 -= inset
    v1 -= inset

    for polygon in mesh.polygons:
        normal = polygon.normal
        dominant_axis = max(range(3), key=lambda axis: abs(normal[axis]))
        projection_axes = {
            0: (1, 2),
            1: (0, 2),
            2: (0, 1),
        }[dominant_axis]
        coordinates = [
            mesh.vertices[mesh.loops[loop_index].vertex_index].co
            for loop_index in polygon.loop_indices
        ]
        projected_u = [coordinate[projection_axes[0]] for coordinate in coordinates]
        projected_v = [coordinate[projection_axes[1]] for coordinate in coordinates]
        min_u, max_u = min(projected_u), max(projected_u)
        min_v, max_v = min(projected_v), max(projected_v)
        span_u = max(max_u - min_u, 1e-6)
        span_v = max(max_v - min_v, 1e-6)

        for loop_index, source_u, source_v in zip(
            polygon.loop_indices,
            projected_u,
            projected_v,
            strict=True,
        ):
            uv_layer.data[loop_index].uv = (
                u0 + (source_u - min_u) / span_u * (u1 - u0),
                v0 + (source_v - min_v) / span_v * (v1 - v0),
            )


def entrance_local_to_source(x: float, z: float = 0.0) -> tuple[float, float]:
    return (
        ENTRANCE_MID[0] + math.cos(ENTRANCE_ANGLE) * x + math.sin(ENTRANCE_ANGLE) * z,
        ENTRANCE_MID[1] - math.sin(ENTRANCE_ANGLE) * x + math.cos(ENTRANCE_ANGLE) * z,
    )


def roof_height_at_source(vertex: tuple[float, float]) -> float:
    low_end = ENTRANCE_MID
    high_end = (
        (STREET_HIGH_START[0] + STREET_HIGH_END[0]) / 2,
        (STREET_HIGH_START[1] + STREET_HIGH_END[1]) / 2,
    )
    axis_x = high_end[0] - low_end[0]
    axis_z = high_end[1] - low_end[1]
    axis_length_squared = axis_x * axis_x + axis_z * axis_z
    projection = (
        (vertex[0] - low_end[0]) * axis_x + (vertex[1] - low_end[1]) * axis_z
    ) / axis_length_squared
    t = min(1.0, max(0.0, projection))
    return ROOF_LOW_HEIGHT + t * (ROOF_PEAK_HEIGHT - ROOF_LOW_HEIGHT)


def roof_height_local(x: float, z: float = 0.0) -> float:
    return roof_height_at_source(entrance_local_to_source(x, z))


def collection_meshes(collection: bpy.types.Collection) -> list[bpy.types.Object]:
    # Assets are linked directly into their export collection. Avoid `all_objects`
    # here because iterating Blender's recursive collection view while join
    # operations remove source objects can leave an invalid RNA iterator.
    return [obj for obj in collection.objects if obj.type == "MESH"]


def join_by_material(
    collection: bpy.types.Collection,
    prefix: str,
    merge_materials: dict[str, bpy.types.Material] | None = None,
) -> None:
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in collection_meshes(collection):
        material_name = obj.data.materials[0].name if obj.data.materials else "NoMaterial"
        quadrant = ATLAS_QUADRANTS.get(material_name)
        if quadrant is not None:
            # Preserve each source material's atlas quadrant before assigning a
            # shared Low-LOD shader. This collapses draw calls without changing
            # the sampled base-colour/ORM/normal pixels.
            apply_atlas_uv(obj, quadrant)
        target_material = merge_materials.get(material_name) if merge_materials else None
        if target_material is not None:
            assign_material(obj, target_material)
            material_name = target_material.name
        groups.setdefault(material_name, []).append(obj)

    for material_name, objects in groups.items():
        quadrant = ATLAS_QUADRANTS.get(material_name)
        if quadrant is not None and merge_materials is None:
            for obj in objects:
                apply_atlas_uv(obj, quadrant)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        active.name = f"{prefix}_{material_name}"
        active.data.name = f"{active.name}_Mesh"
        active.select_set(False)


def join_prop_children_by_material(root: bpy.types.Object) -> None:
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in list(root.children):
        if obj.type != "MESH":
            continue
        material_name = obj.data.materials[0].name if obj.data.materials else "NoMaterial"
        groups.setdefault(material_name, []).append(obj)
    for material_name, objects in groups.items():
        quadrant = ATLAS_QUADRANTS.get(material_name)
        if quadrant is not None:
            for obj in objects:
                apply_atlas_uv(obj, quadrant)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        active.name = f"{root.name}_{material_name}"
        active.data.name = f"{active.name}_Mesh"
        active.parent = root
        active.select_set(False)


def create_asset_root(
    collection: bpy.types.Collection,
    name: str,
    lod: str,
) -> bpy.types.Object:
    root = add_empty(name, collection)
    root["alifeAsset"] = "virtual-church"
    root["phase"] = "VC-02"
    root["materialPhase"] = "VC-04"
    root["lod"] = lod
    root["metresPerUnit"] = METRES_PER_UNIT
    root["coordinateContract"] = "X facade, Y up, Z depth; negative Z faces car park"
    root["canonicalWorldPosition"] = [ENTRANCE_MID[0], 0.0, ENTRANCE_MID[1]]
    root["canonicalRotationY"] = ENTRANCE_ANGLE
    root["sourcePlan"] = "docs/virtual-church-visual-upgrade-plan.zh-CN.md"
    return root


def add_photo_backed_foyer(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    lod: str,
    materials: dict[str, bpy.types.Material],
) -> None:
    """Add the verified first interior view without implying walkable rooms."""

    bevel = 0.018 if lod == "high" else 0.012 if lod == "medium" else 0.0
    # The photographs show narrow, staggered laminate boards. The previous
    # full-depth strips read as broad decking and flattened the whole foyer.
    floor_board_size = {
        "high": (0.34, 1.32),
        "medium": (0.52, 1.72),
        "low": (1.04, 2.35),
    }[lod]
    plank_width, plank_length = floor_board_size
    floor_gap = 0.014 if lod == "high" else 0.018 if lod == "medium" else 0.028
    add_box(
        "Foyer_FloorShadowBase",
        (INTERIOR_WIDTH, 0.035, INTERIOR_DEPTH),
        (INTERIOR_CENTRE_X, 0.0175, INTERIOR_CENTRE_Z),
        materials["cedar_dark"],
        collection,
        root,
    )
    row_count = math.ceil(INTERIOR_DEPTH / plank_length)
    for row in range(row_count):
        row_start = INTERIOR_FRONT_Z + row * plank_length
        row_end = min(INTERIOR_BACK_Z, row_start + plank_length)
        visible_length = row_end - row_start
        x = INTERIOR_MIN_X - (plank_width / 2 if row % 2 else 0.0)
        column = 0
        while x < INTERIOR_MAX_X:
            board_start = max(INTERIOR_MIN_X, x)
            board_end = min(INTERIOR_MAX_X, x + plank_width)
            visible_width = board_end - board_start
            if visible_width > 0.08:
                add_box(
                    f"Foyer_FloorBoard_{row:02d}_{column:02d}",
                    (
                        max(0.04, visible_width - floor_gap),
                        0.055,
                        max(0.08, visible_length - floor_gap),
                    ),
                    (
                        (board_start + board_end) / 2,
                        0.0625,
                        (row_start + row_end) / 2,
                    ),
                    materials["cedar_light"],
                    collection,
                    root,
                )
            x += plank_width
            column += 1

    add_box(
        "Foyer_InteriorCeiling",
        (INTERIOR_WIDTH, 0.12, INTERIOR_DEPTH),
        (INTERIOR_CENTRE_X, INTERIOR_HEIGHT - 0.06, INTERIOR_CENTRE_Z),
        materials["white"],
        collection,
        root,
    )
    # Pale acoustic ceiling panels are one of the strongest repeated cues in
    # both the user photographs and the same-site construction galleries.
    panel_columns, panel_rows = {
        "high": (5, 6),
        "medium": (4, 5),
        "low": (2, 3),
    }[lod]
    panel_field_width = INTERIOR_WIDTH * 0.58
    panel_field_depth = INTERIOR_DEPTH - 0.62
    panel_width = panel_field_width / panel_columns
    panel_depth = panel_field_depth / panel_rows
    panel_centre_x = INTERIOR_CENTRE_X - INTERIOR_WIDTH * 0.10
    panel_start_x = panel_centre_x - panel_field_width / 2
    panel_start_z = INTERIOR_FRONT_Z + 0.31
    for row in range(panel_rows):
        for column in range(panel_columns):
            add_box(
                f"Foyer_AcousticPanel_{row:02d}_{column:02d}",
                (panel_width - 0.055, 0.025, panel_depth - 0.055),
                (
                    panel_start_x + (column + 0.5) * panel_width,
                    INTERIOR_HEIGHT - 0.137,
                    panel_start_z + (row + 0.5) * panel_depth,
                ),
                materials["white"],
                collection,
                root,
            )
    add_box(
        "Foyer_InteriorBackWall",
        (INTERIOR_WIDTH, INTERIOR_HEIGHT, 0.18),
        (INTERIOR_CENTRE_X, INTERIOR_HEIGHT / 2, INTERIOR_BACK_Z),
        materials["white"],
        collection,
        root,
    )
    wall_line_depths = (1.05, 3.45, 5.80) if lod != "low" else (1.45, 5.15)
    for x, label in ((INTERIOR_MIN_X, "Left"), (INTERIOR_MAX_X, "Right")):
        add_box(
            f"Foyer_Interior{label}Wall",
            (0.18, INTERIOR_HEIGHT, INTERIOR_DEPTH),
            (x, INTERIOR_HEIGHT / 2, INTERIOR_CENTRE_Z),
            materials["white"],
            collection,
            root,
        )
        # Structex documents that the structure is normally absorbed into wall
        # lines. These shallow charcoal returns frame the photographed volume;
        # they are not invented freestanding columns.
        for index, z in enumerate(wall_line_depths):
            add_box(
                f"Foyer_{label}WallLine_{index:02d}",
                (0.34, INTERIOR_HEIGHT, 0.44),
                (x + (0.08 if label == "Left" else -0.08), INTERIOR_HEIGHT / 2, z),
                materials["charcoal"],
                collection,
                root,
                bevel,
            )

    # The current user photos place a simple timber cross high on the foyer end
    # wall. It is deliberately architectural and unlit, not an ornamental glow.
    add_box(
        "Foyer_CrossVertical",
        (0.14, 1.48, 0.13),
        (INTERIOR_CENTRE_X, 4.48, INTERIOR_BACK_Z - 0.16),
        materials["cedar_dark"],
        collection,
        root,
        bevel / 2,
    )
    add_box(
        "Foyer_CrossHorizontal",
        (0.88, 0.14, 0.14),
        (INTERIOR_CENTRE_X, 4.70, INTERIOR_BACK_Z - 0.17),
        materials["cedar_dark"],
        collection,
        root,
        bevel / 2,
    )

    # One long black ceiling slot and restrained warm linear fixtures reproduce
    # the photographed ceiling rhythm without adding another material batch.
    add_box(
        "Foyer_BlackLinearSlot",
        (0.15, 0.035, INTERIOR_DEPTH - 0.75),
        (INTERIOR_CENTRE_X + INTERIOR_WIDTH * 0.28, INTERIOR_HEIGHT - 0.135, INTERIOR_CENTRE_Z),
        materials["charcoal"],
        collection,
        root,
    )
    light_pairs = 2 if lod == "low" else 4
    for index in range(light_pairs):
        x = INTERIOR_CENTRE_X + (-0.22 if index % 2 == 0 else 0.12) * INTERIOR_WIDTH
        z = 1.35 + (index // 2) * 2.8
        add_box(
            f"Foyer_LinearLight_{index:02d}",
            (1.20, 0.028, 0.10),
            (x, INTERIOR_HEIGHT - 0.145, z),
            materials["warm_light"],
            collection,
            root,
        )

    pendant_count = 3 if lod == "high" else 2 if lod == "medium" else 1
    pendant_segments = 7 if lod == "high" else 5 if lod == "medium" else 4
    for index in range(pendant_count):
        z = 1.65 + index * (3.15 / max(1, pendant_count - 1))
        add_cylinder(
            f"Foyer_PendantWire_{index:02d}",
            0.018,
            0.62,
            (INTERIOR_CENTRE_X - 0.42, 5.70, z),
            materials["charcoal"],
            collection,
            root,
            6,
        )
        pendant_x = INTERIOR_CENTRE_X - 0.42
        top_y = 5.52
        middle_y = 4.96
        bottom_y = 4.40
        add_horizontal_ring(
            f"Foyer_PendantRingTop_{index:02d}",
            0.075,
            0.018,
            (pendant_x, top_y, z),
            materials["cedar_light"],
            collection,
            root,
            max(8, pendant_segments * 2),
        )
        add_horizontal_ring(
            f"Foyer_PendantRingMiddle_{index:02d}",
            0.30,
            0.020,
            (pendant_x, middle_y, z),
            materials["cedar_light"],
            collection,
            root,
            max(8, pendant_segments * 2),
        )
        add_horizontal_ring(
            f"Foyer_PendantRingBottom_{index:02d}",
            0.075,
            0.018,
            (pendant_x, bottom_y, z),
            materials["cedar_light"],
            collection,
            root,
            max(8, pendant_segments * 2),
        )
        for strand in range(pendant_segments):
            angle = strand * math.tau / pendant_segments
            for direction in (-1, 1):
                middle_angle = angle + direction * math.pi / pendant_segments * 0.62
                bottom_angle = angle + direction * math.pi / pendant_segments * 1.24
                top = (
                    pendant_x + math.cos(angle) * 0.075,
                    top_y,
                    z + math.sin(angle) * 0.075,
                )
                middle = (
                    pendant_x + math.cos(middle_angle) * 0.30,
                    middle_y,
                    z + math.sin(middle_angle) * 0.30,
                )
                bottom = (
                    pendant_x + math.cos(bottom_angle) * 0.075,
                    bottom_y,
                    z + math.sin(bottom_angle) * 0.075,
                )
                add_beam_between(
                    f"Foyer_PendantStrandUpper_{index:02d}_{strand:02d}_{direction:+d}",
                    top,
                    middle,
                    0.025,
                    materials["cedar_light"],
                    collection,
                    root,
                )
                add_beam_between(
                    f"Foyer_PendantStrandLower_{index:02d}_{strand:02d}_{direction:+d}",
                    middle,
                    bottom,
                    0.025,
                    materials["cedar_light"],
                    collection,
                    root,
                )
        add_cylinder(
            f"Foyer_PendantGlow_{index:02d}",
            0.065,
            0.18,
            (INTERIOR_CENTRE_X - 0.42, 4.96, z),
            materials["warm_light"],
            collection,
            root,
            8,
        )


def build_hero(
    collection: bpy.types.Collection,
    lod: str,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    detail = {
        "high": {"corrugation": 0.40, "cedar": 0.42, "bevel": 0.025, "frames": True, "small": True},
        "medium": {"corrugation": 0.80, "cedar": 0.84, "bevel": 0.018, "frames": True, "small": False},
        "low": {"corrugation": None, "cedar": None, "bevel": 0.0, "frames": False, "small": False},
    }[lod]
    root = create_asset_root(collection, f"ChurchHero_{lod.title()}", lod)
    bevel = detail["bevel"]

    top_start = roof_height_local(AUDITORIUM_START, -0.2) - 0.12
    top_end = roof_height_local(AUDITORIUM_END, -0.2) - 0.12
    add_sloped_prism(
        "Auditorium_Upper",
        AUDITORIUM_START,
        AUDITORIUM_END,
        AUDITORIUM_UPPER_BASE,
        top_start,
        top_end,
        -0.46,
        0.24,
        materials["silver"],
        collection,
        root,
        bevel,
    )
    lower_width = CEDAR_START - AUDITORIUM_START + 0.35
    lower_centre = AUDITORIUM_START + lower_width / 2
    add_box(
        "Auditorium_Lower",
        (lower_width, AUDITORIUM_UPPER_BASE, 0.70),
        (lower_centre, AUDITORIUM_UPPER_BASE / 2, -0.10),
        materials["concrete"],
        collection,
        root,
        bevel,
    )

    if detail["corrugation"] is not None:
        count = max(8, math.ceil(AUDITORIUM_WIDTH / detail["corrugation"]))
        for index in range(count):
            x = AUDITORIUM_START + (index + 0.5) * AUDITORIUM_WIDTH / count
            rib_top = roof_height_local(x, -0.42) - 0.18
            rib_height = max(0.2, rib_top - AUDITORIUM_UPPER_BASE)
            add_box(
                f"Auditorium_Rib_{index:02d}",
                (0.055 if lod == "high" else 0.08, rib_height, 0.055),
                (x, AUDITORIUM_UPPER_BASE + rib_height / 2, -0.485),
                materials["silver"],
                collection,
                root,
            )

    window_start = CEDAR_START - 5.2
    window_end = CEDAR_START - 0.2
    window_count = 3 if lod != "low" else 1
    for index in range(window_count):
        width = (window_end - window_start) / window_count - (0.16 if window_count > 1 else 0.0)
        x = window_start + (index + 0.5) * (window_end - window_start) / window_count
        add_box(
            f"Auditorium_Window_{index}",
            (width, 1.62, 0.10),
            (x, 1.28, -0.51),
            materials["glass"],
            collection,
            root,
            bevel / 2,
        )

    add_box(
        "Cedar_LeftPier",
        (LEFT_CEDAR_WIDTH, TIMBER_ENTRANCE_HEIGHT, 0.24),
        ((CEDAR_START + RECESS_START) / 2, TIMBER_ENTRANCE_HEIGHT / 2, -CEDAR_PROJECTION),
        materials["cedar_light"],
        collection,
        root,
        bevel,
    )
    add_box(
        "Cedar_RightPier",
        (RIGHT_CEDAR_WIDTH, TIMBER_ENTRANCE_HEIGHT, 0.24),
        ((RECESS_END + CEDAR_END) / 2, TIMBER_ENTRANCE_HEIGHT / 2, -CEDAR_PROJECTION),
        materials["cedar_light"],
        collection,
        root,
        bevel,
    )
    add_box(
        "Cedar_Header",
        (RECESS_WIDTH, CEDAR_SPANDREL_HEIGHT, 0.24),
        (RECESS_CENTRE, RECESS_HEIGHT + CEDAR_SPANDREL_HEIGHT / 2, -CEDAR_PROJECTION),
        materials["cedar_light"],
        collection,
        root,
        bevel,
    )
    add_box(
        "Cedar_Canopy",
        (CEDAR_WIDTH, 0.22, CEDAR_PROJECTION),
        (CEDAR_CENTRE, TIMBER_ENTRANCE_HEIGHT - 0.07, -CEDAR_PROJECTION / 2),
        materials["cedar_dark"],
        collection,
        root,
        bevel,
    )
    for x, label in ((CEDAR_START, "Left"), (CEDAR_END, "Right")):
        add_box(
            f"Cedar_{label}Return",
            (0.22, TIMBER_ENTRANCE_HEIGHT, CEDAR_PROJECTION),
            (x, TIMBER_ENTRANCE_HEIGHT / 2, -CEDAR_PROJECTION / 2),
            materials["cedar_dark"],
            collection,
            root,
            bevel,
        )

    if detail["cedar"] is not None:
        cedar_sections = [
            (CEDAR_START, RECESS_START, TIMBER_ENTRANCE_HEIGHT, TIMBER_ENTRANCE_HEIGHT / 2, "Left"),
            (RECESS_END, CEDAR_END, TIMBER_ENTRANCE_HEIGHT, TIMBER_ENTRANCE_HEIGHT / 2, "Right"),
        ]
        for section_start, section_end, height, centre_y, label in cedar_sections:
            count = max(1, math.ceil((section_end - section_start) / detail["cedar"]))
            for index in range(count):
                x = section_start + (index + 0.5) * (section_end - section_start) / count
                material = materials["cedar_dark"] if index % 3 == 0 else materials["cedar_light"]
                add_box(
                    f"Cedar_{label}Joint_{index:02d}",
                    (0.035 if lod == "high" else 0.055, height - 0.08, 0.04),
                    (x, centre_y, CEDAR_FRONT_Z - 0.06),
                    material,
                    collection,
                    root,
                )
        header_count = max(4, math.ceil(RECESS_WIDTH / detail["cedar"]))
        for index in range(header_count):
            x = RECESS_START + (index + 0.5) * RECESS_WIDTH / header_count
            material = materials["cedar_dark"] if index % 4 == 0 else materials["cedar_light"]
            add_box(
                f"Cedar_HeaderJoint_{index:02d}",
                (0.035 if lod == "high" else 0.055, CEDAR_SPANDREL_HEIGHT - 0.08, 0.04),
                (x, RECESS_HEIGHT + CEDAR_SPANDREL_HEIGHT / 2, CEDAR_FRONT_Z - 0.06),
                material,
                collection,
                root,
            )

    for x, label in ((RECESS_START + 0.09, "Left"), (RECESS_END - 0.09, "Right")):
        add_box(
            f"Portal_{label}Jamb",
            (0.18, RECESS_HEIGHT, PORTAL_DEPTH),
            (x, RECESS_HEIGHT / 2, PORTAL_CENTRE_Z),
            materials["cedar_dark"],
            collection,
            root,
            bevel / 2,
        )
    add_box(
        "Portal_Soffit",
        (RECESS_WIDTH - 0.18, 0.18, PORTAL_DEPTH),
        (RECESS_CENTRE, RECESS_HEIGHT + 0.09, PORTAL_CENTRE_Z),
        materials["charcoal"],
        collection,
        root,
        bevel / 2,
    )
    add_box(
        "Portal_Threshold",
        (RECESS_WIDTH - 0.18, 0.08, PORTAL_DEPTH),
        (RECESS_CENTRE, 0.04, PORTAL_CENTRE_Z),
        materials["concrete"],
        collection,
        root,
    )
    if detail["small"]:
        for index, ratio in enumerate((-0.34, 0.0, 0.34)):
            add_cylinder(
                f"Portal_Downlight_{index}",
                0.055,
                0.018,
                (RECESS_CENTRE + RECESS_WIDTH * ratio, RECESS_HEIGHT - 0.012, PORTAL_CENTRE_Z),
                materials["warm_light"],
                collection,
                root,
                16,
            )

    add_box(
        "Fixed_Glass",
        (FIXED_GLASS_WIDTH - 0.08, RECESS_HEIGHT - 0.16, 0.12),
        (RECESS_START + FIXED_GLASS_WIDTH / 2, RECESS_HEIGHT / 2, DOOR_PANEL_Z),
        materials["glass"],
        collection,
        root,
        bevel / 2,
    )
    add_box(
        "Ribbed_Wall",
        (RIBBED_WALL_WIDTH, RECESS_HEIGHT, 0.16),
        (RECESS_START + FIXED_GLASS_WIDTH + RIBBED_WALL_WIDTH / 2, RECESS_HEIGHT / 2, REAR_PANEL_Z),
        materials["charcoal"],
        collection,
        root,
        bevel / 2,
    )
    door_count = DOOR_PANEL_COUNT if lod != "low" else 1
    for index in range(door_count):
        width = DOOR_BANK_WIDTH / door_count
        x = DOOR_BANK_START + (index + 0.5) * width
        add_box(
            f"Door_Glass_{index}",
            (width - (0.075 if door_count > 1 else 0.10), RECESS_HEIGHT - 0.16, 0.12),
            (x, RECESS_HEIGHT / 2, DOOR_PANEL_Z),
            materials["glass"],
            collection,
            root,
            bevel / 2,
        )
    add_box(
        "Door_WhitePier",
        (WHITE_PIER_WIDTH, RECESS_HEIGHT, 0.16),
        ((WHITE_PIER_START + WHITE_PIER_END) / 2, RECESS_HEIGHT / 2, REAR_PANEL_Z),
        materials["white"],
        collection,
        root,
        bevel / 2,
    )
    add_box(
        "Door_DarkReturn",
        (DARK_RETURN_WIDTH, RECESS_HEIGHT, 0.16),
        (DARK_RETURN_CENTRE, RECESS_HEIGHT / 2, REAR_PANEL_Z),
        materials["charcoal"],
        collection,
        root,
        bevel / 2,
    )

    if detail["frames"]:
        frame_width = 0.07 if lod == "high" else 0.10
        frame_depth = 0.16
        fixed_frame_xs = [
            RECESS_START + frame_width / 2,
            RECESS_START + FIXED_GLASS_WIDTH - frame_width / 2,
        ]
        door_frame_xs = [
            DOOR_BANK_START + frame_width / 2,
            *[
                DOOR_BANK_START + (index + 1) * ENTRANCE_DOOR_WIDTH
                for index in range(DOOR_PANEL_COUNT - 1)
            ],
            DOOR_BANK_END - frame_width / 2,
        ]
        for index, x in enumerate(fixed_frame_xs + door_frame_xs):
            add_box(
                f"Door_FrameVertical_{index}",
                (frame_width, RECESS_HEIGHT - frame_width * 2, frame_depth),
                (x, RECESS_HEIGHT / 2, DOOR_FRAME_Z),
                materials["charcoal"],
                collection,
                root,
                bevel / 3,
            )
        for index, x in enumerate((RECESS_START + FIXED_GLASS_WIDTH / 2, DOOR_BANK_CENTRE)):
            width = FIXED_GLASS_WIDTH if index == 0 else DOOR_BANK_WIDTH
            for rail_y in (frame_width / 2, RECESS_HEIGHT - frame_width / 2):
                add_box(
                    f"Door_FrameRail_{index}_{rail_y:.2f}",
                    (width, frame_width, frame_depth),
                    (x, rail_y, DOOR_FRAME_Z),
                    materials["charcoal"],
                    collection,
                    root,
                    bevel / 3,
                )
        if detail["small"]:
            for boundary in (1, 3):
                for offset in (-0.11, 0.11):
                    add_box(
                        f"Door_Handle_{boundary}_{offset}",
                        (0.035, 0.62, 0.045),
                        (DOOR_BANK_START + boundary * ENTRANCE_DOOR_WIDTH + offset, 1.24, DOOR_HANDLE_Z),
                        materials["silver"],
                        collection,
                        root,
                        bevel / 4,
                    )

    louvre_width = FOYER_START - AUDITORIUM_END
    louvre_centre = (AUDITORIUM_END + FOYER_START) / 2
    louvre_top = roof_height_local(louvre_centre, -0.05) - 0.12
    louvre_backing_height = max(0.2, louvre_top - RECESS_HEIGHT)
    add_box(
        "Entry_LouvreBacking",
        (louvre_width, louvre_backing_height, 0.70),
        (louvre_centre, RECESS_HEIGHT + louvre_backing_height / 2, -0.05),
        materials["charcoal"],
        collection,
        root,
        bevel,
    )
    louvre_count = 5 if lod == "high" else 3 if lod == "medium" else 1
    for index in range(louvre_count):
        y = 4.08 + index * (1.12 / max(1, louvre_count - 1))
        add_box(
            f"Entry_Louvre_{index}",
            (louvre_width, 0.08 if lod != "low" else 0.24, 0.20),
            (louvre_centre, y, -0.64),
            materials["silver"],
            collection,
            root,
            bevel / 3,
        )

    lower_glass_z = -0.20
    add_box(
        "Foyer_LowerGlass",
        (FOYER_GLASS_WIDTH, LOWER_FOYER_GLASS_HEIGHT, 0.16),
        (FOYER_GLASS_CENTRE, LOWER_FOYER_GLASS_HEIGHT / 2, lower_glass_z),
        materials["glass"],
        collection,
        root,
        bevel / 2,
    )
    add_box(
        "Foyer_DarkBand",
        (FOYER_GLASS_WIDTH, FOYER_BAND_HEIGHT, 0.20),
        (FOYER_GLASS_CENTRE, LOWER_FOYER_GLASS_HEIGHT + FOYER_BAND_HEIGHT / 2, -0.21),
        materials["charcoal"],
        collection,
        root,
        bevel / 2,
    )
    add_box(
        "Foyer_UpperGlass",
        (FOYER_GLASS_WIDTH, UPPER_FOYER_GLASS_HEIGHT, 0.16),
        (
            FOYER_GLASS_CENTRE,
            LOWER_FOYER_GLASS_HEIGHT + FOYER_BAND_HEIGHT + UPPER_FOYER_GLASS_HEIGHT / 2,
            lower_glass_z,
        ),
        materials["glass"],
        collection,
        root,
        bevel / 2,
    )
    add_box(
        "Foyer_WhiteWall",
        (FOYER_WHITE_WIDTH, FOYER_HEIGHT, 0.38),
        (FOYER_WHITE_CENTRE, FOYER_HEIGHT / 2, -0.14),
        materials["white"],
        collection,
        root,
        bevel,
    )
    add_box(
        "Foyer_TopFrame",
        (FOYER_WIDTH, 0.44, 0.36),
        (FOYER_CENTRE, FOYER_HEIGHT - 0.22, -0.14),
        materials["white"],
        collection,
        root,
        bevel,
    )
    if detail["frames"]:
        mullion_count = 5 if lod == "high" else 3
        for index in range(mullion_count):
            ratio = index / (mullion_count - 1)
            add_box(
                f"Foyer_Mullion_{index}",
                (0.09 if lod == "high" else 0.13, FOYER_HEIGHT - 0.5, 0.15),
                (FOYER_GLASS_START + FOYER_GLASS_WIDTH * ratio, FOYER_HEIGHT / 2, -0.39),
                materials["charcoal"],
                collection,
                root,
                bevel / 3,
            )
        for index, y in enumerate(
            (LOWER_FOYER_GLASS_HEIGHT, LOWER_FOYER_GLASS_HEIGHT + FOYER_BAND_HEIGHT)
        ):
            add_box(
                f"Foyer_Transom_{index}",
                (FOYER_GLASS_WIDTH, 0.09, 0.15),
                (FOYER_GLASS_CENTRE, y, -0.39),
                materials["charcoal"],
                collection,
                root,
                bevel / 3,
            )

    add_photo_backed_foyer(collection, root, lod, materials)

    apron_start = RECESS_START - 1.2
    apron_end = FOYER_END + 0.6
    add_box(
        "Entrance_Apron",
        (apron_end - apron_start, 0.08, 4.5),
        ((apron_start + apron_end) / 2, 0.04, -4.45),
        materials["concrete"],
        collection,
        root,
        bevel / 2,
    )

    low_material_merge = None
    if lod == "low":
        low_material_merge = {
            material_name: materials["cedar_light"]
            for material_name in ATLAS_QUADRANTS
        }
        # The tiny interior fixture meshes remain visible but do not need a
        # dedicated emissive pass on the mobile silhouette LOD.
        low_material_merge["M_WarmLight"] = materials["white"]
    join_by_material(collection, f"Hero{lod.title()}", low_material_merge)
    root["materialBudget"] = 3 if lod == "low" else 8
    root["containsWalkableInterior"] = False
    root["interiorRepresentation"] = "photo-backed-shallow-foyer-v2"
    root["interiorDepthMetres"] = round(INTERIOR_DEPTH, 2)
    root["interiorPrimaryReference"] = "user-supplied-10-photo-set"
    root["interiorSecondaryReferences"] = (
        "Structex Chinese Church 2017; "
        "Alloyfold Abundant Life Church 2017; "
        "Leighs Construction Chinese Abundant Life Church 2017"
    )
    root["interiorVerifiedFunctions"] = (
        "auditorium; hall; meeting spaces; library; kitchen; parent room; community spaces"
    )
    root["interiorEventDressingPolicy"] = "temporary-runtime-layer-only"
    root["interiorDeferredUntilMeasured"] = "stairs; service window; corridor doors; auditorium connection"
    return root


def build_props(
    collection: bpy.types.Collection,
    materials: dict[str, bpy.types.Material],
) -> list[bpy.types.Object]:
    props: list[bpy.types.Object] = []

    welcome = add_empty("PROP_WelcomeBoard", collection)
    welcome["propId"] = "welcome-board"
    welcome["catalogPositionOnly"] = True
    add_box("WelcomeBoard_Face", (1.15, 0.82, 0.08), (0, 0.95, 0), materials["charcoal"], collection, welcome, 0.025)
    for x in (-0.46, 0.46):
        add_box("WelcomeBoard_Leg", (0.08, 1.25, 0.08), (x, 0.625, 0.02), materials["cedar_dark"], collection, welcome, 0.015)
    add_box("WelcomeBoard_Base", (1.25, 0.08, 0.42), (0, 0.04, 0.08), materials["cedar_dark"], collection, welcome, 0.015)
    welcome.location = to_blender((-5.0, 0, 0))
    props.append(welcome)

    cross = add_empty("PROP_WallCross", collection)
    cross["propId"] = "wall-cross"
    cross["catalogPositionOnly"] = True
    add_box("Cross_Vertical", (0.18, 2.4, 0.16), (0, 1.2, 0), materials["warm_light"], collection, cross, 0.02)
    add_box("Cross_Horizontal", (1.15, 0.18, 0.18), (0, 1.55, -0.01), materials["warm_light"], collection, cross, 0.02)
    cross.location = to_blender((-2.4, 0, 0))
    props.append(cross)

    sign = add_empty("PROP_WordmarkPlate", collection)
    sign["propId"] = "wordmark-plate"
    sign["requiresRuntimeLabel"] = True
    sign["catalogPositionOnly"] = True
    add_box("Wordmark_Plate", (2.8, 0.72, 0.08), (0, 0.36, 0), materials["white"], collection, sign, 0.025)
    add_box("Wordmark_Inset", (2.58, 0.50, 0.035), (0, 0.36, -0.055), materials["charcoal"], collection, sign, 0.015)
    sign.location = to_blender((0.5, 0, 0))
    props.append(sign)

    planter = add_empty("PROP_Planter", collection)
    planter["propId"] = "planter"
    planter["catalogPositionOnly"] = True
    add_box("Planter_Base", (1.8, 0.12, 0.72), (0, 0.06, 0), materials["concrete"], collection, planter, 0.025)
    for x in (-0.86, 0.86):
        add_box("Planter_End", (0.08, 0.38, 0.72), (x, 0.25, 0), materials["concrete"], collection, planter, 0.015)
    for z in (-0.32, 0.32):
        add_box("Planter_Side", (1.64, 0.38, 0.08), (0, 0.25, z), materials["concrete"], collection, planter, 0.015)
    add_box("Planter_Soil", (1.62, 0.10, 0.56), (0, 0.30, 0), materials["charcoal"], collection, planter)
    plant_offsets = (-0.60, -0.30, 0.0, 0.30, 0.60)
    for index, x in enumerate(plant_offsets):
        add_cone(
            f"Planter_Foliage_{index}",
            0.17,
            0.72 + (index % 2) * 0.18,
            (x, 0.68 + (index % 2) * 0.09, 0.03 * (-1 if index % 2 else 1)),
            materials["foliage"],
            collection,
            planter,
            7,
        )
    planter.location = to_blender((4.5, 0, 0))
    props.append(planter)

    bollard = add_empty("PROP_Bollard", collection)
    bollard["propId"] = "bollard"
    bollard["catalogPositionOnly"] = True
    add_cylinder("Bollard_Post", 0.09, 0.92, (0, 0.46, 0), materials["charcoal"], collection, bollard, 16)
    add_cylinder("Bollard_Cap", 0.11, 0.05, (0, 0.935, 0), materials["silver"], collection, bollard, 16)
    bollard.location = to_blender((7.0, 0, 0))
    props.append(bollard)

    rack = add_empty("PROP_BikeRack", collection)
    rack["propId"] = "bike-rack"
    rack["catalogPositionOnly"] = True
    for index, x in enumerate((-0.65, 0.0, 0.65)):
        add_box(f"BikeRack_Left_{index}", (0.06, 0.76, 0.06), (x - 0.23, 0.38, 0), materials["silver"], collection, rack, 0.015)
        add_box(f"BikeRack_Right_{index}", (0.06, 0.76, 0.06), (x + 0.23, 0.38, 0), materials["silver"], collection, rack, 0.015)
        add_box(f"BikeRack_Top_{index}", (0.52, 0.06, 0.06), (x, 0.76, 0), materials["silver"], collection, rack, 0.015)
    rack.location = to_blender((9.3, 0, 0))
    props.append(rack)

    for prop in props:
        original_location = prop.location.copy()
        prop.location = (0, 0, 0)
        join_prop_children_by_material(prop)
        prop.location = original_location
    return props


def select_collection(collection: bpy.types.Collection) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    roots = [obj for obj in collection.objects if obj.type == "EMPTY"]
    if roots:
        bpy.context.view_layer.objects.active = roots[0]


def export_collection(collection: bpy.types.Collection, output_path: Path) -> None:
    select_collection(collection)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    bpy.ops.object.select_all(action="DESELECT")


def add_preview_scene(
    preview_collection: bpy.types.Collection,
    high_collection: bpy.types.Collection,
    other_collections: list[bpy.types.Collection],
    materials: dict[str, bpy.types.Material],
) -> None:
    for collection in other_collections:
        collection.hide_render = True
    high_collection.hide_render = False

    preview_root = add_empty("PreviewOnly", preview_collection)
    add_box(
        "Preview_Ground",
        (70.0, 0.10, 45.0),
        (-10.0, -0.05, -8.0),
        materials["concrete"],
        preview_collection,
        preview_root,
    )

    bpy.ops.object.light_add(type="SUN", location=to_blender((-15.0, 18.0, -16.0)))
    sun = bpy.context.object
    sun.name = "Preview_Sun"
    sun.data.energy = 2.4
    sun.data.color = (1.0, 0.62, 0.32)
    sun.rotation_euler = (math.radians(38), 0, math.radians(-38))
    move_to_collection(sun, preview_collection)

    bpy.ops.object.light_add(type="AREA", location=to_blender((-7.0, 6.0, -9.0)))
    area = bpy.context.object
    area.name = "Preview_SkyFill"
    area.data.energy = 950
    area.data.shape = "DISK"
    area.data.size = 12
    area.data.color = (0.42, 0.61, 0.85)
    move_to_collection(area, preview_collection)

    bpy.ops.object.camera_add(location=to_blender((-27.0, 2.4, -20.0)))
    camera = bpy.context.object
    camera.name = "VC02_AcceptanceCamera"
    target = Vector(to_blender((-10.0, 2.3, -0.7)))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 43
    move_to_collection(camera, preview_collection)
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    # Cycles CPU rendering works in Windows background sessions where EEVEE may
    # fail to create a WGL context (for example in Codex's non-interactive PTY).
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("VC02_PreviewWorld")
    scene.world.color = (0.08, 0.12, 0.19)
    scene.view_settings.look = "AgX - Medium High Contrast"


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.scale_length = METRES_PER_UNIT

    for atlas_path in (BASE_COLOR_ATLAS, ORM_ATLAS, NORMAL_ATLAS):
        if not atlas_path.exists():
            raise FileNotFoundError(
                f"Missing VC-04 atlas {atlas_path}. Run prepare_vc04_texture_atlas.py first."
            )
    atlas_images = {
        "base_color": bpy.data.images.load(str(BASE_COLOR_ATLAS), check_existing=False),
        "orm": bpy.data.images.load(str(ORM_ATLAS), check_existing=False),
        "normal": bpy.data.images.load(str(NORMAL_ATLAS), check_existing=False),
    }
    atlas_images["base_color"].colorspace_settings.name = "sRGB"
    atlas_images["orm"].colorspace_settings.name = "Non-Color"
    atlas_images["normal"].colorspace_settings.name = "Non-Color"

    materials = {
        "cedar_light": create_material("M_CedarLight", (0.50, 0.25, 0.10, 1), 0.78),
        "cedar_dark": create_material("M_CedarDark", (0.25, 0.095, 0.035, 1), 0.86),
        "silver": create_material("M_SilverMetal", (0.53, 0.58, 0.60, 1), 0.38, 0.58),
        "charcoal": create_material("M_Charcoal", (0.035, 0.045, 0.05, 1), 0.52, 0.28),
        "glass": create_material("M_Glass", (0.16, 0.27, 0.30, 1), 0.16, 0.12, 0.18),
        "white": create_material("M_OffWhite", (0.82, 0.81, 0.76, 1), 0.72),
        "concrete": create_material("M_Concrete", (0.28, 0.28, 0.25, 1), 0.90),
        "warm_light": create_material(
            "M_WarmLight",
            (1.0, 0.64, 0.28, 1),
            0.34,
            emission_color=(1.0, 0.40, 0.08, 1),
            emission_strength=2.2,
        ),
        "foliage": create_material("M_Foliage", (0.13, 0.29, 0.15, 1), 0.90),
    }
    for material in materials.values():
        configure_atlas_material(material, atlas_images)

    collections: dict[str, bpy.types.Collection] = {}
    for name in ("ChurchHero_High", "ChurchHero_Medium", "ChurchHero_Low", "ChurchProps", "Preview"):
        collection = bpy.data.collections.new(name)
        scene.collection.children.link(collection)
        collections[name] = collection

    build_hero(collections["ChurchHero_High"], "high", materials)
    build_hero(collections["ChurchHero_Medium"], "medium", materials)
    build_hero(collections["ChurchHero_Low"], "low", materials)
    build_props(collections["ChurchProps"], materials)
    add_preview_scene(
        collections["Preview"],
        collections["ChurchHero_High"],
        [
            collections["ChurchHero_Medium"],
            collections["ChurchHero_Low"],
            collections["ChurchProps"],
        ],
        materials,
    )

    spec = bpy.data.texts.new("VC02_ASSET_SPEC.md")
    spec.write(
        "# Alife VC-02 asset source\n\n"
        "Generated from build_virtual_church_assets.py using the approved hero-target-v2.png.\n"
        "All dimensions are metres. Exported LOD roots share an identical local origin.\n"
        "VC-04 applies a shared base-color/ORM/normal atlas and Draco geometry compression.\n"
        "The photo-backed foyer is a shallow entrance view, not a walkable interior.\n"
        "Its primary reference is the user-supplied ten-photo set; Structex, Alloyfold\n"
        "and Leighs Construction same-site project galleries are secondary references.\n"
        "Flags and other event dressing remain a temporary runtime layer. Stairs, service-window\n"
        "placement, corridor doors and auditorium connections remain deferred until measured.\n"
    )

    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))
    export_collection(collections["ChurchHero_High"], ASSET_DIR / "church-hero.glb")
    export_collection(collections["ChurchHero_Medium"], ASSET_DIR / "church-hero-medium.glb")
    export_collection(collections["ChurchHero_Low"], ASSET_DIR / "church-hero-low.glb")
    export_collection(collections["ChurchProps"], ASSET_DIR / "church-props.glb")

    if not SKIP_PREVIEW:
        # Restore the source file and render only the high-detail collection.
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND))
        bpy.context.scene.render.filepath = str(PREVIEW_PATH)
        bpy.ops.render.render(write_still=True)
    print(f"VC02_SOURCE_BLEND={SOURCE_BLEND}")
    print(f"VC02_ASSET_DIR={ASSET_DIR}")
    print(f"VC02_PREVIEW={'SKIPPED' if SKIP_PREVIEW else PREVIEW_PATH}")


if __name__ == "__main__":
    main()
