import CustomShaderMaterial from 'three-custom-shader-material/vanilla';

export const PHI_FRAME_VERTEX=`
varying vec3 vPhiFramePosition;
void main(){vPhiFramePosition=position;}
`;
// Instanced painting frames use a shared unit cube, but the visible brushed
// pigment still samples the EXACT original local BoxGeometry dimensions.
export const PHI_FRAME_INSTANCED_VERTEX=`
attribute vec3 phiFrameDimensions;
varying vec3 vPhiFramePosition;
void main(){vPhiFramePosition=position*phiFrameDimensions;}
`;
export const PHI_FRAME_FRAGMENT=`
varying vec3 vPhiFramePosition;
float phiBand(float phase){
 // Fade detail as its frequency exceeds the pixel footprint to prevent shimmer.
 float fade=1.0-smoothstep(0.5,2.0,fwidth(phase));
 return sin(phase)*fade;
}
void main(){
 const float phi=1.61803398875;
 vec3 p=vPhiFramePosition;
 float coarse=sin(dot(p,vec3(2.0,2.0/phi,2.0*phi)));
 float brush=phiBand(dot(p,vec3(67.0,67.0*phi,67.0/phi)));
 float grain=coarse*0.45+brush*0.55;
 csm_DiffuseColor.rgb*=1.0+grain*0.035;
 csm_Roughness=clamp(roughness+grain*0.045,0.0,1.0);
}
`;
export function createPhiFrameStudyMaterial(THREE,{enabled=true,instanced=false}={}){
 const properties={color:'#344452',metalness:.24,roughness:.73};
 const material=enabled?new CustomShaderMaterial({baseMaterial:THREE.MeshStandardMaterial,
  ...properties,vertexShader:instanced?PHI_FRAME_INSTANCED_VERTEX:PHI_FRAME_VERTEX,
  fragmentShader:PHI_FRAME_FRAGMENT,
  cacheKey:()=> instanced?'phi-brushed-frame-instanced-v1':'phi-brushed-frame-v1'})
  :new THREE.MeshStandardMaterial(properties);
 material.name=enabled?(instanced?'Ink-blue brushed frame · instanced CSM test':'Ink-blue brushed frame · CSM test')
  :'Ink-blue frame · baseline';
 // Only the original global frame material is shared across floors.
 // Each instanced copy is disposed when its date is removed from the scene.
 material.userData.galleryPersistent=!instanced;
 return material;
}
