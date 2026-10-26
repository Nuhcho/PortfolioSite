import { MathUtils } from "three";

/** Fixed-target orbit with screen-relative input and short, controlled settling. */
export class PlazaOrbit {
  yaw:number;polar:number;zoom=1;
  targetYaw:number;targetPolar:number;targetZoom=1;
  constructor(readonly initialYaw:number,readonly initialPolar:number){
    this.yaw=this.targetYaw=initialYaw;this.polar=this.targetPolar=initialPolar;
  }
  grab(){this.targetYaw=this.yaw;this.targetPolar=this.polar;return {yaw:this.yaw,polar:this.polar};}
  drag(dx:number,dy:number,width:number,height:number,start:{yaw:number;polar:number}){
    const distance=Math.hypot(dx,dy),beyond=Math.max(0,1-6/Math.max(6,distance));
    this.targetYaw=start.yaw-dx*beyond/Math.max(1,width)*Math.PI*1.15;
    this.targetPolar=MathUtils.clamp(start.polar+dy*beyond/Math.max(1,height)*Math.PI*.42,.52,1.2);
  }
  rotate(yaw:number,polar=0){this.targetYaw+=yaw;this.targetPolar=MathUtils.clamp(this.targetPolar+polar,.52,1.2);}
  setZoom(value:number){this.targetZoom=MathUtils.clamp(value,.65,2.8);}
  zoomBy(factor:number){this.setZoom(this.targetZoom*factor);}
  reset(){this.yaw=this.targetYaw=this.initialYaw;this.polar=this.targetPolar=this.initialPolar;this.zoom=this.targetZoom=1;}
  step(dt:number,reduce=false){
    const beforeYaw=this.yaw,beforePolar=this.polar,beforeZoom=this.zoom;
    const amount=reduce?1:1-Math.exp(-18*MathUtils.clamp(dt,0,.05));
    this.yaw=MathUtils.lerp(this.yaw,this.targetYaw,amount);
    this.polar=MathUtils.lerp(this.polar,this.targetPolar,amount);
    this.zoom=MathUtils.lerp(this.zoom,this.targetZoom,amount);
    if(Math.abs(this.yaw-this.targetYaw)<.0001)this.yaw=this.targetYaw;
    if(Math.abs(this.polar-this.targetPolar)<.0001)this.polar=this.targetPolar;
    if(Math.abs(this.zoom-this.targetZoom)<.0001)this.zoom=this.targetZoom;
    return Math.abs(beforeYaw-this.yaw)>.000001 || Math.abs(beforePolar-this.polar)>.000001 || Math.abs(beforeZoom-this.zoom)>.000001;
  }
}
