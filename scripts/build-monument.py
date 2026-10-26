"""Build the portfolio architectural kit in Blender, then export a texture-free GLB.
Run: blender --background --factory-startup --python scripts/build-monument.py
Compatible with the installed Blender 2.78 and modern Blender. Coordinates below
use Three.js's Y-up convention; conversion happens when creating Blender meshes.
The .blend is the editable source. GLB export is kept dependency-free for 2.78.
"""
import bpy
import json
import math
import os
import struct
from collections import OrderedDict
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGACY = bpy.app.version < (2, 80, 0)
for obj in list(bpy.data.objects):
    if LEGACY:
        bpy.context.scene.objects.unlink(obj)
        bpy.data.objects.remove(obj)
    else:
        bpy.data.objects.remove(obj, do_unlink=True)

ROLES = OrderedDict([('stone', (0.61, 0.78, 0.73)), ('trim', (0.97, 0.945, 0.90)),
         ('shadow', (0.44, 0.64, 0.60)), ('accent', (0.91, 0.78, 0.60)),
         ('recess', (0.30, 0.28, 0.36))])
materials = {}
for name, color in ROLES.items():
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color if LEGACY else (*color, 1)
    materials[name] = mat
modules = OrderedDict()
active = None

def begin(name):
    global active
    active = name
    modules[name] = []

def mesh(name, verts, faces, role='stone', bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata([(x, -z, y) for x, y, z in verts], [], faces)
    data.update(calc_edges=True)
    obj = bpy.data.objects.new(name, data)
    if LEGACY:
        bpy.context.scene.objects.link(obj)
    else:
        bpy.context.collection.objects.link(obj)
    obj.data.materials.append(materials[role])
    obj['role'] = role
    obj['module'] = active
    # Recalculate normals once in the modelling application.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.verts)+list(bm.edges), offset=bevel, segments=3,
                        profile=.5, vertex_only=False, clamp_overlap=True)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if any(not edge.is_manifold for edge in bm.edges):
        raise ValueError("Non-manifold model: " + name)
    bm.to_mesh(data)
    bm.free()
    modules[active].append(obj)
    return obj

def cube(name, size, at, role='stone'):
    x, y, z = at
    a, b, c = [v / 2 for v in size]
    verts = [(x+sx*a, y+sy*b, z+sz*c) for sx, sy, sz in
             [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(name, verts, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)], role,
                bevel=min(.045, min(size)*.16))

def cylinder(name, radius, height, at, role='stone'):
    count=32
    verts=[(at[0]+radius*math.cos(i*2*math.pi/count),at[1]+side*height/2,
            at[2]+radius*math.sin(i*2*math.pi/count)) for side in [-1,1] for i in range(count)]
    faces=[tuple(reversed(range(count))),tuple(range(count,2*count))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    obj=mesh(name,verts,faces,role)
    for poly in obj.data.polygons:
        poly.use_smooth=abs(poly.normal.z)<.5
    return obj

def prism(name, profile, thickness, z=0, yaw=0, at=(0,0,0), role='stone'):
    # An extruded profile creates a real opening, with inner jamb and vault faces.
    n = len(profile)
    verts = []
    for depth in [-thickness/2, thickness/2]:
        for x, y in profile:
            zz = z + depth
            verts.append((x*math.cos(yaw)+zz*math.sin(yaw)+at[0],
                          y+at[1], -x*math.sin(yaw)+zz*math.cos(yaw)+at[2]))
    faces = [tuple(reversed(range(n))), tuple(range(n,2*n))]
    faces += [(k,(k+1)%n,(k+1)%n+n,k+n) for k in range(n)]
    return mesh(name, verts, faces, role)

def arch_wall(name, width, height, opening, spring, thickness, z=0, yaw=0, at=(0,0,0), role='stone'):
    r = opening/2
    # One concave wall profile; no overlaid dark cylinders or coplanar masks.
    profile = [(-width/2,0),(-width/2,height),(width/2,height),(width/2,0),(r,0),(r,spring)]
    profile += [(r*math.cos(i*math.pi/32), spring+r*math.sin(i*math.pi/32)) for i in range(1,33)]
    profile += [(-r,0)]
    return prism(name, profile, thickness, z, yaw, at, role)

def dome(name, radius, at, role='accent'):
    verts, faces = [], []
    segments, rings = 40, 12
    for j in range(rings):
        phi = (math.pi/2) * j/rings
        for i in range(segments):
            theta = 2*math.pi*i/segments
            verts.append((at[0]+radius*math.cos(phi)*math.cos(theta),
                          at[1]+radius*math.sin(phi), at[2]+radius*math.cos(phi)*math.sin(theta)))
    verts.append((at[0],at[1]+radius,at[2]))
    for j in range(rings-1):
        for i in range(segments):
            a=j*segments+i; b=j*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    for i in range(segments):
        faces.append(((rings-1)*segments+i,(rings-1)*segments+(i+1)%segments,len(verts)-1))
    faces.append(tuple(reversed(range(segments))))
    obj=mesh(name,verts,faces,role)
    for poly in obj.data.polygons:
        poly.use_smooth=poly.normal.z>-.5
    return obj

def tower_body():
    cube('Tower foundation',(2.2,.3,2.2),(0,.15,0),'trim')
    # Four closed walls with genuine recessed arches and a dark interior.
    for k in range(4):
        arch_wall('Arched tower wall',1.56,5.7,.7,1.55,.22,z=.89,yaw=k*math.pi/2,at=(0,.3,0))
    for x in [-.89,.89]:
        for z in [-.89,.89]: cube('Tower corner',(.22,5.7,.22),(x,3.15,z))
    cube('Interior floor',(1.58,.08,1.58),(0,.34,0),'recess')
    cube('Upper cornice',(2.24,.3,2.24),(0,6.15,0),'trim')
    cube('Cornice shadow course',(2.12,.1,2.12),(0,5.94,0),'shadow')
    cube('Foundation moulding',(2.08,.12,2.08),(0,.36,0),'trim')

begin('tower_dome')
tower_body()
cylinder('Drum',.85,.35,(0,6.475,0),'shadow')
dome('Stone dome',.84,(0,6.65,0))
cylinder('Finial',.08,.3,(0,7.64,0),'trim')
begin('tower_steps')
tower_body()
for i,(w,h) in enumerate([(1.8,.55),(1.2,.5),(.65,.45)]):
    y=6.3+sum([.55,.5,.45][:i])+h/2
    cube('Stepped crown',(w,h,w),(0,y,0),'accent' if i!=1 else 'trim')
begin('pavilion')
cube('Pavilion terrace',(2.3,.35,2.3),(0,.175,0),'trim')
for k in range(4):
    # Stop wall ends just short of the corners; square corner posts fill them.
    arch_wall('Open pavilion arch',1.56,2.6,1.25,1.3,.22,z=.89,yaw=k*math.pi/2,at=(0,.35,0))
for x in [-.89,.89]:
    for z in [-.89,.89]: cube('Pavilion corner',(.22,2.6,.22),(x,1.65,z))
cube('Pavilion cornice',(2.3,.28,2.3),(0,3.09,0),'trim')
dome('Pavilion dome',.92,(0,3.23,0))
cylinder('Pavilion finial',.07,.24,(0,4.27,0),'trim')
begin('arcade')
# A 2.6-unit gallery bay, with openings through both sides and a solid deck.
for z in [-.9,.9]:
    arch_wall('Gallery arch',2.6,1.9,1.5,1.0,.2,z=z)
cube('Gallery deck',(2.6,.6,2.2),(0,2.2,0),'trim')
for z in [-1.0,1.0]: cube('Gallery parapet',(2.6,.35,.2),(0,2.675,z),'trim')
begin('vault')
# Structural vaults meet the wall above without a gallery's raised parapets.
for z in [-.9,.9]:
    arch_wall('Foundation vault',2.6,1.9,1.5,1.0,.2,z=z)
cube('Vault ceiling',(2.6,.6,2.2),(0,2.2,0),'trim')
begin('staircase')
# A watertight stair flight with an underside following the treads.
# Keeping a constant stringer thickness avoids giant triangular wedges.
# Broad treads survive the distant orthographic view, including short bridges.
steps=12
# Extend below the first riser so the foot still meets its lower landing.
stringer=.4
upper=[]
for k in range(steps):
    x,y=6*k/steps,3*(k+1)/steps
    # Round just the exposed nosing in the profile, preserving flat landings.
    nose=.025
    points=[(x,3*k/steps)]
    points += [(x+nose+nose*math.cos(math.pi-j*math.pi/8),
                y-nose+nose*math.sin(math.pi-j*math.pi/8)) for j in range(5)]
    points += [(6*(k+1)/steps,y)]
    for point in points:
        if not upper or point!=upper[-1]: upper.append(point)
profile=upper+[(x,y-stringer) for x,y in reversed(upper)]
# Drop collinear endpoint vertices before triangulating the concave sides.
changed=True
while changed:
    changed=False
    for i in range(len(profile)):
        a,b,c=profile[i-1],profile[i],profile[(i+1)%len(profile)]
        if abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))<1e-10:
            profile.pop(i);changed=True;break
stair=prism('Continuous stair flight',profile,1.9,role='stone')
stair.data.materials.append(materials['trim'])
for polygon in stair.data.polygons:
    if polygon.normal.z>.5: polygon.material_index=1
begin('window')
r=.5
profile=[(-r,0),(r,0),(r,1.5)]
profile += [(r*math.cos(i*math.pi/32),1.5+r*math.sin(i*math.pi/32)) for i in range(1,33)]
prism('Recessed arch silhouette',profile,.08,z=.05,role='recess')
begin('corbel')
for i,(w,h) in enumerate([(2,.45),(1.5,.5),(.9,.55)]):
    y=-sum([.45,.5,.55][:i])-h/2
    cube('Corbel course',(w,h,w),(0,y,0),'shadow')

# Bake, triangulate and export a minimal standards-compliant glTF 2.0 binary.
# Flat masonry faces meet beveled edges; domes retain smooth vertex normals.
blob=bytearray(); views=[]; accessors=[]; meshes=[]; nodes=[]
role_ids={role:i for i,role in enumerate(ROLES)}
def accessor(values, dimension, kind, bounds=False):
    while len(blob)%4: blob.extend(b'\x00')
    start=len(blob)
    flat=[c for value in values for c in value]
    blob.extend(struct.pack('<'+'f'*len(flat),*flat))
    view=len(views); views.append({'buffer':0,'byteOffset':start,'byteLength':len(blob)-start,'target':34962})
    entry={'bufferView':view,'componentType':5126,'count':len(values),'type':kind}
    if bounds:
        entry['min']=[min(v[i] for v in values) for i in range(dimension)]
        entry['max']=[max(v[i] for v in values) for i in range(dimension)]
    accessors.append(entry)
    return len(accessors)-1
import bmesh
manifest={}
for name, objects in modules.items():
    primitives=[]; all_positions=[]
    for role in ROLES:
        positions=[]; normals=[]
        for obj in objects:
            bm=bmesh.new(); bm.from_mesh(obj.data)
            bmesh.ops.triangulate(bm,faces=list(bm.faces))
            bm.normal_update()
            if any(face.calc_area() < 1e-10 for face in bm.faces):
                raise ValueError("Degenerate triangle: " + obj.name)
            for face in bm.faces:
                if obj.data.materials[face.material_index].name != role: continue
                for vert in face.verts:
                    normal=vert.normal if face.smooth else face.normal
                    v=vert.co
                    positions.append((v.x,v.z,-v.y))
                    normals.append((normal.x,normal.z,-normal.y))
            bm.free()
        if positions:
            all_positions.extend(positions)
            primitives.append({'attributes':{'POSITION':accessor(positions,3,'VEC3',True),'NORMAL':accessor(normals,3,'VEC3')},'material':role_ids[role]})
    meshes.append({'name':name,'primitives':primitives})
    nodes.append({'name':name,'mesh':len(meshes)-1})
    manifest[name]={'vertices':len(all_positions),'min':[min(p[i] for p in all_positions) for i in range(3)],'max':[max(p[i] for p in all_positions) for i in range(3)]}

gltf={'asset':{'version':'2.0','generator':'Blender architectural kit'},'scene':0,
      'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,
      'materials':[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':list(color)+[1],'metallicFactor':0,'roughnessFactor':1}} for name,color in ROLES.items()],
      'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':accessors}
encoded=json.dumps(gltf,separators=(',',':')).encode('utf-8')
while len(encoded)%4: encoded+=b' '
while len(blob)%4: blob.extend(b'\x00')
output=os.path.join(ROOT,'public','models','monument-kit.glb')
with open(output,'wb') as f:
    f.write(struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(blob)))
    f.write(struct.pack('<II',len(encoded),0x4e4f534a));f.write(encoded)
    f.write(struct.pack('<II',len(blob),0x004e4942));f.write(blob)
with open(os.path.join(ROOT,'art','monument-kit.json'),'w') as f: json.dump(manifest,f,indent=2)
# Lay the modules out on a modelling bench in the source file.
for index,(name,objects) in enumerate(modules.items()):
    for obj in objects: obj.location.x=index*5
if LEGACY:
    bpy.context.user_preferences.filepaths.save_version = 0
else:
    bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','monument-kit.blend'))
print('EXPORTED',output,os.path.getsize(output),'bytes',manifest)
