import * as THREE from "three";
import { seeded } from "./architecture";
import type { buildShoreTerrain } from "./shoreTerrain";
import type { Registry } from "./theme";

/** Sparse dune plants and shells use the same surface profile as the beach. */
export function addShoreDetails(registry:Registry,coast:ReturnType<typeof buildShoreTerrain>){
  const group=new THREE.Group();group.name="beach-grass-and-shells";coast.group.add(group);
  const random=seeded(0xd0ae);
  const grass=[registry.lit(0x7ca853,{side:THREE.DoubleSide}),registry.lit(0xa8bd70,{side:THREE.DoubleSide})];
  const shellPaint=[registry.lit(0xf4e4c5),registry.lit(0xcfae8e)];
  const blade=registry.geometry(new THREE.BufferGeometry());
  blade.setAttribute("position",new THREE.Float32BufferAttribute([-.055,0,0,.055,0,0,.065,.36,.035,.17,.68,.11],3));
  blade.setIndex([0,1,2,0,2,3]);blade.computeVertexNormals();
  const shell=registry.geometry(new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2));
  for(const shore of coast.shores){
    for(let distance=1;distance<shore.length;distance+=2.1+random()*2.7){
      const t=distance/shore.length;if(shore.sample(t).width<3)continue;
      for(let i=0;i<6;i++){
        const mesh=new THREE.Mesh(blade,grass[i%2]);
        mesh.position.copy(shore.surface((t+(random()-.5)*.007+1)%1,.27+random()*.11));
        mesh.position.y-=.035;mesh.rotation.y=random()*Math.PI*2;
        mesh.scale.setScalar(.55+random()*.55);group.add(mesh);
      }
      for(let i=0;i<2;i++){
        const mesh=new THREE.Mesh(shell,shellPaint[i]);
        mesh.position.copy(shore.surface((t+(random()-.5)*.01+1)%1,.78+random()*.15));
        mesh.position.y+=.025;
        mesh.scale.set(.09+random()*.045,.04,.13+random()*.04);
        mesh.rotation.y=random()*Math.PI*2;group.add(mesh);
      }
    }
  }
}
