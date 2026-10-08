"""Bake local Mixamo locomotion onto a VRoid source without changing its meshes.

Run with Blender --background --python-exit-code 1 --python this_file --
  --target character.blend --source-directory extracted-pack
  --output review-only.blend --report ignored-report.json

Output is an isolated DCC candidate, never a runtime release. Source FBXs stay
outside the public repository; only project-specific baked animation may ship
after movement review. No online upload or source redistribution is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inspect_animation_source import (
    action_fcurves, bind_action, coordinate_evidence, semantic_bone_map, set_scene_frame,
)


CORE_MAP = [
    ("Hips", "J_Bip_C_Hips"), ("Spine", "J_Bip_C_Spine"),
    ("Spine1", "J_Bip_C_Chest"), ("Spine2", "J_Bip_C_UpperChest"),
    ("Neck", "J_Bip_C_Neck"), ("Head", "J_Bip_C_Head"),
]
for side, short in (("Left", "L"), ("Right", "R")):
    CORE_MAP.extend((side + name, f"J_Bip_{short}_{target}") for name, target in (
        ("Shoulder", "Shoulder"), ("Arm", "UpperArm"),
        ("ForeArm", "LowerArm"), ("Hand", "Hand"),
        ("UpLeg", "UpperLeg"), ("Leg", "LowerLeg"),
        ("Foot", "Foot"), ("ToeBase", "ToeBase"),
    ))
    for finger, target in (("Thumb", "Thumb"), ("Index", "Index"),
                           ("Middle", "Middle"), ("Ring", "Ring"), ("Pinky", "Little")):
        CORE_MAP.extend((f"{side}Hand{finger}{index}", f"J_Bip_{short}_{target}{index}")
                        for index in range(1, 4))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def world_rest(rig, name):
    return rig.matrix_world @ rig.data.bones[name].matrix_local


def world_pose(rig, name):
    return rig.matrix_world @ rig.pose.bones[name].matrix


def transfer_world_rotation(source_pose, source_rest, target_rest, alignment):
    return (alignment @ source_pose @ source_rest.inverted()
            @ alignment.inverted() @ target_rest)


def turn_counter_rotation(phase, angle):
    """Cancel controller yaw locally; the source body retains its anticipation."""
    if not 0 <= phase <= 1 or not math.isfinite(angle) or abs(abs(angle)-math.pi/2) > 1e-6:
        raise ValueError('Expected normalized quarter-turn time and signed pi/2 angle')
    return Quaternion((0,0,1), -angle*phase*phase*(3-2*phase))


def local_pose_matrix(bone, matrix, parent_poses, *, invert=False):
    parents = ({'parent_matrix': parent_poses[bone.parent.name],
                'parent_matrix_local': bone.parent.matrix_local} if bone.parent else {})
    return bone.convert_local_to_pose(matrix, bone.matrix_local, **parents, invert=invert)


def allow_hips_translation(rig):
    """A connected Hips bone ignores location keys; retain its parent and rest pose."""
    hips = rig.data.bones['J_Bip_C_Hips']
    connected = hips.use_connect
    if connected:
        rests = {bone.name: bone.matrix_local.copy() for bone in rig.data.bones}
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        rig.data.edit_bones[hips.name].use_connect = False
        bpy.ops.object.mode_set(mode='OBJECT')
        bpy.context.view_layer.update()
        if any(max(abs(a-b) for row_a, row_b in zip(rests[bone.name], bone.matrix_local)
                   for a, b in zip(row_a, row_b)) > 1e-6 for bone in rig.data.bones):
            raise ValueError('Enabling hips translation changed the rest skeleton')
    return connected


def offset_hips_keys(rig, action, height):
    """Translate a whole clip vertically, preserving every gait-relative pose."""
    bind_action(rig, action)
    set_scene_frame(0)
    hips = rig.pose.bones['J_Bip_C_Hips']
    original = hips.location.copy()
    matrix = world_pose(rig, hips.name)
    matrix.translation.z += height
    hips.matrix = rig.matrix_world.inverted() @ matrix
    delta = hips.location-original
    curves = [curve for curve in action_fcurves(action)
              if curve.data_path == 'pose.bones["J_Bip_C_Hips"].location']
    if {curve.array_index for curve in curves} != {0,1,2}:
        raise ValueError('Ground calibration requires all three hips location channels')
    for curve in curves:
        for point in curve.keyframe_points:
            point.co.y += delta[curve.array_index]
            point.handle_left.y += delta[curve.array_index]
            point.handle_right.y += delta[curve.array_index]
        curve.update()
    set_scene_frame(0)


def sample_shoe_contacts(rig, action, sample_rate_hz=60):
    """Evaluate the real skinned shoe surfaces, including half-keyframe samples."""
    if sample_rate_hz <= 0 or sample_rate_hz % 30 != 0:
        raise ValueError('Shoe sampling rate must be a positive multiple of the 30 Hz timeline')
    selections = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or not any(mod.type == 'ARMATURE' and mod.object == rig
                                       and mod.show_viewport for mod in obj.modifiers):
            continue
        sides = {}
        for side in ('L','R'):
            groups = {group.index for group in obj.vertex_groups
                      if group.name in {f'J_Bip_{side}_Foot', f'J_Bip_{side}_ToeBase'}}
            sides[side] = [v.index for v in obj.data.vertices
                           if sum(g.weight for g in v.groups if g.group in groups) > .7]
        if any(sides.values()):
            selections.append((obj, sides))
    if any(not any(sides[side] for _, sides in selections) for side in ('L','R')):
        raise ValueError('Missing skinned shoe vertices; cannot verify ground clearance')
    bind_action(rig, action)
    samples = []
    steps_per_frame=sample_rate_hz/30
    for index in range(round(action.frame_range[1]*steps_per_frame)+1):
        set_scene_frame(index/steps_per_frame)
        deps = bpy.context.evaluated_depsgraph_get()
        heights = {'L': math.inf, 'R': math.inf}
        for obj, sides in selections:
            evaluated = obj.evaluated_get(deps)
            mesh = evaluated.to_mesh()
            try:
                if len(mesh.vertices) != len(obj.data.vertices):
                    raise ValueError('Shoe topology changed during evaluation')
                for side, vertices in sides.items():
                    if vertices:
                        heights[side] = min(heights[side], min(
                            (evaluated.matrix_world @ mesh.vertices[i].co).z for i in vertices))
            finally:
                evaluated.to_mesh_clear()
        samples.append(heights)
    return {
        'sampleRateHz': sample_rate_hz, 'sampleCount': len(samples),
        'soleMinMaxM': {side: [min(s[side] for s in samples), max(s[side] for s in samples)]
                       for side in ('L','R')},
        'framesBothSolesAbove3cm': sum(min(s.values()) > .03 for s in samples),
        'maxLowerSoleHeightM': max(min(s.values()) for s in samples),
    }


def calibrate_ground(rig, results, fixed_height=None):
    before = {item['clip']: sample_shoe_contacts(rig, bpy.data.actions[item['clip']])
              for item in results}
    minimum = min(bounds[0] for report in before.values() for bounds in report['soleMinMaxM'].values())
    # One shared offset prevents a height pop between Walk and Run. Never use
    # a large whole-body translation to hide a broken retarget or flatten flight.
    height = max(0, .002-minimum) if fixed_height is None else fixed_height
    if height > .03:
        raise ValueError(f'Shoe penetration {minimum:.4f} m requires a pose correction, not root lift')
    for item in results:
        action = bpy.data.actions[item['clip']]
        offset_hips_keys(rig, action, height)
        after = sample_shoe_contacts(rig, action)
        if min(v[0] for v in after['soleMinMaxM'].values()) < .001:
            raise ValueError('Shoe clearance failed after ground calibration')
        item['groundCalibration'] = {'sharedHeightOffsetM': height, 'before': before[item['clip']], 'after': after}
        action['alifeGroundHeightOffsetM'] = height
        # Replace pre-save joint observations with evaluated, final keyed poses.
        points = []
        for frame in range(round(action.frame_range[1])+1):
            set_scene_frame(frame)
            points.append({name: list(world_pose(rig, name).translation) for name in item['points'][0]})
        item['points'] = points
        item['loopJointSeamMaxM'] = max((Vector(points[-1][name])-Vector(points[0][name])).length
                                      for name in points[0])
        item['footJointHeightRangeM'] = {side: [min(p[f'J_Bip_{side}_Foot'][2] for p in points),
                                                   max(p[f'J_Bip_{side}_Foot'][2] for p in points)]
                                        for side in ('L','R')}


def self_test():
    # Reapplying controller yaw must reproduce the captured world pose, not
    # turn it twice. Counter-rotate the absolute position BEFORE subtracting
    # rest position; rotating only the displacement gives a wrong foot path.
    source_point=Vector((.16,-.04,.12))
    source_rest_point=Vector((.1,0,.12))
    target_rest_point=Vector((.085,0,.14))
    for angle in (-math.pi/2,math.pi/2):
        for phase in (0,.25,.5,.75,1):
            inverse=turn_counter_rotation(phase,angle)
            controller=inverse.inverted()
            source_rotation=Quaternion((0,0,1),.27)
            assert abs((controller @ inverse @ source_rotation).dot(source_rotation))> .999999
            local=target_rest_point+(inverse @ source_point-source_rest_point)*.93
            expected=source_point*.93+controller @ (target_rest_point-source_rest_point*.93)
            assert (controller @ local-expected).length<1e-6
        forward=turn_counter_rotation(1,angle).inverted() @ Vector((0,-1,0))
        assert abs(forward.x-(1 if angle>0 else -1))<1e-6
    for phase,angle in ((-.1,math.pi/2),(1.1,math.pi/2),(.5,math.pi),(.5,float('nan'))):
        try:
            turn_counter_rotation(phase,angle)
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid turn profile must be rejected')
    # Both rest bones point +X but have different axial rolls. A source arm
    # lowered towards -Z must lower the target too, not turn into an overhead
    # reach. Exercise opposite character headings as well as equal headings.
    rest = Quaternion((0, 0, 1), -math.pi / 2)
    source_rest = rest @ Quaternion((0, 1, 0), 0.42)
    source_pose = Quaternion((0, 1, 0), math.pi / 2) @ source_rest
    for yaw in (0, math.pi):
        alignment = Quaternion((0, 0, 1), yaw)
        target_rest = alignment @ rest @ Quaternion((0, 1, 0), -0.71)
        result = transfer_world_rotation(source_pose, source_rest, target_rest, alignment)
        assert ((result @ Vector((0, 1, 0))) - Vector((0, 0, -1))).length < 1e-6
    bpy.ops.object.armature_add()
    rig = bpy.context.object
    bpy.ops.object.mode_set(mode='EDIT')
    rig.data.edit_bones.remove(rig.data.edit_bones[0])
    root = rig.data.edit_bones.new('Root')
    root.head, root.tail = (0,0,0), (0,0,1)
    hips = rig.data.edit_bones.new('J_Bip_C_Hips')
    hips.head, hips.tail, hips.parent, hips.use_connect = (0,0,1), (0,0,1.2), root, True
    parent = None
    for part, head, tail in (
        ('UpperLeg', (0,0,2), (0,0,1)),
        ('LowerLeg', (0,0,1), (0,0,0)),
        ('Foot', (0,0,0), (0,-.2,0)),
    ):
        bone = rig.data.edit_bones.new(f'J_Bip_L_{part}')
        bone.head, bone.tail, bone.parent = head, tail, parent
        parent = bone
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
    rest_hips = world_rest(rig, 'J_Bip_C_Hips').translation
    rig.pose.bones['J_Bip_C_Hips'].location.x = .1
    bpy.context.view_layer.update()
    assert (world_pose(rig, 'J_Bip_C_Hips').translation-rest_hips).length < 1e-6
    assert allow_hips_translation(rig)
    assert abs((world_pose(rig, 'J_Bip_C_Hips').translation-rest_hips).length-.1) < 1e-6
    assert not allow_hips_translation(rig)
    hips_pose = rig.pose.bones['J_Bip_C_Hips']
    hips_pose.keyframe_insert(data_path='location', frame=0)
    hips_pose.location.x = -.1
    hips_pose.keyframe_insert(data_path='location', frame=30)
    action = rig.animation_data.action
    original_points = []
    for frame in (0,15,30):
        set_scene_frame(frame)
        original_points.append(world_pose(rig, hips_pose.name).translation.copy())
    offset_hips_keys(rig, action, .01)
    for frame, point in zip((0,15,30), original_points):
        set_scene_frame(frame)
        assert (world_pose(rig, hips_pose.name).translation-point-Vector((0,0,.01))).length < 1e-6
    for invalid_rate in (0,-30,59):
        try:
            sample_shoe_contacts(rig,action,sample_rate_hz=invalid_rate)
        except ValueError as error:
            assert 'positive multiple' in str(error)
        else:
            raise AssertionError('Invalid shoe sampling rate must be rejected')
    try:
        sample_shoe_contacts(rig, action)
    except ValueError as error:
        assert 'Missing skinned shoe vertices' in str(error)
    else:
        raise AssertionError('Missing shoes must not pass clearance validation')
    rig.animation_data_clear()
    foot_rotation = world_pose(rig, 'J_Bip_L_Foot').to_quaternion()
    goal = Vector((.3,-.2,.2))
    assert solve_leg(rig, 'L', goal, Vector((0,-1,0))) < 1e-6
    assert (world_pose(rig, 'J_Bip_L_Foot').translation-goal).length < 1e-5
    assert abs(world_pose(rig, 'J_Bip_L_Foot').to_quaternion().dot(foot_rotation)) > .99999
    hip = world_pose(rig, 'J_Bip_L_UpperLeg').translation
    knee = world_pose(rig, 'J_Bip_L_LowerLeg').translation
    ankle = world_pose(rig, 'J_Bip_L_Foot').translation
    assert abs((knee-hip).length-1) < 1e-5 and abs((ankle-knee).length-1) < 1e-5
    scale_before={name:rig.pose.bones[name].scale.copy() for name in (
        'J_Bip_L_UpperLeg','J_Bip_L_LowerLeg','J_Bip_L_Foot')}
    rig.pose.bones['J_Bip_L_UpperLeg'].scale=(1.00002,.99999,1.00001)
    rig.pose.bones['J_Bip_L_LowerLeg'].scale=(.99998,1.00001,1.00002)
    scale_before={name:rig.pose.bones[name].scale.copy() for name in scale_before}
    scaled_goal=world_pose(rig,'J_Bip_L_Foot').translation+Vector((.01,-.01,.01))
    assert solve_leg(rig,'L',scaled_goal,Vector((0,-1,0)))<1e-4
    assert all((rig.pose.bones[name].scale-value).length<1e-8 for name,value in scale_before.items())
    rig.pose.bones['J_Bip_L_UpperLeg'].scale=(1,1,1)
    rig.pose.bones['J_Bip_L_LowerLeg'].scale=(1,1,1)
    assert solve_leg(rig, 'L', Vector((0,0,-3)), Vector((0,-1,0))) > 2.99
    bpy.data.objects.remove(rig, do_unlink=True)
    print('ALIFE_RETARGET_SELF_TEST=passed: bone-roll-independent-arm-direction, opposite-heading, '
          'ankle-IK, preserved-leg-lengths-and-foot-roll, unreachable-target-clamp, connected-hips, '
          'uniform-ground-offset, missing-shoes-rejected, preserved-IK-local-scale, '
          'quarter-turn-direction-and-counter-rotation')


def limb_length(rig, upper, lower):
    return sum((rig.matrix_world.to_3x3() @
                (rig.data.bones[name].tail_local - rig.data.bones[name].head_local)).length
               for name in (upper, lower))


def solve_leg(rig, side, goal, pole_direction):
    """Preserve bone lengths while matching the mocap ankle trajectory."""
    names = [f'J_Bip_{side}_{part}' for part in ('UpperLeg', 'LowerLeg', 'Foot')]
    local_scales = [rig.pose.bones[name].scale.copy() for name in names]
    matrices = [world_pose(rig, name) for name in names]
    hip, knee, ankle = [matrix.translation for matrix in matrices]
    upper_length, lower_length = (knee-hip).length, (ankle-knee).length
    direction = goal - hip
    requested = direction.length
    if requested < 1e-8 or min(upper_length, lower_length) < 1e-8:
        raise ValueError('Degenerate leg or ankle goal at the hip')
    direction.normalize()
    distance = max(abs(upper_length-lower_length)+1e-6,
                   min(requested, upper_length+lower_length-1e-6))
    bend = pole_direction - direction * pole_direction.dot(direction)
    if bend.length < 1e-5:
        bend = Vector((0,-1,0)) - direction * Vector((0,-1,0)).dot(direction)
    bend.normalize()
    along = (upper_length**2 - lower_length**2 + distance**2) / (2*distance)
    perpendicular = math.sqrt(max(0, upper_length**2-along**2))
    desired_knee = hip + direction*along + bend*perpendicular
    def aim(name, destination, child_name):
        matrix = world_pose(rig, name)
        current = world_pose(rig, child_name).translation - matrix.translation
        desired = destination - matrix.translation
        rotation = current.normalized().rotation_difference(desired.normalized()) @ matrix.to_quaternion()
        solved = rotation.to_matrix().to_4x4()
        solved.translation = matrix.translation
        rig.pose.bones[name].matrix = rig.matrix_world.inverted() @ solved
        bpy.context.view_layer.update()
    aim(names[0], desired_knee, names[1])
    aim(names[1], hip+direction*distance, names[2])
    # Keep the source foot roll rather than inheriting the IK leg rotations.
    foot_matrix = matrices[2].copy()
    foot_matrix.translation = world_pose(rig, names[2]).translation
    rig.pose.bones[names[2]].matrix = rig.matrix_world.inverted() @ foot_matrix
    # Assigning world matrices through rotated/scaled ancestors can leave tiny
    # decomposed local-scale drift. IK is rotational: retain the authored pose
    # scales exactly and report any resulting ankle-position residue.
    for name, scale in zip(names, local_scales):
        rig.pose.bones[name].scale = scale
    bpy.context.view_layer.update()
    return max(abs(requested-distance), (world_pose(rig,names[2]).translation-goal).length)


def mesh_fingerprint(rig):
    """Exact rest geometry/material assignment signature, independent of pose."""
    result = {}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not any(mod.type == "ARMATURE" and mod.object == rig
                                        for mod in obj.modifiers):
            continue
        payload = repr(([(tuple(v.co)) for v in obj.data.vertices],
                        [(tuple(poly.vertices), poly.material_index) for poly in obj.data.polygons],
                        [slot.material.name if slot.material else None for slot in obj.material_slots]))
        result[obj.name] = hashlib.sha256(payload.encode()).hexdigest()
    return result


def action_fingerprint(action):
    channels = [(curve.data_path, curve.array_index,
                 [(tuple(point.co), tuple(point.handle_left), tuple(point.handle_right), point.interpolation)
                  for point in curve.keyframe_points]) for curve in action_fcurves(action)]
    return hashlib.sha256(repr(channels).encode()).hexdigest()


def bake_clip(target, source_path, clip_name, *, turn_angle=None):
    print(f'ALIFE_BAKE_BEGIN={clip_name}', flush=True)
    scene = bpy.context.scene
    objects_before = set(scene.objects)
    actions_before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(source_path), automatic_bone_orientation=False)
    imported = [obj for obj in scene.objects if obj not in objects_before]
    source = next(obj for obj in imported if obj.type == "ARMATURE")
    source_action = source.animation_data.action
    bind_action(source, source_action)
    source_names = {name.split(":")[-1]: name for name in source.data.bones.keys()}
    missing = [(src, dst) for src, dst in CORE_MAP
               if src not in source_names or dst not in target.pose.bones]
    if missing:
        raise ValueError(f"Incomplete retarget mapping: {missing}")
    mapping = [(source_names[src], dst) for src, dst in CORE_MAP]
    # Parent-first assignment makes the solved world rotations independent of
    # bone roll and avoids copying FBX local Euler angles onto a different rig.
    mapping.sort(key=lambda pair: len(target.data.bones[pair[1]].parent_recursive))
    source_rest = {src: world_rest(source, src) for src, _ in mapping}
    target_rest = {dst: world_rest(target, dst) for _, dst in mapping}
    def facing_basis(armature):
        axes = coordinate_evidence(armature, semantic_bone_map(armature))
        if axes is None or axes['confidence'] != 'high':
            raise ValueError('Cannot establish an unambiguous forward axis')
        # A rest spine is not a gravity vector: its small natural lean must not
        # turn metres of forward root travel into centimetres of vertical drift.
        up = Vector((0, 0, 1))
        forward = Vector(axes['forward'])
        forward.z = 0
        forward.normalize()
        return Matrix([forward.cross(up), forward, up]).transposed()
    alignment = (facing_basis(target) @ facing_basis(source).inverted()).to_quaternion()
    scale = limb_length(target, "J_Bip_L_UpperLeg", "J_Bip_L_LowerLeg") / limb_length(
        source, source_names["LeftUpLeg"], source_names["LeftLeg"])
    first, last = map(float, source_action.frame_range)
    source_fps = scene.render.fps / scene.render.fps_base
    duration = (last - first) / source_fps
    sample_rate = 120 if turn_angle is not None else 30
    count = round(duration * sample_rate)
    if count < 2:
        raise ValueError(f"No continuous motion in {source_path}")
    samples = []
    for index in range(count + 1):
        set_scene_frame(first + (last - first) * index / count)
        samples.append({src: world_pose(source, src).copy() for src, _ in mapping})
    hips_src = source_names["Hips"]
    travel = samples[-1][hips_src].translation - samples[0][hips_src].translation
    stationary = clip_name == 'Idle_A'
    if turn_angle is not None:
        if abs(abs(turn_angle)-math.pi/2) > 1e-6 or travel.length > .06:
            raise ValueError('Turn profile requires a stationary nominal quarter turn')
    elif stationary:
        if travel.length > .01:
            raise ValueError('The idle source unexpectedly travels')
    elif abs(travel.x) > 0.05 or travel.y >= -0.1:
        raise ValueError(f"Expected forward -Y travel, got {tuple(travel)}")
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        if action not in actions_before:
            bpy.data.actions.remove(action)

    target.animation_data_clear()
    action = bpy.data.actions.new(clip_name)
    action.use_fake_user = True
    target.animation_data_create().action = action
    previous = {}
    points = []
    reach_errors = []
    hips_errors = []
    initial_forward = samples[0][hips_src].translation.y - source_rest[hips_src].translation.y
    for index, sample in enumerate(samples):
        frame = index*30/sample_rate
        phase = index/count
        controller_travel = alignment @ Vector((0, initial_forward + travel.y*phase, 0))
        # A turn is not a locomotion loop. The controller owns the nominal
        # quarter turn; counter-rotate both absolute positions and rotations
        # so the clip preserves the captured body's lead/lag without double yaw.
        inverse_turn = turn_counter_rotation(phase,turn_angle) if turn_angle is not None else None
        # No scene evaluation between reset and solve: it would overwrite the
        # current result with this partially baked action.
        for pose in target.pose.bones:
            pose.rotation_mode = "QUATERNION"
            pose.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        parent_poses = {pose.name: pose.matrix.copy() for pose in target.pose.bones}
        for src, dst in mapping:
            pose = target.pose.bones[dst]
            current = target.matrix_world @ local_pose_matrix(pose.bone, Matrix.Identity(4), parent_poses)
            # Transfer a WORLD-space rotation delta, then apply the target's
            # own rest orientation. Reversing this product applies that delta
            # in bone space and raises VRoid's arms instead of lowering them.
            rotation = transfer_world_rotation(sample[src].to_quaternion(),
                                               source_rest[src].to_quaternion(),
                                               target_rest[dst].to_quaternion(), alignment)
            if inverse_turn is not None:
                rotation = inverse_turn @ rotation
            matrix = rotation.to_matrix().to_4x4()
            matrix.translation = current.translation
            if dst == "J_Bip_C_Hips":
                delta = alignment @ (sample[src].translation - source_rest[src].translation)
                # Remove linear travel only: retain the source's fore/aft
                # weight shift so the controller and planted feet agree.
                if inverse_turn is None:
                    delta -= controller_travel
                else:
                    delta = inverse_turn @ (alignment @ sample[src].translation) - alignment @ source_rest[src].translation
                matrix.translation = target_rest[dst].translation + delta * scale
                desired_hips = matrix.translation.copy()
            desired = target.matrix_world.inverted() @ matrix
            pose.matrix_basis = local_pose_matrix(pose.bone, desired, parent_poses, invert=True)
            parent_poses[dst] = local_pose_matrix(pose.bone, pose.matrix_basis, parent_poses)
        # Evaluate once for the whole parent-first solve, not after each of 52
        # bones. Blender's conversion above preserves inheritance/bone roll.
        bpy.context.view_layer.update()
        hips_errors.append((world_pose(target, 'J_Bip_C_Hips').translation-desired_hips).length)
        if hips_errors[-1] > 1e-4:
            raise ValueError('Hips motion was suppressed by the target rig')
        for side, source_side in (('L','Left'), ('R','Right')):
            foot = source_names[source_side+'Foot']
            upper = source_names[source_side+'UpLeg']
            lower = source_names[source_side+'Leg']
            foot_delta = alignment @ (sample[foot].translation-source_rest[foot].translation)
            goal = target_rest[f'J_Bip_{side}_Foot'].translation + (foot_delta-controller_travel)*scale
            pole = alignment @ (sample[lower].translation-sample[upper].translation)
            if inverse_turn is not None:
                goal = target_rest[f'J_Bip_{side}_Foot'].translation + (
                    inverse_turn @ (alignment @ sample[foot].translation) - alignment @ source_rest[foot].translation)*scale
                # Preserve the bend plane when proportional retargeting changes
                # the ankle goal; a full thigh vector can reverse the knee.
                axis=(sample[foot].translation-sample[upper].translation).normalized()
                bend=sample[lower].translation-sample[upper].translation
                bend-=axis*bend.dot(axis)
                if bend.length < 1e-5:
                    raise ValueError('Turn source has an ambiguous straight-knee bend plane')
                pole=inverse_turn @ (alignment @ bend.normalized())
            reach_errors.append(solve_leg(target, side, goal, pole))
        for _, dst in mapping:
            pose = target.pose.bones[dst]
            if dst in previous and pose.rotation_quaternion.dot(previous[dst]) < 0:
                pose.rotation_quaternion.negate()
            previous[dst] = pose.rotation_quaternion.copy()
            pose.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=dst)
            if dst == "J_Bip_C_Hips":
                pose.keyframe_insert(data_path="location", frame=frame, group=dst)
        points.append({dst: list(world_pose(target, dst).translation) for dst in (
            "J_Bip_C_Hips", "J_Bip_L_Foot", "J_Bip_R_Foot",
            "J_Bip_L_ToeBase", "J_Bip_R_ToeBase")})
    for curve in action_fcurves(action):
        for point in curve.keyframe_points:
            point.interpolation = "LINEAR"
    action.use_frame_range = True
    action.frame_start = 0
    action.frame_end = count*30/sample_rate
    action["alifeClipName"] = clip_name
    action["alifeDurationSeconds"] = count / sample_rate
    action["alifeSource"] = str(source_path)
    action["alifeSourceSha256"] = digest(source_path)
    action["alifeSourceLicense"] = "Adobe Mixamo - project use; not CC0"
    action["alifeInPlace"] = True
    action["alifeCalibratedSpeedMps"] = 0 if stationary or turn_angle is not None else abs(travel.y) * scale / duration
    if turn_angle is not None:
        action['alifeControllerYawRadians'] = turn_angle
        action['alifeControllerYawEnvelope'] = 'smoothstep-normalized-time'
        action['alifeSampleRateHz'] = sample_rate
        action['alifeRuntimeReleaseAllowed'] = False
        action['alifeTurnContactRefined'] = False
    print(f'ALIFE_BAKE_END={clip_name}', flush=True)
    return {
        "clip": clip_name, "source": str(source_path), "sourceSha256": digest(source_path),
        "durationSeconds": count / sample_rate, "bakedSamples": count + 1,
        "mappedBones": len(mapping), "legLengthScale": scale,
        "maxAnkleReachClampM": max(reach_errors),
        "maxHipsTargetErrorM": max(hips_errors),
        "sourceTravelM": list(travel), "calibratedSpeedMps": action["alifeCalibratedSpeedMps"],
        ("turnEndpointJointDifferenceM" if turn_angle is not None else "loopJointSeamMaxM"):
            max((Vector(points[-1][name]) - Vector(points[0][name])).length for name in points[0]),
        "footJointHeightRangeM": {
            side: [min(point[f"J_Bip_{side}_Foot"][2] for point in points),
                   max(point[f"J_Bip_{side}_Foot"][2] for point in points)]
            for side in ("L", "R")
        },
        "points": points,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--append-idle', action='store_true',
                        help='Add same-source Idle_A to a baked candidate without changing Walk/Run')
    for arg in ("target", "source-directory", "output", "report"):
        parser.add_argument("--" + arg, type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    if args.self_test:
        self_test()
        return
    if any(value is None for value in (args.target, args.source_directory, args.output, args.report)):
        parser.error('--target, --source-directory, --output and --report are required')
    if args.output.resolve() == args.target.resolve():
        raise ValueError("The approved appearance source must not be overwritten")
    if args.output.exists() or args.report.exists():
        raise FileExistsError("Use a distinct candidate path; do not overwrite an existing review")
    source_hash = digest(args.target)
    bpy.ops.wm.open_mainfile(filepath=str(args.target.resolve()), load_ui=False)
    if abs(bpy.context.scene.unit_settings.scale_length-1) > 1e-6:
        raise ValueError('The approved source must use metre scene units')
    preserved = {}
    fixed_height = None
    if args.append_idle:
        if 'Idle_A' in bpy.data.actions or any(name not in bpy.data.actions for name in ('Walk','Run')):
            raise ValueError('Appending idle requires a Walk/Run candidate without Idle_A')
        preserved = {name: action_fingerprint(bpy.data.actions[name]) for name in ('Walk','Run')}
        heights = [bpy.data.actions[name]['alifeGroundHeightOffsetM'] for name in preserved]
        if abs(heights[0]-heights[1]) > 1e-6:
            raise ValueError('Existing Walk/Run ground offsets disagree')
        fixed_height = heights[0]
    elif any(name in bpy.data.actions for name in ('Walk','Run')):
        raise ValueError('Use the approved appearance source, or --append-idle for a baked candidate')
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    geometry_before = mesh_fingerprint(rig)
    hips_disconnected = allow_hips_translation(rig)
    deformers = [(mod, mod.show_viewport) for obj in bpy.context.scene.objects if obj.type == 'MESH'
                 for mod in obj.modifiers if mod.type == 'ARMATURE' and mod.object == rig]
    try:
        # Solving the skeleton doesn't require reskinning every mesh after each
        # individual bone; restore all modifier states before saving/rendering.
        for mod, _ in deformers:
            mod.show_viewport = False
        clips = (("idle.fbx", "Idle_A"),) if args.append_idle else (
            ("walking.fbx", "Walk"), ("standard run.fbx", "Run"))
        results = [bake_clip(rig, args.source_directory / filename, name) for filename, name in clips]
    finally:
        for mod, visible in deformers:
            mod.show_viewport = visible
    bpy.context.scene.render.fps = 30
    bpy.context.scene.render.fps_base = 1
    calibrate_ground(rig, results, fixed_height)
    if any(item['loopJointSeamMaxM'] > 0.001 for item in results):
        raise ValueError('Baked loop has an unexpected seam larger than 1 mm')
    bpy.context.scene.render.fps = 30
    bpy.context.scene.render.fps_base = 1
    bind_action(rig, bpy.data.actions["Walk"])
    set_scene_frame(0)
    if mesh_fingerprint(rig) != geometry_before or digest(args.target) != source_hash:
        raise ValueError("Approved appearance changed")
    if any(action_fingerprint(bpy.data.actions[name]) != fingerprint for name, fingerprint in preserved.items()):
        raise ValueError('Appending idle changed the existing Walk/Run channels')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
    report = {
        "source": str(args.target), "sourceSha256": source_hash,
        "candidate": str(args.output), "candidateSha256": digest(args.output),
        "geometryAndMaterialAssignmentsUnchanged": True, "meshFingerprints": geometry_before,
        "hipsConnectionReleased": hips_disconnected,
        "mode": 'append-idle' if args.append_idle else 'locomotion',
        "preservedActionFingerprints": preserved,
        "clips": results, "runtimeReleaseAllowed": False,
        "pending": ["visual-motion-review", "foot-contact-calibration", "coat-and-hair-follow-through",
                    "start-stop-and-turn-transitions", "runtime-integration"],
    }
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("ALIFE_RETARGET_RESULT=" + json.dumps({
        "candidate": str(args.output), "clips": [{k: v for k, v in item.items() if k != "points"}
                                                   for item in results]}))


if __name__ == "__main__":
    main()
