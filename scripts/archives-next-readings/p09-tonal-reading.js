/* Optional L04 display aid; the closed comparison component is mounted on demand. */
(() => {
 'use strict';
 document.querySelectorAll('[data-p09-tonal-help]').forEach(help => {
  let instance=null;
  help.addEventListener('toggle',()=>{
   if(!help.open)return;
   if(!instance){
    const template=help.querySelector('[data-p09-tonal-template]');
    const host=help.querySelector('[data-p09-tonal-host]');
    host.append(template.content.cloneNode(true));
    instance=window.TonalCropReview.mount(host.querySelector('[data-tonal-crop-review]'));
    template.remove();
   }
   instance.reset();
  });
 });
})();
