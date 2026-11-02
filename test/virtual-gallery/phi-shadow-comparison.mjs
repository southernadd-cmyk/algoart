// TEST-only A/B. Shadow casting is separated from the approved phi lighting.
// ?shadows=0 disables real-time WebGL shadow maps without changing any light's
// position, colour or intensity; textured/baked contact shadows remain.
export function phiRealTimeShadowsEnabled(search=''){
 const params=new URLSearchParams(search);
 return params.get('shadows')!=='0';
}
export function configurePhiRealTimeShadows(renderer,sun,{enabled=true,shadowType}={}){
 if(!renderer?.shadowMap||!sun)throw TypeError('Renderer shadowMap and sun are required');
 renderer.shadowMap.enabled=!!enabled;
 if(enabled&&shadowType!==undefined)renderer.shadowMap.type=shadowType;
 sun.castShadow=!!enabled;
 return {enabled:!!enabled,shadowMaps:enabled?2:0};
}
