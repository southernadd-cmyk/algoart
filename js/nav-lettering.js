/* Shared navigation uses the site's existing uppercase marker typeface.
   Keep native link text (and href, aria-current, focus and screen-reader labels)
   rather than replacing characters with an inaccessible lowercase SVG alphabet. */
(()=>{'use strict';
 function updateLabels(){
  document.querySelectorAll('[data-algo-nav]').forEach(link=>{
   link.textContent=link.textContent.trim().toLocaleUpperCase('en-GB');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',updateLabels);
 else updateLabels();
})();
