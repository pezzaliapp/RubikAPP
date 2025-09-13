(()=>{

const STICKER = {
  U: 0xffffff, D: 0xffd000, F: 0x00a74a, B: 0x0053d6, L: 0xff6c00, R: 0xd80027
};

const stage = document.getElementById('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9eef6);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(4.2, 3.8, 5.8);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
stage.appendChild(renderer.domElement);

function onResize(){
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
}
window.addEventListener('resize', onResize);

scene.add(new THREE.AmbientLight(0xffffff, .8));
const dir = new THREE.DirectionalLight(0xffffff, .6);
dir.position.set(4,7,6); scene.add(dir);

function nearlyEqual(a,b,eps=1e-4){ return Math.abs(a-b) < eps; }
function roundTo90(rad){ const q = Math.round(rad / (Math.PI/2)); return q * (Math.PI/2); }

const cubelets = [];
const size = 0.98, gap = 0.02;
const geo = new THREE.BoxGeometry(size, size, size);

function materialsFor(i,j,k){
  const base = new THREE.MeshPhongMaterial({color:0x222222, shininess:30});
  const arr = [base, base, base, base, base, base].map(m=>m.clone());
  if(i=== 1) arr[0] = new THREE.MeshPhongMaterial({color:STICKER.R});
  if(i===-1) arr[1] = new THREE.MeshPhongMaterial({color:STICKER.L});
  if(j=== 1) arr[2] = new THREE.MeshPhongMaterial({color:STICKER.U});
  if(j===-1) arr[3] = new THREE.MeshPhongMaterial({color:STICKER.D});
  if(k=== 1) arr[4] = new THREE.MeshPhongMaterial({color:STICKER.F});
  if(k===-1) arr[5] = new THREE.MeshPhongMaterial({color:STICKER.B});
  return arr;
}

const root = new THREE.Group(); scene.add(root);
function buildSolved(){
  while(root.children.length) root.remove(root.children[0]);
  cubelets.length = 0;
  for(let i=-1;i<=1;i++){
    for(let j=-1;j<=1;j++){
      for(let k=-1;k<=1;k++){
        const mesh = new THREE.Mesh(geo, materialsFor(i,j,k));
        mesh.position.set(i*(size+gap), j*(size+gap), k*(size+gap));
        mesh.userData.coord = new THREE.Vector3(i,j,k);
        root.add(mesh); cubelets.push(mesh);
      }
    }
  }
}
buildSolved();

let isOrbit=false, lastX=0, lastY=0;
function orbitStart(x,y){ isOrbit=true; lastX=x; lastY=y; }
function orbitMove(x,y){ if(!isOrbit) return; const dx=(x-lastX)/120, dy=(y-lastY)/120; root.rotation.y += dx; root.rotation.x += dy; lastX=x; lastY=y; }
function orbitEnd(){ isOrbit=false; }

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let pressInfo=null, rotating=false;

function getHits(cx,cy){
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((cx-r.left)/r.width)*2-1; ndc.y = -((cy-r.top)/r.height)*2+1;
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(cubelets);
}

function onPointerDown(e){
  const t = e.touches ? e.touches[0] : e;
  const hits = getHits(t.clientX, t.clientY);
  if(hits.length){ pressInfo = {hit:hits[0], x:t.clientX, y:t.clientY}; }
  else { orbitStart(t.clientX, t.clientY); }
}
function onPointerMove(e){
  const t = e.touches ? e.touches[0] : e;
  if(isOrbit && !rotating){ orbitMove(t.clientX, t.clientY); return; }
  if(!pressInfo || rotating) return;
  const dx = t.clientX - pressInfo.x, dy = t.clientY - pressInfo.y;
  if(Math.hypot(dx,dy) > 18){
    rotateFromGesture(pressInfo.hit, dx, dy);
    pressInfo = null;
  }
}
function onPointerUp(){ orbitEnd(); pressInfo=null; }

renderer.domElement.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);
renderer.domElement.addEventListener('touchstart', onPointerDown, {passive:true});
window.addEventListener('touchmove', onPointerMove, {passive:true});
window.addEventListener('touchend', onPointerUp);

function rotateFromGesture(hit, dx, dy){
  if(rotating) return; rotating=true;
  const faceNormal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  const dominant = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  let axis = new THREE.Vector3();
  if(Math.abs(faceNormal.z) > 0.9){ axis = (dominant==='x') ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0); }
  else if(Math.abs(faceNormal.x) > 0.9){ axis = (dominant==='x') ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1); }
  else { axis = (dominant==='x') ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0); }
  let sign = (dominant==='x') ? (dx>0?1:-1) : (dy<0?1:-1);

  const coord = hit.object.userData.coord.clone();
  let selector;
  if(Math.abs(axis.x) > 0.9) selector = m=> nearlyEqual(m.userData.coord.x, coord.x);
  else if(Math.abs(axis.y) > 0.9) selector = m=> nearlyEqual(m.userData.coord.y, coord.y);
  else selector = m=> nearlyEqual(m.userData.coord.z, coord.z);

  const group = new THREE.Group(), layer=[];
  cubelets.forEach(m=>{ if(selector(m)){ layer.push(m); group.attach(m); } });
  scene.add(group);

  const target = (Math.PI/2) * sign;
  const dur = 200; const t0 = performance.now();
  function anim(now){
    const t = Math.min(1, (now-t0)/dur);
    group.rotation.x = axis.x * target * t;
    group.rotation.y = axis.y * target * t;
    group.rotation.z = axis.z * target * t;
    renderer.render(scene, camera);
    if(t<1) requestAnimationFrame(anim);
    else finalize();
  }
  requestAnimationFrame(anim);

  function finalize(){
    layer.forEach(m=>{
      m.applyMatrix4(group.matrix);
      const p=m.position, s=size+gap;
      p.x = Math.round(p.x/s)*s; p.y = Math.round(p.y/s)*s; p.z = Math.round(p.z/s)*s;
      m.userData.coord.set(Math.round(p.x/s), Math.round(p.y/s), Math.round(p.z/s));
      m.rotation.x = roundTo90(m.rotation.x);
      m.rotation.y = roundTo90(m.rotation.y);
      m.rotation.z = roundTo90(m.rotation.z);
    });
    layer.forEach(m=>root.attach(m)); scene.remove(group);
    rotating=false;
  }
}

document.getElementById('btn-reset').addEventListener('click', ()=>{
  root.rotation.set(0,0,0); buildSolved();
});
document.getElementById('btn-scramble').addEventListener('click', async ()=>{
  if(rotating) return;
  for(let i=0;i<20;i++){
    const rand = cubelets[(Math.random()*cubelets.length)|0];
    const fake = {object:rand, face:{normal:new THREE.Vector3(0,0,1)}};
    const dx = (Math.random()>.5?1:-1)*30, dy=(Math.random()>.5?1:-1)*30;
    await new Promise(res=>{ const iv=setInterval(()=>{ if(!rotating){ clearInterval(iv); res(); }}, 18); rotateFromGesture(fake, dx, dy); });
  }
});

function loop(){ renderer.render(scene,camera); requestAnimationFrame(loop); }
onResize(); loop();
})();