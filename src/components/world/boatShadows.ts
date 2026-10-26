import * as THREE from "three";
import type { Registry } from "./theme";

export type ShadowBox = { center: [number, number, number]; size: [number, number, number] };
export type ShadowSail = [[number, number, number], [number, number, number], [number, number, number]];

/** Analytic onboard shadows retain contact detail beyond the main shadow map.
 * Rays intersect the actual cabin/cargo boxes and sail triangles in boat space. */
export function addBoatShadows(boat: THREE.Group, registry: Registry, boxes: ShadowBox[], sails: ShadowSail[] = []) {
  const inverse = { value: new THREE.Matrix4() };
  const light = { value: new THREE.Vector3() };
  const sunlight = new THREE.Vector3(25, 45, 18).normalize();
  const literal = (v: number[]) => `vec3(${v.map(n => n.toFixed(5)).join(",")})`;
  const tests = boxes.map(box => {
    const min = box.center.map((v, i) => v - box.size[i] / 2);
    const max = box.center.map((v, i) => v + box.size[i] / 2);
    return `occlusion = max(occlusion, onboardBox(p, boatSun, ${literal(min)}, ${literal(max)}));`;
  }).concat(sails.map((_, i) => `occlusion = max(occlusion, onboardSail(p, boatSun, onboardSailVertices[${i * 3}], onboardSailVertices[${i * 3 + 1}], onboardSailVertices[${i * 3 + 2}]));`)).join("\n");
  const sailVertices = { value: sails.flatMap(triangle => triangle.map(point => new THREE.Vector3(...point))) };
  const clones = new Map<THREE.Material, THREE.Material>();
  const patch = (source: THREE.Material) => {
    const cached = clones.get(source);
    if (cached) return cached;
    if (!(source instanceof THREE.MeshToonMaterial)) return source;
    const material = registry.track(source.clone());
    material.onBeforeCompile = (shader, renderer) => {
      source.onBeforeCompile(shader, renderer);
      shader.uniforms.boatInverse = inverse;
      shader.uniforms.boatSun = light;
      if (sails.length) shader.uniforms.onboardSailVertices = sailVertices;
      shader.vertexShader = `uniform mat4 boatInverse; varying vec3 onboardPosition;\n${shader.vertexShader}`
        .replace("#include <project_vertex>", "#include <project_vertex>\nonboardPosition = (boatInverse * modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = `
        ${sails.length ? `uniform vec3 onboardSailVertices[${sails.length * 3}];` : ""}
        uniform vec3 boatSun; varying vec3 onboardPosition;
        float onboardBox(vec3 p, vec3 d, vec3 low, vec3 high) {
          vec3 safeD = mix(vec3(.0001), d, step(vec3(.0001), abs(d)));
          vec3 a = (low-p)/safeD, b = (high-p)/safeD;
          vec3 lo = min(a,b), hi = max(a,b);
          float nearT=max(max(lo.x,lo.y),lo.z), farT=min(min(hi.x,hi.y),hi.z);
          return float(nearT > .015 && farT > nearT);
        }
        float onboardSail(vec3 p, vec3 d, vec3 a, vec3 b, vec3 c) {
          vec3 e1=b-a, e2=c-a, h=cross(d,e2);
          float det=dot(e1,h);
          if(abs(det)<.0001)return 0.;
          vec3 s=p-a; float u=dot(s,h)/det;
          vec3 q=cross(s,e1); float v=dot(d,q)/det;
          float t=dot(e2,q)/det;
          return float(u>=0. && v>=0. && u+v<=1. && t>.025);
        }
        ${shader.fragmentShader}`.replace("#include <opaque_fragment>", `
          vec3 p = onboardPosition + boatSun * .008;
          float occlusion = 0.;
          ${tests}
          outgoingLight *= mix(vec3(1.), vec3(.30,.40,.56), occlusion);
          #include <opaque_fragment>
        `);
    };
    material.customProgramCacheKey = () => `${source.customProgramCacheKey()}-onboard-${tests}`;
    clones.set(source, material);
    return material;
  };
  boat.traverse(object => {
    if (object.name === "animated-sail") { object.receiveShadow = false; return; }
    if (object instanceof THREE.Mesh) object.material = Array.isArray(object.material)
      ? object.material.map(patch) : patch(object.material);
  });
  return () => {
    sails.forEach((triangle, i) => triangle.forEach((point, j) => sailVertices.value[i * 3 + j].set(...point)));
    boat.updateWorldMatrix(true, false);
    inverse.value.copy(boat.matrixWorld).invert();
    light.value.copy(sunlight).transformDirection(inverse.value);
  };
}
