"""Inspect an external humanoid animation package without modifying it.

Run with Blender 4.5 LTS from the repository root:

    blender --background --python \
        tools/blender/virtual_church/v3/inspect_animation_source.py -- \
        --source <source.glb|source.gltf|source.fbx|source.blend> \
        --output <ignored-report.json>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import statistics
import sys
from pathlib import Path
from typing import Iterable

import bpy
from mathutils import Matrix, Vector


SUPPORTED_SUFFIXES = {".blend", ".fbx", ".glb", ".gltf"}
ROOT_NAME_HINTS = {"root", "hips", "hip", "pelvis"}
BONE_PATH = re.compile(r'^pose\.bones\["((?:[^"\\]|\\.)+)"\]')
SEMANTIC_ALIASES = {
    "root": ("root", "armatureroot"),
    "hips": ("hips", "hip", "pelvis", "jbipchips"),
    "spine": ("spine", "spine1", "jbipcspine"),
    "chest": ("chest", "spine2", "jbipcchest"),
    "upperChest": ("upperchest", "spine3", "jbipcupperchest"),
    "neck": ("neck", "jbipcneck"),
    "head": ("head", "jbipchead"),
    "leftShoulder": ("leftshoulder", "lshoulder", "jbiplshoulder"),
    "leftUpperArm": (
        "leftarm", "leftupperarm", "lupperarm", "jbiplupperarm",
    ),
    "leftLowerArm": (
        "leftforearm", "leftlowerarm", "llowerarm", "jbipllowerarm",
    ),
    "leftHand": ("lefthand", "lhand", "jbiplhand"),
    "rightShoulder": ("rightshoulder", "rshoulder", "jbiprshoulder"),
    "rightUpperArm": (
        "rightarm", "rightupperarm", "rupperarm", "jbiprupperarm",
    ),
    "rightLowerArm": (
        "rightforearm", "rightlowerarm", "rlowerarm", "jbiprlowerarm",
    ),
    "rightHand": ("righthand", "rhand", "jbiprhand"),
    "leftUpperLeg": (
        "leftupleg", "leftupperleg", "lupperleg", "leftthigh",
        "thighl", "jbiplupperleg",
    ),
    "leftLowerLeg": (
        "leftleg", "leftlowerleg", "llowerleg", "leftshin",
        "calfl", "jbipllowerleg",
    ),
    "leftFoot": ("leftfoot", "lfoot", "jbiplfoot"),
    "leftToes": ("lefttoes", "lefttoebase", "ltoes", "jbipltoebase"),
    "rightUpperLeg": (
        "rightupleg", "rightupperleg", "rupperleg", "rightthigh",
        "thighr", "jbiprupperleg",
    ),
    "rightLowerLeg": (
        "rightleg", "rightlowerleg", "rlowerleg", "rightshin",
        "calfr", "jbiprlowerleg",
    ),
    "rightFoot": ("rightfoot", "rfoot", "jbiprfoot"),
    "rightToes": (
        "righttoes", "righttoebase", "rtoes", "jbiprtoebase",
    ),
}
LOCOMOTION_CORE_SEMANTICS = {
    "hips", "spine", "chest", "head",
    "leftUpperArm", "leftLowerArm", "rightUpperArm", "rightLowerArm",
    "leftUpperLeg", "leftLowerLeg", "leftFoot",
    "rightUpperLeg", "rightLowerLeg", "rightFoot",
}


def script_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--reference-report",
        type=Path,
        help="Optional prior report whose first armature is the retarget target",
    )
    return parser.parse_args(
        sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def import_source(source: Path) -> None:
    suffix = source.suffix.lower()
    if suffix == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
        return

    bpy.ops.wm.read_factory_settings(use_empty=True)
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(
            filepath=str(source), automatic_bone_orientation=False
        )
    else:
        raise ValueError(f"Unsupported animation source: {source.suffix}")


def action_fcurves(action: bpy.types.Action) -> list[bpy.types.FCurve]:
    """Return both legacy and Blender 4.4+ layered-action F-curves."""

    curves: list[bpy.types.FCurve] = []
    legacy = getattr(action, "fcurves", None)
    if legacy is not None:
        curves.extend(list(legacy))
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for channel_bag in getattr(strip, "channelbags", []):
                curves.extend(list(getattr(channel_bag, "fcurves", [])))

    unique: list[bpy.types.FCurve] = []
    seen: set[int] = set()
    for curve in curves:
        pointer = curve.as_pointer()
        if pointer not in seen:
            seen.add(pointer)
            unique.append(curve)
    return unique


def path_bone_name(data_path: str) -> str | None:
    match = BONE_PATH.match(data_path)
    if not match:
        return None
    return bytes(match.group(1), "utf-8").decode("unicode_escape")


def action_bones(curves: Iterable[bpy.types.FCurve]) -> list[str]:
    return sorted(
        {
            name
            for curve in curves
            if (name := path_bone_name(curve.data_path)) is not None
        },
        key=str.casefold,
    )


def set_scene_frame(frame: float) -> None:
    whole = math.floor(frame)
    bpy.context.scene.frame_set(whole, subframe=frame - whole)
    bpy.context.view_layer.update()


def select_action_armature(
    armatures: list[bpy.types.Object], animated_bones: list[str]
) -> bpy.types.Object | None:
    animated = set(animated_bones)
    ranked = sorted(
        armatures,
        key=lambda item: len(animated.intersection(item.data.bones.keys())),
        reverse=True,
    )
    if not ranked:
        return None
    if animated and not animated.intersection(ranked[0].data.bones.keys()):
        return None
    return ranked[0]


def bind_action(armature: bpy.types.Object, action: bpy.types.Action) -> str | None:
    animation_data = armature.animation_data_create()
    animation_data.action = action
    slots = list(getattr(action, "slots", []))
    if slots and hasattr(animation_data, "action_slot"):
        for slot in slots:
            try:
                animation_data.action_slot = slot
                return getattr(slot, "name_display", None) or getattr(
                    slot, "identifier", None
                )
            except RuntimeError:
                continue
    return None


def candidate_root_bones(armature: bpy.types.Object) -> list[str]:
    roots = [bone.name for bone in armature.data.bones if bone.parent is None]
    hinted = [
        bone.name
        for bone in armature.data.bones
        if bone.name.casefold().split(":")[-1] in ROOT_NAME_HINTS
    ]
    return list(dict.fromkeys(roots + hinted))


def bone_positions(
    armature: bpy.types.Object, names: Iterable[str]
) -> dict[str, Vector]:
    return {
        name: world_point_m(armature, armature.pose.bones[name].matrix.translation)
        for name in names
        if name in armature.pose.bones
    }


def world_point_m(armature: bpy.types.Object, point: Vector) -> Vector:
    # FBX commonly keeps centimetres and Y-up inside the rig, while the object
    # transform supplies 0.01 scale and a 90-degree rotation. Never label those
    # local coordinates as metres or classify XY as the horizontal plane.
    return (armature.matrix_world @ point) * bpy.context.scene.unit_settings.scale_length


def rounded_vector(vector: Vector) -> list[float]:
    return [round(float(value), 6) for value in vector]


def cardinal_axis(vector: Vector) -> str:
    axis = max(range(3), key=lambda index: abs(vector[index]))
    return ("+" if vector[axis] >= 0.0 else "-") + "XYZ"[axis]


def normalized_bone_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.casefold())


def semantic_match_score(name: str, aliases: tuple[str, ...]) -> int:
    normalized = normalized_bone_name(name)
    best = 0
    for alias in aliases:
        if normalized == alias:
            best = max(best, 1000)
        elif normalized.endswith(alias):
            best = max(best, 750)
        elif alias in normalized:
            best = max(best, 500)
    if best and any(marker in normalized for marker in ("ctrl", "control", "ik", "roll", "end")):
        best -= 250
    return best


def semantic_bone_map(armature: bpy.types.Object) -> dict[str, dict[str, object]]:
    available = list(armature.data.bones)
    used: set[str] = set()
    mapping: dict[str, dict[str, object]] = {}
    for semantic, aliases in SEMANTIC_ALIASES.items():
        mixamo_spine = {"spine": "Spine", "chest": "Spine1", "upperChest": "Spine2"}.get(semantic)
        candidates = sorted(
            (
                ((1100 if bone.name.split(":")[-1] == mixamo_spine else 0)
                 if mixamo_spine and bone.name.lower().startswith("mixamorig")
                 else semantic_match_score(bone.name, aliases), bone)
                for bone in available
                if bone.name not in used
            ),
            key=lambda item: (-item[0], item[1].name.casefold()),
        )
        if not candidates or candidates[0][0] <= 0:
            continue
        score, bone = candidates[0]
        used.add(bone.name)
        mapping[semantic] = {
            "name": bone.name,
            "score": score,
            "parent": bone.parent.name if bone.parent else None,
            "head": rounded_vector(world_point_m(armature, bone.head_local)),
            "tail": rounded_vector(world_point_m(armature, bone.tail_local)),
            "lengthM": round(float((world_point_m(armature, bone.tail_local)
                                     - world_point_m(armature, bone.head_local)).length), 6),
        }
    return mapping


def coordinate_evidence(
    armature: bpy.types.Object,
    semantics: dict[str, dict[str, object]],
) -> dict[str, object] | None:
    required = {
        "hips", "head", "leftUpperArm", "rightUpperArm",
        "leftFoot", "rightFoot", "leftToes", "rightToes",
    }
    if not required.issubset(semantics):
        return None

    def head(semantic: str) -> Vector:
        return world_point_m(armature, armature.data.bones[semantics[semantic]["name"]].head_local)

    up = head("head") - head("hips")
    if up.length < 1e-6:
        return None
    up.normalize()

    right = head("rightUpperArm") - head("leftUpperArm")
    right -= up * right.dot(up)
    if right.length < 1e-6:
        return None
    right.normalize()

    cross_forward = right.cross(up)
    if cross_forward.length < 1e-6:
        return None
    cross_forward.normalize()

    toe_direction = (
        (head("leftToes") - head("leftFoot"))
        + (head("rightToes") - head("rightFoot"))
    ) * 0.5
    toe_direction -= up * toe_direction.dot(up)
    toe_direction -= right * toe_direction.dot(right)
    toe_planar_length = toe_direction.length
    if toe_planar_length > 1e-6:
        toe_direction.normalize()
        if cross_forward.dot(toe_direction) < 0.0:
            cross_forward.negate()

    return {
        "up": rounded_vector(up),
        "upCardinalAxis": cardinal_axis(up),
        "characterRight": rounded_vector(right),
        "rightCardinalAxis": cardinal_axis(right),
        "forward": rounded_vector(cross_forward),
        "forwardCardinalAxis": cardinal_axis(cross_forward),
        "forwardEvidence": "foot-to-toe rest direction",
        "toePlanarLengthM": round(float(toe_planar_length), 6),
        "confidence": "high" if toe_planar_length > 0.01 else "low",
    }


def inspect_armature(armature: bpy.types.Object) -> dict[str, object]:
    semantics = semantic_bone_map(armature)
    return {
        "name": armature.name,
        "bones": len(armature.data.bones),
        "rootBones": [bone.name for bone in armature.data.bones if bone.parent is None],
        "boneNames": sorted(
            (bone.name for bone in armature.data.bones), key=str.casefold
        ),
        "semanticBones": semantics,
        "missingSemantics": sorted(set(SEMANTIC_ALIASES).difference(semantics)),
        "coordinateEvidence": coordinate_evidence(armature, semantics),
    }


def classify_action(name: str) -> list[str]:
    folded = name.casefold()
    tags: list[str] = []
    for tag, needles in (
        ("walk", ("walk",)),
        ("jog", ("jog",)),
        ("run", ("run",)),
        ("sprint", ("sprint",)),
        ("idle", ("idle",)),
        ("turn", ("turn",)),
        ("start", ("start", "begin")),
        ("stop", ("stop", "end")),
        ("forward", ("forward", "fwd", "front")),
        ("backward", ("backward", "back", "bwd")),
        ("left", ("left",)),
        ("right", ("right",)),
    ):
        if any(needle in folded for needle in needles):
            tags.append(tag)
    return tags


def inspect_action(
    action: bpy.types.Action,
    armatures: list[bpy.types.Object],
    fps: float,
) -> dict[str, object]:
    curves = action_fcurves(action)
    animated_bones = action_bones(curves)
    armature = select_action_armature(armatures, animated_bones)
    frame_start, frame_end = (float(value) for value in action.frame_range)
    key_frames = sorted(
        {
            round(float(point.co.x), 6)
            for curve in curves
            for point in curve.keyframe_points
        }
    )
    positive_steps = [
        right - left
        for left, right in zip(key_frames, key_frames[1:])
        if right - left > 1e-6
    ]
    median_key_step = statistics.median(positive_steps) if positive_steps else None
    result: dict[str, object] = {
        "name": action.name,
        "tags": classify_action(action.name),
        "frameRange": [round(frame_start, 6), round(frame_end, 6)],
        "durationFrames": round(max(0.0, frame_end - frame_start), 6),
        "durationSeconds": round(max(0.0, frame_end - frame_start) / fps, 6),
        "fcurves": len(curves),
        "keyFrames": len(key_frames),
        "medianKeyStepFrames": (
            round(median_key_step, 6) if median_key_step is not None else None
        ),
        "medianKeyStepSeconds": (
            round(median_key_step / fps, 8) if median_key_step is not None else None
        ),
        "estimatedDenseSampleHz": (
            round(fps / median_key_step, 6)
            if median_key_step is not None and median_key_step > 0.0
            else None
        ),
        "animatedBones": animated_bones,
        "targetArmature": armature.name if armature else None,
        "slot": None,
        "rootMotion": None,
        "loopSeamTranslationRmsM": None,
    }
    if armature is None:
        return result

    result["slot"] = bind_action(armature, action)
    semantics = semantic_bone_map(armature)
    animated_semantics = sorted(
        semantic
        for semantic, evidence in semantics.items()
        if evidence["name"] in animated_bones
    )
    result["animatedSemantics"] = animated_semantics
    result["missingLocomotionCoreSemantics"] = sorted(
        LOCOMOTION_CORE_SEMANTICS.difference(animated_semantics)
    )
    root_names = candidate_root_bones(armature)
    seam_names = animated_bones or [bone.name for bone in armature.data.bones]

    set_scene_frame(frame_start)
    root_start = bone_positions(armature, root_names)
    seam_start = bone_positions(armature, seam_names)
    object_start = armature.matrix_world.translation.copy() * bpy.context.scene.unit_settings.scale_length
    set_scene_frame(frame_end)
    root_end = bone_positions(armature, root_names)
    seam_end = bone_positions(armature, seam_names)
    object_end = armature.matrix_world.translation.copy() * bpy.context.scene.unit_settings.scale_length

    object_delta = object_end - object_start
    roots: list[dict[str, object]] = []
    max_horizontal_net = math.hypot(object_delta.x, object_delta.y)
    for name in root_names:
        if name not in root_start or name not in root_end:
            continue
        delta = root_end[name] - root_start[name]
        horizontal = math.hypot(delta.x, delta.y)
        max_horizontal_net = max(max_horizontal_net, horizontal)
        roots.append(
            {
                "bone": name,
                "start": rounded_vector(root_start[name]),
                "end": rounded_vector(root_end[name]),
                "delta": rounded_vector(delta),
                "horizontalNetM": round(horizontal, 6),
            }
        )

    seam_distances = [
        (seam_end[name] - start).length
        for name, start in seam_start.items()
        if name in seam_end
    ]
    seam_rms = (
        math.sqrt(sum(value * value for value in seam_distances) / len(seam_distances))
        if seam_distances
        else None
    )
    result["rootMotion"] = {
        "likely": max_horizontal_net > 0.01,
        "thresholdM": 0.01,
        "maxHorizontalNetM": round(max_horizontal_net, 6),
        "armatureObjectDelta": rounded_vector(object_delta),
        "bones": roots,
    }
    result["loopSeamTranslationRmsM"] = (
        round(seam_rms, 8) if seam_rms is not None else None
    )
    # A travelling loop must be compared after removing its root displacement;
    # keep the raw seam above too, so non-loop transitions are not disguised.
    root_delta = roots[0]["delta"] if roots else rounded_vector(object_delta)
    relative_seams = [
        (seam_end[name] - start - Vector(root_delta)).length
        for name, start in seam_start.items() if name in seam_end
    ]
    result["loopSeamRootRelativeRmsM"] = (
        round(math.sqrt(sum(value * value for value in relative_seams) / len(relative_seams)), 8)
        if relative_seams else None
    )
    return result


def inspect_source(source: Path) -> dict[str, object]:
    scene = bpy.context.scene
    fps = float(scene.render.fps) / float(scene.render.fps_base)
    armatures = sorted(
        (obj for obj in scene.objects if obj.type == "ARMATURE"),
        key=lambda item: item.name.casefold(),
    )
    actions = sorted(bpy.data.actions, key=lambda item: item.name.casefold())
    action_reports = [inspect_action(action, armatures, fps) for action in actions]
    locomotion_candidates = [
        {
            "name": item["name"],
            "tags": item["tags"],
            "durationSeconds": item["durationSeconds"],
            "likelyRootMotion": (
                item["rootMotion"]["likely"] if item["rootMotion"] else None
            ),
        }
        for item in action_reports
        if set(item["tags"]).intersection({"walk", "jog", "run", "sprint"})
    ]
    return {
        "schemaVersion": 2,
        "coordinateSpace": "world-metres-z-up",
        "source": {
            "path": str(source),
            "bytes": source.stat().st_size,
            "sha256": sha256_file(source),
            "suffix": source.suffix.lower(),
        },
        "blender": {
            "version": bpy.app.version_string,
            "sceneEvaluationFps": round(fps, 6),
        },
        "scene": {
            "objects": len(scene.objects),
            "meshes": sum(obj.type == "MESH" for obj in scene.objects),
            "armatures": len(armatures),
            "actions": len(actions),
        },
        "armatures": [inspect_armature(armature) for armature in armatures],
        "locomotionCandidates": locomotion_candidates,
        "actions": action_reports,
    }


def compare_with_reference(
    source_report: dict[str, object],
    reference_report: dict[str, object],
) -> dict[str, object]:
    if any(report.get("coordinateSpace") != "world-metres-z-up"
           for report in (source_report, reference_report)):
        raise ValueError("Regenerate source/reference reports in world metres before comparing rigs")
    source_armatures = source_report.get("armatures", [])
    reference_armatures = reference_report.get("armatures", [])
    if not source_armatures or not reference_armatures:
        raise ValueError("Both source and reference reports need an armature")

    source_armature = source_armatures[0]
    reference_armature = reference_armatures[0]
    source_semantics = source_armature.get("semanticBones", {})
    reference_semantics = reference_armature.get("semanticBones", {})
    shared = sorted(set(source_semantics).intersection(reference_semantics))
    mapping: list[dict[str, object]] = []
    scale_ratios: list[float] = []
    for semantic in shared:
        source_bone = source_semantics[semantic]
        reference_bone = reference_semantics[semantic]
        source_length = float(source_bone["lengthM"])
        reference_length = float(reference_bone["lengthM"])
        length_ratio = (
            reference_length / source_length if source_length > 1e-8 else None
        )
        if length_ratio is not None and semantic != "root":
            scale_ratios.append(length_ratio)
        mapping.append(
            {
                "semantic": semantic,
                "sourceBone": source_bone["name"],
                "referenceBone": reference_bone["name"],
                "sourceLengthM": source_length,
                "referenceLengthM": reference_length,
                "referenceToSourceLengthRatio": (
                    round(length_ratio, 6) if length_ratio is not None else None
                ),
            }
        )

    source_axes = source_armature.get("coordinateEvidence")
    reference_axes = reference_armature.get("coordinateEvidence")
    alignment = None
    if source_axes and reference_axes:
        forward_dot = Vector(source_axes["forward"]).dot(
            Vector(reference_axes["forward"])
        )
        up_dot = Vector(source_axes["up"]).dot(Vector(reference_axes["up"]))
        right_dot = Vector(source_axes["characterRight"]).dot(
            Vector(reference_axes["characterRight"])
        )
        alignment = {
            "forwardDot": round(float(forward_dot), 6),
            "upDot": round(float(up_dot), 6),
            "rightDot": round(float(right_dot), 6),
            "forwardReversed": forward_dot < -0.5,
            "axisCorrectionRequired": (
                forward_dot < 0.95 or up_dot < 0.95 or right_dot < 0.95
            ),
        }

    return {
        "referenceSource": reference_report.get("source"),
        "sourceArmature": source_armature["name"],
        "referenceArmature": reference_armature["name"],
        "sharedSemantics": len(shared),
        "missingInSource": sorted(set(reference_semantics).difference(source_semantics)),
        "missingInReference": sorted(set(source_semantics).difference(reference_semantics)),
        "medianReferenceToSourceLengthRatio": (
            round(statistics.median(scale_ratios), 6) if scale_ratios else None
        ),
        "axisAlignment": alignment,
        "boneMap": mapping,
    }


def self_test() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    bpy.ops.object.armature_add()
    rig = bpy.context.object
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bone = rig.data.edit_bones[0]
    edit_bone.head = (0, 0, 0)
    edit_bone.tail = (0, 1, 0)
    bpy.ops.object.mode_set(mode="POSE")
    rig.data.bones[0].name = "mixamorig:Hips"
    rig.matrix_world = Matrix.Rotation(math.pi / 2, 4, "X") @ Matrix.Scale(0.01, 4)
    pose = rig.pose.bones[0]
    pose.location = (0, 100, 0)
    pose.keyframe_insert(data_path="location", frame=1)
    pose.location.z = 100
    pose.keyframe_insert(data_path="location", frame=31)
    bpy.context.view_layer.update()
    for unit_scale in (1.0, 0.1):
        scene.unit_settings.scale_length = unit_scale
        report = inspect_action(rig.animation_data.action, [rig], 30)
        assert report["rootMotion"]["likely"], report
        assert abs(report["rootMotion"]["maxHorizontalNetM"] - unit_scale) < 1e-5
        assert report["loopSeamRootRelativeRmsM"] < 1e-5
        length = semantic_bone_map(rig)["hips"]["lengthM"]
        assert abs(length - 0.01 * unit_scale) < 1e-6
    print("ALIFE_ANIMATION_SOURCE_SELF_TEST=passed: rotated-centimetre-rig, scene-units, root-relative-seam")


def main() -> None:
    arguments = script_args()
    if arguments.self_test:
        self_test()
        return
    if arguments.source is None:
        raise ValueError("--source is required unless using --self-test")
    source = arguments.source.resolve()
    if not source.is_file():
        raise FileNotFoundError(f"Animation source does not exist: {source}")
    if source.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise ValueError(
            f"Unsupported source suffix {source.suffix!r}; expected one of "
            f"{sorted(SUPPORTED_SUFFIXES)}"
        )
    if arguments.output is not None and arguments.output.resolve() == source:
        raise ValueError("Report output must not overwrite the animation source")

    import_source(source)
    report = inspect_source(source)
    if arguments.reference_report is not None:
        reference_path = arguments.reference_report.resolve()
        if not reference_path.is_file():
            raise FileNotFoundError(f"Reference report does not exist: {reference_path}")
        reference = json.loads(reference_path.read_text(encoding="utf-8"))
        report["referenceComparison"] = compare_with_reference(report, reference)
    encoded = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    if arguments.output is not None:
        output = arguments.output.resolve()
        if not output.parent.is_dir():
            raise FileNotFoundError(f"Report directory does not exist: {output.parent}")
        output.write_text(encoded + "\n", encoding="utf-8")
        report["reportPath"] = str(output)
    print("ALIFE_ANIMATION_SOURCE_REPORT=" + json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
