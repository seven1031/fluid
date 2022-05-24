struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) fragPosition: vec4<f32>
};

let rect = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
);

@stage(vertex)
fn main(
    @builtin(vertex_index) VertexIndex : u32
) -> VertexOutput {
    let position = vec4<f32>(rect[VertexIndex], 0.0, 1.0);
    return VertexOutput(position, position);
}