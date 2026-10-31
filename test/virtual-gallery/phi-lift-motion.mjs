// Keep the actuator independent of display refresh rate, and limit the visual
// jump when a long construction/upload frame arrives between animation ticks.
export function advanceLiftDoor(closure,target,elapsed){
 const next=closure+(target-closure)*(1-Math.exp(-3.5*Math.min(Math.max(0,elapsed),.055)));
 return Math.abs(target-next)<.002?target:next;
}
