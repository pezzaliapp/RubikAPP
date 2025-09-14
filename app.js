(()=>{
// ——— palette standard
const STICKER = { U:0xffffff, D:0xffd000, F:0x00a74a, B:0x2f6ee6, L:0xff6c00, R:0xd80027 };

const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a3142);

// camera + renderer
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(4.2, 3.8, 5.8);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
stage.appendChild(renderer.domElement);

// resize + primo render (fix iOS)
function onResize(){
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
  renderer.render(scene, camera);
}
window.addEventListener('resize', onResize, { passive:true });

// luci
scene.add(new THREE.AmbientLight(0xffffff, .9));
const key = new THREE.DirectionalLight(0xffffff, .8); key.position.set(4,7,6); scene.add(key);

// util
const nearly = (a,b,eps=1e-4)=>Math.abs(a-b)<eps;
const snap90  = rad => Math.round(rad/(Math.PI/2))*(Math.PI/2);

// —— CUBO: plastica + sticker (niente colori sulle facce 3D)
const cubelets = [];
const size = 0.98, gap = 0.012;            // gap un filo più stretto
const geo  = new THREE.BoxGeometry(size,size,size);

function makeSticker(color, axis, sign){
  const g = new THREE.PlaneGeometry(0.965, 0.965);
  const m = new THREE.MeshBasicMaterial({
    color,
    side: THREE.FrontSide,
    polygonOffset: true,            // << evita z-fighting
    polygonOffsetFactor: -2,
    polygonOffsetUnits:  -2
  });
  const s = new THREE.Mesh(g, m);
  const d = 0.515;                  // leggermente “fuori” dalla plastica
  if(axis==='x'){ s.position.x = sign*d; s.rotation.y = -sign*Math.PI/2; }
  if(axis==='y'){ s.position.y = sign*d; s.rotation.x =  sign*Math.PI/2; }
  if(axis==='z'){ s.position.z = sign*d; if(sign<0) s.rotation.y = Math.PI; }
  return s;
}

const root = new THREE.Group(); scene.add(root);

function buildSolved(){
  while(root.children.length) root.remove(root.children[0]);
  cubelets.length = 0;
  for(let i=-1;i<=1;i++){
    for(let j=-1;j<=1;j++){
      for(let k=-1;k<=1;k++){
        // plastica nera
        const plastic = new THREE.MeshStandardMaterial({ color:0x20232c, metalness:0.1, roughness:0.6 });
        const mesh = new THREE.Mesh(geo, [plastic,plastic,plastic,plastic,plastic,plastic].map(m=>m.clone()));
        const s = size + gap;
        mesh.position.set(i*s, j*s, k*s);
        mesh.userData.coord = new THREE.Vector3(i,j,k);

        // sticker sulle facce esterne
        if(i=== 1) mesh.add(makeSticker(STICKER.R,'x',+1));
        if(i===-1) mesh.add(makeSticker(STICKER.L,'x',-1));
        if(j=== 1) mesh.add(makeSticker(STICKER.U,'y',+1));
        if(j===-1) mesh.add(makeSticker(STICKER.D,'y',-1));
        if(k=== 1) mesh.add(makeSticker(STICKER.F,'z',+1));
        if(k===-1) mesh.add(makeSticker(STICKER.B,'z',-1));

        root.add(mesh); cubelets.push(mesh);
      }
    }
  }
}

buildSolved();
onResize(); // primo frame

// —— interazione (come prima)
let isOrbit=false,lastX=0,lastY=0, rotating=false;
const orbitStart=(x,y)=>{ isOrbit=true; lastX=x; lastY=y; };
const orbitMove=(x,y)=>{ if(!isOrbit||rotating) return; const dx=(x-lastX)/120, dy=(y-lastY)/120; root.rotation.y+=dx; root.rotation.x+=dy; lastX=x; lastY=y; };
const orbitEnd =()=>{ isOrbit=false; };

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let press=null;

function hitsAt(cx,cy){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.x=((cx-r.left)/r.width)*2-1; ndc.y= -((cy-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc, camera);
  // NB: intersechiamo QUALSIASI figlio (anche sticker), poi risaliamo al cubetto
  const raw = ray.intersectObjects(root.children, true);
  return raw.map(h=>{ let o=h.object; while(o && o.parent && o.parent!==root){ o=o.parent; } return {...h, object:o}; });
}

function onDown(e){ const t=e.touches?e.touches[0]:e; const h=hitsAt(t.clientX,t.clientY); if(h.length){ press={hit:h[0],x:t.clientX,y:t.clientY}; } else { orbitStart(t.clientX,t.clientY); } }
function onMove(e){ const t=e.touches?e.touches[0]:e; if(isOrbit&&!rotating){ orbitMove(t.clientX,t.clientY); return; } if(!press||rotating) return; const dx=t.clientX-press.x, dy=t.clientY-press.y; if(Math.hypot(dx,dy)>18){ rotateFromGesture(press.hit,dx,dy); press=null; } }
function onUp(){ orbitEnd(); press=null; }

renderer.domElement.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
renderer.domElement.addEventListener('touchstart', onDown, {passive:true});
window.addEventListener('touchmove', onMove, {passive:true});
window.addEventListener('touchend', onUp);

async function rotateLayer(axisChar, layerCoord, sign){
  if(rotating) return; rotating=true;
  const axis = axisChar==='X' ? new THREE.Vector3(1,0,0) : axisChar==='Y' ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
  const pick = axisChar==='X' ? m=>nearly(m.userData.coord.x,layerCoord) : axisChar==='Y' ? m=>nearly(m.userData.coord.y,layerCoord) : m=>nearly(m.userData.coord.z,layerCoord);

  const group=new THREE.Group(), layer=[];
  cubelets.forEach(m=>{ if(pick(m)){ layer.push(m); group.attach(m);} });
  scene.add(group);

  const target=(Math.PI/2)*sign, dur=200, t0=performance.now();
  await new Promise(res=>{
    function anim(now){ const t=Math.min(1,(now-t0)/dur);
      group.rotation.x=axis.x*target*t; group.rotation.y=axis.y*target*t; group.rotation.z=axis.z*target*t;
      renderer.render(scene,camera); if(t<1) requestAnimationFrame(anim); else res();
    } requestAnimationFrame(anim);
  });

  const s=size+gap;
  layer.forEach(m=>{
    m.applyMatrix4(group.matrix);
    m.position.set(Math.round(m.position.x/s)*s, Math.round(m.position.y/s)*s, Math.round(m.position.z/s)*s);
    m.userData.coord.set(Math.round(m.position.x/s), Math.round(m.position.y/s), Math.round(m.position.z/s));
    m.rotation.x=snap90(m.rotation.x); m.rotation.y=snap90(m.rotation.y); m.rotation.z=snap90(m.rotation.z);
  });
  layer.forEach(m=>root.attach(m)); scene.remove(group);
  rotating=false; renderer.render(scene,camera);
}

function rotateFromGesture(hit, dx, dy){
  if(rotating) return;
  const n = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  const dom = Math.abs(dx)>Math.abs(dy)?'x':'y';
  let axisChar;
  if(Math.abs(n.z)>0.9){ axisChar = (dom==='x')?'Y':'X'; }
  else if(Math.abs(n.x)>0.9){ axisChar = (dom==='x')?'Y':'Z'; }
  else { axisChar = (dom==='x')?'Z':'X'; }
  const sign = (dom==='x')? (dx>0?1:-1) : (dy<0?1:-1);
  const c = hit.object.userData.coord;
  const layerCoord = axisChar==='X'? c.x : axisChar==='Y'? c.y : c.z;
  rotateLayer(axisChar, layerCoord, sign);
}

// UI base
document.getElementById('btn-reset').addEventListener('click', ()=>{ root.rotation.set(0,0,0); buildSolved(); renderer.render(scene,camera); });
document.getElementById('btn-scramble').addEventListener('click', async ()=>{
  if(rotating) return;
  for(let i=0;i<20;i++){
    const rand = cubelets[(Math.random()*cubelets.length)|0];
    const fake = { object:rand, face:{ normal:new THREE.Vector3(0,0,1) } };
    const dx = (Math.random()>.5?1:-1)*30, dy=(Math.random()>.5?1:-1)*30;
    await new Promise(res=>{ const iv=setInterval(()=>{ if(!rotating){ clearInterval(iv); res(); }}, 18); rotateFromGesture(fake,dx,dy); });
  }
});

// loop
(function loop(){ renderer.render(scene,camera); requestAnimationFrame(loop); })();
})();
