import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BREAKWATER_ARMS, ISLAND_SHORES, SHORE_QUAYS } from "./harborLayout";
import { type Registry } from "./theme";

export type ShoreSample = { inner: THREE.Vector3; water: THREE.Vector3; width: number };
const PROFILE = [0,.15,.32,.55,.78,1,1.24,1.6,2.1,2.65];
const OUTER = PROFILE[PROFILE.length-1];
const FRACTIONS = [...new Set([...PROFILE,...Array.from({length:33},(_,i)=>i/32*OUTER)])].sort((a,b)=>a-b);
const MAP_BOUNDS = new THREE.Vector4(-40,-33,94,92);

/** Monotone Hermite interpolation rounds the beach without overshooting sea level. */
function smoothProfile(x: readonly number[],y: readonly number[]) {
  const slopes=x.slice(1).map((value,i)=>(y[i+1]-y[i])/(value-x[i]));
  const tangents=x.map((_,i)=>{
    if(i===0)return slopes[0];
    if(i===x.length-1)return slopes[i-1];
    const before=slopes[i-1],after=slopes[i];
    if(before*after<=0)return 0;
    const left=x[i]-x[i-1],right=x[i+1]-x[i],a=2*right+left,b=right+2*left;
    return (a+b)/(a/before+b/after);
  });
  return (value:number)=>{
    if(value<=x[0])return y[0];
    for(let i=1;i<x.length;i++)if(value<x[i]){
      const span=x[i]-x[i-1],t=(value-x[i-1])/span,t2=t*t,t3=t2*t;
      return (2*t3-3*t2+1)*y[i-1]+(t3-2*t2+t)*span*tangents[i-1]
        +(-2*t3+3*t2)*y[i]+(t3-t2)*span*tangents[i];
    }
    return y[y.length-1];
  };
}
const depthAt=smoothProfile([0,.24,.6,1.1,1.65,2],[0,.42,1.5,4,7,8]);

/** Continuous land, beach and seabed surfaces share one measured waterline. */
export function buildShoreTerrain(registry: Registry, seaY: number, floor: number) {
  const group=new THREE.Group();group.name="continuous-island-terrain";
  const material=registry.lit(0xffffff,{vertexColors:true});
  const compile=material.onBeforeCompile.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    compile(shader,renderer);
    // Keep the painted lighting, with softer bands and no ink rim on the beach.
    shader.fragmentShader=shader.fragmentShader
      .replace("float aa = max(fwidth(facing) * .75, .006);","float aa = .22;")
      .replace("inkEdge * .7","inkEdge * .12");
  };
  material.customProgramCacheKey=()=>"coastal-soft-terrain-v2";
  const paintStops=[0,.22,.65,1,1.4,OUTER];
  const shorePaint=[0x91b65b,0xa2b96d,0xe0cd99,0xb9bd9a,0x7da59c,0x356f88].map(c=>new THREE.Color(c));
  const naturalHeight=smoothProfile(PROFILE,[floor-.08,floor-.13,seaY+2.9,seaY+1.9,seaY+.65,seaY,seaY-.42,seaY-1.5,seaY-4,seaY-7]);
  const retainedHeight=smoothProfile(PROFILE,[floor-.08,seaY-.35,seaY-.4,seaY-.5,seaY-.55,seaY-.6,seaY-.9,seaY-1.5,seaY-4,seaY-7]);
  const washes:THREE.BufferGeometry[]=[];
  const shores=ISLAND_SHORES.map((outline,island)=>{
    const innerCurve=new THREE.CatmullRomCurve3(outline.map(p=>new THREE.Vector3(p[0],0,p[1])),true,"centripetal");
    const waterCurve=new THREE.CatmullRomCurve3(outline.map(p=>new THREE.Vector3(p[2],0,p[3])),true,"centripetal");
    const sample=(t:number):ShoreSample=>{
      const inner=innerCurve.getPoint(t),water=waterCurve.getPoint(t);
      return {inner,water,width:Math.max(.2,inner.distanceTo(water))};
    };
    const rows=192,cols=FRACTIONS.length;
    const positions:number[]=[],colors:number[]=[],indices:number[]=[];
    const washPositions:number[]=[],washUV:number[]=[],washIndices:number[]=[];
    const samples=Array.from({length:rows+1},(_,i)=>sample(i/rows));
    const area=samples.slice(0,-1).reduce((sum,p,i)=>{
      const next=samples[(i+1)%rows].water;
      return sum+p.water.x*next.z-next.x*p.water.z;
    },0);
    for(let i=0;i<=rows;i++){
      const {inner,water,width}=samples[i],phase=i/rows*Math.PI*2;
      const delta=water.clone().sub(inner);
      const exposed=THREE.MathUtils.smoothstep(width,1.1,3);
      const weather=(Math.sin(phase*5+island)*.07+Math.sin(phase*13-island)*.035)*exposed;
      // Working quays retain their ground behind masonry. Sink the bank
      // beneath them so sand cannot cut diagonally through the wall faces.
      for(let j=0;j<cols;j++){
        const fraction=FRACTIONS[j];
        const height=THREE.MathUtils.lerp(retainedHeight(fraction),naturalHeight(fraction),exposed)
          +weather*THREE.MathUtils.smoothstep(fraction,0,.25)*(1-THREE.MathUtils.smoothstep(fraction,.65,1));
        const x=inner.x+delta.x*fraction,z=inner.z+delta.z*fraction;
        positions.push(x,height,z);
        // Broad, irregular pigment transitions avoid rings of uniform color.
        const pigment=Math.max(0,fraction+(Math.sin(x*.71+z*.29)+Math.sin(z*.83-x*.34))*.065);
        let stop=1;while(stop<paintStops.length-1&&pigment>paintStops[stop])stop++;
        const blend=THREE.MathUtils.smoothstep(pigment,paintStops[stop-1],paintStops[stop]);
        const color=shorePaint[stop-1].clone().lerp(shorePaint[stop],blend);
        const mottling=.98+.02*Math.sin(x*1.4+Math.sin(z*.8));
        color.multiplyScalar(mottling);
        colors.push(color.r,color.g,color.b);
      }
      const normal=delta.clone().normalize();
      for(const side of [-1,1]){
        washPositions.push(water.x+normal.x*side*.42,seaY+.045,water.z+normal.z*side*.42);
        washUV.push(i*.22,(side+1)/2);
      }
    }
    for(let i=0;i<rows;i++){
      for(let j=0;j<cols-1;j++){
        const a=i*cols+j,b=a+cols;indices.push(a,b,b+1,a,b+1,a+1);
      }
      const a=i*2;washIndices.push(a,a+2,a+3,a,a+3,a+1);
    }
    if(area<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    // Close the land under the paving and continue the outer rim below the
    // opaque deep water. There are no exposed end caps around the island.
    const innerPolygon=samples.slice(0,-1).map(p=>new THREE.Vector2(p.inner.x,p.inner.z));
    const outerPolygon=samples.slice(0,-1).map(p=>new THREE.Vector2(
      p.inner.x+(p.water.x-p.inner.x)*OUTER,p.inner.z+(p.water.z-p.inner.z)*OUTER));
    const addCap=(points:THREE.Vector2[],vertexAt:(i:number)=>number,up:boolean)=>{
      for(const face of THREE.ShapeUtils.triangulateShape(points,[])){
        const [a,b,c]=face.map(vertexAt);
        const ax=positions[a*3],az=positions[a*3+2],bx=positions[b*3],bz=positions[b*3+2],cx=positions[c*3],cz=positions[c*3+2];
        const cross=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
        if((cross<0)===up)indices.push(a,b,c);else indices.push(a,c,b);
      }
    };
    addCap(innerPolygon,i=>i*cols,true);
    const bottom=positions.length/3;
    for(let i=0;i<=rows;i++){
      const p=outerPolygon[i%rows],color=shorePaint[shorePaint.length-1];positions.push(p.x,seaY-8,p.y);
      colors.push(color.r,color.g,color.b);
    }
    for(let i=0;i<rows;i++){
      const a=i*cols+cols-1,b=a+cols,c=bottom+i,d=c+1;
      if(area>0)indices.push(a,b,d,a,d,c);else indices.push(a,d,b,a,c,d);
    }
    addCap(outerPolygon,i=>bottom+i,false);
    const geometry=registry.geometry(new THREE.BufferGeometry());
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    // Weld the lighting across the duplicate closing row of the smooth loop.
    const normals=geometry.getAttribute("normal"),normal=new THREE.Vector3();
    for(let j=0;j<cols;j++){
      const end=rows*cols+j;
      normal.set(normals.getX(j)+normals.getX(end),normals.getY(j)+normals.getY(end),normals.getZ(j)+normals.getZ(end)).normalize();
      normals.setXYZ(j,normal.x,normal.y,normal.z);normals.setXYZ(end,normal.x,normal.y,normal.z);
    }
    const terrain=new THREE.Mesh(geometry,material);terrain.name=`continuous-island-${island}`;group.add(terrain);
    const wash=new THREE.BufferGeometry();
    wash.setAttribute("position",new THREE.Float32BufferAttribute(washPositions,3));
    wash.setAttribute("uv",new THREE.Float32BufferAttribute(washUV,2));wash.setIndex(washIndices);washes.push(wash);
    return {sample,length:waterCurve.getLength(),samples:samples.filter((_,i)=>i%2===0).slice(0,-1)};
  });

  // A single bathymetry texture describes the same coast the geometry uses.
  // Sampling it replaces the rectangular turquoise halo around each quay.
  const size=256,data=new Uint8Array(size*size*4);
  const builtShore=[...SHORE_QUAYS,...BREAKWATER_ARMS];
  for(let row=0;row<size;row++)for(let column=0;column<size;column++){
    const x=MAP_BOUNDS.x+(column+.5)/size*MAP_BOUNDS.z,z=MAP_BOUNDS.y+(row+.5)/size*MAP_BOUNDS.w;
    let depth=8;
    for(const shore of shores){
      let inside=false,nearest=Infinity,width=1;
      for(let i=0;i<shore.samples.length;i++){
        const a=shore.samples[i],b=shore.samples[(i+1)%shore.samples.length];
        const dx=b.water.x-a.water.x,dz=b.water.z-a.water.z;
        const t=THREE.MathUtils.clamp(((x-a.water.x)*dx+(z-a.water.z)*dz)/(dx*dx+dz*dz||1),0,1);
        const px=x-a.water.x-t*dx,pz=z-a.water.z-t*dz,distance=px*px+pz*pz;
        if(distance<nearest){nearest=distance;width=THREE.MathUtils.lerp(a.width,b.width,t);}
        if((a.water.z>z)!==(b.water.z>z)&&x<(b.water.x-a.water.x)*(z-a.water.z)/(b.water.z-a.water.z)+a.water.x)inside=!inside;
      }
      depth=Math.min(depth,inside?0:depthAt(Math.sqrt(nearest)/width));
    }
    for(const bounds of builtShore){
      const dx=Math.abs(x-bounds.center[0])-bounds.halfSize[0],dz=Math.abs(z-bounds.center[1])-bounds.halfSize[1];
      const distance=Math.hypot(Math.max(dx,0),Math.max(dz,0));
      depth=Math.min(depth,3.2+distance*.7);
    }
    const offset=(row*size+column)*4;data[offset]=Math.round(Math.min(8,depth)/8*255);data[offset+3]=255;
  }
  const waterDepth=registry.track(new THREE.DataTexture(data,size,size,THREE.RGBAFormat));
  waterDepth.minFilter=waterDepth.magFilter=THREE.LinearFilter;
  waterDepth.generateMipmaps=false;waterDepth.needsUpdate=true;
  const washGeometry=mergeGeometries(washes);washes.forEach(geometry=>geometry.dispose());
  if(!washGeometry)throw new Error("Unable to join shoreline wash");
  return {group,shores,waterDepth,depthBounds:MAP_BOUNDS.clone(),washGeometry:registry.geometry(washGeometry)};
}
