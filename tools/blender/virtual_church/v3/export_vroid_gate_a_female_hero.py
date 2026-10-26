from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix
from bpy_extras.anim_utils import action_get_channelbag_for_slot


def script_args() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


args = script_args()
if len(args) != 4:
    raise SystemExit(
        "Usage: blender character.blend -b --python prepare_web_character.py -- "
        "<lod> <max-texture-size> <output.glb> <report.json>"
    )

lod = args[0]
max_texture_size = int(args[1])
output_path = Path(args[2]).resolve()
report_path = Path(args[3]).resolve()
if lod not in {"high", "medium", "low"}:
    raise ValueError(f"Unsupported LOD: {lod}")

scene = bpy.context.scene
scene.render.fps = 30
bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
rig = next((obj for obj in scene.objects if obj.type == "ARMATURE"), None)
if rig is None:
    raise RuntimeError("VRoid armature not found")
rig.name = "Armature"

bone_names = {
    "hips": "J_Bip_C_Hips",
    "spine": "J_Bip_C_Spine",
    "chest": "J_Bip_C_Chest",
    "upper_chest": "J_Bip_C_UpperChest",
    "neck": "J_Bip_C_Neck",
    "head": "J_Bip_C_Head",
    "left_upper_arm": "J_Bip_L_UpperArm",
    "right_upper_arm": "J_Bip_R_UpperArm",
    "left_lower_arm": "J_Bip_L_LowerArm",
    "right_lower_arm": "J_Bip_R_LowerArm",
    "left_upper_leg": "J_Bip_L_UpperLeg",
    "right_upper_leg": "J_Bip_R_UpperLeg",
    "left_lower_leg": "J_Bip_L_LowerLeg",
    "right_lower_leg": "J_Bip_R_LowerLeg",
    "left_foot": "J_Bip_L_Foot",
    "right_foot": "J_Bip_R_Foot",
    "left_toe": "J_Bip_L_ToeBase",
    "right_toe": "J_Bip_R_ToeBase",
}

# VRoid splits the ponytail and layered outfit across several independent
# spring-bone roots. motion-v6 keyed only two hair roots and the `_02` skirt
# layer, which left most of the visible silhouette rigid. Keep the compact pose
# vocabulary below, but expand each semantic control to every root that
# actually drives the same visual region. The four skirt suffixes correspond to
# the four overlapping outfit layers and must move together to avoid tearing.
bone_groups = {
    "hair_left": (
        "J_Sec_Hair1_02", "J_Sec_Hair1_04", "J_Sec_Hair1_05", "J_Sec_Hair1_09",
    ),
    "hair_right": (
        "J_Sec_Hair1_03", "J_Sec_Hair1_06", "J_Sec_Hair1_07", "J_Sec_Hair1_08",
    ),
    "hair_center": ("J_Sec_Hair1_01", "J_Sec_Hair1_10"),
    "skirt_front_left": tuple(f"J_Sec_L_SkirtFront0_0{index}" for index in range(1, 5)),
    "skirt_front_right": tuple(f"J_Sec_R_SkirtFront0_0{index}" for index in range(1, 5)),
    "skirt_back_left": tuple(f"J_Sec_L_SkirtBack0_0{index}" for index in range(1, 5)),
    "skirt_back_right": tuple(f"J_Sec_R_SkirtBack0_0{index}" for index in range(1, 5)),
    "skirt_side_left": tuple(f"J_Sec_L_SkirtSide0_0{index}" for index in range(1, 5)),
    "skirt_side_right": tuple(f"J_Sec_R_SkirtSide0_0{index}" for index in range(1, 5)),
}


def target_bone_names(key: str) -> tuple[str, ...]:
    if key in bone_groups:
        return bone_groups[key]
    return (bone_names[key],)


missing = [
    name
    for name in (*bone_names.values(), *(name for names in bone_groups.values() for name in names))
    if name not in rig.pose.bones
]
if missing:
    raise RuntimeError(f"Required VRoid bones missing: {missing}")


def reset_pose() -> None:
    for pose_bone in rig.pose.bones:
        pose_bone.matrix_basis.identity()
        pose_bone.rotation_mode = "QUATERNION"
    bpy.context.view_layer.update()


def rotate_global(bone_name: str, degrees: float, axis: str) -> None:
    pose_bone = rig.pose.bones[bone_name]
    pivot = Matrix.Translation(pose_bone.head)
    rotation = Matrix.Rotation(math.radians(degrees), 4, axis)
    pose_bone.matrix = pivot @ rotation @ pivot.inverted() @ pose_bone.matrix


def transform_commands(transform):
    if isinstance(transform, list):
        return transform
    return [transform]


def average_rotation_transforms(*transforms):
    samples: dict[str, list[float]] = {}
    for transform in transforms:
        if transform is None:
            continue
        for value, axis in transform_commands(transform):
            if axis == "LOCATION":
                continue
            samples.setdefault(axis, []).append(float(value))
    return [
        (sum(samples[axis]) / len(samples[axis]), axis)
        for axis in ("X", "Y", "Z")
        if axis in samples
    ]


def expand_secondary_pose_offsets(offsets: dict) -> dict:
    expanded = dict(offsets)
    derived_controls = {
        "hair_center": ("hair_left", "hair_right"),
        "skirt_side_left": ("skirt_front_left", "skirt_back_left"),
        "skirt_side_right": ("skirt_front_right", "skirt_back_right"),
    }
    for target, sources in derived_controls.items():
        if target in expanded:
            continue
        transform = average_rotation_transforms(*(expanded.get(source) for source in sources))
        if transform:
            expanded[target] = transform
    return expanded


def apply_pose(offsets: dict) -> None:
    reset_pose()
    for key, transform in offsets.items():
        if key in {
            "left_upper_arm",
            "right_upper_arm",
            "left_lower_arm",
            "right_lower_arm",
        }:
            continue
        for target_name in target_bone_names(key):
            for value, axis in transform_commands(transform):
                if axis == "LOCATION":
                    rig.pose.bones[target_name].location = value
                else:
                    rotate_global(target_name, value, axis)
    # VRoid's bind pose is a T-pose. Compose each clip-specific shoulder swing
    # and the shared arm drop into one matrix assignment. Separate assignments
    # can cause Blender's global-matrix conversion to export only the final
    # component, producing either a T-pose or motionless arms.
    for key, base_drop in (
        ("left_upper_arm", 78.0),
        ("right_upper_arm", -78.0),
    ):
        pose_bone = rig.pose.bones[bone_names[key]]
        rotation = Matrix.Rotation(math.radians(base_drop), 4, "Y")
        for value, axis in transform_commands(offsets.get(key, [])):
            if axis == "LOCATION":
                raise ValueError(f"Arm location animation is not supported: {key}")
            rotation = Matrix.Rotation(math.radians(value), 4, axis) @ rotation
        pivot = Matrix.Translation(pose_bone.head)
        pose_bone.matrix = pivot @ rotation @ pivot.inverted() @ pose_bone.matrix
    bpy.context.view_layer.update()
    # Lower-arm rotations must be evaluated after their upper-arm parents.
    # Applying an elbow rotation first and then replacing the parent matrix
    # leaves the exported forearm nearly straight, which was the main source
    # of the stiff Walk/Run silhouette.
    for key in ("left_lower_arm", "right_lower_arm"):
        for value, axis in transform_commands(offsets.get(key, [])):
            if axis == "LOCATION":
                raise ValueError(f"Arm location animation is not supported: {key}")
            rotate_global(bone_names[key], value, axis)
    bpy.context.view_layer.update()


def author_action(
    name: str,
    duration_seconds: float,
    poses: list[tuple[float, dict]],
    smooth_bone_keys: frozenset[str] = frozenset(),
) -> bpy.types.Action:
    poses = [
        (time_ratio, expand_secondary_pose_offsets(offsets))
        for time_ratio, offsets in poses
    ]
    action = bpy.data.actions.new(name=name)
    rig.animation_data_create()
    rig.animation_data.action = action
    # Python set iteration is process-randomized. Blender maps the order in
    # which these pose-bone channels are keyed into exported action samplers,
    # so iterating the set directly can produce different animation channel
    # layouts for High, Medium and Low when each LOD is exported in its own
    # Blender process. Sort once and use the same deterministic channel order
    # for every action and every LOD.
    keyed_names = tuple(sorted({
        bone_names["left_upper_arm"],
        bone_names["right_upper_arm"],
        *(target for _, offsets in poses for key in offsets for target in target_bone_names(key)),
    }))
    location_keyed_names = frozenset({
        target
        for _, offsets in poses
        for key, transform in offsets.items()
        for target in target_bone_names(key)
        if any(axis == "LOCATION" for _, axis in transform_commands(transform))
    })
    previous_quaternions = {}
    for time_ratio, offsets in poses:
        frame = duration_seconds * scene.render.fps * time_ratio
        apply_pose(offsets)
        for target in keyed_names:
            pose_bone = rig.pose.bones[target]
            previous = previous_quaternions.get(target)
            if previous is not None and pose_bone.rotation_quaternion.dot(previous) < 0:
                pose_bone.rotation_quaternion.negate()
            previous_quaternions[target] = pose_bone.rotation_quaternion.copy()
            pose_bone.keyframe_insert(
                data_path="rotation_quaternion",
                frame=frame,
                group=target,
            )
            if target in location_keyed_names:
                pose_bone.keyframe_insert(
                    data_path="location",
                    frame=frame,
                    group=target,
                )
    channelbag = action_get_channelbag_for_slot(action, rig.animation_data.action_slot)
    if channelbag is None:
        raise RuntimeError(f"Action {name} has no animation channel bag")
    smooth_bone_names = frozenset(
        target
        for key in smooth_bone_keys
        for target in target_bone_names(key)
    )
    interpolation = "MIXED_LINEAR_BEZIER" if smooth_bone_names else "LINEAR"
    for fcurve in channelbag.fcurves:
        use_smooth_curve = fcurve.group is not None and fcurve.group.name in smooth_bone_names
        for keyframe in fcurve.keyframe_points:
            if use_smooth_curve:
                keyframe.interpolation = "BEZIER"
                keyframe.handle_left_type = "AUTO_CLAMPED"
                keyframe.handle_right_type = "AUTO_CLAMPED"
            else:
                keyframe.interpolation = "LINEAR"
    action.use_frame_range = True
    action.frame_start = 0.0
    action.frame_end = duration_seconds * scene.render.fps
    action["alifeClipName"] = name
    action["alifeDurationSeconds"] = duration_seconds
    action["alifeKeyedBones"] = list(keyed_names)
    action["alifeInterpolation"] = interpolation
    return action


for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

actions = [
    author_action("Idle_A", 2.0, [
        (0.0, {}),
        (0.5, {"chest": (1.5, "X"), "head": (-1.0, "X")}),
        (1.0, {}),
    ]),
    author_action("Idle_B", 2.4, [
        (0.0, {}),
        (0.5, {"chest": (-2.5, "Y"), "head": (5.0, "Z"), "right_lower_arm": (-8.0, "X")}),
        (1.0, {}),
    ]),
    author_action("Walk", 1.0, [
        # A compact high-heel gait. Keep a softly bent support knee, recover the
        # swing foot close to the body, and avoid the long locked-leg silhouette
        # that made motion-v7 read like a hurried stilt walk.
        (0.0, {
            "hips": [((-0.01, 0.0, -0.014), "LOCATION"), (1.5, "Y"), (-1.5, "Z")],
            "spine": [(1.2, "X"), (0.8, "Y"), (1.2, "Z")], "chest": [(0.8, "X"), (-1.0, "Y"), (1.8, "Z")],
            "upper_chest": (-0.9, "Z"), "neck": (0.5, "Z"), "head": (-0.3, "Z"),
            "left_upper_leg": (-18.0, "X"), "left_lower_leg": (16.0, "X"), "left_foot": (5.0, "X"), "left_toe": (-2.0, "X"),
            "right_upper_leg": (12.0, "X"), "right_lower_leg": (32.0, "X"), "right_foot": (-5.0, "X"), "right_toe": (-5.0, "X"),
            "left_upper_arm": (11.0, "X"), "left_lower_arm": (-30.0, "X"), "right_upper_arm": (-10.0, "X"), "right_lower_arm": (32.0, "X"),
            "hair_left": [(-2.2, "X"), (1.2, "Z")], "hair_right": [(-1.8, "X"), (0.8, "Z")],
            "skirt_front_left": (-1.5, "X"), "skirt_front_right": (2.0, "X"), "skirt_back_left": (1.5, "X"), "skirt_back_right": (-2.0, "X"),
        }),
        (0.125, {
            "hips": [((-0.014, 0.0, -0.025), "LOCATION"), (1.1, "Y"), (-1.0, "Z")],
            "spine": [(1.3, "X"), (0.7, "Z")], "chest": [(0.9, "X"), (1.1, "Z")], "upper_chest": (-0.6, "Z"), "head": (-0.2, "Z"),
            "left_upper_leg": (-15.0, "X"), "left_lower_leg": (17.0, "X"), "left_foot": (-1.0, "X"), "left_toe": (0.0, "X"),
            "right_upper_leg": (8.0, "X"), "right_lower_leg": (42.0, "X"), "right_foot": (6.0, "X"), "right_toe": (-7.0, "X"),
            "left_upper_arm": (12.0, "X"), "left_lower_arm": (-25.0, "X"), "right_upper_arm": (-10.0, "X"), "right_lower_arm": (31.0, "X"),
            "hair_left": (-0.8, "X"), "hair_right": (-0.6, "X"), "skirt_front_right": (3.0, "X"), "skirt_back_right": (-2.6, "X"),
        }),
        (0.25, {
            "hips": [((0.0, 0.0, 0.003), "LOCATION"), (0.2, "Y")],
            "spine": [(1.1, "X"), (-0.3, "Z")], "chest": [(0.7, "X"), (-0.6, "Z")], "upper_chest": (0.4, "Z"), "neck": (-0.2, "Z"),
            "left_upper_leg": (-1.0, "X"), "left_lower_leg": (7.0, "X"), "left_foot": (-3.0, "X"), "left_toe": (2.0, "X"),
            "right_upper_leg": (-7.0, "X"), "right_lower_leg": (54.0, "X"), "right_foot": (10.0, "X"), "right_toe": (4.0, "X"),
            "left_upper_arm": (3.0, "X"), "left_lower_arm": (-18.0, "X"), "right_upper_arm": (-3.0, "X"), "right_lower_arm": (22.0, "X"),
            "hair_left": (1.3, "X"), "hair_right": (1.0, "X"), "skirt_front_right": (3.5, "X"), "skirt_back_right": (-3.0, "X"),
        }),
        (0.375, {
            "hips": [((0.009, 0.0, 0.01), "LOCATION"), (-1.0, "Y"), (1.1, "Z")],
            "spine": [(1.2, "X"), (-0.8, "Z")], "chest": [(0.8, "X"), (-1.2, "Z")], "upper_chest": (0.6, "Z"), "head": (0.2, "Z"),
            "left_upper_leg": (8.0, "X"), "left_lower_leg": (22.0, "X"), "left_foot": (-2.0, "X"), "left_toe": (3.0, "X"),
            "right_upper_leg": (-14.0, "X"), "right_lower_leg": (42.0, "X"), "right_foot": (8.0, "X"), "right_toe": (4.0, "X"),
            "left_upper_arm": (-10.0, "X"), "left_lower_arm": (30.0, "X"), "right_upper_arm": (12.0, "X"), "right_lower_arm": (-25.0, "X"),
            "hair_left": [(2.2, "X"), (-0.8, "Z")], "hair_right": [(1.8, "X"), (-1.2, "Z")], "skirt_front_left": (2.6, "X"), "skirt_back_left": (-2.6, "X"),
        }),
        (0.5, {
            "hips": [((0.01, 0.0, -0.014), "LOCATION"), (-1.5, "Y"), (1.5, "Z")],
            "spine": [(1.2, "X"), (-0.8, "Y"), (-1.2, "Z")], "chest": [(0.8, "X"), (1.0, "Y"), (-1.8, "Z")],
            "upper_chest": (0.9, "Z"), "neck": (-0.5, "Z"), "head": (0.3, "Z"),
            "left_upper_leg": (12.0, "X"), "left_lower_leg": (32.0, "X"), "left_foot": (-5.0, "X"), "left_toe": (-5.0, "X"),
            "right_upper_leg": (-18.0, "X"), "right_lower_leg": (16.0, "X"), "right_foot": (5.0, "X"), "right_toe": (-2.0, "X"),
            "left_upper_arm": (-10.0, "X"), "left_lower_arm": (32.0, "X"), "right_upper_arm": (11.0, "X"), "right_lower_arm": (-30.0, "X"),
            "hair_left": [(-1.8, "X"), (-0.8, "Z")], "hair_right": [(-2.2, "X"), (-1.2, "Z")],
            "skirt_front_left": (2.0, "X"), "skirt_front_right": (-1.5, "X"), "skirt_back_left": (-2.0, "X"), "skirt_back_right": (1.5, "X"),
        }),
        (0.625, {
            "hips": [((0.014, 0.0, -0.025), "LOCATION"), (-1.1, "Y"), (1.0, "Z")],
            "spine": [(1.3, "X"), (-0.7, "Z")], "chest": [(0.9, "X"), (-1.1, "Z")], "upper_chest": (0.6, "Z"), "head": (0.2, "Z"),
            "left_upper_leg": (8.0, "X"), "left_lower_leg": (42.0, "X"), "left_foot": (6.0, "X"), "left_toe": (-7.0, "X"),
            "right_upper_leg": (-15.0, "X"), "right_lower_leg": (17.0, "X"), "right_foot": (-1.0, "X"), "right_toe": (0.0, "X"),
            "left_upper_arm": (-10.0, "X"), "left_lower_arm": (31.0, "X"), "right_upper_arm": (12.0, "X"), "right_lower_arm": (-25.0, "X"),
            "hair_left": (-0.6, "X"), "hair_right": (-0.8, "X"), "skirt_front_left": (3.0, "X"), "skirt_back_left": (-2.6, "X"),
        }),
        (0.75, {
            "hips": [((0.0, 0.0, 0.003), "LOCATION"), (-0.2, "Y")],
            "spine": [(1.1, "X"), (0.3, "Z")], "chest": [(0.7, "X"), (0.6, "Z")], "upper_chest": (-0.4, "Z"), "neck": (0.2, "Z"),
            "left_upper_leg": (-7.0, "X"), "left_lower_leg": (54.0, "X"), "left_foot": (10.0, "X"), "left_toe": (4.0, "X"),
            "right_upper_leg": (-1.0, "X"), "right_lower_leg": (7.0, "X"), "right_foot": (-3.0, "X"), "right_toe": (2.0, "X"),
            "left_upper_arm": (-3.0, "X"), "left_lower_arm": (22.0, "X"), "right_upper_arm": (3.0, "X"), "right_lower_arm": (-18.0, "X"),
            "hair_left": (1.0, "X"), "hair_right": (1.3, "X"), "skirt_front_left": (3.5, "X"), "skirt_back_left": (-3.0, "X"),
        }),
        (0.875, {
            "hips": [((-0.009, 0.0, 0.01), "LOCATION"), (1.0, "Y"), (-1.1, "Z")],
            "spine": [(1.2, "X"), (0.8, "Z")], "chest": [(0.8, "X"), (1.2, "Z")], "upper_chest": (-0.6, "Z"), "head": (-0.2, "Z"),
            "left_upper_leg": (-14.0, "X"), "left_lower_leg": (42.0, "X"), "left_foot": (8.0, "X"), "left_toe": (4.0, "X"),
            "right_upper_leg": (8.0, "X"), "right_lower_leg": (22.0, "X"), "right_foot": (-2.0, "X"), "right_toe": (3.0, "X"),
            "left_upper_arm": (12.0, "X"), "left_lower_arm": (-25.0, "X"), "right_upper_arm": (-10.0, "X"), "right_lower_arm": (30.0, "X"),
            "hair_left": [(1.8, "X"), (1.2, "Z")], "hair_right": [(2.2, "X"), (0.8, "Z")], "skirt_front_right": (2.6, "X"), "skirt_back_right": (-2.6, "X"),
        }),
        (1.0, {
            "hips": [((-0.01, 0.0, -0.014), "LOCATION"), (1.5, "Y"), (-1.5, "Z")],
            "spine": [(1.2, "X"), (0.8, "Y"), (1.2, "Z")], "chest": [(0.8, "X"), (-1.0, "Y"), (1.8, "Z")],
            "upper_chest": (-0.9, "Z"), "neck": (0.5, "Z"), "head": (-0.3, "Z"),
            "left_upper_leg": (-18.0, "X"), "left_lower_leg": (16.0, "X"), "left_foot": (5.0, "X"), "left_toe": (-2.0, "X"),
            "right_upper_leg": (12.0, "X"), "right_lower_leg": (32.0, "X"), "right_foot": (-5.0, "X"), "right_toe": (-5.0, "X"),
            "left_upper_arm": (11.0, "X"), "left_lower_arm": (-30.0, "X"), "right_upper_arm": (-10.0, "X"), "right_lower_arm": (32.0, "X"),
            "hair_left": [(-2.2, "X"), (1.2, "Z")], "hair_right": [(-1.8, "X"), (0.8, "Z")],
            "skirt_front_left": (-1.5, "X"), "skirt_front_right": (2.0, "X"), "skirt_back_left": (1.5, "X"), "skirt_back_right": (-2.0, "X"),
        }),
    ], frozenset({
        "spine", "chest", "upper_chest", "neck", "head",
        "left_upper_arm", "right_upper_arm", "left_lower_arm", "right_lower_arm",
        "hair_left", "hair_right", "skirt_front_left", "skirt_front_right",
        "skirt_back_left", "skirt_back_right",
    })),
    author_action("Run", 0.8, [
        # Run is a separate performance from Walk: shorter stride, stronger
        # compression and flight, recovered heels, and compact bent arms that
        # stay close to the torso instead of stretching into a wide windmill.
        (0.0, {
            "hips": [((-0.009, 0.0, -0.025), "LOCATION"), (1.8, "Y"), (-2.3, "Z")],
            "spine": [(4.8, "X"), (1.2, "Z")], "chest": [(6.2, "X"), (2.0, "Z")], "upper_chest": [(1.7, "X"), (-0.9, "Z")], "neck": (-2.2, "X"), "head": (-1.7, "X"),
            "left_upper_leg": (-24.0, "X"), "left_lower_leg": (32.0, "X"), "left_foot": (5.0, "X"), "left_toe": (-2.0, "X"),
            "right_upper_leg": (14.0, "X"), "right_lower_leg": (66.0, "X"), "right_foot": (-4.0, "X"), "right_toe": (-8.0, "X"),
            "left_upper_arm": (19.0, "X"), "left_lower_arm": (-66.0, "X"), "right_upper_arm": (-17.0, "X"), "right_lower_arm": (64.0, "X"),
            "hair_left": [(-5.0, "X"), (2.0, "Z")], "hair_right": [(-4.5, "X"), (1.7, "Z")],
            "skirt_front_left": (-3.5, "X"), "skirt_front_right": (5.0, "X"), "skirt_back_left": (4.5, "X"), "skirt_back_right": (-4.5, "X"),
        }),
        (0.125, {
            "hips": [((-0.013, 0.0, -0.048), "LOCATION"), (1.3, "Y"), (-1.6, "Z")],
            "spine": (5.2, "X"), "chest": [(6.6, "X"), (1.2, "Z")], "upper_chest": (2.0, "X"), "neck": (-2.4, "X"), "head": (-2.0, "X"),
            "left_upper_leg": (-16.0, "X"), "left_lower_leg": (46.0, "X"), "left_foot": (-2.0, "X"), "left_toe": (0.0, "X"),
            "right_upper_leg": (8.0, "X"), "right_lower_leg": (76.0, "X"), "right_foot": (8.0, "X"), "right_toe": (-6.0, "X"),
            "left_upper_arm": (16.0, "X"), "left_lower_arm": (-68.0, "X"), "right_upper_arm": (-14.0, "X"), "right_lower_arm": (66.0, "X"),
            "hair_left": (-2.5, "X"), "hair_right": (-2.0, "X"), "skirt_front_right": (6.5, "X"), "skirt_back_right": (-6.0, "X"),
        }),
        (0.25, {
            "hips": [((0.0, 0.0, 0.038), "LOCATION"), (0.3, "Y")],
            "spine": (4.6, "X"), "chest": (5.8, "X"), "upper_chest": (1.7, "X"), "neck": (-1.8, "X"), "head": (-1.3, "X"),
            "left_upper_leg": (4.0, "X"), "left_lower_leg": (48.0, "X"), "left_foot": (-6.0, "X"), "left_toe": (6.0, "X"),
            "right_upper_leg": (-10.0, "X"), "right_lower_leg": (78.0, "X"), "right_foot": (10.0, "X"), "right_toe": (6.0, "X"),
            "left_upper_arm": (5.0, "X"), "left_lower_arm": (-64.0, "X"), "right_upper_arm": (-5.0, "X"), "right_lower_arm": (64.0, "X"),
            "hair_left": (3.5, "X"), "hair_right": (3.0, "X"), "skirt_front_right": (7.5, "X"), "skirt_back_right": (-7.0, "X"),
        }),
        (0.375, {
            "hips": [((0.008, 0.0, 0.064), "LOCATION"), (-1.2, "Y"), (1.6, "Z")],
            "spine": [(4.2, "X"), (-1.0, "Z")], "chest": [(5.5, "X"), (-1.6, "Z")], "upper_chest": [(1.4, "X"), (0.7, "Z")], "neck": (-1.5, "X"), "head": (-1.0, "X"),
            "left_upper_leg": (15.0, "X"), "left_lower_leg": (70.0, "X"), "left_foot": (-4.0, "X"), "left_toe": (6.0, "X"),
            "right_upper_leg": (-21.0, "X"), "right_lower_leg": (52.0, "X"), "right_foot": (8.0, "X"), "right_toe": (4.0, "X"),
            "left_upper_arm": (-16.0, "X"), "left_lower_arm": (66.0, "X"), "right_upper_arm": (18.0, "X"), "right_lower_arm": (-64.0, "X"),
            "hair_left": [(6.0, "X"), (-1.7, "Z")], "hair_right": [(6.5, "X"), (-2.1, "Z")], "skirt_front_left": (6.0, "X"), "skirt_back_left": (-6.0, "X"),
        }),
        (0.5, {
            "hips": [((0.009, 0.0, -0.025), "LOCATION"), (-1.8, "Y"), (2.3, "Z")],
            "spine": [(4.8, "X"), (-1.2, "Z")], "chest": [(6.2, "X"), (-2.0, "Z")], "upper_chest": [(1.7, "X"), (0.9, "Z")], "neck": (-2.2, "X"), "head": (-1.7, "X"),
            "left_upper_leg": (14.0, "X"), "left_lower_leg": (66.0, "X"), "left_foot": (-4.0, "X"), "left_toe": (-8.0, "X"),
            "right_upper_leg": (-24.0, "X"), "right_lower_leg": (32.0, "X"), "right_foot": (5.0, "X"), "right_toe": (-2.0, "X"),
            "left_upper_arm": (-17.0, "X"), "left_lower_arm": (64.0, "X"), "right_upper_arm": (19.0, "X"), "right_lower_arm": (-66.0, "X"),
            "hair_left": [(-4.5, "X"), (-1.7, "Z")], "hair_right": [(-5.0, "X"), (-2.0, "Z")],
            "skirt_front_left": (5.0, "X"), "skirt_front_right": (-3.5, "X"), "skirt_back_left": (-4.5, "X"), "skirt_back_right": (4.5, "X"),
        }),
        (0.625, {
            "hips": [((0.013, 0.0, -0.048), "LOCATION"), (-1.3, "Y"), (1.6, "Z")],
            "spine": (5.2, "X"), "chest": [(6.6, "X"), (-1.2, "Z")], "upper_chest": (2.0, "X"), "neck": (-2.4, "X"), "head": (-2.0, "X"),
            "left_upper_leg": (8.0, "X"), "left_lower_leg": (76.0, "X"), "left_foot": (8.0, "X"), "left_toe": (-6.0, "X"),
            "right_upper_leg": (-16.0, "X"), "right_lower_leg": (46.0, "X"), "right_foot": (-2.0, "X"), "right_toe": (0.0, "X"),
            "left_upper_arm": (-14.0, "X"), "left_lower_arm": (66.0, "X"), "right_upper_arm": (16.0, "X"), "right_lower_arm": (-68.0, "X"),
            "hair_left": (-2.0, "X"), "hair_right": (-2.5, "X"), "skirt_front_left": (6.5, "X"), "skirt_back_left": (-6.0, "X"),
        }),
        (0.75, {
            "hips": [((0.0, 0.0, 0.038), "LOCATION"), (-0.3, "Y")],
            "spine": (4.6, "X"), "chest": (5.8, "X"), "upper_chest": (1.7, "X"), "neck": (-1.8, "X"), "head": (-1.3, "X"),
            "left_upper_leg": (-10.0, "X"), "left_lower_leg": (78.0, "X"), "left_foot": (10.0, "X"), "left_toe": (6.0, "X"),
            "right_upper_leg": (4.0, "X"), "right_lower_leg": (48.0, "X"), "right_foot": (-6.0, "X"), "right_toe": (6.0, "X"),
            "left_upper_arm": (-5.0, "X"), "left_lower_arm": (64.0, "X"), "right_upper_arm": (5.0, "X"), "right_lower_arm": (-64.0, "X"),
            "hair_left": (3.0, "X"), "hair_right": (3.5, "X"), "skirt_front_left": (7.5, "X"), "skirt_back_left": (-7.0, "X"),
        }),
        (0.875, {
            "hips": [((-0.008, 0.0, 0.064), "LOCATION"), (1.2, "Y"), (-1.6, "Z")],
            "spine": [(4.2, "X"), (1.0, "Z")], "chest": [(5.5, "X"), (1.6, "Z")], "upper_chest": [(1.4, "X"), (-0.7, "Z")], "neck": (-1.5, "X"), "head": (-1.0, "X"),
            "left_upper_leg": (-21.0, "X"), "left_lower_leg": (52.0, "X"), "left_foot": (8.0, "X"), "left_toe": (4.0, "X"),
            "right_upper_leg": (15.0, "X"), "right_lower_leg": (70.0, "X"), "right_foot": (-4.0, "X"), "right_toe": (6.0, "X"),
            "left_upper_arm": (18.0, "X"), "left_lower_arm": (-64.0, "X"), "right_upper_arm": (-16.0, "X"), "right_lower_arm": (66.0, "X"),
            "hair_left": [(6.5, "X"), (2.1, "Z")], "hair_right": [(6.0, "X"), (1.7, "Z")], "skirt_front_right": (6.0, "X"), "skirt_back_right": (-6.0, "X"),
        }),
        (1.0, {
            "hips": [((-0.009, 0.0, -0.025), "LOCATION"), (1.8, "Y"), (-2.3, "Z")],
            "spine": [(4.8, "X"), (1.2, "Z")], "chest": [(6.2, "X"), (2.0, "Z")], "upper_chest": [(1.7, "X"), (-0.9, "Z")], "neck": (-2.2, "X"), "head": (-1.7, "X"),
            "left_upper_leg": (-24.0, "X"), "left_lower_leg": (32.0, "X"), "left_foot": (5.0, "X"), "left_toe": (-2.0, "X"),
            "right_upper_leg": (14.0, "X"), "right_lower_leg": (66.0, "X"), "right_foot": (-4.0, "X"), "right_toe": (-8.0, "X"),
            "left_upper_arm": (19.0, "X"), "left_lower_arm": (-66.0, "X"), "right_upper_arm": (-17.0, "X"), "right_lower_arm": (64.0, "X"),
            "hair_left": [(-5.0, "X"), (2.0, "Z")], "hair_right": [(-4.5, "X"), (1.7, "Z")],
            "skirt_front_left": (-3.5, "X"), "skirt_front_right": (5.0, "X"), "skirt_back_left": (4.5, "X"), "skirt_back_right": (-4.5, "X"),
        }),
    ], frozenset({
        "spine", "chest", "upper_chest", "neck", "head",
        "left_upper_arm", "right_upper_arm", "left_lower_arm", "right_lower_arm",
        "hair_left", "hair_right", "skirt_front_left", "skirt_front_right",
        "skirt_back_left", "skirt_back_right",
    })),
    author_action("Walk_Start", 0.36, [
        (0.0, {}),
        (0.28, {
            "hips": [((-0.008, 0.0, -0.014), "LOCATION"), (1.2, "Y"), (-1.2, "Z")],
            "spine": (1.8, "X"), "chest": [(3.0, "X"), (1.4, "Z")], "upper_chest": (-0.7, "Z"), "head": (-0.4, "X"),
            "left_upper_leg": (-7.0, "X"), "left_lower_leg": (11.0, "X"), "left_foot": (-3.0, "X"),
            "right_upper_leg": (4.0, "X"), "right_lower_leg": (9.0, "X"), "right_toe": (-4.0, "X"),
            "left_upper_arm": (5.0, "X"), "left_lower_arm": (-7.0, "X"), "right_upper_arm": (-4.0, "X"), "right_lower_arm": (11.0, "X"),
            "hair_left": (-1.0, "X"), "hair_right": (-0.8, "X"), "skirt_front_right": (2.0, "X"), "skirt_back_right": (-1.5, "X"),
        }),
        (0.64, {
            "hips": [((-0.014, 0.0, -0.008), "LOCATION"), (1.8, "Y"), (-2.2, "Z")],
            "spine": [(1.0, "Y"), (1.2, "Z")], "chest": [(1.0, "X"), (2.0, "Z")], "upper_chest": (-1.0, "Z"), "head": (-0.5, "Z"),
            "left_upper_leg": (-18.0, "X"), "left_lower_leg": (7.0, "X"), "left_foot": (7.0, "X"), "left_toe": (-3.0, "X"),
            "right_upper_leg": (13.0, "X"), "right_lower_leg": (19.0, "X"), "right_foot": (-6.0, "X"), "right_toe": (-6.0, "X"),
            "left_upper_arm": (12.0, "X"), "left_lower_arm": (-8.0, "X"), "right_upper_arm": (-10.0, "X"), "right_lower_arm": (14.0, "X"),
            "hair_left": [(-2.0, "X"), (1.0, "Z")], "hair_right": [(-1.5, "X"), (0.8, "Z")],
            "skirt_front_left": (-1.5, "X"), "skirt_front_right": (2.0, "X"), "skirt_back_left": (1.5, "X"), "skirt_back_right": (-2.0, "X"),
        }),
        (1.0, {
            "hips": [((-0.01, 0.0, -0.014), "LOCATION"), (1.5, "Y"), (-1.5, "Z")],
            "spine": [(1.2, "X"), (0.8, "Y"), (1.2, "Z")], "chest": [(0.8, "X"), (-1.0, "Y"), (1.8, "Z")],
            "upper_chest": (-0.9, "Z"), "neck": (0.5, "Z"), "head": (-0.3, "Z"),
            "left_upper_leg": (-18.0, "X"), "left_lower_leg": (16.0, "X"), "left_foot": (5.0, "X"), "left_toe": (-2.0, "X"),
            "right_upper_leg": (12.0, "X"), "right_lower_leg": (32.0, "X"), "right_foot": (-5.0, "X"), "right_toe": (-5.0, "X"),
            "left_upper_arm": (11.0, "X"), "left_lower_arm": (-30.0, "X"), "right_upper_arm": (-10.0, "X"), "right_lower_arm": (32.0, "X"),
            "hair_left": [(-2.2, "X"), (1.2, "Z")], "hair_right": [(-1.8, "X"), (0.8, "Z")],
            "skirt_front_left": (-1.5, "X"), "skirt_front_right": (2.0, "X"), "skirt_back_left": (1.5, "X"), "skirt_back_right": (-2.0, "X"),
        }),
    ]),
    author_action("Walk_Stop", 0.32, [
        (0.0, {
            "hips": [((-0.01, 0.0, -0.014), "LOCATION"), (1.5, "Y"), (-1.5, "Z")],
            "spine": [(1.2, "X"), (0.8, "Y"), (1.2, "Z")], "chest": [(0.8, "X"), (-1.0, "Y"), (1.8, "Z")],
            "upper_chest": (-0.9, "Z"), "neck": (0.5, "Z"), "head": (-0.3, "Z"),
            "left_upper_leg": (-18.0, "X"), "left_lower_leg": (16.0, "X"), "left_foot": (5.0, "X"), "left_toe": (-2.0, "X"),
            "right_upper_leg": (12.0, "X"), "right_lower_leg": (32.0, "X"), "right_foot": (-5.0, "X"), "right_toe": (-5.0, "X"),
            "left_upper_arm": (11.0, "X"), "left_lower_arm": (-30.0, "X"), "right_upper_arm": (-10.0, "X"), "right_lower_arm": (32.0, "X"),
            "hair_left": [(-2.2, "X"), (1.2, "Z")], "hair_right": [(-1.8, "X"), (0.8, "Z")],
            "skirt_front_left": (-1.5, "X"), "skirt_front_right": (2.0, "X"), "skirt_back_left": (1.5, "X"), "skirt_back_right": (-2.0, "X"),
        }),
        (0.46, {
            "hips": [((0.008, 0.0, -0.018), "LOCATION"), (-1.0, "Y"), (1.4, "Z")],
            "spine": (-1.5, "X"), "chest": [(-2.5, "X"), (-1.8, "Z")], "upper_chest": (0.8, "Z"), "head": (0.4, "X"),
            "left_upper_leg": (8.0, "X"), "left_lower_leg": (20.0, "X"), "left_foot": (-7.0, "X"),
            "right_upper_leg": (-12.0, "X"), "right_lower_leg": (16.0, "X"), "right_foot": (6.0, "X"), "right_toe": (3.0, "X"),
            "left_upper_arm": (-7.0, "X"), "left_lower_arm": (12.0, "X"), "right_upper_arm": (8.0, "X"), "right_lower_arm": (-10.0, "X"),
            "hair_left": (2.0, "X"), "hair_right": (1.7, "X"), "skirt_front_left": (2.5, "X"), "skirt_back_left": (-2.0, "X"),
        }),
        (0.78, {
            "hips": [((0.004, 0.0, -0.008), "LOCATION"), (-0.5, "Y"), (0.6, "Z")],
            "chest": (-1.0, "X"), "left_upper_leg": (2.0, "X"), "right_upper_leg": (-3.0, "X"),
            "left_lower_leg": (7.0, "X"), "right_lower_leg": (7.0, "X"), "left_upper_arm": (-2.0, "X"), "right_upper_arm": (2.0, "X"),
            "hair_left": (0.8, "X"), "hair_right": (0.7, "X"),
        }),
        (1.0, {}),
    ]),
    author_action("Run_Start", 0.3, [
        (0.0, {}),
        (0.24, {
            "hips": [((0.0, 0.0, -0.025), "LOCATION"), (1.0, "Y")],
            "spine": (4.0, "X"), "chest": (7.0, "X"), "upper_chest": (2.0, "X"), "neck": (-1.5, "X"), "head": (-1.0, "X"),
            "left_upper_leg": (-10.0, "X"), "left_lower_leg": (18.0, "X"), "right_upper_leg": (5.0, "X"), "right_lower_leg": (16.0, "X"),
            "left_upper_arm": (12.0, "X"), "left_lower_arm": (-22.0, "X"), "right_upper_arm": (-10.0, "X"), "right_lower_arm": (28.0, "X"),
            "hair_left": (-2.5, "X"), "hair_right": (-2.0, "X"), "skirt_front_right": (4.0, "X"), "skirt_back_right": (-4.0, "X"),
        }),
        (0.62, {
            "hips": [((-0.01, 0.0, -0.035), "LOCATION"), (2.0, "Y"), (-2.5, "Z")],
            "spine": [(5.0, "X"), (1.5, "Z")], "chest": [(8.0, "X"), (2.5, "Z")], "upper_chest": (3.0, "X"), "head": (-1.5, "X"),
            "left_upper_leg": (-27.0, "X"), "left_lower_leg": (20.0, "X"), "left_foot": (7.0, "X"),
            "right_upper_leg": (19.0, "X"), "right_lower_leg": (42.0, "X"), "right_foot": (-5.0, "X"), "right_toe": (-8.0, "X"),
            "left_upper_arm": (27.0, "X"), "left_lower_arm": (-31.0, "X"), "right_upper_arm": (-25.0, "X"), "right_lower_arm": (42.0, "X"),
            "hair_left": [(-4.5, "X"), (2.0, "Z")], "hair_right": [(-4.0, "X"), (1.5, "Z")],
            "skirt_front_left": (-3.0, "X"), "skirt_front_right": (5.0, "X"), "skirt_back_left": (4.0, "X"), "skirt_back_right": (-4.0, "X"),
        }),
        (1.0, {
            "hips": [((-0.009, 0.0, -0.025), "LOCATION"), (1.8, "Y"), (-2.3, "Z")],
            "spine": [(4.8, "X"), (1.2, "Z")], "chest": [(6.2, "X"), (2.0, "Z")], "upper_chest": [(1.7, "X"), (-0.9, "Z")], "neck": (-2.2, "X"), "head": (-1.7, "X"),
            "left_upper_leg": (-24.0, "X"), "left_lower_leg": (32.0, "X"), "left_foot": (5.0, "X"), "left_toe": (-2.0, "X"),
            "right_upper_leg": (14.0, "X"), "right_lower_leg": (66.0, "X"), "right_foot": (-4.0, "X"), "right_toe": (-8.0, "X"),
            "left_upper_arm": (19.0, "X"), "left_lower_arm": (-66.0, "X"), "right_upper_arm": (-17.0, "X"), "right_lower_arm": (64.0, "X"),
            "hair_left": [(-5.0, "X"), (2.0, "Z")], "hair_right": [(-4.5, "X"), (1.7, "Z")],
            "skirt_front_left": (-3.5, "X"), "skirt_front_right": (5.0, "X"), "skirt_back_left": (4.5, "X"), "skirt_back_right": (-4.5, "X"),
        }),
    ]),
    author_action("Run_Stop", 0.38, [
        (0.0, {
            "hips": [((-0.009, 0.0, -0.025), "LOCATION"), (1.8, "Y"), (-2.3, "Z")],
            "spine": [(4.8, "X"), (1.2, "Z")], "chest": [(6.2, "X"), (2.0, "Z")], "upper_chest": [(1.7, "X"), (-0.9, "Z")], "neck": (-2.2, "X"), "head": (-1.7, "X"),
            "left_upper_leg": (-24.0, "X"), "left_lower_leg": (32.0, "X"), "left_foot": (5.0, "X"), "left_toe": (-2.0, "X"),
            "right_upper_leg": (14.0, "X"), "right_lower_leg": (66.0, "X"), "right_foot": (-4.0, "X"), "right_toe": (-8.0, "X"),
            "left_upper_arm": (19.0, "X"), "left_lower_arm": (-66.0, "X"), "right_upper_arm": (-17.0, "X"), "right_lower_arm": (64.0, "X"),
            "hair_left": [(-5.0, "X"), (2.0, "Z")], "hair_right": [(-4.5, "X"), (1.7, "Z")],
            "skirt_front_left": (-3.5, "X"), "skirt_front_right": (5.0, "X"), "skirt_back_left": (4.5, "X"), "skirt_back_right": (-4.5, "X"),
        }),
        (0.38, {
            "hips": [((0.012, 0.0, -0.042), "LOCATION"), (-1.5, "Y"), (2.0, "Z")],
            "spine": (-1.5, "X"), "chest": [(-4.5, "X"), (-2.5, "Z")], "upper_chest": (-1.5, "X"), "neck": (1.0, "X"), "head": (1.5, "X"),
            "left_upper_leg": (11.0, "X"), "left_lower_leg": (31.0, "X"), "left_foot": (-8.0, "X"),
            "right_upper_leg": (-18.0, "X"), "right_lower_leg": (27.0, "X"), "right_foot": (9.0, "X"), "right_toe": (5.0, "X"),
            "left_upper_arm": (-18.0, "X"), "left_lower_arm": (31.0, "X"), "right_upper_arm": (20.0, "X"), "right_lower_arm": (-27.0, "X"),
            "hair_left": (7.0, "X"), "hair_right": (6.5, "X"), "skirt_front_left": (8.0, "X"), "skirt_back_left": (-7.0, "X"),
        }),
        (0.72, {
            "hips": [((0.005, 0.0, -0.012), "LOCATION"), (-0.6, "Y"), (0.8, "Z")],
            "spine": (-0.5, "X"), "chest": (-1.5, "X"), "left_upper_leg": (3.0, "X"), "right_upper_leg": (-5.0, "X"),
            "left_lower_leg": (10.0, "X"), "right_lower_leg": (11.0, "X"), "left_upper_arm": (-4.0, "X"), "right_upper_arm": (5.0, "X"),
            "hair_left": (2.0, "X"), "hair_right": (1.8, "X"),
        }),
        (1.0, {}),
    ]),
    author_action("Jump_Start", 0.28, [
        (0.0, {}),
        (1.0, {"left_upper_leg": (-13.0, "X"), "right_upper_leg": (-13.0, "X"), "left_lower_leg": (24.0, "X"), "right_lower_leg": (24.0, "X"), "chest": (7.0, "X")}),
    ]),
    author_action("Jump_Loop", 0.5, [
        (0.0, {"left_upper_leg": (-13.0, "X"), "right_upper_leg": (-13.0, "X"), "left_lower_leg": (24.0, "X"), "right_lower_leg": (24.0, "X"), "chest": (7.0, "X")}),
        (1.0, {"left_upper_leg": (-13.0, "X"), "right_upper_leg": (-13.0, "X"), "left_lower_leg": (24.0, "X"), "right_lower_leg": (24.0, "X"), "chest": (7.0, "X")}),
    ]),
    author_action("Jump_Land", 0.32, [
        (0.0, {"left_upper_leg": (-13.0, "X"), "right_upper_leg": (-13.0, "X"), "left_lower_leg": (24.0, "X"), "right_lower_leg": (24.0, "X"), "chest": (7.0, "X")}),
        (1.0, {}),
    ]),
    author_action("Turn_L", 0.8, [
        (0.0, {}),
        (0.18, {
            "hips": [((0.012, 0.0, -0.008), "LOCATION"), (-2.0, "Z")], "spine": (2.5, "Z"), "chest": (5.0, "Z"), "upper_chest": (2.0, "Z"), "neck": (3.0, "Z"), "head": (7.0, "Z"),
            "left_upper_leg": (3.0, "X"), "left_lower_leg": (7.0, "X"), "right_upper_leg": (-5.0, "X"), "right_lower_leg": (10.0, "X"), "right_foot": (4.0, "Z"),
            "left_upper_arm": (-4.0, "X"), "right_upper_arm": (5.0, "X"), "hair_left": (1.5, "Z"), "hair_right": (1.0, "Z"),
        }),
        (0.5, {
            "hips": [((-0.014, 0.0, -0.014), "LOCATION"), (5.0, "Z")], "spine": (6.0, "Z"), "chest": (12.0, "Z"), "upper_chest": (4.0, "Z"), "neck": (5.0, "Z"), "head": (16.0, "Z"),
            "left_upper_leg": (-9.0, "X"), "left_lower_leg": (16.0, "X"), "left_foot": (-7.0, "Z"), "left_toe": (5.0, "X"),
            "right_upper_leg": (7.0, "X"), "right_lower_leg": (19.0, "X"), "right_foot": (8.0, "Z"), "right_toe": (-5.0, "X"),
            "left_upper_arm": (8.0, "X"), "left_lower_arm": (12.0, "X"), "right_upper_arm": (-7.0, "X"), "right_lower_arm": (15.0, "X"),
            "hair_left": [(-2.0, "X"), (3.0, "Z")], "hair_right": [(-1.5, "X"), (2.5, "Z")],
            "skirt_front_left": (-2.5, "X"), "skirt_front_right": (3.0, "X"), "skirt_back_left": (2.0, "X"), "skirt_back_right": (-2.5, "X"),
        }),
        (0.82, {
            "hips": [((-0.005, 0.0, -0.004), "LOCATION"), (2.0, "Z")], "spine": (2.0, "Z"), "chest": (5.0, "Z"), "upper_chest": (1.5, "Z"), "head": (7.0, "Z"),
            "left_upper_leg": (-2.0, "X"), "left_lower_leg": (7.0, "X"), "right_upper_leg": (2.0, "X"), "right_lower_leg": (7.0, "X"),
            "left_upper_arm": (2.0, "X"), "right_upper_arm": (-2.0, "X"), "hair_left": (1.0, "Z"), "hair_right": (0.8, "Z"),
        }),
        (1.0, {}),
    ]),
    author_action("Turn_R", 0.8, [
        (0.0, {}),
        (0.18, {
            "hips": [((-0.012, 0.0, -0.008), "LOCATION"), (2.0, "Z")], "spine": (-2.5, "Z"), "chest": (-5.0, "Z"), "upper_chest": (-2.0, "Z"), "neck": (-3.0, "Z"), "head": (-7.0, "Z"),
            "left_upper_leg": (-5.0, "X"), "left_lower_leg": (10.0, "X"), "left_foot": (-4.0, "Z"), "right_upper_leg": (3.0, "X"), "right_lower_leg": (7.0, "X"),
            "left_upper_arm": (-5.0, "X"), "right_upper_arm": (4.0, "X"), "hair_left": (-1.0, "Z"), "hair_right": (-1.5, "Z"),
        }),
        (0.5, {
            "hips": [((0.014, 0.0, -0.014), "LOCATION"), (-5.0, "Z")], "spine": (-6.0, "Z"), "chest": (-12.0, "Z"), "upper_chest": (-4.0, "Z"), "neck": (-5.0, "Z"), "head": (-16.0, "Z"),
            "left_upper_leg": (7.0, "X"), "left_lower_leg": (19.0, "X"), "left_foot": (-8.0, "Z"), "left_toe": (-5.0, "X"),
            "right_upper_leg": (-9.0, "X"), "right_lower_leg": (16.0, "X"), "right_foot": (7.0, "Z"), "right_toe": (5.0, "X"),
            "left_upper_arm": (-7.0, "X"), "left_lower_arm": (15.0, "X"), "right_upper_arm": (8.0, "X"), "right_lower_arm": (12.0, "X"),
            "hair_left": [(-1.5, "X"), (-2.5, "Z")], "hair_right": [(-2.0, "X"), (-3.0, "Z")],
            "skirt_front_left": (3.0, "X"), "skirt_front_right": (-2.5, "X"), "skirt_back_left": (-2.5, "X"), "skirt_back_right": (2.0, "X"),
        }),
        (0.82, {
            "hips": [((0.005, 0.0, -0.004), "LOCATION"), (-2.0, "Z")], "spine": (-2.0, "Z"), "chest": (-5.0, "Z"), "upper_chest": (-1.5, "Z"), "head": (-7.0, "Z"),
            "left_upper_leg": (2.0, "X"), "left_lower_leg": (7.0, "X"), "right_upper_leg": (-2.0, "X"), "right_lower_leg": (7.0, "X"),
            "left_upper_arm": (-2.0, "X"), "right_upper_arm": (2.0, "X"), "hair_left": (-0.8, "Z"), "hair_right": (-1.0, "Z"),
        }),
        (1.0, {}),
    ]),
    author_action("Greet", 1.4, [
        (0.0, {}),
        (0.35, {"right_upper_arm": (62.0, "Y"), "right_lower_arm": (-20.0, "X"), "head": (-5.0, "Z")}),
        (0.55, {"right_upper_arm": (62.0, "Y"), "right_lower_arm": (13.0, "X"), "head": (-5.0, "Z")}),
        (0.75, {"right_upper_arm": (62.0, "Y"), "right_lower_arm": (-20.0, "X"), "head": (-5.0, "Z")}),
        (1.0, {}),
    ]),
]

# Keep the editor and exported default state on the friendly idle rather than T-pose.
rig.animation_data.action = bpy.data.actions["Idle_A"]
scene.frame_set(0)

if lod in {"medium", "low"}:
    ratios = {"medium": 0.72, "low": 0.46}
    for obj in [item for item in scene.objects if item.type == "MESH"]:
        if obj.data.shape_keys is not None:
            while obj.data.shape_keys is not None:
                obj.shape_key_remove(obj.data.shape_keys.key_blocks[-1])
        modifier = obj.modifiers.new(name=f"Alife {lod.title()} Decimate", type="DECIMATE")
        modifier.ratio = ratios[lod]
        modifier.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        finally:
            obj.select_set(False)

scaled_images: list[dict[str, object]] = []
for image in list(bpy.data.images):
    if image.name in {"Render Result", "Viewer Node", "Thumbnail"}:
        if image.users == 0 or image.name == "Thumbnail":
            bpy.data.images.remove(image)
        continue
    width, height = int(image.size[0]), int(image.size[1])
    if width <= 0 or height <= 0 or max(width, height) <= max_texture_size:
        continue
    factor = max_texture_size / max(width, height)
    resized = (max(8, round(width * factor)), max(8, round(height * factor)))
    image.scale(*resized)
    image.pack()
    scaled_images.append({"name": image.name, "from": [width, height], "to": list(resized)})

output_path.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output_path),
    export_format="GLB",
    use_selection=False,
    export_apply=False,
    export_materials="EXPORT",
    export_image_format="WEBP",
    export_image_add_webp=False,
    export_image_webp_fallback=False,
    export_jpeg_quality={"high": 76, "medium": 68, "low": 60}[lod],
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_merge_animation="ACTION",
    export_anim_single_armature=True,
    export_force_sampling=False,
    export_reset_pose_bones=False,
    export_nla_strips=False,
    export_optimize_animation_size=True,
    # Facial blend shapes add roughly two megabytes to this character. Keep the
    # authored face geometry, but omit inactive expression targets from the
    # first web release so the asset stays inside the critical-load budget.
    export_morph=False,
    export_morph_animation=False,
    # The church already requires Draco on first load, so the character can
    # reuse the same decoder without adding another request. Keep character
    # quantization above the church baseline because the face and silhouette
    # are reviewed at much closer distances than the building.
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=16,
    export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=14,
    export_draco_color_quantization=12,
    export_draco_generic_quantization=14,
    export_yup=True,
)

triangles = 0
mesh_count = 0
material_names: set[str] = set()
for obj in scene.objects:
    if obj.type != "MESH":
        continue
    mesh_count += 1
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
    material_names.update(slot.material.name for slot in obj.material_slots if slot.material)

report = {
    "lod": lod,
    "output": str(output_path),
    "bytes": output_path.stat().st_size,
    "triangles": triangles,
    "meshCount": mesh_count,
    "materials": len(material_names),
    "bones": len(rig.data.bones),
    "animations": [
        {
            "name": action.name,
            "durationSeconds": action["alifeDurationSeconds"],
            "keyedBones": list(action["alifeKeyedBones"]),
            "interpolation": action["alifeInterpolation"],
        }
        for action in actions
    ],
    "maxTextureSize": max_texture_size,
    "scaledImages": scaled_images,
    "textureFormat": "WebP",
    "draco": True,
    "dracoCompression": {
        "level": 7,
        "positionQuantizationBits": 16,
        "normalQuantizationBits": 12,
        "texcoordQuantizationBits": 14,
        "colorQuantizationBits": 12,
        "genericQuantizationBits": 14,
    },
}
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report))
