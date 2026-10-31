// Test-only GPU profiler for the gallery. This module has no side effects.
export function gpuProfilerSupported(gl){return !!gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');}
