@group(0) @binding(0) var<storage, read_write> result1 : array<vec3<f32>>;
@group(0) @binding(1) var<storage, read_write> result2 : array<vec3<f32>>;

@stage(fragment)
fn main(
    @location(0) position: vec4<f32>
) -> @location(0) vec4<f32> {
    let _result1 = result1[0];
    let _result2 = result2[0];



    return vec4(1.0,1.0,1.0,1.0);
}