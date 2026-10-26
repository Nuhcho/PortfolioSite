import * as THREE from "three";
import type { Registry } from "./theme";
export type GlowLight={at:[number,number,number];size:number;color:number};

/** Billboard halos in one instanced draw, rather than a light per bulb. */
export function buildLightHalos(registry:Registry,lights:GlowLight[]) {
  const material=registry.track(new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 glowUV;varying vec3 glowColor;void main(){
      glowUV=uv;glowColor=instanceColor;
      vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
      float size=length(instanceMatrix[0].xyz)*length(modelMatrix[0].xyz);
      center.xy+=position.xy*size;
      gl_Position=projectionMatrix*center;
    }`,
    fragmentShader:`varying vec2 glowUV;varying vec3 glowColor;void main(){float r=length(glowUV-.5)*2.;
      float a=pow(max(0.,1.-r),1.8)*.85+exp(-r*r*24.)*.45;
      gl_FragColor=vec4(glowColor,min(a,.95));\n#include <colorspace_fragment>\n}`
  }));
  const mesh=new THREE.InstancedMesh(registry.geometry(new THREE.PlaneGeometry(1,1)),material,lights.length);
  mesh.name="lamp-halos";mesh.userData.excludeFromFraming=true;
  const dummy=new THREE.Object3D();lights.forEach((light,i)=>{dummy.position.set(...light.at);dummy.scale.setScalar(light.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(light.color));});
  mesh.frustumCulled=false;return mesh;
}

/** Small, broken streaks underneath a lit vessel, kept on the sea plane. */
export function buildWaterGlint(registry:Registry) {
  const time={value:0};
  const material=registry.track(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time},vertexShader:`varying vec2 glintUV;void main(){glintUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time;varying vec2 glintUV;void main(){
      vec2 p=glintUV-.5;float wiggle=sin(p.y*28.+time*2.)*.06;
      float band=smoothstep(.05,.6,sin(p.y*61.-time*3.));
      float fade=pow(max(0.,1.-abs(p.y)*2.),1.5);
      float edge=1.-smoothstep(.10,.4,abs(p.x+wiggle));
      gl_FragColor=vec4(.95,.66,.28,edge*fade*band*.34);\n#include <colorspace_fragment>\n}`
  }));
  const mesh=new THREE.Mesh(registry.geometry(new THREE.PlaneGeometry(7,9)),material);
  mesh.rotation.x=-Math.PI/2;mesh.userData.excludeFromFraming=true;
  return {mesh,update:(elapsed:number)=>{time.value=elapsed;}};
}
