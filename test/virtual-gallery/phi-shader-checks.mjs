// TEST tower only. Skip synchronous WebGL shader error-log diagnostics by
// default; leave a URL override for direct A/B comparison and debugging.
// The flag does not alter shader source, programs or any rendering preset.
export function configurePhiShaderErrorChecks(renderer,search=''){
 if(!renderer?.debug)throw new Error('Three.js renderer.debug is required');
 const enabled=new URLSearchParams(search).get('shaderchecks')==='1';
 renderer.debug.checkShaderErrors=enabled;
 return enabled;
}
