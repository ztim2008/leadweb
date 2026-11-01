(function(){
var b=document.querySelector('.burger'),m=document.getElementById('menu'),h=document.querySelector('.hdr'),de=document.documentElement,bd=document.body,sy=0,last=null;
function onScroll(){h&&h.classList.toggle('is-scrolled',(scrollY||0)>4)}addEventListener('scroll',onScroll,{passive:true});onScroll();
if(b&&m){var x=m.querySelector('.mclose');
function items(){return [].slice.call(m.querySelectorAll('a[href],button'))}
function isOpen(){return b.getAttribute('aria-expanded')==='true'}
function open(){last=document.activeElement;sy=scrollY||0;bd.style.top=(-sy)+'px';m.hidden=false;de.classList.add('menu-lock');requestAnimationFrame(function(){requestAnimationFrame(function(){de.classList.add('menu-open')})});b.setAttribute('aria-expanded','true');x.focus({preventScroll:true})}
function close(back){if(!isOpen())return;de.classList.remove('menu-open','menu-lock');b.setAttribute('aria-expanded','false');bd.style.top='';scrollTo(0,sy);setTimeout(function(){if(!isOpen())m.hidden=true},300);if(back!==false)(last||b).focus({preventScroll:true})}
b.addEventListener('click',function(){isOpen()?close():open()});x.addEventListener('click',function(){close()});
m.addEventListener('click',function(e){var a=e.target.closest('a');if(a)close(false)});
document.addEventListener('keydown',function(e){if(!isOpen())return;if(e.key==='Escape'){e.preventDefault();close()}
 if(e.key==='Tab'){var f=items(),i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}}});
matchMedia('(min-width:981px)').addEventListener('change',function(q){if(q.matches)close(false)});}
/* reveal */
var els=document.querySelectorAll('.reveal');
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});els.forEach(function(e){io.observe(e)})}else els.forEach(function(e){e.classList.add('in')});
/* calculator (цены — с исходного сайта) */
var c=document.getElementById('calc');if(c){
 var out=c.querySelector('output'),term=c.querySelector('[data-term]');
 function calc(){var t=c.querySelector('input[name=type]:checked'),sum=+t.value;
  c.querySelectorAll('input[name=extra]:checked').forEach(function(e){sum+=+e.value});
  sum*=+c.querySelector('input[name=speed]:checked').value;
  out.textContent='от '+(Math.round(sum/1000)*1000).toLocaleString('ru-RU')+' ₽';term.textContent=t.dataset.term}
 c.addEventListener('input',calc);c.addEventListener('change',calc);calc();}
})();
