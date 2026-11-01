/* MagicRings — vanilla JS/WebGL2 port of React Bits <MagicRings/> (same props, same shaders). */
(function(){
'use strict';
var MAX_RINGS=12,MAX_BURSTS=3,SLOTS=MAX_RINGS+MAX_BURSTS,SEGMENTS=128;
var FULLSCREEN='\nconst vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));\nvoid main() {\n  gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0);\n}';
var STRIP=`
layout(location = 0) in vec2 aSegment;
uniform mat3 uForward;
uniform vec2 uResolution;
uniform float uUnit;
uniform vec2 uCenter;
uniform vec4 uShape[SLOTS];
uniform vec4 uFrame[SLOTS];
uniform float uReach;
uniform float uSplit;
flat out int vSlot;
out vec2 vPlane;
void main() {
  vec4 shape = uShape[gl_InstanceID];
  vec2 origin = uCenter + uFrame[gl_InstanceID].xy;
  float angle = aSegment.x * 6.2831853;
  vec2 direction = vec2(cos(angle), sin(angle));
  vec3 inner = uForward * vec3(origin + direction * shape.x, 1.0);
  vec3 outer = uForward * vec3(origin + direction * (shape.x + 0.01), 1.0);
  float pixels = length(outer.xy / outer.z - inner.xy / inner.z) * 100.0 * uUnit;
  float band = uReach / max(pixels, 1e-3) + uSplit * shape.x;
  vec2 plane = origin + direction * max(shape.x + aSegment.y * band, 0.0);
  vec3 screen = uForward * vec3(plane, 1.0);
  gl_Position = vec4(screen.xy * (2.0 * uUnit / uResolution), 0.0, screen.z);
  vPlane = plane;
  vSlot = gl_InstanceID;
}`;
var COMMON=`
uniform vec2 uResolution;
uniform vec2 uScale;
uniform float uUnit;
uniform mat3 uInverse;
uniform vec2 uCenter;
uniform int uCount;
uniform vec4 uShape[SLOTS];
uniform vec4 uFrame[SLOTS];
uniform vec4 uTint[SLOTS];
uniform vec4 uHover;
uniform vec2 uBounds;
uniform float uSplit;
uniform float uOpacity;
out vec4 fragColor;
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float angleOf(vec2 v) {
  vec2 a = abs(v);
  float t = min(a.x, a.y) / max(max(a.x, a.y), 1e-6);
  float r = t * (0.5 + 0.1738 * (1.0 - t));
  return a.y > a.x ? 1.0 - r : r;
}
float nearness(vec2 plane) {
  vec2 offset = plane - uHover.xy;
  return uHover.z * exp(-dot(offset, offset) * uHover.w);
}
vec3 prismOf(vec3 tint) {
  return mix(tint, vec3(dot(tint, vec3(0.3333))), 0.65) * 0.85;
}
vec4 toneMap(vec3 light) {
  float peak = max(max(light.r, light.g), light.b);
  if (peak <= 0.0) return vec4(0.0);
  float level = 1.0 - exp(-peak);
  vec3 color = mix(light * (level / peak), vec3(level), smoothstep(1.4, 3.6, peak) * 0.4);
  return vec4(color, level);
}
`;
var GLOW=`
uniform vec4 uHalo;
uniform vec3 uRange;
float haloOf(float d) {
  float fall = exp(-d * uHalo.y);
  float tight = fall * fall;
  tight *= tight;
  float window = clamp(1.0 - (d - uRange.x) * uRange.y, 0.0, 1.0);
  return (uHalo.z * tight + uHalo.w * fall) * window * window;
}
void main() {
  vec3 projected = uInverse * vec3((gl_FragCoord.xy * uScale - 0.5 * uResolution) / uUnit, 1.0);
  vec2 plane = projected.xy / projected.z;
  vec2 base = plane - uCenter;
  float reach = length(base);
  if (projected.z <= 0.0 || reach < uBounds.x || reach > uBounds.y) {
    fragColor = vec4(0.0);
    return;
  }
  float boost = 1.0 + 1.6 * nearness(plane);
  float limit = uRange.z + uSplit;
  vec3 light = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < SLOTS; i++) {
    if (i >= uCount) break;
    vec4 shape = uShape[i];
    vec4 frame = uFrame[i];
    vec2 w = base - frame.xy;
    float len = length(w);
    float d = abs(len - shape.x);
    if (d > limit) continue;
    float a = angleOf(vec2(dot(w, frame.zw), frame.z * w.y - frame.w * w.x));
    if (a > shape.w) continue;
    float energy = shape.y * max(exp(-shape.z * a * a * a) - 0.002, 0.0) * boost;
    vec3 tint = uTint[i].rgb;
#ifdef PRISM
    float offset = uSplit * shape.x;
    vec3 halo = vec3(haloOf(abs(len - shape.x - offset)), haloOf(d), haloOf(abs(len - shape.x + offset)));
#else
    vec3 halo = vec3(haloOf(d));
#endif
#ifdef LIGHT
    float layer = clamp(energy * dot(halo, vec3(0.3333)), 0.0, 1.0);
    light = tint * layer + light * (1.0 - layer);
    alpha = layer + alpha * (1.0 - layer);
#else
#ifdef PRISM
    tint = prismOf(tint);
#endif
    light += tint * energy * halo;
#endif
  }
#ifdef LIGHT
  fragColor = vec4(light, alpha);
#elif defined(PACKED)
  fragColor = vec4(1.0 - exp(-light), 1.0);
#else
  fragColor = vec4(light, 1.0);
#endif
}`;
var COMPOSE=`
uniform sampler2D uGlow;
uniform float uGrain;
uniform float uTime;
void main() {
  vec4 glow = texture(uGlow, gl_FragCoord.xy / uResolution);
  float grain = 1.0;
  if (uGrain > 0.0) grain += uGrain * (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 413.0) - 0.5) * 1.8;
  float dither = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
#ifdef LIGHT
  float alpha = clamp(glow.a * grain, 0.0, 1.0);
  if (alpha <= 0.0) { fragColor = vec4(0.0); return; }
  vec3 ink = glow.rgb * grain;
  alpha = clamp(alpha + dither, 0.0, 1.0);
  fragColor = vec4(min(ink, vec3(alpha)), alpha) * uOpacity;
#else
#ifdef PACKED
  vec3 light = -log(1.0 - min(glow.rgb, vec3(0.9995))) * grain;
#else
  vec3 light = glow.rgb * grain;
#endif
  vec4 color = toneMap(light);
  if (color.a <= 0.0) { fragColor = vec4(0.0); return; }
  float alpha = clamp(color.a + dither, 0.0, 1.0);
  fragColor = vec4(min(color.rgb, vec3(alpha)), alpha) * uOpacity;
#endif
}`;
var LINE=`
flat in int vSlot;
in vec2 vPlane;
uniform float uWidth;
float coverage(float pixels, float halfWidth) {
  return clamp(max(halfWidth, 0.5) - pixels + 0.5, 0.0, 1.0) * min(halfWidth * 2.0, 1.0);
}
void main() {
  vec4 shape = uShape[vSlot];
  vec4 frame = uFrame[vSlot];
  vec4 tint = uTint[vSlot];
  vec2 w = vPlane - uCenter - frame.xy;
  float len = length(w);
  float stretch = 1.0 / max(length(vec2(dFdx(len), dFdy(len))), 1e-6);
  float a = angleOf(vec2(dot(w, frame.zw), frame.z * w.y - frame.w * w.x));
  float near = nearness(vPlane);
  float energy = shape.y * max(exp(-shape.z * a * a * a) - 0.002, 0.0) * (1.0 + 1.6 * near) * step(a, shape.w);
  float halfWidth = uWidth * (1.0 + 0.45 * near) * max(1.0 - a, 0.5) * tint.w;
  float pixels = abs(len - shape.x) * stretch;
#ifdef PRISM
  float offset = uSplit * shape.x;
  vec3 core = vec3(coverage(abs(len - shape.x - offset) * stretch, halfWidth), coverage(pixels, halfWidth), coverage(abs(len - shape.x + offset) * stretch, halfWidth));
#else
  vec3 core = vec3(coverage(pixels, halfWidth));
#endif
#ifdef LIGHT
  float hot = core.g * clamp(1.0 - pixels / max(halfWidth * 0.35, 0.3), 0.0, 1.0);
  float layer = energy * max(max(core.r, core.g), core.b);
  if (layer <= 0.0) discard;
#ifdef PRISM
  vec3 color = clamp(1.0 - (1.0 - tint.rgb) * core * 1.4, 0.0, 1.0);
#else
  vec3 color = tint.rgb;
#endif
  color = mix(color, vec3(1.0), hot * 0.7);
  fragColor = vec4(color * layer, layer) * uOpacity;
#else
#ifdef PRISM
  vec4 color = toneMap(prismOf(tint.rgb) * energy * core * 1.7);
#else
  vec4 color = toneMap(tint.rgb * energy * core * 1.7);
#endif
  if (color.a <= 0.0) discard;
  fragColor = color * uOpacity;
#endif
}`;
function shaderSource(body,flags){return ['#version 300 es','precision highp float;','#define SLOTS '+SLOTS].concat(flags.map(function(f){return '#define '+f})).concat([body]).join('\n')}
var FRAGMENTS={glow:GLOW,compose:COMPOSE,line:LINE};
var MOTIONS=['pulse','ripple','breathe'],CYCLE=3.45,STAGGER=0.5,DEPTH=2.6,BURST_LIFE=1.1,BURST_SPEED=0.9;
function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
function smoothstep(f,t,v){var x=clamp((v-f)/(t-f),0,1);return x*x*(3-2*x)}
function pulseLife(t){return Math.min(smoothstep(0,0.7,t),1-smoothstep(0.5,3.25,t))}
function toLinear(c){return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)}
function parseColor(value){
  var text=String(value||'').trim(),hex=/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if(hex){var full=hex[1].length===3?hex[1].replace(/./g,function(d){return d+d}):hex[1];return [0,2,4].map(function(i){return parseInt(full.slice(i,i+2),16)/255})}
  var rgb=/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  if(rgb)return [rgb[1],rgb[2],rgb[3]].map(function(c){return clamp(parseFloat(c)/255,0,1)});
  var ctx=document.createElement('canvas').getContext('2d');
  if(ctx){ctx.fillStyle='#000000';ctx.fillStyle=text;var n=String(ctx.fillStyle);if(n!=='#000000'||/^(#0{3}|#0{6}|black)$/i.test(text))return parseColor(n)}
  return [0.66,0.33,0.97];
}
function compile(gl,type,src){var s=gl.createShader(type);if(!s)return null;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));gl.deleteShader(s);return null}return s}
function link(gl,vs,fs){
  var v=compile(gl,gl.VERTEX_SHADER,vs),f=compile(gl,gl.FRAGMENT_SHADER,fs),p=v&&f?gl.createProgram():null;
  if(!v||!f||!p){if(v)gl.deleteShader(v);if(f)gl.deleteShader(f);return null}
  gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(p));gl.deleteProgram(p);return null}
  var u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(var i=0;i<n;i++){var info=gl.getActiveUniform(p,i);if(info)u[info.name.replace(/\[0\]$/,'')]=gl.getUniformLocation(p,info.name)}
  return {program:p,uniforms:u};
}
function invert(m){var a=m[0],b=m[1],c=m[2],d=m[3],e=m[4],f=m[5],g=m[6],h=m[7],i=m[8];var A=e*i-f*h,B=f*g-d*i,C=d*h-e*g,det=a*A+b*B+c*C;
  return [A,c*h-b*i,b*f-c*e,B,a*i-c*g,c*d-a*f,C,b*g-a*h,a*e-b*d].map(function(x){return x/det})}
function planeFor(tx,ty){var ax=tx*Math.PI/180,ay=ty*Math.PI/180,cx=Math.cos(ax),sx=Math.sin(ax),cy=Math.cos(ay),sy=Math.sin(ay);
  var fw=[cy,sy*sx,0,0,cx,0,(sy*cx)/DEPTH,-sx/DEPTH,1];return {forward:fw,inverse:invert(fw)}}
function project(m,x,y){var w=m[6]*x+m[7]*y+m[8];return [(m[0]*x+m[1]*y+m[2])/w,(m[3]*x+m[4]*y+m[5])/w,w]}
var DEFAULTS={color:'#A855F7',colorTwo:'#6366F1',ringCount:6,motion:'pulse',speed:1,lineThickness:2,glow:1,baseRadius:0.35,radiusStep:0.1,expansion:0.1,taper:1.5,rotation:0,spin:0,tilt:0,dispersion:0,grain:0,opacity:1,followMouse:false,mouseInfluence:0.2,hoverScale:1.2,hoverIntensity:1,parallax:0.05,clickBurst:true,intro:true,theme:'dark',maxDevicePixelRatio:2};
function normalize(o){
  var light=o.theme==='light',a=parseColor(o.color),b=parseColor(o.colorTwo);
  return {color:light?a:a.map(toLinear),colorTwo:light?b:b.map(toLinear),ringCount:clamp(Math.round(o.ringCount),1,MAX_RINGS),motion:MOTIONS.indexOf(o.motion)>=0?o.motion:'pulse',speed:Math.max(0,o.speed),lineThickness:Math.max(0.25,o.lineThickness),glow:clamp(o.glow,0,3),baseRadius:Math.max(0.01,o.baseRadius),radiusStep:Math.max(0,o.radiusStep),expansion:o.expansion,taper:Math.max(0.5,o.taper),rotation:o.rotation*Math.PI/180,spin:o.spin,tilt:clamp(o.tilt,-80,80),dispersion:clamp(o.dispersion,0,1),grain:clamp(o.grain,0,1),opacity:clamp(o.opacity,0,1),followMouse:!!o.followMouse,mouseInfluence:o.mouseInfluence,hoverScale:Math.max(0.5,o.hoverScale),hoverIntensity:Math.max(0,o.hoverIntensity),parallax:o.parallax,clickBurst:!!o.clickBurst,intro:!!o.intro,light:light,maxRatio:clamp(o.maxDevicePixelRatio,0.5,3)};
}
function MagicRings(container,opts){
  this.container=container;this.props=Object.assign({},DEFAULTS,opts||{});this.s=normalize(this.props);this.generation=0;
  container.classList.add('magic-rings');
  this.canvas=document.createElement('canvas');this.canvas.className='magic-rings__canvas';this.canvas.setAttribute('aria-hidden','true');container.appendChild(this.canvas);
  this.ok=this._mount();
  if(!this.ok)container.classList.add('magic-rings--fallback');
}
MagicRings.prototype.set=function(opts){Object.assign(this.props,opts);this.s=normalize(this.props);if(this._wake)this._wake()};
MagicRings.prototype.destroy=function(){if(this._cleanup)this._cleanup()};
MagicRings.prototype._mount=function(){
  var self=this,container=this.container,canvas=this.canvas,generation=this.generation;
  var gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,powerPreference:'default'});
  if(!gl)return false;
  var programs=new Map();
  function programFor(name,flags){var key=name+'|'+flags.join(',');if(!programs.has(key)){var vtx=shaderSource(name==='line'?STRIP:FULLSCREEN,flags);programs.set(key,link(gl,vtx,shaderSource(COMMON+FRAGMENTS[name],flags)))}return programs.get(key)}
  if(!programFor('glow',[])||!programFor('compose',[])||!programFor('line',[]))return false;
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var vao=gl.createVertexArray(),stripVao=gl.createVertexArray(),stripBuffer=gl.createBuffer(),strip=new Float32Array((SEGMENTS+1)*4);
  for(var k=0;k<=SEGMENTS;k++)strip.set([k/SEGMENTS,-1,k/SEGMENTS,1],k*4);
  gl.bindVertexArray(stripVao);gl.bindBuffer(gl.ARRAY_BUFFER,stripBuffer);gl.bufferData(gl.ARRAY_BUFFER,strip,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);
  var glowTexture=gl.createTexture(),glowBuffer=gl.createFramebuffer(),glowSize={width:0,height:0},floatGlow=!!gl.getExtension('EXT_color_buffer_float');
  var shape=new Float32Array(SLOTS*4),frameData=new Float32Array(SLOTS*4),tints=new Float32Array(SLOTS*4);
  var size={width:1,height:1,ratio:1,unit:1},pointer={x:0,y:0,inside:false,touch:false},spring={x:0,y:0,vx:0,vy:0,hover:0,hoverVelocity:0},bursts=[];
  var introLive=self.s.intro&&self.s.speed>0&&!reduced&&generation===0,time=introLive?0:1.6,clock=0,raf=0,last=0,visible=true,pageVisible=document.visibilityState!=='hidden',lost=false;
  function resize(){
    var s=self.s,rect=container.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,s.maxRatio);
    var width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
    size.width=width;size.height=height;size.ratio=ratio;size.unit=Math.max(1,Math.min(width,height));
    var gw=Math.max(1,Math.ceil(width/2)),gh=Math.max(1,Math.ceil(height/2));
    if(glowSize.width===gw&&glowSize.height===gh)return;glowSize.width=gw;glowSize.height=gh;
    function allocate(useFloat){
      gl.bindTexture(gl.TEXTURE_2D,glowTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,useFloat?gl.RGBA16F:gl.RGBA8,gw,gh,0,gl.RGBA,useFloat?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,glowBuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,glowTexture,0);
      var complete=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);return complete;
    }
    if(!allocate(floatGlow)){floatGlow=false;allocate(false)}
  }
  function ringState(s,index,count){
    var mix=count>1?index/(count-1):0;
    if(s.motion==='ripple'){
      var span=count*s.radiusStep+s.expansion,period=CYCLE*Math.max(1,count)*0.32,phase=time/period+index/count,progress=phase-Math.floor(phase);
      var born=time-progress*period>=-1e-4||!introLive,life=born?smoothstep(0,0.12,progress)*(1-smoothstep(0.62,1,progress)):0;
      return {radius:s.baseRadius+progress*span,life:life,virtual:progress*Math.max(1,count-1),mix:progress,opening:1};
    }
    if(s.motion==='breathe'){
      var wave=Math.sin((time/4)*Math.PI*2-index*0.55),rise=introLive?smoothstep(index*0.12,index*0.12+0.9,time):1;
      return {radius:s.baseRadius+index*s.radiusStep+s.expansion*0.5*(1+wave),life:(0.78+0.22*wave)*rise,virtual:index,mix:mix,opening:1};
    }
    var local=time-index*STAGGER,t=((local%CYCLE)+CYCLE)%CYCLE,lf=introLive&&local<0?0:pulseLife(t);
    return {radius:s.baseRadius+index*s.radiusStep+(1-Math.pow(1-t/CYCLE,2))*s.expansion,life:lf,virtual:index,mix:mix,opening:introLive&&local<CYCLE?smoothstep(0,0.9,local):1};
  }
  function render(){
    var s=self.s,count=s.ringCount,hover=spring.hover,still=reduced?0:1,scale=1+(s.hoverScale-1)*hover*still;
    var mouseX=spring.x*still,mouseY=spring.y*still,leanX=s.tilt-mouseY*s.parallax*260,leanY=mouseX*s.parallax*260,view=planeFor(leanX,leanY);
    var center=s.followMouse?[mouseX*s.mouseInfluence,mouseY*s.mouseInfluence]:[0,0],spinBase=s.spin*time*0.6;
    var slots=0,lowest=Infinity,highest=0,shiftMax=0;
    function place(radius,life,cut,angle,sx,sy,mix,width){
      if(life<=0.002)return;var gain=10*radius*cut*cut*cut;
      shape.set([radius,life,gain,gain>6.2?Math.cbrt(6.2/gain):2],slots*4);
      frameData.set([sx,sy,Math.cos(angle),Math.sin(angle)],slots*4);
      tints.set([s.color[0]+(s.colorTwo[0]-s.color[0])*mix,s.color[1]+(s.colorTwo[1]-s.color[1])*mix,s.color[2]+(s.colorTwo[2]-s.color[2])*mix,width],slots*4);
      lowest=Math.min(lowest,radius);highest=Math.max(highest,radius);shiftMax=Math.max(shiftMax,Math.hypot(sx,sy));slots++;
    }
    var i,b,age,fade;
    for(i=0;i<count;i++){
      var st=ringState(s,i,count),radius=st.radius*scale,life=st.life;
      for(b=0;b<bursts.length;b++){age=clock-bursts[b].start;var wv=(bursts[b].radius+age*BURST_SPEED)*scale;fade=Math.pow(Math.max(0,1-age/BURST_LIFE),1.5);var gap=(wv-radius)/0.08;
        radius+=0.04*Math.exp(-gap*gap)*fade;life=Math.min(1.6,life+0.9*Math.exp(-gap*gap*1.6)*fade)}
      var cut=Math.pow(s.taper,st.virtual)/Math.max(0.08,st.opening),angle=s.rotation+spinBase*(i%2?-1:1)*(1+i*0.15);
      place(radius,life,cut,angle,i*s.parallax*mouseX,i*s.parallax*mouseY,st.mix,1);
    }
    for(b=0;b<bursts.length;b++){age=clock-bursts[b].start;fade=Math.pow(Math.max(0,1-age/BURST_LIFE),1.5);place((bursts[b].radius+age*BURST_SPEED)*scale,1.5*fade,0.85,s.rotation,0,0,clamp(age/BURST_LIFE,0,1),1.15)}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    if(!slots)return;
    var flags=[];if(s.light)flags.push('LIGHT');if(s.dispersion>0)flags.push('PRISM');if(!floatGlow)flags.push('PACKED');
    var gP=programFor('glow',flags),cP=programFor('compose',flags),lP=programFor('line',flags);if(!gP||!cP||!lP)return;
    var glowScale=(s.light?0.3:1)*(1-s.dispersion*0.45),outer=0.012+0.033*s.glow,innerAmount=0.5*Math.min(1,s.glow)*glowScale,outerAmount=0.9*s.glow*glowScale;
    var range=outer*4.5+0.008,split=s.dispersion*0.03,margin=range+split*highest+shiftMax+0.01,width=s.lineThickness*size.ratio,reach=width*(1+0.45*s.hoverIntensity)*1.15+1.5,cursor=project(view.inverse,pointer.x,pointer.y);
    function shared(p){var u=p.uniforms;gl.useProgram(p.program);gl.uniform2f(u.uResolution,canvas.width,canvas.height);gl.uniform1f(u.uUnit,size.unit);gl.uniform2f(u.uCenter,center[0],center[1]);gl.uniform1i(u.uCount,slots);
      gl.uniform4fv(u.uShape,shape);gl.uniform4fv(u.uFrame,frameData);gl.uniform4fv(u.uTint,tints);gl.uniform4f(u.uHover,cursor[0]-center[0],cursor[1]-center[1],hover*s.hoverIntensity,1/0.03);gl.uniform1f(u.uSplit,split);gl.uniform1f(u.uOpacity,s.opacity);return u}
    gl.bindVertexArray(vao);gl.bindFramebuffer(gl.FRAMEBUFFER,glowBuffer);gl.viewport(0,0,glowSize.width,glowSize.height);gl.clear(gl.COLOR_BUFFER_BIT);
    var gu=shared(gP);gl.uniform2f(gu.uScale,canvas.width/glowSize.width,canvas.height/glowSize.height);gl.uniformMatrix3fv(gu.uInverse,true,view.inverse);
    gl.uniform2f(gu.uBounds,Math.max(0,lowest-margin),highest+margin);gl.uniform4f(gu.uHalo,0,1/outer,innerAmount,outerAmount);gl.uniform3f(gu.uRange,range*0.45,1/(range*0.55),range);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
    var cu=shared(cP);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,glowTexture);gl.uniform1i(cu.uGlow,0);gl.uniform1f(cu.uGrain,s.grain);gl.uniform1f(cu.uTime,clock);gl.drawArrays(gl.TRIANGLES,0,3);
    var lu=shared(lP);gl.uniformMatrix3fv(lu.uForward,true,view.forward);gl.uniform1f(lu.uReach,reach);gl.uniform1f(lu.uWidth,width);
    gl.enable(gl.BLEND);if(s.light)gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);else gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_COLOR,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(stripVao);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,(SEGMENTS+1)*2,slots);gl.disable(gl.BLEND);gl.bindVertexArray(null);
  }
  function frame(now){
    raf=0;if(lost)return;var s=self.s,dt=clamp((now-last)/1000||0,0,0.05);last=Math.max(last,now);clock+=dt;if(!reduced)time+=dt*s.speed;
    var tx=pointer.inside?pointer.x/Math.max(1e-6,size.width/size.unit):0,ty=pointer.inside?pointer.y/Math.max(1e-6,size.height/size.unit):0;
    var stiff=70,damp=2*Math.sqrt(stiff)*0.9,steps=Math.max(1,Math.ceil(dt/(1/240))),h=dt/steps;
    for(var q=0;q<steps;q++){spring.vx+=(stiff*(tx-spring.x)-damp*spring.vx)*h;spring.vy+=(stiff*(ty-spring.y)-damp*spring.vy)*h;spring.x+=spring.vx*h;spring.y+=spring.vy*h;
      var ht=pointer.inside?1:0;spring.hoverVelocity+=(40*(ht-spring.hover)-2*Math.sqrt(40)*spring.hoverVelocity)*h;spring.hover+=spring.hoverVelocity*h}
    for(var j=bursts.length-1;j>=0;j--)if(clock-bursts[j].start>BURST_LIFE)bursts.splice(j,1);
    if(introLive&&time>(s.ringCount+2)*STAGGER+CYCLE)introLive=false;
    render();
    var settling=Math.abs(spring.vx)+Math.abs(spring.vy)+Math.abs(spring.hoverVelocity)>1e-4||Math.abs((pointer.inside?1:0)-spring.hover)>1e-3;
    var busy=(s.speed>0&&!reduced)||settling||bursts.length>0||introLive;
    if(busy&&visible&&pageVisible)raf=requestAnimationFrame(frame);
  }
  function wake(){if(raf||lost||!visible||!pageVisible)return;last=performance.now();raf=requestAnimationFrame(frame)}
  self._wake=function(){resize();wake()};
  function locate(e){var r=container.getBoundingClientRect(),inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom,unit=Math.max(1,Math.min(r.width,r.height));
    return {x:(e.clientX-r.left-r.width/2)/unit,y:(r.top+r.height/2-e.clientY)/unit,inside:inside}}
  function onMove(e){if(e.pointerType==='touch'&&!pointer.touch)return;var p=locate(e);pointer.x=p.x;pointer.y=p.y;pointer.inside=p.inside;wake()}
  function onDown(e){var p=locate(e);if(!p.inside)return;pointer.x=p.x;pointer.y=p.y;pointer.inside=true;pointer.touch=e.pointerType==='touch';
    if(self.s.clickBurst&&!reduced){bursts.push({start:clock,radius:Math.max(0.04,self.s.baseRadius*0.45)});if(bursts.length>MAX_BURSTS)bursts.shift()}wake()}
  function onUp(e){if(e.pointerType!=='touch')return;pointer.touch=false;pointer.inside=false;wake()}
  function onLeave(){pointer.inside=false;wake()}
  addEventListener('pointermove',onMove,{passive:true});addEventListener('pointerdown',onDown,{passive:true});addEventListener('pointerup',onUp,{passive:true});addEventListener('pointercancel',onUp,{passive:true});
  document.documentElement.addEventListener('pointerleave',onLeave);
  function onLost(e){e.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0}
  function onRestored(){cleanup();self.generation++;self._mount()}
  canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
  var ro=new ResizeObserver(function(){resize();wake()});ro.observe(container);
  var io=new IntersectionObserver(function(en){visible=en.some(function(x){return x.isIntersecting});wake()});io.observe(container);
  function onVis(){pageVisible=document.visibilityState!=='hidden';wake()}
  document.addEventListener('visibilitychange',onVis);
  function cleanup(){
    cancelAnimationFrame(raf);self._wake=null;ro.disconnect();io.disconnect();
    removeEventListener('pointermove',onMove);removeEventListener('pointerdown',onDown);removeEventListener('pointerup',onUp);removeEventListener('pointercancel',onUp);
    document.documentElement.removeEventListener('pointerleave',onLeave);document.removeEventListener('visibilitychange',onVis);
    canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);
    if(!gl.isContextLost()){gl.deleteVertexArray(vao);gl.deleteTexture(glowTexture);gl.deleteFramebuffer(glowBuffer);programs.forEach(function(p){p&&gl.deleteProgram(p.program)});gl.deleteVertexArray(stripVao);gl.deleteBuffer(stripBuffer)}
  }
  self._cleanup=cleanup;resize();wake();return true;
};
window.MagicRings=MagicRings;
function autoInit(){
  [].forEach.call(document.querySelectorAll('[data-magic-rings]'),function(el){
    var o={};try{o=JSON.parse(el.getAttribute('data-magic-rings')||'{}')}catch(e){}
    if(matchMedia('(max-width: 700px)').matches&&o.mobile){Object.assign(o,o.mobile)}delete o.mobile;
    new MagicRings(el,o);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autoInit);else autoInit();
})();
