/* Menu en zijbalk (UI PR #2, eigenaar 19 november).
   Het menu is een <details>-element in de bovenbalk: het opent en sluit zonder
   JavaScript met muis, toetsenbord (Enter/Spatie) en schermlezer. Deze laag
   voegt alleen toe wat <details> zelf niet doet:
   - Escape sluit het menu en zet de focus terug op de menuknop;
   - een klik buiten het menu of op een link in het menu sluit het;
   - vanaf 1904px (genoeg papier naast het vel van 1600px) staat hetzelfde menu
     permanent open als zijbalk links naast het vel; de knop is dan verborgen
     (CSS). De zijbalk staat vast bij het scrollen en schuift mee omhoog zodra
     het einde van het vel in beeld komt, zodat hij nooit over de plaatscontext
     of de populaire plaatsen eronder valt;
   - bij het verkleinen van het venster onder 1904px gaat het menu weer dicht.
   Er is één menu in de pagina; de zijbalk is hetzelfde element. */
(function(root){
"use strict";
var RAIL_MIN=1904,RAIL_BREEDTE=136,RAIL_LUCHT=8,RAIL_BOVEN=48,RAIL_ONDER=16;
function init(){
  var doc=root.document,menu=doc.getElementById("wiw-menu");
  if(!menu||menu.getAttribute("data-wiw-menu")==="klaar")return;
  menu.setAttribute("data-wiw-menu","klaar");
  var knop=menu.querySelector("summary"),paneel=menu.querySelector(".wiw-menu-paneel"),html=doc.documentElement;
  var mq=typeof root.matchMedia==="function"?root.matchMedia("(min-width: "+RAIL_MIN+"px)"):null;
  var rail=function(){return !!(mq&&mq.matches);};
  var gepland=false;
  function plaats(){
    gepland=false;
    if(!paneel)return;
    if(!rail()){paneel.style.left="";paneel.style.transform="";return;}
    var sheet=doc.querySelector(".sheet");if(!sheet)return;
    var s=sheet.getBoundingClientRect();
    paneel.style.left=Math.max(RAIL_LUCHT,Math.round(s.left-RAIL_LUCHT-RAIL_BREEDTE))+"px";
    var over=RAIL_BOVEN+paneel.offsetHeight+RAIL_ONDER-s.bottom;
    paneel.style.transform=over>0?"translateY("+(-Math.ceil(over))+"px)":"";
  }
  function plan(){if(!gepland){gepland=true;(root.requestAnimationFrame||setTimeout)(plaats);}}
  function zetModus(){
    if(rail()){html.classList.add("wiw-menu-rail");menu.open=true;}
    else if(html.classList.contains("wiw-menu-rail")){html.classList.remove("wiw-menu-rail");menu.open=false;}
    plaats();
  }
  if(knop)knop.addEventListener("click",function(e){if(rail())e.preventDefault();});
  doc.addEventListener("keydown",function(e){
    if((e.key==="Escape"||e.key==="Esc")&&menu.open&&!rail()){menu.open=false;if(knop)knop.focus();}
  });
  doc.addEventListener("click",function(e){
    if(!menu.open||rail())return;
    var t=e.target;
    if(!menu.contains(t)){menu.open=false;return;}
    var a=t&&t.closest?t.closest("a"):null;
    if(a&&paneel&&paneel.contains(a))menu.open=false;
  });
  root.addEventListener("scroll",plan,{passive:true});
  root.addEventListener("resize",plan,{passive:true});
  if(mq){if(typeof mq.addEventListener==="function")mq.addEventListener("change",zetModus);else if(typeof mq.addListener==="function")mq.addListener(zetModus);}
  zetModus();
}
if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(window);
