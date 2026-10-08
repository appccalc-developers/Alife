"""Refine an approved Mixamo review candidate without exporting runtime assets.

This profile is tied to the supplied Walking / Standard Run sources and the
approved female rig or explicit male boot profile. It is not a general contact
solver or a release validator.
Run with Blender --background --python-exit-code 1 --python this_file --
  --target candidate.blend --output new-review.blend --report ignored.json
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion

sys.path.insert(0, str(Path(__file__).resolve().parent))
from retarget_mixamo_locomotion import (
    CORE_MAP, world_pose, solve_leg, mesh_fingerprint, digest, offset_hips_keys,
    action_fingerprint, sample_shoe_contacts,
    turn_counter_rotation, bake_clip,
)
from inspect_animation_source import bind_action, set_scene_frame, action_fcurves

def smooth(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)

def shoes(rig):
    result={}
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or not any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers):continue
        for side in ('L','R'):
            groups={g.index for g in obj.vertex_groups if g.name in {f'J_Bip_{side}_Foot',f'J_Bip_{side}_ToeBase'}}
            selected=[v for v in obj.data.vertices if sum(g.weight for g in v.groups if g.group in groups)>.7]
            if not selected:continue
            low=min((obj.matrix_world@v.co).z for v in selected)
            sole=[v for v in selected if (obj.matrix_world@v.co).z<low+.015]
            ys=[(obj.matrix_world@v.co).y for v in sole]
            front,back=min(ys),max(ys)
            patches={
                'heel':[v.index for v in sole if (obj.matrix_world@v.co).y>back-(back-front)*.3],
                'toe':[v.index for v in sole if (obj.matrix_world@v.co).y<front+(back-front)*.3],
                'all':[v.index for v in selected],
            }
            if side in result:raise ValueError('Multiple shoe meshes need explicit handling')
            result[side]=(obj,patches)
    assert set(result)=={'L','R'}
    return result

def sample_shoes(probes):
    deps=bpy.context.evaluated_depsgraph_get()
    result={}
    for side,(obj,patches) in probes.items():
        evaluated=obj.evaluated_get(deps)
        mesh=evaluated.to_mesh()
        try:
            positions={name:[evaluated.matrix_world@mesh.vertices[i].co for i in ids] for name,ids in patches.items()}
            result[side]={name:sum(points,Vector())/len(points) for name,points in positions.items() if name!='all'}
            result[side]['minimum']=min(p.z for p in positions['all'])
        finally:evaluated.to_mesh_clear()
    return result

def capture(rig):
    return {b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in rig.pose.bones}

def restore(rig,pose):
    for name,(location,rotation,scale) in pose.items():
        b=rig.pose.bones[name]
        b.location,b.rotation_quaternion,b.scale=location,rotation,scale
    bpy.context.view_layer.update()

def stabilize(rig,probes,name,window,stable_bend=False,*,sample_rate=60,skin_floor=False):
    if sample_rate not in (60,120):raise ValueError('Contact baking supports 60 or 120 Hz')
    steps=sample_rate//30
    action=bpy.data.actions[name]
    bind_action(rig,action)
    end=round(action.frame_range[1])
    speed=action['alifeCalibratedSpeedMps']
    stride=speed*end/30
    anchors={}
    for side,centre in (('L',.5),('R',1.0)):
        set_scene_frame((centre%1)*end)
        anchors[side]=sample_shoes(probes)[side]
    samples=[]
    for index in range(end*steps+1):
        set_scene_frame(index/steps)
        samples.append(capture(rig))
    fingerprints={n:action_fingerprint(bpy.data.actions[n]) for n in ('Walk','Run','Idle_A') if n!=name}
    # Bake into a copy; source keys stay available while the candidate is solved.
    action.name=name+'_Source'
    result=bpy.data.actions.new(name)
    result.use_fake_user=True
    for key in action.keys():result[key]=action[key]
    rig.animation_data_clear()
    rig.animation_data_create().action=result
    last={}
    clamps=[]
    corrections=[]
    pelvis_offsets=[]
    for index,pose in enumerate(samples):
        phase=index/(len(samples)-1)
        restore(rig,pose)
        frame_corrections={}
        goals={side:world_pose(rig,f'J_Bip_{side}_Foot').translation.copy() for side in ('L','R')}
        poles={side:world_pose(rig,f'J_Bip_{side}_LowerLeg').translation-world_pose(rig,f'J_Bip_{side}_UpperLeg').translation for side in ('L','R')}
        if stable_bend:
            poles={side:knee_bend_direction(world_pose(rig,f'J_Bip_{side}_UpperLeg').translation,
                    world_pose(rig,f'J_Bip_{side}_LowerLeg').translation,goals[side]) for side in ('L','R')}
        for side,centre in (('L',.5),('R',1.0)):
            unwrapped=phase if side=='L' else phase+.5
            # Both sides use the same half-cycle contact window.
            if side=='R':unwrapped=(phase+.5)%1
            start,full_start,full_end,finish=window
            weight=smooth((unwrapped-start)/(full_start-start))*(1-smooth((unwrapped-full_end)/(finish-full_end)))
            if weight<=0:continue
            actual_phase=unwrapped if side=='L' else unwrapped+.5
            patch_blend=smooth((unwrapped-.36)/.27)
            original_ankle=world_pose(rig,f'J_Bip_{side}_Foot').translation.copy()
            pole=world_pose(rig,f'J_Bip_{side}_LowerLeg').translation-world_pose(rig,f'J_Bip_{side}_UpperLeg').translation
            points=sample_shoes(probes)[side]
            heel=anchors[side]['heel']-points['heel']
            toe=anchors[side]['toe']-points['toe']
            delta=heel.lerp(toe,patch_blend)
            delta.y+=stride*(actual_phase-centre)
            # Do not pull an airborne swing or toe-off shoe back to the floor.
            delta.z=(.003-points['minimum'])*smooth((.05-points['minimum'])/.03)
            delta*=weight
            goals[side]=original_ankle+delta
            frame_corrections[side]=list(delta)
        # Grounding must not lock a straight knee. Let the pelvis settle by the
        # minimal reachable amount, then preserve both ankle paths with IK.
        pelvis_offset=0
        for side,goal in goals.items():
            hip=world_pose(rig,f'J_Bip_{side}_UpperLeg').translation
            knee=world_pose(rig,f'J_Bip_{side}_LowerLeg').translation
            ankle=world_pose(rig,f'J_Bip_{side}_Foot').translation
            radius=(knee-hip).length+(ankle-knee).length-.002
            horizontal=math.hypot(goal.x-hip.x,goal.y-hip.y)
            if horizontal>=radius:raise ValueError('Horizontal ankle target is unreachable')
            pelvis_offset=min(pelvis_offset,goal.z+math.sqrt(radius*radius-horizontal*horizontal)-hip.z)
        if pelvis_offset<-.03:raise ValueError(f'Excessive pelvis compensation: {name} {phase:.4f} {pelvis_offset:.4f}')
        matrix=world_pose(rig,'J_Bip_C_Hips')
        matrix.translation.z+=pelvis_offset
        rig.pose.bones['J_Bip_C_Hips'].matrix=rig.matrix_world.inverted()@matrix
        bpy.context.view_layer.update()
        for side,goal in goals.items():clamps.append(solve_leg(rig,side,goal,poles[side]))
        if skin_floor:
            # Boot skin includes small neighbouring-bone weights. Validate the
            # solved surface, not only the pre-IK ankle/sole estimate.
            for side,points in sample_shoes(probes).items():
                clearance=max(0,.003-points['minimum'])
                if clearance>.015:raise ValueError('Contact shoe correction exceeds 15 mm')
                if clearance:
                    goal=world_pose(rig,f'J_Bip_{side}_Foot').translation+Vector((0,0,clearance))
                    clamps.append(solve_leg(rig,side,goal,poles[side]))
        if stable_bend:
            for bone_name,(_,_,scale) in pose.items():rig.pose.bones[bone_name].scale=scale
            bpy.context.view_layer.update()
        rig.pose.bones['J_Bip_C_Hips'].keyframe_insert(data_path='location',frame=index/steps,group='J_Bip_C_Hips')
        pelvis_offsets.append(pelvis_offset)
        for side in ('L','R'):
            for part in ('UpperLeg','LowerLeg','Foot','ToeBase'):
                bone=rig.pose.bones[f'J_Bip_{side}_{part}']
                if bone.name in last and bone.rotation_quaternion.dot(last[bone.name])<0:bone.rotation_quaternion.negate()
                last[bone.name]=bone.rotation_quaternion.copy()
                bone.keyframe_insert(data_path='rotation_quaternion',frame=index/steps,group=bone.name)
        corrections.append(frame_corrections)
    # Keep every unchanged channel exactly as in the mocap-derived action.
    changed={f'pose.bones["J_Bip_{side}_{part}"].rotation_quaternion' for side in ('L','R') for part in ('UpperLeg','LowerLeg','Foot','ToeBase')}
    changed.add('pose.bones["J_Bip_C_Hips"].location')
    from bpy_extras.anim_utils import action_get_channelbag_for_slot
    bag=action_get_channelbag_for_slot(result,rig.animation_data.action_slot)
    for curve in action_fcurves(action):
        if curve.data_path in changed:continue
        cloned=bag.fcurves.new(curve.data_path,index=curve.array_index)
        for point in curve.keyframe_points:
            key=cloned.keyframe_points.insert(point.co.x,point.co.y)
            key.interpolation=point.interpolation
    for curve in action_fcurves(result):
        if curve.data_path in changed:
            for key in curve.keyframe_points:key.interpolation='LINEAR'
    result.use_frame_range=True
    result.frame_start,result.frame_end=0,end
    result['alifeContactWindow']=list(window)
    if skin_floor:result['alifeSolvedShoeFloorM']=.003
    result['alifeContactBakedSampleRateHz']=sample_rate
    for n,old in fingerprints.items():assert action_fingerprint(bpy.data.actions[n])==old
    return {'clip':name,'maxReachClampM':max(clamps,default=0),'minimumPelvisOffsetM':min(pelvis_offsets),'corrections':corrections}


ENTRY = .375
START_SECONDS = .6
STOP_SECONDS = .8


def distance(q, speed, duration, stopping=False):
    integral = q**3 - .5*q**4
    return speed*duration*(q-integral if stopping else integral)


def knee_bend_direction(hip, knee, ankle):
    """Transfer the bend plane, not the axial hip-to-knee component.

    When ankle goals change during acceleration, projecting the full original
    thigh vector against the new leg axis can flip the knee behind the body.
    """
    axis=(ankle-hip).normalized()
    bend=knee-hip-axis*(knee-hip).dot(axis)
    if bend.length<1e-5:
        forward=Vector((0,-1,0))
        bend=forward-axis*forward.dot(axis)
    return bend.normalized()


def snapshot(rig, action, frame, stable_bend=False):
    bind_action(rig, action)
    set_scene_frame(frame)
    pose = capture(rig)
    feet = {side: world_pose(rig, f'J_Bip_{side}_Foot').copy() for side in ('L','R')}
    poles = {side: world_pose(rig, f'J_Bip_{side}_LowerLeg').translation
             - world_pose(rig, f'J_Bip_{side}_UpperLeg').translation for side in feet}
    if stable_bend:
        poles={side:knee_bend_direction(world_pose(rig,f'J_Bip_{side}_UpperLeg').translation,
                                        world_pose(rig,f'J_Bip_{side}_LowerLeg').translation,
                                        feet[side].translation) for side in feet}
    return pose, feet, poles


def blended_pose(a, b, t):
    return {name: (a[name][0].lerp(b[name][0], t),
                   a[name][1].slerp(b[name][1], t),
                   a[name][2].lerp(b[name][2], t)) for name in a}


def hermite(a, b, velocity, duration, t):
    t = max(0, min(1, t))
    return a*(2*t**3-3*t*t+1) + velocity*duration*(t**3-2*t*t+t) + b*(-2*t**3+3*t*t)


def distance_time(target, speed, duration, stopping):
    """Invert the monotone controller path without assuming constant speed."""
    if not 0 <= target <= speed*duration/2:
        raise ValueError('Contact lies outside transition travel')
    low, high = 0.0, 1.0
    for _ in range(50):
        middle = (low+high)/2
        if distance(middle,speed,duration,stopping) < target: low=middle
        else: high=middle
    return (low+high)/2


def run_stop_reference(rig, loop, duration):
    """Keep the first toe-off, then use two shortening braking steps."""
    speed,period=loop['alifeCalibratedSpeedMps'],loop['alifeDurationSeconds']
    release_phase=.61
    release_travel=(release_phase-ENTRY)*speed*period
    release_time=distance_time(release_travel,speed,duration,True)
    _,feet,_=snapshot(rig,loop,release_phase*period*30)
    _,next_feet,_=snapshot(rig,loop,(release_phase+1e-4)*period*30)
    # Convert the mocap velocity to the current decelerating controller speed.
    rate=1-smooth(release_time)
    velocity=((next_feet['L'].translation-feet['L'].translation)/(period*1e-4)
              +Vector((0,-speed,0)))*rate
    return {'releaseTime':release_time,
            'leftRelease':feet['L'].translation+Vector((0,-release_travel,0)),
            'leftRotation':feet['L'].to_quaternion(),'leftVelocity':velocity}


def bake(rig, name, idle, loop, stopping, running=False, stable_bend=None):
    stable_bend=running if stable_bend is None else stable_bend
    duration = (.85 if stopping else .4) if running else (STOP_SECONDS if stopping else START_SECONDS)
    sample_rate=120 if stable_bend else 60
    count = round(duration*sample_rate)
    period = loop['alifeDurationSeconds']
    speed = loop['alifeCalibratedSpeedMps']
    entry_frame = ENTRY*period*30
    idle_pose, idle_feet, idle_poles = snapshot(rig, idle, 0,stable_bend=stable_bend)
    initial_phase = ENTRY if stopping else ENTRY-duration/(2*period)
    references = []
    for index in range(count+1):
        q = index/count
        phase = initial_phase + distance(q,speed,duration,stopping)/(speed*period)
        references.append(snapshot(rig, loop, (phase%1)*period*30,stable_bend=stable_bend))
    initial_pose, initial_feet, initial_poles = references[0]
    _, next_feet, _ = snapshot(rig, loop, entry_frame+.01)
    stop_velocity = {side: (next_feet[side].translation-initial_feet[side].translation)*3000
                     + Vector((0,-speed,0)) for side in ('L','R')}
    braking=run_stop_reference(rig,loop,duration) if running and stopping else None
    rig.animation_data_clear()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data_create().action = action
    last = {}
    records = []
    probes = shoes(rig)
    for index, (reference, source_feet, source_poles) in enumerate(references):
        q = index/count
        travel = distance(q,speed,duration,stopping)
        final_travel = speed*duration/2
        restore(rig, blended_pose(reference,idle_pose,smooth(q)) if stopping
                else blended_pose(idle_pose,reference,smooth(q)))
        authored_scales={bone.name:bone.scale.copy() for bone in rig.pose.bones} if stable_bend else None
        goals, rotations = {}, {}
        if stopping and running:
            # At running speed a single planted foot cannot absorb the whole
            # stopping distance. Right brakes, left lands, then right gathers.
            landing_time,left_land,gather_time=.40,.74,.76
            right_land=idle_feet['R'].translation+Vector((0,-distance(landing_time,speed,duration,True)-.20,0))
            for side in ('L','R'):
                finish=idle_feet[side].translation+Vector((0,-final_travel,0))
                if side=='L' and q<=braking['releaseTime']:
                    goals[side]=source_feet[side].translation.copy()
                    rotations[side]=source_feet[side].to_quaternion()
                    continue
                if side=='L':
                    span=left_land-braking['releaseTime']
                    t=min(1,(q-braking['releaseTime'])/span)
                    goal=hermite(braking['leftRelease'],finish,braking['leftVelocity'],duration*span,t)
                    rotation=braking['leftRotation'].slerp(idle_feet[side].to_quaternion(),smooth(t))
                elif q<landing_time:
                    t=q/landing_time
                    goal=hermite(initial_feet[side].translation,right_land,stop_velocity[side],duration*landing_time,t)
                    rotation=initial_feet[side].to_quaternion().slerp(idle_feet[side].to_quaternion(),smooth(t))
                else:
                    t=max(0,(q-gather_time)/(1-gather_time))
                    goal=right_land.lerp(finish,smooth(t))
                    goal.z+=.035*math.sin(math.pi*t)**2
                    rotation=idle_feet[side].to_quaternion()
                goals[side]=goal+Vector((0,travel,0))
                rotations[side]=rotation
        elif stopping:
            # Left supports braking until right lands; left then gathers.
            for side in ('L','R'):
                start = initial_feet[side].translation
                finish = idle_feet[side].translation+Vector((0,-final_travel,0))
                if side == 'R':
                    t = min(1,q/.60)
                    goal = hermite(start,finish,stop_velocity[side],duration*.60,t)
                    blend = smooth(t)
                else:
                    t = max(0,(q-.62)/.38)
                    blend = smooth(t)
                    goal = start.lerp(finish,blend)
                    goal.z += .045*math.sin(math.pi*t)**2
                goals[side] = goal+Vector((0,travel,0))
                rotations[side] = initial_feet[side].to_quaternion().slerp(idle_feet[side].to_quaternion(),blend)
        else:
            # Release left to take the first step; right remains supporting.
            for side in ('L','R'):
                if side == 'L':
                    blend = smooth(q/(.80 if running else .72))
                    offset = idle_feet[side].translation-initial_feet[side].translation
                    goals[side] = source_feet[side].translation+offset*(1-blend)
                else:
                    release=.55 if running else .78
                    blend = smooth((q-release)/(1-release))
                    planted = idle_feet[side].translation+Vector((0,travel,0))
                    goals[side] = planted.lerp(source_feet[side].translation,blend)
                rotations[side] = idle_feet[side].to_quaternion().slerp(source_feet[side].to_quaternion(),blend)
        # Preserve foot roll independently of the leg solve.
        for side, rotation in rotations.items():
            matrix = rotation.to_matrix().to_4x4()
            matrix.translation = world_pose(rig,f'J_Bip_{side}_Foot').translation
            rig.pose.bones[f'J_Bip_{side}_Foot'].matrix = rig.matrix_world.inverted()@matrix
        bpy.context.view_layer.update()
        settle = 0
        for side, goal in goals.items():
            hip = world_pose(rig,f'J_Bip_{side}_UpperLeg').translation
            knee = world_pose(rig,f'J_Bip_{side}_LowerLeg').translation
            ankle = world_pose(rig,f'J_Bip_{side}_Foot').translation
            radius = (hip-knee).length+(knee-ankle).length-.001
            horizontal = math.hypot(goal.x-hip.x,goal.y-hip.y)
            if horizontal >= radius: raise ValueError(f'{name} {q}: unreachable horizontal step')
            settle = min(settle,goal.z+math.sqrt(radius*radius-horizontal*horizontal)-hip.z)
        if settle < -.10: raise ValueError(f'{name} {q}: excessive pelvis settling {settle}')
        matrix = world_pose(rig,'J_Bip_C_Hips')
        matrix.translation.z += settle
        rig.pose.bones['J_Bip_C_Hips'].matrix = rig.matrix_world.inverted()@matrix
        bpy.context.view_layer.update()
        for side, goal in goals.items():
            pole = source_poles[side].lerp(idle_poles[side],smooth(q)) if stopping else idle_poles[side].lerp(source_poles[side],smooth(q))
            clamp = solve_leg(rig,side,goal,pole)
            if clamp > 1e-4: raise ValueError(f'{name} {q}: clamped ankle {clamp}')
        # Toe blending can move the skin below an otherwise pinned ankle.
        # Lift only the affected foot by a few mm; never lift the whole rig.
        for side, points in sample_shoes(probes).items():
            clearance = .003-points['minimum']
            if clearance <= 0: continue
            if clearance > .015: raise ValueError(f'{name} {q}: shoe correction is too large')
            goal = world_pose(rig,f'J_Bip_{side}_Foot').translation+Vector((0,0,clearance))
            pole = world_pose(rig,f'J_Bip_{side}_LowerLeg').translation-world_pose(rig,f'J_Bip_{side}_UpperLeg').translation
            if solve_leg(rig,side,goal,pole)>1e-4:raise ValueError('Shoe clearance goal unreachable')
        if authored_scales is not None:
            for bone_name,scale in authored_scales.items():rig.pose.bones[bone_name].scale=scale
            bpy.context.view_layer.update()
        # Exact matching endpoints, never a different idle or loop pose.
        if index == 0: restore(rig,initial_pose if stopping else idle_pose)
        if index == count: restore(rig,idle_pose if stopping else reference)
        for _, name_bone in CORE_MAP:
            bone = rig.pose.bones[name_bone]
            if name_bone in last and bone.rotation_quaternion.dot(last[name_bone])<0: bone.rotation_quaternion.negate()
            last[name_bone] = bone.rotation_quaternion.copy()
            bone.keyframe_insert(data_path='rotation_quaternion',frame=index*30/sample_rate,group=name_bone)
            if name_bone == 'J_Bip_C_Hips': bone.keyframe_insert(data_path='location',frame=index*30/sample_rate,group=name_bone)
        records.append({'frame':index*30/sample_rate,'travelM':travel,'pelvisSettleM':settle})
    for curve in action_fcurves(action):
        for key in curve.keyframe_points: key.interpolation='LINEAR'
    action.use_frame_range=True
    action.frame_start,action.frame_end=0,duration*30
    action['alifeClipName']=name
    action['alifeDurationSeconds']=duration
    action['alifeInPlace']=True
    action['alifeSource']=loop['alifeSource']
    action['alifeSourceSha256']=loop['alifeSourceSha256']
    action['alifeSourceLicense']=loop['alifeSourceLicense']
    action['alifeAuthoredTransition']=True
    action['alifeLoopPhase']=ENTRY
    action['alifeControllerEnvelope']='smoothstep-deceleration' if stopping else 'smoothstep-acceleration'
    action['alifeControllerTravelM']=speed*duration/2
    action['alifeCalibratedSpeedMps']=speed
    action['alifeRuntimeReleaseAllowed']=False
    action['alifeBakedSampleRateHz']=sample_rate
    return {'clip':name,'durationSeconds':duration,'loopJoinPhase':ENTRY,
            'controllerTravelM':speed*duration/2,'minimumPelvisSettleM':min(r['pelvisSettleM'] for r in records)}



def bake_turn(rig, name, profile='female'):
    """Adapt a supplied quarter turn to the approved Idle footprint.

    The controller rotates, but stance shoes stay in world space. Each foot
    changes its footprint only during its captured swing window. Source swing
    offsets retain the small lift and body motion; endpoints are the same Idle.
    These are explicit rig/source review profiles, not a general turn solver.
    """
    expected={
        'Turn_L':('f0620a1640760de01b00d0f06dd5e3659e8074470e94167c8b2485547f1a9ead',.9,math.pi/2),
        'Turn_R':('d845032d77a5d6fbc1ef093c00dd5954616ba9e524bdad0259b15330fa286782',28/30,-math.pi/2),
    }
    if profile not in ('female','male'):raise ValueError('Unknown turn rig profile')
    if name not in expected or len(rig.data.bones)!=(126 if profile=='male' else 187) or name+'_Source' in bpy.data.actions:
        raise ValueError('Turn profile requires the matching unrefined quarter-turn candidate')
    raw=bpy.data.actions[name]
    sha,seconds,expected_angle=expected[name]
    if (raw.get('alifeSourceSha256')!=sha or raw.get('alifeTurnContactRefined',False)
            or abs(raw['alifeDurationSeconds']-seconds)>1e-6
            or abs(raw['alifeControllerYawRadians']-expected_angle)>1e-6):
        raise ValueError('Turn contact profile does not match the recorded source/timing/direction')
    angle=raw['alifeControllerYawRadians']
    duration=raw['alifeDurationSeconds']
    windows={'L':(.025,.52),'R':(.42,.94)} if angle>0 else {'R':(.025,.62),'L':(.38,.97)}
    idle_pose,idle_feet,idle_poles=snapshot(rig,bpy.data.actions['Idle_A'],0,True)
    sample_rate=120
    count=round(duration*sample_rate)
    references=[snapshot(rig,raw,i*30/sample_rate,True) for i in range(count+1)]
    edges={}
    for side,(lift,land) in windows.items():
        edges[side]=[]
        for q in (lift,land):
            _,feet,_=snapshot(rig,raw,q*duration*30,True)
            controller=turn_counter_rotation(q,angle).inverted()
            edges[side].append((controller@feet[side].translation,controller@feet[side].to_quaternion()))
    raw.name=name+'_Source'
    rig.animation_data_clear()
    action=bpy.data.actions.new(name)
    action.use_fake_user=True
    for key in raw.keys():action[key]=raw[key]
    rig.animation_data_create().action=action
    probes=shoes(rig)
    final_rotation=Quaternion((0,0,1),angle)
    last={}
    settlements=[]
    shoe_corrections=[]
    for index,(reference,source_feet,source_poles) in enumerate(references):
        q=index/count
        inverse=turn_counter_rotation(q,angle)
        controller=inverse.inverted()
        body_weight=smooth(q/.16)*(1-smooth((q-.82)/.18))
        restore(rig,blended_pose(idle_pose,reference,body_weight))
        authored_scales={bone.name:bone.scale.copy() for bone in rig.pose.bones}
        goals,rotations,poles={},{},{}
        for side,(lift,land) in windows.items():
            t=max(0,min(1,(q-lift)/(land-lift)))
            blend=smooth(t)
            start=idle_feet[side].translation
            finish=final_rotation@start
            start_rotation=idle_feet[side].to_quaternion()
            finish_rotation=final_rotation@start_rotation
            if t==0 or t==1:
                goal=start.copy() if t==0 else finish.copy()
                rotation=start_rotation.copy() if t==0 else finish_rotation.copy()
            else:
                raw_start,raw_finish=edges[side]
                source_point=controller@source_feet[side].translation
                # Retain the captured swing's arc while matching the existing
                # asymmetric idle stance before/after the actual world turn.
                goal=source_point+(start-raw_start[0])*(1-blend)+(finish-raw_finish[0])*blend
                correction=(start_rotation@raw_start[1].inverted()).slerp(
                    finish_rotation@raw_finish[1].inverted(),blend)
                rotation=correction@controller@source_feet[side].to_quaternion()
            goals[side]=inverse@goal
            rotations[side]=inverse@rotation
            poles[side]=idle_poles[side].lerp(source_poles[side],body_weight)
            # An unchanging planted sole includes the toe, not just the ankle.
            toe=rig.pose.bones[f'J_Bip_{side}_ToeBase']
            swing_weight=math.sin(math.pi*t)**2
            toe.rotation_quaternion=idle_pose[toe.name][1].slerp(reference[toe.name][1],swing_weight)
        bpy.context.view_layer.update()
        for side,rotation in rotations.items():
            matrix=rotation.to_matrix().to_4x4()
            matrix.translation=world_pose(rig,f'J_Bip_{side}_Foot').translation
            rig.pose.bones[f'J_Bip_{side}_Foot'].matrix=rig.matrix_world.inverted()@matrix
        bpy.context.view_layer.update()
        settle=0
        for side,goal in goals.items():
            hip=world_pose(rig,f'J_Bip_{side}_UpperLeg').translation
            knee=world_pose(rig,f'J_Bip_{side}_LowerLeg').translation
            ankle=world_pose(rig,f'J_Bip_{side}_Foot').translation
            radius=(hip-knee).length+(knee-ankle).length-.001
            horizontal=math.hypot(goal.x-hip.x,goal.y-hip.y)
            if horizontal>=radius:raise ValueError(f'{name} {q}: unreachable turn step')
            settle=min(settle,goal.z+math.sqrt(radius*radius-horizontal*horizontal)-hip.z)
        if settle<-.10:raise ValueError(f'{name} {q}: excessive turn pelvis settle')
        matrix=world_pose(rig,'J_Bip_C_Hips')
        matrix.translation.z+=settle
        rig.pose.bones['J_Bip_C_Hips'].matrix=rig.matrix_world.inverted()@matrix
        bpy.context.view_layer.update()
        for side,goal in goals.items():
            if solve_leg(rig,side,goal,poles[side])>1e-4:raise ValueError('Turn ankle clamped')
        for side,points in sample_shoes(probes).items():
            clearance=max(0,.003-points['minimum'])
            if clearance>.015:raise ValueError(f'{name} {q}: excessive turn shoe correction {clearance}')
            shoe_corrections.append(clearance)
            if clearance and solve_leg(rig,side,goals[side]+Vector((0,0,clearance)),poles[side])>1e-4:
                raise ValueError('Turn shoe clearance unreachable')
        for bone_name,scale in authored_scales.items():rig.pose.bones[bone_name].scale=scale
        bpy.context.view_layer.update()
        if index in (0,count):restore(rig,idle_pose)
        for _,bone_name in CORE_MAP:
            bone=rig.pose.bones[bone_name]
            if bone_name in last and bone.rotation_quaternion.dot(last[bone_name])<0:bone.rotation_quaternion.negate()
            last[bone_name]=bone.rotation_quaternion.copy()
            bone.keyframe_insert(data_path='rotation_quaternion',frame=index*30/sample_rate,group=bone_name)
            if bone_name=='J_Bip_C_Hips':bone.keyframe_insert(data_path='location',frame=index*30/sample_rate,group=bone_name)
        settlements.append(settle)
    for curve in action_fcurves(action):
        for point in curve.keyframe_points:point.interpolation='LINEAR'
    action.use_frame_range=True
    action.frame_start,action.frame_end=0,duration*30
    action['alifeClipName']=name
    action['alifeTurnContactRefined']=True
    action['alifeTurnFootSwingWindows']=json.dumps(windows)
    action['alifeRigProfile']=profile
    action['alifeRuntimeReleaseAllowed']=False
    return {'clip':name,'durationSeconds':duration,'controllerYawRadians':angle,
            'swingWindows':windows,'minimumPelvisSettleM':min(settlements),
            'maxShoeCorrectionM':max(shoe_corrections)}


def polish_run_stop_first_brake(args,rig,source_hash):
    """Pin the first Run_Stop toe contact without rebuilding other motion.

    The existing transition already has exact Run/Idle joins and two later
    braking contacts below a few millimetres. Only the left toe contact during
    q=0..0.18 is stabilized; the correction fades while that foot lifts.
    """
    required=('Idle_A','Walk','Run','Walk_Start','Walk_Stop','Run_Start','Run_Stop')
    if any(name not in bpy.data.actions for name in required):
        raise ValueError('First-brake polish requires the complete locomotion candidate')
    if 'Run_Stop_FirstBrakeSource' in bpy.data.actions:
        raise ValueError('First-brake polish has already been applied')
    source=bpy.data.actions['Run_Stop']
    duration=float(source.get('alifeDurationSeconds',0))
    speed=float(source.get('alifeCalibratedSpeedMps',0))
    if (abs(duration-.85)>1e-6 or speed<=0
            or source.get('alifeControllerEnvelope')!='smoothstep-deceleration'):
        raise ValueError('Unexpected Run_Stop timing or controller envelope')

    geometry=mesh_fingerprint(rig)
    rests={bone.name:[value for row in bone.matrix_local for value in row]
           for bone in rig.data.bones}
    preserved={action.name:action_fingerprint(action) for action in bpy.data.actions
               if action.name!='Run_Stop'}
    probes=shoes(rig)
    sample_rate=240
    count=round(duration*sample_rate)
    sample_phases=sorted({index/count for index in range(count+1)}|{.18,.28})
    samples=[]
    bind_action(rig,source)
    for q in sample_phases:
        set_scene_frame(q*duration*30)
        samples.append((q,capture(rig)))
    set_scene_frame(0)
    anchor=sample_shoes(probes)['L']['toe'].copy()

    source.name='Run_Stop_FirstBrakeSource'
    result=bpy.data.actions.new('Run_Stop')
    result.use_fake_user=True
    for key in source.keys():result[key]=source[key]
    result['alifeFirstBrakeContactPolished']=True
    result['alifeFirstBrakeContactWindow']=[0,.18]
    result['alifeFirstBrakeContactReleaseEnd']=.28
    rig.animation_data_clear()
    rig.animation_data_create().action=result
    changed={f'pose.bones["J_Bip_L_{part}"].rotation_quaternion'
             for part in ('UpperLeg','LowerLeg','Foot')}
    last={}
    before_drift=after_drift=max_correction=0
    reach_clamps=[]
    release_deltas={}
    for q,pose in samples:
        set_scene_frame(q*duration*30)
        restore(rig,pose)
        travel=distance(q,speed,duration,True)
        if q<=.18:
            original_world=sample_shoes(probes)['L']['toe']+Vector((0,-travel,0))
            before_drift=max(before_drift,math.hypot(
                original_world.x-anchor.x,original_world.y-anchor.y))
            for _ in range(2):
                current=sample_shoes(probes)['L']['toe']+Vector((0,-travel,0))
                delta=anchor-current
                horizontal=Vector((delta.x,delta.y,0))
                if horizontal.length<=1e-7:break
                max_correction=max(max_correction,horizontal.length)
                goal=world_pose(rig,'J_Bip_L_Foot').translation+horizontal
                hip=world_pose(rig,'J_Bip_L_UpperLeg').translation
                knee=world_pose(rig,'J_Bip_L_LowerLeg').translation
                ankle=world_pose(rig,'J_Bip_L_Foot').translation
                pole=knee_bend_direction(hip,knee,ankle)
                reach_clamps.append(solve_leg(rig,'L',goal,pole))
            corrected=sample_shoes(probes)['L']['toe']+Vector((0,-travel,0))
            after_drift=max(after_drift,math.hypot(
                corrected.x-anchor.x,corrected.y-anchor.y))
            # Preserve the last reachable contact correction. Once the foot
            # lifts, fade this local rotation delta instead of chasing a
            # ground-plane target that would require stretching the leg.
            for part in ('UpperLeg','LowerLeg','Foot'):
                name=f'J_Bip_L_{part}'
                delta=rig.pose.bones[name].rotation_quaternion @ pose[name][1].inverted()
                if delta.w<0:delta.negate()
                release_deltas[name]=delta
        elif q<.28 and release_deltas:
            weight=1-smooth((q-.18)/.10)
            identity=Quaternion((1,0,0,0))
            for name,delta in release_deltas.items():
                correction=identity.slerp(delta,weight)
                rig.pose.bones[name].rotation_quaternion=(correction @
                    rig.pose.bones[name].rotation_quaternion)
            bpy.context.view_layer.update()
        for part in ('UpperLeg','LowerLeg','Foot'):
            bone=rig.pose.bones[f'J_Bip_L_{part}']
            bone.rotation_quaternion.normalize()
            if bone.name in last and bone.rotation_quaternion.dot(last[bone.name])<0:
                bone.rotation_quaternion.negate()
            last[bone.name]=bone.rotation_quaternion.copy()
            bone.keyframe_insert(data_path='rotation_quaternion',
                                 frame=q*duration*30,group=bone.name)

    max_reach_clamp=max(reach_clamps,default=0)
    if max_reach_clamp>.003:
        raise ValueError(f'Run_Stop first-brake correction exceeds the 3 mm reach guard: '
                         f'{max_reach_clamp:.6f} m')

    from bpy_extras.anim_utils import action_get_channelbag_for_slot
    bag=action_get_channelbag_for_slot(result,rig.animation_data.action_slot)
    for curve in action_fcurves(source):
        if curve.data_path in changed:continue
        cloned=bag.fcurves.new(curve.data_path,index=curve.array_index)
        for point in curve.keyframe_points:
            key=cloned.keyframe_points.insert(point.co.x,point.co.y)
            key.interpolation=point.interpolation
            key.handle_left_type=point.handle_left_type
            key.handle_right_type=point.handle_right_type
            key.handle_left=point.handle_left
            key.handle_right=point.handle_right
    for curve in action_fcurves(result):
        if curve.data_path in changed:
            for point in curve.keyframe_points:point.interpolation='LINEAR'
    result.use_frame_range=True
    result.frame_start,result.frame_end=source.frame_range

    if any(action_fingerprint(bpy.data.actions[name])!=fingerprint
           for name,fingerprint in preserved.items()):
        raise ValueError('First-brake polish changed an unrelated action')
    if rests!={bone.name:[value for row in bone.matrix_local for value in row]
              for bone in rig.data.bones}:
        raise ValueError('First-brake polish changed the rest skeleton')
    if geometry!=mesh_fingerprint(rig) or digest(args.target)!=source_hash:
        raise ValueError('First-brake polish changed the appearance source')

    bind_action(rig,result)
    set_scene_frame(0)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
    report={
        'source':str(args.target),'sourceSha256':source_hash,
        'candidate':str(args.output),'candidateSha256':digest(args.output),
        'mode':'polish-run-stop-first-brake','rigProfile':args.profile,
        'geometryAndRestSkeletonUnchanged':True,
        'unrelatedActionFingerprintsPreserved':True,
        'contactWindow':[0,.18],'releaseEnd':.28,'sampleRateHz':sample_rate,
        'exactBoundaryKeys':[.18,.28],
        'firstBrakeToeDriftBeforeM':before_drift,
        'firstBrakeToeDriftAfterM':after_drift,
        'maximumIterativeCorrectionM':max_correction,
        'maximumReachClampM':max_reach_clamp,
        'runtimeReleaseAllowed':False,
        'pending':['visual-braking-review','walk-contact-review','hand-outfit-clearance',
                   'running-cloth-clearance','shared-skeleton','runtime-input-review'],
    }
    args.report.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('ALIFE_FIRST_BRAKE_POLISH='+json.dumps(report),flush=True)


def self_test():
    speed, duration = 1.55, .6
    for stopping in (False, True):
        assert distance(0, speed, duration, stopping) == 0
        assert abs(distance(1, speed, duration, stopping)-speed*duration/2) < 1e-12
        values = [distance(i/100, speed, duration, stopping) for i in range(101)]
        assert all(b >= a for a,b in zip(values,values[1:]))
        epsilon = 1e-5
        initial = (distance(epsilon,speed,duration,stopping)-values[0])/(duration*epsilon)
        final = (values[-1]-distance(1-epsilon,speed,duration,stopping))/(duration*epsilon)
        assert abs(initial-(speed if stopping else 0)) < 1e-5
        assert abs(final-(0 if stopping else speed)) < 1e-5
        for q in (.01,.2,.5,.9,.99):
            assert abs(distance_time(distance(q,speed,duration,stopping),speed,duration,stopping)-q)<1e-8
    a,b,v = Vector((0,0,1)),Vector((1,2,0)),Vector((.2,.3,-.1))
    assert (hermite(a,b,v,duration,0)-a).length < 1e-7
    assert (hermite(a,b,v,duration,1)-b).length < 1e-7
    epsilon=1e-4
    assert ((hermite(a,b,v,duration,epsilon)-a)/(duration*epsilon)-v).length < .005
    assert ((b-hermite(a,b,v,duration,1-epsilon))/(duration*epsilon)).length < .005
    assert smooth(-1)==0 and smooth(2)==1
    hip,knee,ankle=Vector((0,0,1)),Vector((0,.15,.6)),Vector((0,.6,.2))
    new_axis=Vector((0,.05,-.85)).normalized()
    old_pole=knee-hip
    stable_pole=knee_bend_direction(hip,knee,ankle)
    assert (old_pole-new_axis*old_pole.dot(new_axis)).y>0
    assert (stable_pole-new_axis*stable_pole.dot(new_axis)).y<0
    print('ALIFE_CONTACT_TRANSITION_SELF_TEST=passed: monotonic travel, inverse contact timing, endpoint speeds, Hermite tangents, no axial knee flip')


def append_run_candidate(args, rig, source_hash):
    required=('Walk_Start','Walk','Walk_Stop','Run','Idle_A')
    if any(name not in bpy.data.actions for name in required):
        raise ValueError('Appending run transitions requires the refined walking candidate')
    if any(name in bpy.data.actions for name in ('Run_Start','Run_Stop')):
        raise ValueError('Run transitions already exist; do not overwrite them')
    geometry=mesh_fingerprint(rig)
    rests={b.name:[v for row in b.matrix_local for v in row] for b in rig.data.bones}
    preserved={a.name:action_fingerprint(a) for a in bpy.data.actions}
    transitions=[]
    for name,stopping in (('Run_Start',False),('Run_Stop',True)):
        transitions.append(bake(rig,name,bpy.data.actions['Idle_A'],bpy.data.actions['Run'],stopping,True))
        print('ALIFE_RUN_TRANSITION_BAKED='+name,flush=True)
    clearance={name:sample_shoe_contacts(rig,bpy.data.actions[name],sample_rate_hz=240)
               for name in ('Run_Start','Run_Stop')}
    if any(min(v[0] for v in row['soleMinMaxM'].values())<0 for row in clearance.values()):
        raise ValueError('Subframe shoe penetration; candidate not saved')
    if any(action_fingerprint(bpy.data.actions[name])!=value for name,value in preserved.items()):
        raise ValueError('Appending run transitions changed an existing action')
    if rests!={b.name:[v for row in b.matrix_local for v in row] for b in rig.data.bones}:
        raise ValueError('Rest skeleton changed')
    if geometry!=mesh_fingerprint(rig) or digest(args.target)!=source_hash:
        raise ValueError('Appearance source changed')
    bind_action(rig,bpy.data.actions['Idle_A'])
    set_scene_frame(0)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
    result={'source':str(args.target),'sourceSha256':source_hash,'candidate':str(args.output),
            'candidateSha256':digest(args.output),'mode':'append-run-transitions',
            'geometryAndRestSkeletonUnchanged':True,'preservedActionFingerprints':preserved,
            'transitions':transitions,'clearance':clearance,'runtimeReleaseAllowed':False,
            'pending':['first-braking-contact-roll','compact-running-style','turning',
                       'hand-outfit-clearance','hair-and-cloth-follow-through','runtime-input-review']}
    args.report.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print('ALIFE_RUN_TRANSITION_RESULT='+json.dumps(result),flush=True)


def append_turn_candidate(args,rig,source_hash):
    required=('Idle_A','Walk','Run','Walk_Start','Walk_Stop','Run_Start','Run_Stop')
    if any(n not in bpy.data.actions for n in required):
        raise ValueError('Append turns to the existing locomotion/start-stop candidate')
    if any(n in bpy.data.actions for n in ('Turn_L','Turn_R','Turn_L_Source','Turn_R_Source')):
        raise ValueError('Existing turn actions must not be overwritten')
    if args.source_directory is None:
        raise ValueError('--append-turns requires --source-directory with the supplied local pack')
    sources=(('Turn_L','left turn 90.fbx','f0620a1640760de01b00d0f06dd5e3659e8074470e94167c8b2485547f1a9ead',math.pi/2),
             ('Turn_R','right turn 90.fbx','d845032d77a5d6fbc1ef093c00dd5954616ba9e524bdad0259b15330fa286782',-math.pi/2))
    for _,filename,sha,_ in sources:
        if digest(args.source_directory/filename)!=sha:raise ValueError('Unexpected turn FBX: '+filename)
    geometry=mesh_fingerprint(rig)
    rests={b.name:[v for row in b.matrix_local for v in row] for b in rig.data.bones}
    preserved={a.name:action_fingerprint(a) for a in bpy.data.actions}
    original_pose=capture(rig)
    deformers=[(m,m.show_viewport) for o in bpy.context.scene.objects if o.type=='MESH'
               for m in o.modifiers if m.type=='ARMATURE' and m.object==rig]
    try:
        for m,_ in deformers:m.show_viewport=False
        for name,filename,_,angle in sources:
            bake_clip(rig,args.source_directory/filename,name,turn_angle=angle)
    finally:
        for m,visible in deformers:m.show_viewport=visible
    bpy.context.scene.render.fps,bpy.context.scene.render.fps_base=30,1
    results=[]
    for name,_,_,_ in sources:
        offset_hips_keys(rig,bpy.data.actions[name],bpy.data.actions['Idle_A']['alifeGroundHeightOffsetM'])
        # Raw retargeting resets pose bases and can leave unkeyed scales or
        # accessory bones changed. Re-establish the existing rig state before
        # sampling Idle and authoring each turn; existing clips stay identical.
        restore(rig,original_pose)
        results.append(bake_turn(rig,name,args.profile))
        print('ALIFE_TURN_REFINED='+name,flush=True)
    clearance={name:sample_shoe_contacts(rig,bpy.data.actions[name],sample_rate_hz=240) for name,_,_,_ in sources}
    if min(v[0] for row in clearance.values() for v in row['soleMinMaxM'].values())<0:
        raise ValueError('Turn shoes penetrate ground; candidate not saved')
    snapshot(rig,bpy.data.actions['Idle_A'],0)
    idle_matrices={b.name:world_pose(rig,b.name).copy() for b in rig.pose.bones}
    joins={}
    for name,_,_,_ in sources:
        joins[name]=[]
        for frame in bpy.data.actions[name].frame_range:
            snapshot(rig,bpy.data.actions[name],frame)
            error=max(abs(a-b) for bone,matrix in idle_matrices.items()
                      for ra,rb in zip(matrix,world_pose(rig,bone)) for a,b in zip(ra,rb))
            if error>1e-6:raise ValueError('Turn does not join the existing Idle pose')
            joins[name].append(error)
    if any(action_fingerprint(bpy.data.actions[n])!=value for n,value in preserved.items()):
        raise ValueError('Turn authoring changed an existing action')
    if rests!={b.name:[v for row in b.matrix_local for v in row] for b in rig.data.bones}:
        raise ValueError('Turn authoring changed the rest skeleton')
    if geometry!=mesh_fingerprint(rig) or digest(args.target)!=source_hash:
        raise ValueError('Turn authoring changed the appearance source')
    snapshot(rig,bpy.data.actions['Idle_A'],0)
    if any((rig.pose.bones[name].scale-value[2]).length>1e-7 for name,value in original_pose.items()):
        raise ValueError('Turn authoring changed original local pose scales')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
    result={'source':str(args.target),'sourceSha256':source_hash,'candidate':str(args.output),
            'candidateSha256':digest(args.output),'mode':'append-turns','rigProfile':args.profile,'turns':results,
            'localPoseScalesPreserved':True,
            'geometryAndRestSkeletonUnchanged':True,'preservedActionFingerprints':preserved,
            'clearance':clearance,'idleJoinMatrixDifferences':joins,'runtimeReleaseAllowed':False,
            'pending':['continuous-turn-aesthetic-review','hand-outfit-clearance','hair-and-cloth-follow-through',
                       'runtime-yaw-envelope-and-input-review']}
    args.report.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print('ALIFE_TURN_RESULT='+json.dumps(result),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--profile',choices=('female','male'),default='female',
                        help='Explicit reviewed rig/footwear profile; female behavior stays the default')
    modes=parser.add_mutually_exclusive_group()
    modes.add_argument('--append-run-transitions',action='store_true',
                        help='Add Run_Start/Run_Stop without changing existing refined Walk/Run/Idle actions')
    modes.add_argument('--append-turns',action='store_true',
                       help='Append review-only quarter turns from the recorded local FBXs')
    modes.add_argument('--polish-run-stop-first-brake',action='store_true',
                       help='Stabilize only the first Run_Stop toe contact on a complete candidate')
    parser.add_argument('--source-directory',type=Path)
    for key in ('target','output','report'):
        parser.add_argument('--'+key,type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if args.self_test:
        self_test()
        return
    if any(value is None for value in (args.target,args.output,args.report)):
        parser.error('--target, --output and --report are required')
    if len({args.target.resolve(),args.output.resolve(),args.report.resolve()})!=3:
        raise ValueError('Never overwrite the input')
    if args.output.exists() or args.report.exists():
        raise FileExistsError('Use new candidate and report paths')
    source_hash=digest(args.target)
    bpy.ops.wm.open_mainfile(filepath=str(args.target.resolve()),load_ui=False)
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    male=args.profile=='male'
    expected_bones=126 if male else 187
    if len(rig.data.bones)!=expected_bones or rig.data.bones['J_Bip_C_Hips'].use_connect:
        raise ValueError(f'The {args.profile} profile requires {expected_bones} bones and translated hips')
    if bpy.context.scene.render.fps!=30 or abs(bpy.context.scene.render.fps_base-1)>1e-6:
        raise ValueError('Expected the 30 Hz retarget source convention')
    if abs(bpy.context.scene.unit_settings.scale_length-1)>1e-6:
        raise ValueError('Expected metre scene units')
    probes=shoes(rig)
    if male and any(len(patches['heel'])!=15 or len(patches['toe'])!=143 for _,patches in probes.values()):
        raise ValueError('The male contact profile requires the recorded approved boot geometry')
    expected={
        'Walk':('bd5d1ec1846e850c5eb942dca8f6de3ade7c5c9f89389ce30a97b8d9c166792e',31),
        'Run':('71967aa523974b5c57382047a4fe4373a6afc619a2228d13c254615c45bb091d',22),
        'Idle_A':('8e760a8414a1a13b2bb497a29fc577ce5c1839353dc7a2153a2ab13521c05e08',249),
    }
    for name,(source_sha,last) in expected.items():
        action=bpy.data.actions.get(name)
        if action is None or action.get('alifeSourceSha256')!=source_sha:
            raise ValueError('Contact timing requires the recorded Mixamo source: '+name)
        if abs(action.frame_range[0])>1e-6 or abs(action.frame_range[1]-last)>1e-6:
            raise ValueError('Source timing changed: '+name)
    if args.append_run_transitions:
        append_run_candidate(args,rig,source_hash)
        return
    if args.append_turns:
        append_turn_candidate(args,rig,source_hash)
        return
    if args.polish_run_stop_first_brake:
        polish_run_stop_first_brake(args,rig,source_hash)
        return
    if any(name in bpy.data.actions for name in ('Walk_Start','Walk_Stop','Walk_Source','Run_Source')):
        raise ValueError('Use the unrefined Walk/Run/Idle candidate')
    geometry=mesh_fingerprint(rig)
    rests={bone.name:bone.matrix_local.copy() for bone in rig.data.bones}
    contacts=[]
    windows=(('Walk',(.16,.24,.80,.90)),('Run',(.25,.315,.62,.72))) if male else (
        ('Walk',(.16,.23,.81,.89)),('Run',(.22,.295,.625,.73)))
    for clip,window in windows:
        result=stabilize(rig,probes,clip,window,stable_bend=male,sample_rate=120 if male else 60,skin_floor=male)
        contacts.append({k:v for k,v in result.items() if k!='corrections'})
        print('ALIFE_CONTACT_REFINED='+clip,flush=True)
    idle=bpy.data.actions['Idle_A']
    bind_action(rig,idle)
    set_scene_frame(0)
    minimum=min(p['minimum'] for p in sample_shoes(probes).values())
    offset_hips_keys(rig,idle,.003-minimum)
    idle['alifeContactGroundCorrectionM']=.003-minimum
    preserved={name:action_fingerprint(bpy.data.actions[name]) for name in expected}
    transitions=[bake(rig,'Walk_Start',idle,bpy.data.actions['Walk'],False,stable_bend=male),
                 bake(rig,'Walk_Stop',idle,bpy.data.actions['Walk'],True,stable_bend=male)]
    check_names=['Walk','Run','Walk_Start','Walk_Stop']
    if male:
        transitions.extend(bake(rig,name,idle,bpy.data.actions['Run'],stopping,True)
                           for name,stopping in (('Run_Start',False),('Run_Stop',True)))
        check_names.extend(('Run_Start','Run_Stop','Idle_A'))
    clearance={name:sample_shoe_contacts(rig,bpy.data.actions[name],sample_rate_hz=240 if male and name!='Idle_A' else 60)
               for name in check_names}
    if any(min(v[0] for v in row['soleMinMaxM'].values())<0 for row in clearance.values()):
        raise ValueError('Skinned shoe penetration; candidate not saved')
    if any(action_fingerprint(bpy.data.actions[name])!=value for name,value in preserved.items()):
        raise ValueError('Transition authoring changed a refined loop or idle')
    if geometry!=mesh_fingerprint(rig) or digest(args.target)!=source_hash:
        raise ValueError('Appearance source changed')
    if any(max(abs(x-y) for ra,rb in zip(rests[b.name],b.matrix_local)
               for x,y in zip(ra,rb))>1e-7 for b in rig.data.bones):
        raise ValueError('Rest skeleton changed')
    bind_action(rig,idle)
    set_scene_frame(0)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
    result={
        'source':str(args.target),'sourceSha256':source_hash,'candidate':str(args.output),
        'candidateSha256':digest(args.output),'profile':'male-mixamo-contact-start-stop-review' if male else 'female-mixamo-contact-walk-transition-review',
        'geometryAndMaterialAssignmentsUnchanged':True,'restSkeletonUnchanged':True,
        'contacts':contacts,'transitions':transitions,'clearance':clearance,
        'runtimeReleaseAllowed':False,
        'pending':['contact-roll-review','turning','hand-outfit-clearance',
                   'hair-and-cloth-follow-through','three-view-review','runtime-input-review']+([] if male else ['running-start-stop']),
    }
    args.report.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print('ALIFE_REFINEMENT_RESULT='+json.dumps(result),flush=True)


if __name__=='__main__':
    main()
