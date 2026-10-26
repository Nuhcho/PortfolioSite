import * as THREE from "three";
import type { Registry } from "./theme";

export function buildFountainWater(registry: Registry) {
  const group = new THREE.Group(); group.name = "flowing-fountain";
  const time = { value: 0 };
  const night = { value: 0 };
  const basin = (radius: number, y: number) => {
    const material = registry.track(new THREE.ShaderMaterial({
      uniforms: { time, night, radius: { value: radius } },
      vertexShader: `varying vec2 basinUV;void main(){basinUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time,radius,night;varying vec2 basinUV;
      void main(){vec2 p=(basinUV-.5)*2.*radius;
        float flow=sin(p.x*3.+time*.8)*sin(p.y*4.-time*.6);
        float splash=0.;for(int i=0;i<4;i++){float a=float(i)*1.570796;vec2 impact=vec2(cos(a),sin(a))*2.15;float d=length(p-impact);
          float ripple=sin(d*16.-time*5.-float(i)*.8);splash+=smoothstep(.65,.98,ripple)*(1.-smoothstep(.08,.85,d));}
        vec3 col=mix(vec3(.10,.57,.64),vec3(.22,.70,.73),flow*.25+.5);
        col=mix(col,vec3(.72,.94,.89),clamp(splash*.32+smoothstep(.85,1.,flow)*.08,0.,.45));
        col*=mix(vec3(1.),vec3(.38,.62,.82),night);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
    }));
    const surface = new THREE.Mesh(registry.geometry(new THREE.CircleGeometry(radius, 48)), material);
    surface.rotation.x = -Math.PI / 2; surface.position.y = y; group.add(surface);
  };
  basin(2.92, .595); basin(1.17, 2.845);
  const stream = registry.track(new THREE.ShaderMaterial({
    uniforms: { time, night },
    vertexShader: `varying float flow;void main(){flow=uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float time,night;varying float flow;void main(){float foam=smoothstep(.5,.95,sin(flow*42.-time*8.));vec3 col=mix(vec3(.19,.66,.72),vec3(.65,.90,.87),foam*.55);gl_FragColor=vec4(col*mix(vec3(1.),vec3(.5,.7,.9),night),1.);\n#include <colorspace_fragment>\n}`,
  }));
  const curves: THREE.QuadraticBezierCurve3[] = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, x = Math.cos(a), z = Math.sin(a);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x * 1.17, 2.85, z * 1.17), new THREE.Vector3(x * 1.7, 2.94, z * 1.7), new THREE.Vector3(x * 2.15, .65, z * 2.15));
    curves.push(curve);
    group.add(new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(curve, 32, .045, 10, false)), stream));
  }
  const droplets = new THREE.InstancedMesh(registry.geometry(new THREE.SphereGeometry(.05, 8, 6)), registry.lit(0xd0ffef), 32);
  droplets.userData.noCastShadow = true;
  droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  droplets.frustumCulled = false; group.add(droplets);
  const dummy = new THREE.Object3D(), point = new THREE.Vector3(), tangent = new THREE.Vector3(), up = new THREE.Vector3(0,1,0);
  return { group, setNight: (value: boolean) => { night.value = Number(value); }, update: (elapsed: number, reduce: boolean) => {
    const t = reduce ? 0 : elapsed; time.value = t;
    for (let i = 0; i < 32; i++) {
      const progress = (i * .61803398875 + t * (.6 + Math.floor(i / 8) * .025)) % 1;
      const curve=curves[Math.floor(i / 8)];
      curve.getPoint(progress, point);curve.getTangent(progress,tangent);
      dummy.position.copy(point);dummy.quaternion.setFromUnitVectors(up,tangent);dummy.scale.set(.6, 1.0+progress*1.5, .6);dummy.updateMatrix();droplets.setMatrixAt(i, dummy.matrix);
    }
    droplets.instanceMatrix.needsUpdate = true;
  }};
}
