"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { loadArchitecture, type ArchitectureAssets, type DownloadProgress } from "./models";
import { batchStatic } from "./batching";
import { PlazaOrbit } from "./orbit";
import { SCREEN_RIGHT, SCREEN_UP } from "./layout";
import { buildPlaza } from "./plaza";
import { ISO_DIR, Registry, createPalette } from "./theme";
import PlazaPanel from "./PlazaPanel";
import WorldLoader from "./WorldLoader";
import { PLAZA_STOPS, type PlazaStop } from "./plazaStops";
import styles from "./WorldCanvas.module.css";

const Y_AXIS = new THREE.Vector3(0, 1, 0);
// Keep the loading animation responsive between synchronous scene tasks.
const yieldForPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

/** Landmarks are the navigation; HTML controls follow their world positions. */
export default function WorldCanvas({ children }: { children: ReactNode }) {
  const [sceneReady, setSceneReady] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({ loaded: 0, total: null });
  const [preparingScene, setPreparingScene] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [night, setNight] = useState(false);
  const nightRef = useRef(false);
  const dragClickRef = useRef(false);
  const cameraActionsRef = useRef<((action: "in" | "out" | "reset" | "left" | "right") => void) | null>(null);
  const toggleNight = () => { nightRef.current = !nightRef.current; setNight(nightRef.current); };
  const [selected, setSelected] = useState<PlazaStop | null>(null);
  const selectedRef = useRef<PlazaStop | null>(null);
  const labelsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const choose = (id: PlazaStop | null) => { selectedRef.current = id; setSelected(id); };
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (textMode) return;
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      queueMicrotask(() => setTextMode(true));
      return;
    }
    let disposed = false;
    const download = new AbortController();
    let assets: ArchitectureAssets | undefined;
    let registry: Registry | undefined;
    let teardown: (() => void) | undefined;
    const checkpoint = async () => {
      download.signal.throwIfAborted();
      await yieldForPaint();
      download.signal.throwIfAborted();
    };
    const start = async () => {
      assets = await loadArchitecture(progress => {
        if (!disposed) setDownloadProgress(progress);
      }, download.signal, async () => {
        if (disposed) return;
        setPreparingScene(true);
        await checkpoint();
      });
      if (disposed) {
        assets.dispose();
        return;
      }
      await checkpoint();
      registry = new Registry(assets);
      const scene = new THREE.Scene();
      const skyLight = new THREE.HemisphereLight(0xbce7fa, 0x8066ad, .5);
      scene.add(skyLight);
      const sun = new THREE.DirectionalLight(0xfffbef, 2.7);
      sun.position.set(25, 45, 18);
      sun.castShadow = true;
      const shadowSize = innerWidth > 900 ? 4096 : 2048;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 125 });
      sun.shadow.bias = -.0006;
      sun.shadow.normalBias = .09;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      scene.add(sun);

      const plaza = await buildPlaza(registry, createPalette(registry), checkpoint);
      plaza.root.rotation.y=plaza.poses[0];
      scene.add(plaza.root);
      plaza.root.traverse(object => {
        if (!(object instanceof THREE.Mesh) || object.material instanceof THREE.ShaderMaterial) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.some(material => material.opacity === 0)) return;
        object.receiveShadow = object.name !== "animated-sail" && !object.userData.noReceiveShadow;
        object.castShadow = !object.userData.noCastShadow && !materials.some(material => material instanceof THREE.MeshBasicMaterial || material instanceof THREE.ShadowMaterial);
      });
      batchStatic(plaza.town, registry, [...plaza.dynamic, ...plaza.hotspots.map(h => h.hit)]);
      await checkpoint();
      // Onboard contact shadows handle ship detail independently. A conservative
      // shoreline bias avoids acne on thin rails, bridge decks and pier planks.
      sun.shadow.normalBias = .07;
      sun.shadow.bias = -.00045;
      renderer.shadowMap.autoUpdate = false;
      let lastShadowUpdate = -Infinity;
      let lastShadowRotation = Infinity;
      let needsRender = true;
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 700);
      await renderer.compileAsync(scene, camera);
      if (disposed) return;
      await checkpoint();
      const preferredRatio = Math.min(2.5, Math.max(devicePixelRatio, 2));
      let pixelRatio = preferredRatio;
      let qualitySamples = 0, qualityTotal = 0, lastQualityCheck = 0;
      const drawingBudget = 8_000_000;
      const updateResolution = () => {
        const cap = Math.sqrt(drawingBudget / Math.max(1, host.clientWidth * host.clientHeight));
        renderer.setPixelRatio(Math.min(pixelRatio, cap));
      };
      updateResolution();
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.appendChild(renderer.domElement);
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      let reduce = motion.matches;
      let aspect = 1;
      let frameId = 0;
      const target = new THREE.Vector3();
      const initialYaw=Math.atan2(ISO_DIR.x,ISO_DIR.z),initialPolar=Math.acos(ISO_DIR.y);
      const orbit=new PlazaOrbit(initialYaw,initialPolar);
      const orbitDirection=new THREE.Vector3();
      const baseTarget=new THREE.Vector3(-2,1.5,7).applyAxisAngle(Y_AXIS,Math.PI/4+plaza.poses[0]);
      const framingTarget=plaza.centres[0].clone().applyAxisAngle(Y_AXIS,plaza.poses[0]);
      const framingDelta=baseTarget.clone().sub(framingTarget);
      const framingWidth=plaza.width+2*Math.abs(framingDelta.dot(SCREEN_RIGHT));
      const framingHeight=plaza.height+2*Math.abs(framingDelta.dot(SCREEN_UP));
      let lastNight: boolean | null = null;
      const applyNight = (night: boolean) => {
        skyLight.color.setHex(night?0x89a9e7:0xbce7fa);
        skyLight.groundColor.setHex(night?0x292445:0x8066ad);
        skyLight.intensity=night?.48:.5;
        sun.color.setHex(night?0xa8c9ff:0xfffbef);
        sun.intensity=night?1.5:2.7;
        plaza.setNight(night);
        document.documentElement.dataset.sceneMode=night?"night":"day";
        needsRender=true;
        lastNight=night;
      };
      const wantedProgress = () => Math.max(0, PLAZA_STOPS.findIndex(s => s.id === selectedRef.current));
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const surface=host.parentElement!;
      const hitAt = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return undefined;
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
          -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObjects(plaza.hotspots.map(h => h.hit), false)[0]?.object.name as PlazaStop | undefined;
      };
      let pointerDown: { id: number; x: number; y: number; yaw: number; polar: number; interactive: boolean } | null = null;
      const pointers=new Map<number,{x:number;y:number}>();
      let pinch:{distance:number;zoom:number}|null=null;
      const onPointerDown = (event: PointerEvent) => {
        if(event.button!==0) return;
        const control=event.target instanceof Element?event.target.closest("button"):null;
        if(control && !host.contains(control))return;
        pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(pointers.size===2){
          const points=[...pointers.values()];
          pinch={distance:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y),zoom:orbit.zoom};
          pointerDown=null;dragClickRef.current=true;return;
        }
        dragClickRef.current=false;
        const start=orbit.grab();
        pointerDown={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:start.yaw,polar:start.polar,
          interactive:event.target instanceof Element && !!event.target.closest("button")};
        if(!pointerDown.interactive) host.focus({preventScroll:true});
      };
      const onPointerMove = (event: PointerEvent) => {
        if(pointers.has(event.pointerId))pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(pinch&&pointers.size>=2){
          const points=[...pointers.values()];
          const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
          orbit.setZoom(pinch.zoom*distance/Math.max(1,pinch.distance));
          needsRender=true;event.preventDefault();return;
        }
        if(pointerDown && pointerDown.id===event.pointerId) {
          const dx=event.clientX-pointerDown.x,dy=event.clientY-pointerDown.y;
          if(dragClickRef.current || Math.hypot(dx,dy)>6) {
            dragClickRef.current=true;
            try { surface.setPointerCapture(event.pointerId); } catch {}
            orbit.drag(dx,dy,host.clientWidth,host.clientHeight,pointerDown);
            needsRender=true;
            host.style.cursor="grabbing";
            event.preventDefault();return;
          }
        }
        const hit=hitAt(event);
        host.style.cursor=hit?"pointer":"grab";
        labelsRef.current.forEach((label,i)=>label?.setAttribute("data-hover",String(PLAZA_STOPS[i].id===hit)));
      };
      const onPointerUp = (event: PointerEvent) => {
        pointers.delete(event.pointerId);
        if(pinch){pinch=null;pointerDown=null;dragClickRef.current=true;return;}
        if(!pointerDown || event.pointerId!==pointerDown.id) return;
        const down=pointerDown;pointerDown=null;
        if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)dragClickRef.current=true;
        if(surface.hasPointerCapture(event.pointerId))surface.releasePointerCapture(event.pointerId);
        host.style.cursor="grab";
        if(dragClickRef.current || down.interactive) return;
        const id=hitAt(event);if(id){selectedRef.current=id;setSelected(id);}
      };
      const onPointerCancel = () => {pointerDown=null;pointers.clear();pinch=null;host.style.cursor="grab";};
      const zoom = (factor: number) => {
        orbit.zoomBy(factor);needsRender=true;
      };
      const onWheel = (event: WheelEvent) => {event.preventDefault();zoom(Math.exp(-THREE.MathUtils.clamp(event.deltaY,-150,150)*.0015));};
      const action = (action: "in" | "out" | "reset" | "left" | "right") => {
        if(action==="reset"){orbit.reset();camera.zoom=1;camera.updateProjectionMatrix();needsRender=true;}
        else if(action==="left"||action==="right"){orbit.rotate(action==="left"?.18:-.18);needsRender=true;}
        else zoom(action==="in"?1.2:1/1.2);
      };
      cameraActionsRef.current=action;
      const onKey = (event: KeyboardEvent) => {
        if(event.target!==host)return;
        if(event.key==="ArrowLeft")orbit.rotate(.1);
        else if(event.key==="ArrowRight")orbit.rotate(-.1);
        else if(event.key==="ArrowUp")orbit.rotate(0,-.06);
        else if(event.key==="ArrowDown")orbit.rotate(0,.06);
        else if(event.key==="+"||event.key==="=")zoom(1.2);
        else if(event.key==="-")zoom(1/1.2);
        else if(event.key==="0")action("reset");else return;
        event.preventDefault();needsRender=true;
      };
      surface.addEventListener("pointerdown",onPointerDown);
      surface.addEventListener("pointermove",onPointerMove);
      surface.addEventListener("pointerup",onPointerUp);
      surface.addEventListener("pointercancel",onPointerCancel);
      surface.addEventListener("wheel",onWheel,{passive:false});
      host.addEventListener("keydown",onKey);
      const resize = () => {
        const width = host.clientWidth, height = host.clientHeight;
        if (!width || !height) return;
        aspect = width / height;
        updateResolution();
        renderer.setSize(width, height);
        needsRender = true;
        const size = Math.max(framingHeight / (2 * .86), framingWidth / (2 * aspect * .9));
        camera.left = -size * aspect;
        camera.right = size * aspect;
        camera.top = size;
        camera.bottom = -size;
        camera.updateProjectionMatrix();

      };
      document.documentElement.dataset.world = "on";
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(host);

      const onMotion = (event: MediaQueryListEvent) => { reduce = event.matches; needsRender = true; };
      motion.addEventListener("change", onMotion);

      const timer = new THREE.Timer();
      let lastFrame = 0, lastWanted = -1;
      let firstFrame = true;
      let labelRotation = Infinity;
      const projected = new THREE.Vector3();
      const render = (now: number) => {
        frameId = requestAnimationFrame(render);
        const wanted = wantedProgress();
        if(lastNight!==nightRef.current)applyNight(nightRef.current);
        if (reduce && wanted === lastWanted && !needsRender) return;
        if (!reduce && now - lastFrame < 1000 / 60 - .7) return;
        const frameTime = lastFrame ? now - lastFrame : 16.7;
        lastFrame = now;
        timer.update();
        if (!reduce && !selectedRef.current) {
          qualitySamples++;
          qualityTotal += frameTime;
          if (now - lastQualityCheck > 3000 && qualitySamples > 45) {
            const average = qualityTotal / qualitySamples;
            const next = average > 25 ? Math.max(1.25, pixelRatio - .25)
              : average < 18 ? Math.min(preferredRatio, pixelRatio + .25) : pixelRatio;
            if (next !== pixelRatio) { pixelRatio = next; updateResolution(); needsRender = true; }
            qualitySamples = qualityTotal = 0;
            lastQualityCheck = now;
          }
        }
        const rotation=plaza.poses[0];
        plaza.root.rotation.y=rotation;
        const cameraChanged=orbit.step(frameTime/1000,reduce);
        if(cameraChanged)needsRender=true;
        if(Math.abs(camera.zoom-orbit.zoom)>.000001){camera.zoom=orbit.zoom;camera.updateProjectionMatrix();}
        target.copy(baseTarget);
        orbitDirection.setFromSphericalCoords(140,orbit.polar,orbit.yaw);
        camera.position.copy(target).add(orbitDirection);
        camera.lookAt(target);
        plaza.update(timer.getElapsed(), reduce);
        if (now - lastShadowUpdate > 1000 / 30 || Math.abs(rotation - lastShadowRotation) > .002) {
          renderer.shadowMap.needsUpdate = true;
          lastShadowUpdate = now;
          lastShadowRotation = rotation;
        }
        try {
          renderer.render(scene, camera);
        } catch {
          setTextMode(true);
          return;
        }
        const moveLabels = needsRender || Math.abs(rotation - labelRotation) > .0001;
        if (moveLabels) plaza.hotspots.forEach((hotspot, index) => {
          const label = labelsRef.current[index];
          if (!label) return;
          hotspot.anchor.getWorldPosition(projected).project(camera);
          label.style.left = `${(projected.x + 1) * .5 * host.clientWidth}px`;
          label.style.top = `${(1 - projected.y) * .5 * host.clientHeight}px`;
        });
        if (moveLabels) labelRotation = rotation;
        if (firstFrame) {
          firstFrame = false;
          setSceneReady(true);
        }
        lastWanted = wanted;
        needsRender = false;
      };
      const onVisibility = () => {
        if (document.hidden) cancelAnimationFrame(frameId);
        else { needsRender = true; lastFrame = 0; frameId = requestAnimationFrame(render); }
      };
      document.addEventListener("visibilitychange", onVisibility);
      frameId = requestAnimationFrame(render);
      teardown = () => {
        cameraActionsRef.current=null;
        cancelAnimationFrame(frameId);
        observer.disconnect();
        motion.removeEventListener("change", onMotion);
        surface.removeEventListener("pointerdown",onPointerDown);
        surface.removeEventListener("pointermove",onPointerMove);
        surface.removeEventListener("pointerup",onPointerUp);
        surface.removeEventListener("pointercancel",onPointerCancel);
        surface.removeEventListener("wheel",onWheel);
        host.removeEventListener("keydown",onKey);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setTextMode(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    void start().catch(() => { if (!disposed) setTextMode(true); });
    return () => {
      disposed = true;
      download.abort();
      teardown?.();
      delete document.documentElement.dataset.world;
      delete document.documentElement.dataset.sceneMode;
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      registry?.dispose();
      assets?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [textMode]);
  return <>
    <WorldLoader ready={sceneReady || textMode} download={downloadProgress} preparing={preparingScene} />
    <noscript><style>{`[data-world-loader] { display: none !important; } [data-world-fallback] { display: block !important; }`}</style></noscript>
    <div className={styles.world} inert={!sceneReady || textMode}>
      <div ref={hostRef} className={styles.canvasHost} tabIndex={0} role="region" aria-label="Interactive waterfront plaza. Drag to rotate. Arrow keys rotate the camera, plus and minus zoom, zero resets.">
        {PLAZA_STOPS.map((stop, index) => <button key={stop.id} ref={el => { labelsRef.current[index] = el; }}
          className={styles.landmark} onClick={event => {if(event.detail===0 || !dragClickRef.current)choose(stop.id);}} aria-label={`Explore ${stop.label}: ${stop.title}`}>
          <span>{stop.number}</span><strong>{stop.label}</strong><i>+</i>
        </button>)}
      </div>
      <div className={styles.sceneControls} role="group" aria-label="Scene controls">
        <button type="button" onClick={toggleNight} aria-pressed={night} aria-label={night?"Switch to daytime":"Switch to nighttime"}>{night?"☀ Day":"☾ Night"}</button>
        <span className={styles.controlDivider}/>
        <button type="button" onClick={()=>cameraActionsRef.current?.("left")} aria-label="Rotate left">↶</button>
        <button type="button" onClick={()=>cameraActionsRef.current?.("right")} aria-label="Rotate right">↷</button>
        <button type="button" onClick={()=>cameraActionsRef.current?.("in")} aria-label="Zoom in">+</button>
        <button type="button" onClick={()=>cameraActionsRef.current?.("out")} aria-label="Zoom out">−</button>
        <button type="button" onClick={()=>cameraActionsRef.current?.("reset")} aria-label="Reset camera">Reset view</button>
      </div>
      <header className={styles.intro}><p className={styles.eyebrow}>Nicolas Villegas-Kirchman</p><h1>A little plaza.{" "}<br/>A world of work.</h1><p>Applied ML & software engineering.{" "}<br/>Choose a landmark to explore.</p></header>
      <nav className={styles.exploreNav} aria-label="Portfolio landmarks">{PLAZA_STOPS.map(stop => <button key={stop.id} onClick={() => choose(stop.id)}>{stop.number} <span>{stop.title}</span></button>)}</nav>
      <p className={styles.hint}>Drag to rotate · Scroll or pinch to zoom · Click a landmark to read</p>
    </div>
    <PlazaPanel selected={textMode ? null : selected} onClose={() => choose(null)} onSelect={choose}/>
    <div data-world-fallback hidden={!textMode}>{children}</div>
  </>;
}

