@group(0) @binding(0) var<storage, read> models : array<mat4x4<f32>>;
@group(0) @binding(1) var<storage, read> mvp : array<mat4x4<f32>>;
@group(0) @binding(2) var<storage, read> color : array<vec4<f32>>;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>
};
@stage(vertex)
fn main(
    @builtin(instance_index) index : u32,
    @location(0) position : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) uv : vec2<f32>
) -> VertexOutput {
    let worldMatrix = models[index];
    let pm = vec4<f32>( position, 1.0 );
    return VertexOutput(mvp[index] * pm, color[index]);
}