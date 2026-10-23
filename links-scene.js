// Links perspective view. Coordinates remain the game's original local yards.
// This module only draws: it cannot change a shot, lie, score, pack or saved state.
import * as T from './vendor/three-r186.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
function nearest(p,path){let best=Infinity;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);best=Math.min(best,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}return best;}
function combine(geometries){
  const pos=[],norm=[],uv=[],indices=[];let offset=0;
  for(const g of geometries){pos.push(...g.attributes.position.array);norm.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);for(const n of g.index.array)indices.push(n+offset);offset+=g.attributes.position.count;g.dispose();}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}
function texture(kind){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),r=random(71+kind.length);
  x.fillStyle=kind==='sand'?'#dac9a5':kind==='green'?'#9eae64':kind==='rough'?'#506c35':'#52783f';x.fillRect(0,0,256,256);
  for(let i=0;i<18000;i++){const light=r()>.5;x.fillStyle=light?'rgba(255,252,196,.07)':'rgba(13,37,15,.07)';const a=r()*256,b=r()*256;x.fillRect(a,b,kind==='sand'?1:1+r(),kind==='sand'?1:2+r()*4);}
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
function radial(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(0,0,0,.45)');g.addColorStop(.5,'rgba(0,0,0,.25)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(c);}

export async function create(canvas,onLost){
  const foliage=await new T.TextureLoader().loadAsync(new URL('./assets/links/oak.webp',import.meta.url).href);foliage.colorSpace=T.SRGBColorSpace;
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  const scene=new T.Scene();scene.background=new T.Color('#bdd8e5');scene.fog=new T.FogExp2('#bfd3cb',.0013);
  const camera=new T.PerspectiveCamera(49,1,.08,1800),ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),0);
  const hemi=new T.HemisphereLight('#eaf4ff','#4a542a',1.6);scene.add(hemi);
  const sun=new T.DirectionalLight('#fff1cc',2.0);sun.position.set(-120,170,80);scene.add(sun);
  let root=new T.Group();scene.add(root);let key='',origin=[0,0],W=1,H=1,disposed=false,valid=false;
  const temp=new T.Vector3(),dummy=new T.Object3D(),col=new T.Color();
  const materials={},textures=[foliage];
  for(const kind of ['rough','fairway','green','sand']){const tex=texture(kind);textures.push(tex);materials[kind]=new T.MeshStandardMaterial({map:tex,roughness:1,color:kind==='fairway'?'#c3d6a2':'#ffffff'});}
  materials.tee=materials.fairway;materials.bunker=materials.sand;materials.wood=materials.rough;
  materials.water=new T.MeshStandardMaterial({color:'#3b8896',roughness:.3,metalness:.35});
  // Sky is decorative; the playable ground stays planar until elevation is sourced.
  const sky=new T.Mesh(new T.SphereGeometry(1500,24,12),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 v;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec3 d=normalize(v);float h=d.y;vec3 c=mix(vec3(.83,.88,.82),vec3(.24,.55,.80),smoothstep(-.04,.65,h));vec2 p=d.xz/max(.12,h)*1.5;float n=noise(p)*.55+noise(p*2.03)*.27+noise(p*4.13)*.12+noise(p*8.17)*.06;float cloud=smoothstep(.48,.73,n)*smoothstep(.015,.22,h);c=mix(c,vec3(.96,.97,.92),cloud*.8);gl_FragColor=vec4(c,1.);}`}));scene.add(sky);
  const shadowTex=radial();textures.push(shadowTex);
  const shadowMat=new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,opacity:.65});
  const leafMat=new T.MeshBasicMaterial({map:foliage,alphaTest:.45,color:'#e3ecd5',side:T.DoubleSide});
  leafMat.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);mvPosition.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*mvPosition;`);};
  const markerMat=new T.MeshStandardMaterial({color:'#244c69',roughness:.8});
  const ball=new T.Mesh(new T.SphereGeometry(.15,24,16),new T.MeshStandardMaterial({color:'#fffef4',roughness:.35}));scene.add(ball);
  const ballShadow=new T.Mesh(new T.PlaneGeometry(1,1),shadowMat.clone());ballShadow.rotation.x=-Math.PI/2;scene.add(ballShadow);
  const club=new T.Group();scene.add(club);
  const head=new T.Mesh(new T.SphereGeometry(1,20,12),new T.MeshStandardMaterial({color:'#253c40',metalness:.75,roughness:.25}));head.scale.set(.4,.19,.3);club.add(head);
  const shaft=new T.Mesh(new T.CylinderGeometry(.018,.024,2.1,8),new T.MeshStandardMaterial({color:'#d7dfe0',metalness:.8,roughness:.2}));shaft.position.set(.22,.98,.08);shaft.rotation.z=-.23;club.add(shaft);
  const iron=new T.Mesh(new T.BoxGeometry(.58,.26,.09),new T.MeshStandardMaterial({color:'#cbd3cd',metalness:.85,roughness:.24}));iron.rotation.x=-.3;club.add(iron);
  const grooves=new T.Group();iron.add(grooves);
  const grooveMat=new T.MeshBasicMaterial({color:'#52645f'});
  for(let i=0;i<5;i++){const line=new T.Mesh(new T.BoxGeometry(.46,.008,.004),grooveMat);line.position.set(0,-.085+i*.04,.047);grooves.add(line);}
  const grip=new T.Mesh(new T.CylinderGeometry(.037,.03,.55,10),new T.MeshStandardMaterial({color:'#21372d',roughness:1}));grip.position.set(.43,1.73,.08);grip.rotation.z=-.23;club.add(grip);
  const ring=new T.Mesh(new T.RingGeometry(.96,1,80),new T.MeshBasicMaterial({color:'#fff9cd',transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;scene.add(ring);
  const disk=new T.Mesh(new T.CircleGeometry(1,64),new T.MeshBasicMaterial({color:'#eddf9b',transparent:true,opacity:.13,depthWrite:false}));disk.rotation.x=-Math.PI/2;scene.add(disk);
  const aimGeom=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);
  const aimLine=new T.Line(aimGeom,new T.LineBasicMaterial({color:'#fff4b5',transparent:true,opacity:.8}));scene.add(aimLine);
  const traceGeom=new T.BufferGeometry();traceGeom.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(330),3));traceGeom.setDrawRange(0,0);
  const trace=new T.Line(traceGeom,new T.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.9}));trace.frustumCulled=false;scene.add(trace);
  const flag=new T.Group();scene.add(flag);const pole=new T.Mesh(new T.CylinderGeometry(.035,.035,3,8),new T.MeshStandardMaterial({color:'#faf8e8'}));pole.position.y=1.5;flag.add(pole);
  const cloth=new T.Mesh(new T.PlaneGeometry(1.45,.85),new T.MeshStandardMaterial({color:'#e94c3b',side:T.DoubleSide}));cloth.position.set(.72,2.65,0);flag.add(cloth);
  const cup=new T.Mesh(new T.CircleGeometry(.12,16),new T.MeshBasicMaterial({color:'#172b20'}));cup.rotation.x=-Math.PI/2;cup.position.y=.14;flag.add(cup);
  const landing=new T.Mesh(new T.RingGeometry(.85,1,40),new T.MeshBasicMaterial({color:'#fff6d4',side:T.DoubleSide,transparent:true,depthWrite:false}));landing.rotation.x=-Math.PI/2;scene.add(landing);
  const V=(p,y=0)=>new T.Vector3(p[0]-origin[0],y,-p[1]+origin[1]);
  function releaseRoot(){root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.isInstancedMesh)o.dispose();});scene.remove(root);root=new T.Group();scene.add(root);}
  function setHole(course,h){
    const next=course.id+':'+h.n;if(key===next)return;key=next;origin=h.tee.slice();valid=false;releaseRoot();
    const base=new T.PlaneGeometry(2400,2400);base.rotateX(-Math.PI/2);const uv=base.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,base.attributes.position.getX(i)/9,base.attributes.position.getZ(i)/9);
    root.add(new T.Mesh(base,materials.rough));
    const byKind={};
    for(const f of course.feats){const center=[(f.bb[0]+f.bb[2])/2,(f.bb[1]+f.bb[3])/2];if(nearest(center,h.path)>220)continue;
      const shape=new T.Shape();for(let i=0;i<f.pts.length;i+=2){const x=f.pts[i]-origin[0],y=f.pts[i+1]-origin[1];i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();
      const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);const lift={wood:.01,fairway:.035,tee:.05,water:.06,bunker:.075,green:.09}[f.kind]||.02;g.translate(0,lift,0);
      // Raised grass lip follows the mapped polygon, with a small decorative bevel.
      // Visual relief only: collision geometry and surveyed terrain are unchanged.
      if(f.kind==='bunker'){
        const edge=new T.ExtrudeGeometry(shape,{depth:.38,bevelEnabled:true,bevelThickness:.12,bevelSize:.16,bevelSegments:2,steps:1});
        edge.rotateX(-Math.PI/2);edge.translate(0,.035,0);
        (byKind['rough']||(byKind['rough']=[])).push(edge.index?edge:(()=>{const n=edge.attributes.position.count;edge.setIndex(Array.from({length:n},(_,i)=>i));return edge;})());
        // Lift the sand surface just above the base; the lip remains visible around it.
        g.translate(0,.40,0);
      }
      for(let i=0;i<g.attributes.uv.count;i++)g.attributes.uv.setXY(i,g.attributes.position.getX(i)/9,g.attributes.position.getZ(i)/9);
      (byKind[f.kind]||(byKind[f.kind]=[])).push(g);
    }
    for(const [kind,geoms]of Object.entries(byKind)){root.add(new T.Mesh(combine(geoms),materials[kind]||materials.rough));}
    // Every tree uses the existing simulated tree position/radius, preserving lies.
    // Shared geometry + instancing keeps the cost bounded even for larger courses.
    const trees=course.trees.filter(t=>nearest(t.p,h.path)<180).slice(0,1100);
    const crowns=new T.InstancedMesh(new T.PlaneGeometry(1,1),leafMat,trees.length);
    const shade=new T.InstancedMesh(new T.PlaneGeometry(1,1),shadowMat,trees.length);
    trees.forEach((t,i)=>{
      const p=V(t.p),height=t.r*(2.8+t.s*.8);
      dummy.position.set(p.x,height/2,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(height*.72,height,1);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);crowns.setColorAt(i,col.setHSL(.12+t.s*.08,.08+t.s*.1,.7+t.s*.16));
      dummy.position.set(p.x+t.r*.7,.11,p.z+t.r*.6);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(t.r*3.5,t.r*2.5,1);dummy.updateMatrix();shade.setMatrixAt(i,dummy.matrix);
    });
    for(const m of [shade,crowns]){m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();root.add(m);}if(crowns.instanceColor)crowns.instanceColor.needsUpdate=true;
    // An address mat and markers make the playable tee legible; decorative only.
    const address=new T.Mesh(new T.CircleGeometry(1,48),materials.fairway);
    address.rotation.x=-Math.PI/2;address.scale.set(4,7,1);address.position.copy(V(h.tee,.045));root.add(address);
    const direction=V(h.path[1]).sub(V(h.tee)).normalize(),side=new T.Vector3(-direction.z,0,direction.x);
    for(const sign of [-1,1]){const marker=new T.Mesh(new T.BoxGeometry(.3,.22,.3),markerMat);marker.position.copy(V(h.tee,.2)).addScaledVector(side,sign*2.2);root.add(marker);}
    flag.position.copy(V(h.pin,.02));
  }
  function render({course,h,ballState,anim,fx,forecast,angle,reduced,pulling}){
    if(disposed)return;setHole(course,h);
    const nw=canvas.clientWidth,nh=canvas.clientHeight;if(!nw||!nh)return;
    if(nw!==W||nh!==H){W=nw;H=nh;renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix();}
    const b=ballState.ball,u=new T.Vector3(Math.sin(angle),0,-Math.cos(angle)),right=new T.Vector3(Math.cos(angle),0,Math.sin(angle));
    const flight=anim?.kind==='shot',pos=flight?(anim.pos||anim.b):b;
    const k=flight?clamp((performance.now()-anim.t0)/anim.dur,0,1):0;
    const height=flight&&k<1?4*anim.apex*k*(1-k):0;
    const bp=V(pos,height);
    const wanted=V(b).addScaledVector(u,-14);wanted.y=8;
    const look=V(b).addScaledVector(u,22);look.y=.3;
    if(flight&&!reduced){wanted.copy(bp).addScaledVector(u,-23);wanted.y+=9;look.copy(bp).addScaledVector(u,22);look.y=Math.max(.4,height*.55);}
    if(!valid||reduced){camera.position.copy(wanted);}else camera.position.lerp(wanted,flight?.18:.24);
    camera.lookAt(look);camera.updateMatrixWorld();valid=true;
    ball.position.copy(bp);ball.position.y+=ballState.lie==='tee'&&!flight?.25:.21;ball.visible=!ballState.holed;
    ball.scale.setScalar(flight?Math.max(1,camera.position.distanceTo(ball.position)*.012):1);
    ballShadow.position.copy(V(pos,.12));ballShadow.scale.setScalar(.65+.4/(1+height/45));ballShadow.material.opacity=.65/(1+height/45);ballShadow.visible=ball.visible;
    const id=ballState.club.id||'',wedge=/°|wedge|^[PAGSL]W$|^\d{2}$/i.test(id),blade=ballState.club.putter||wedge||/i$|putt/i.test(id);
    head.visible=!blade;iron.visible=blade;iron.rotation.x=wedge?-.65:-.3;
    head.scale.set(/^dr$/i.test(id)?.4:.29,.15,.26);
    club.visible=(!flight||k<.12)&&!ballState.done;club.position.copy(V(b,.22)).addScaledVector(right,.6);club.rotation.y=-angle;
    const load=clamp(ballState.power||0,0,1.1);
    club.rotation.z=flight?-.8+Math.min(1,k/.12)*2.2:pulling?-.15-load*.9:0;
    if(pulling)club.position.addScaledVector(u,-load*.75);
    flag.rotation.y=-angle;
    ring.visible=disk.visible=aimLine.visible=!flight&&!ballState.done&&!!forecast;
    let target=null;
    if(forecast&&!flight){const F=forecast;target=[b[0]+F.u[0]*F.carryW+F.rgt[0]*F.lat,b[1]+F.u[1]*F.carryW+F.rgt[1]*F.lat];const lp=V(target,.16);
      ring.position.copy(lp);disk.position.copy(lp);ring.rotation.set(-Math.PI/2,0,-Math.atan2(F.u[0],F.u[1]));disk.rotation.copy(ring.rotation);ring.scale.set(Math.max(2,F.sl*1.6),Math.max(3,F.sc*1.6),1);disk.scale.copy(ring.scale);
      const points=[];for(let i=0;i<=32;i++){const t=i/32;points.push(V([b[0]+F.u[0]*F.carryW*t+F.rgt[0]*(F.lat-F.curve)*t+F.rgt[0]*F.curve*t*t,b[1]+F.u[1]*F.carryW*t+F.rgt[1]*(F.lat-F.curve)*t+F.rgt[1]*F.curve*t*t],.14));}if(aimLine.geometry.attributes.position.count===points.length)aimLine.geometry.setFromPoints(points);else{aimLine.geometry.dispose();aimLine.geometry=new T.BufferGeometry().setFromPoints(points);}aimLine.geometry.computeBoundingSphere();
    }
    // Read original animation samples; translate their time-independent normalized
    // progression to true world-height. Camera scale must never change the arc.
    const trail=flight?anim.trail:fx?.trail;const coords=traceGeom.attributes.position;
    let count=0;if(trail)for(const t of trail.slice(-110)){const q=V(t.p,t.worldHeight??t.hy);coords.setXYZ(count++,q.x,q.y+.2,q.z);}
    coords.needsUpdate=true;traceGeom.setDrawRange(0,count);trace.material.opacity=flight?.95:fx?Math.max(0,1-(performance.now()-fx.t0)/1500):0;
    const puff=flight&&anim.landedAt?{land:anim.land,t0:anim.landedAt}:fx;
    landing.visible=!!puff&&performance.now()-puff.t0<1500;if(landing.visible){const age=(performance.now()-puff.t0)/1500;landing.position.copy(V(puff.land,.17));landing.scale.setScalar(1+age*8);landing.material.opacity=1-age;}
    renderer.render(scene,camera);
    return{target,flight,height,progress:k,carry:flight?Math.round(Math.hypot(pos[0]-anim.b[0],pos[1]-anim.b[1])):0,ball:project(b,.25),moving:camera.position.distanceTo(wanted)>.02};
  }
  function project(p,height=0){temp.copy(V(p,height)).project(camera);return[(temp.x+1)*W/2,(1-temp.y)*H/2,temp.z];}
  function unproject(x,y){ray.setFromCamera(new T.Vector2(x/W*2-1,1-y/H*2),camera);const hit=ray.ray.intersectPlane(plane,temp);if(!hit||hit.distanceTo(camera.position)>650)return null;return[hit.x+origin[0],origin[1]-hit.z];}
  function lost(e){e.preventDefault();if(!disposed)onLost?.();}canvas.addEventListener('webglcontextlost',lost);
  function dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);const geoms=new Set(),mats=new Set();scene.traverse(o=>{if(o.geometry)geoms.add(o.geometry);if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material]))mats.add(m);}if(o.isInstancedMesh)o.dispose();});for(const g of geoms)g.dispose();for(const m of mats)m.dispose();for(const t of textures)t.dispose();renderer.dispose();renderer.forceContextLoss();}
  return{render,project,unproject,dispose,reset:()=>{valid=false;},info:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,camera:camera.position.toArray()})};
}
