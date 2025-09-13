(function(){
'use strict';
var diag = document.getElementById('diag');
function log(){ var s=[].slice.call(arguments).join(' '); if(diag) diag.textContent += s + '\n'; console.log.apply(console, arguments); }

try{
  var STICKER = { U:0xffffff, D:0xffd000, F:0x00a74a, B:0x0053d6, L:0xff6c00, R:0xd80027 };

  var stage = document.getElementById('stage');
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a3142);
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  var renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  stage.appendChild(renderer.domElement);

  function onResize(){
    var w = stage.clientWidth||800, h = stage.clientHeight||600;
    camera.aspect = w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h);
    renderer.render(scene,camera);
    log('resize', w, h);
  }
  window.addEventListener('resize', onResize, {passive:true});
  camera.position.set(4.2, 3.8, 5.8);
  camera.lookAt(0,0,0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  var key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(4,7,6); scene.add(key);

  function nearly(a,b){ return Math.abs(a-b)<1e-4; }
  function snap90(rad){ return Math.round(rad/(Math.PI/2))*(Math.PI/2); }

  var cubelets=[], root=new THREE.Group(); scene.add(root);
  var size=0.98, gap=0.012;
  var geo = new THREE.BoxGeometry(size, size, size);

  function makeSticker(color, axis, sign){
    var g = new THREE.PlaneGeometry(0.965,0.965);
    var m = new THREE.MeshBasicMaterial({ color: color, side: THREE.FrontSide, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
    var s = new THREE.Mesh(g, m);
    var d = 0.515;
    if(axis==='x'){ s.position.x = sign*d; s.rotation.y = -sign*Math.PI/2; }
    if(axis==='y'){ s.position.y = sign*d; s.rotation.x =  sign*Math.PI/2; }
    if(axis==='z'){ s.position.z = sign*d; if(sign<0) s.rotation.y = Math.PI; }
    return s;
  }
  function addCubelet(i,j,k){
    var base = new THREE.MeshStandardMaterial({color:0x20232c, metalness:0.1, roughness:0.6});
    var mesh = new THREE.Mesh(geo, [base,base,base,base,base,base].map(function(m){ return m.clone(); }));
    var s = size+gap;
    mesh.position.set(i*s, j*s, k*s);
    mesh.userData.coord = new THREE.Vector3(i,j,k);
    if(i=== 1) mesh.add(makeSticker(STICKER.R,'x',+1));
    if(i===-1) mesh.add(makeSticker(STICKER.L,'x',-1));
    if(j=== 1) mesh.add(makeSticker(STICKER.U,'y',+1));
    if(j===-1) mesh.add(makeSticker(STICKER.D,'y',-1));
    if(k=== 1) mesh.add(makeSticker(STICKER.F,'z',+1));
    if(k===-1) mesh.add(makeSticker(STICKER.B,'z',-1));
    root.add(mesh); cubelets.push(mesh);
  }
  function buildSolved(){
    while(root.children.length) root.remove(root.children[0]);
    cubelets.length=0;
    for(var i=-1;i<=1;i++)for(var j=-1;j<=1;j++)for(var k=-1;k<=1;k++) addCubelet(i,j,k);
    log('Cubelets:', cubelets.length);
  }

  var moveAlgEl = document.getElementById('move-alg');
  var moveCountEl = document.getElementById('move-count');
  var history=[], future=[], moveAlg=[], moveCount=0;

  function pushHistory(){
    var s = cubelets.map(function(m){ return {
      x:m.position.x, y:m.position.y, z:m.position.z,
      rx:m.rotation.x, ry:m.rotation.y, rz:m.rotation.z,
      cx:m.userData.coord.x, cy:m.userData.coord.y, cz:m.userData.coord.z
    }; });
    history.push(s); if(history.length>200) history.shift(); future.length=0;
  }
  function restoreState(snap){
    cubelets.forEach(function(m,i){
      var s=snap[i];
      m.position.set(s.x,s.y,s.z);
      m.rotation.set(s.rx,s.ry,s.rz);
      m.userData.coord.set(s.cx,s.cy,s.cz);
      root.attach(m);
    });
    renderer.render(scene,camera);
  }
  function addMoveNotation(n){
    moveAlg.push(n); moveCount++;
    moveAlgEl.textContent = moveAlg.join(' ');
    moveCountEl.textContent = String(moveCount);
  }

  var isOrbit=false,lastX=0,lastY=0, rotating=false;
  function orbitStart(x,y){ isOrbit=true; lastX=x; lastY=y; }
  function orbitMove(x,y){ if(!isOrbit||rotating) return; var dx=(x-lastX)/120, dy=(y-lastY)/120; root.rotation.y+=dx; root.rotation.x+=dy; lastX=x; lastY=y; }
  function orbitEnd(){ isOrbit=false; }

  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  var press=null;
  function hitsAt(cx,cy){
    var r=renderer.domElement.getBoundingClientRect();
    ndc.x=((cx-r.left)/r.width)*2-1; ndc.y= -((cy-r.top)/r.height)*2+1;
    ray.setFromCamera(ndc, camera);
    var inters = ray.intersectObjects(root.children, true);
    if(!inters.length) return [];
    var norm = inters.map(function(h){
      var obj=h.object;
      while(obj && obj.parent && obj.parent!==root){ obj = obj.parent; }
      var copy={}; for (var p in h){ copy[p]=h[p]; } copy.object=obj; return copy;
    });
    return norm;
  }
  function onDown(e){ var t=e.touches?e.touches[0]:e; var h=hitsAt(t.clientX,t.clientY);
    if(h.length){ press={hit:h[0],x:t.clientX,y:t.clientY}; } else { orbitStart(t.clientX,t.clientY); } }
  function onMove(e){ var t=e.touches?e.touches[0]:e;
    if(isOrbit&&!rotating){ orbitMove(t.clientX,t.clientY); return; }
    if(!press||rotating) return;
    var dx=t.clientX-press.x, dy=t.clientY-press.y;
    if(Math.hypot(dx,dy)>18){ rotateFromGesture(press.hit,dx,dy); press=null; } }
  function onUp(){ orbitEnd(); press=null; }

  renderer.domElement.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  renderer.domElement.addEventListener('touchstart', onDown, {passive:true});
  window.addEventListener('touchmove', onMove, {passive:true});
  window.addEventListener('touchend', onUp);

  function rotateLayer(axisChar, layerCoord, sign, record){
    if(record===undefined) record=true;
    if(rotating) return; rotating=true; if(record) pushHistory();

    var axis = axisChar==='X' ? new THREE.Vector3(1,0,0)
             : axisChar==='Y' ? new THREE.Vector3(0,1,0)
             : new THREE.Vector3(0,0,1);
    var picker = axisChar==='X' ? function(m){ return nearly(m.userData.coord.x, layerCoord); }
             : axisChar==='Y' ? function(m){ return nearly(m.userData.coord.y, layerCoord); }
             : function(m){ return nearly(m.userData.coord.z, layerCoord); };
    var group = new THREE.Group(), layer=[];
    cubelets.forEach(function(m){ if(picker(m)){ layer.push(m); group.attach(m); } });
    scene.add(group);

    var target=(Math.PI/2)*sign, dur=200, t0=performance.now();
    function animate(now){
      var t=Math.min(1,(now-t0)/dur);
      group.rotation.x = axis.x*target*t;
      group.rotation.y = axis.y*target*t;
      group.rotation.z = axis.z*target*t;
      renderer.render(scene,camera);
      if(t<1) requestAnimationFrame(animate); else bake();
    }
    requestAnimationFrame(animate);

    function bake(){
      var s=size+gap;
      layer.forEach(function(m){
        m.applyMatrix4(group.matrix);
        m.position.set(Math.round(m.position.x/s)*s, Math.round(m.position.y/s)*s, Math.round(m.position.z/s)*s);
        m.userData.coord.set(Math.round(m.position.x/s), Math.round(m.position.y/s), Math.round(m.position.z/s));
        m.rotation.x = snap90(m.rotation.x);
        m.rotation.y = snap90(m.rotation.y);
        m.rotation.z = snap90(m.rotation.z);
      });
      layer.forEach(function(m){ root.attach(m); }); scene.remove(group);
      rotating=false; renderer.render(scene,camera);
    }
  }

  function rotateFromGesture(hit, dx, dy){
    if(rotating) return;
    var faceN = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    var dom = Math.abs(dx)>Math.abs(dy)?'x':'y';
    var axisChar, layerCoord, sign;
    if(Math.abs(faceN.z)>0.9){ axisChar = (dom==='x')?'Y':'X'; }
    else if(Math.abs(faceN.x)>0.9){ axisChar = (dom==='x')?'Y':'Z'; }
    else { axisChar = (dom==='x')?'Z':'X'; }
    sign = (dom==='x')? (dx>0?1:-1) : (dy<0?1:-1);
    var c = hit.object.userData.coord;
    layerCoord = axisChar==='X'? c.x : axisChar==='Y'? c.y : c.z;

    var notation = '?';
    if(axisChar==='Y' && nearly(layerCoord, +1)) notation = (sign===-1)?'U':"U'";
    else if(axisChar==='Y' && nearly(layerCoord, -1)) notation = (sign===+1)?'D':"D'";
    else if(axisChar==='X' && nearly(layerCoord, +1)) notation = (sign===+1)?'R':"R'";
    else if(axisChar==='X' && nearly(layerCoord, -1)) notation = (sign===-1)?'L':"L'";
    else if(axisChar==='Z' && nearly(layerCoord, +1)) notation = (sign===+1)?'F':"F'";
    else if(axisChar==='Z' && nearly(layerCoord, -1)) notation = (sign===-1)?'B':"B'";
    addMoveNotation(notation);
    rotateLayer(axisChar, layerCoord, sign, true);
  }

  function playAlg(alg){
    var tokens = alg.trim().split(/\s+/).filter(Boolean).map(function(t){ return t.toUpperCase(); });
    return (async function(){
      for (var ti=0; ti<tokens.length; ti++){
        var t = tokens[ti];
        var base=t[0], mod=t.slice(1);
        var dbl = mod.indexOf('2')>=0;
        var prime = mod.indexOf(\"'\")>=0;
        var reps = dbl?2:1;
        for(var r=0;r<reps;r++){
          if(base==='U') await rotateLayer('Y', +1, prime?-1:+1, true);
          else if(base==='D') await rotateLayer('Y', -1, prime?+1:-1, true);
          else if(base==='R') await rotateLayer('X', +1, prime?+1:-1, true);
          else if(base==='L') await rotateLayer('X', -1, prime?-1:+1, true);
          else if(base==='F') await rotateLayer('Z', +1, prime?+1:-1, true);
          else if(base==='B') await rotateLayer('Z', -1, prime?-1:+1, true);
          addMoveNotation(base + (dbl? '2': (prime?\"'\":'')));
        }
      }
    })();
  }

  document.getElementById('btn-reset').addEventListener('click', function(){
    buildSolved(); root.rotation.set(0,0,0);
    history=[]; future=[]; moveAlg=[]; moveCount=0;
    moveAlgEl.textContent=''; moveCountEl.textContent='0';
    renderer.render(scene,camera); log('Reset');
  });
  document.getElementById('btn-scramble').addEventListener('click', async function(){
    var faces=['U','D','L','R','F','B']; var last=null, seq=[];
    for(var i=0;i<20;i++){ var f; do{ f=faces[(Math.random()*6)|0]; }while(f===last); last=f; var mod=Math.random()<0.33?\"'\":(Math.random()<0.5?'2':''); seq.push(f+mod); }
    await playAlg(seq.join(' '));
  });
  document.getElementById('btn-undo').addEventListener('click', function(){
    if(!history.length) return;
    var snap=history.pop();
    var curr = cubelets.map(function(m){ return {
      x:m.position.x, y:m.position.y, z:m.position.z,
      rx:m.rotation.x, ry:m.rotation.y, rz:m.rotation.z,
      cx:m.userData.coord.x, cy:m.userData.coord.y, cz:m.userData.coord.z
    }; });
    future.push(curr);
    restoreState(snap);
    if(moveAlg.length){ moveAlg.pop(); moveCount=Math.max(0,moveCount-1); }
    moveAlgEl.textContent = moveAlg.join(' ');
    moveCountEl.textContent = String(moveCount);
  });
  document.getElementById('btn-redo').addEventListener('click', function(){
    if(!future.length) return;
    var snap=future.pop();
    history.push(cubelets.map(function(m){ return {
      x:m.position.x, y:m.position.y, z:m.position.z,
      rx:m.rotation.x, ry:m.rotation.y, rz:m.rotation.z,
      cx:m.userData.coord.x, cy:m.userData.coord.y, cz:m.userData.coord.z
    }; }));
    restoreState(snap);
  });
  document.getElementById('btn-copy').addEventListener('click', function(){
    var s = moveAlg.join(' ');
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(s); }
  });

  buildSolved();
  onResize();
  renderer.render(scene,camera);
  (function loop(){ renderer.render(scene,camera); requestAnimationFrame(loop); })();
  log('Init ok');
}catch(err){
  var s = 'ERRORE FATALE: ' + (err && err.message ? err.message : String(err));
  if(diag) diag.textContent += s + '\\n';
  console.error(err);
}
})();