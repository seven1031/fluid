
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> pressure: array<f32>;
@group(0) @binding(2) var<storage, read_write> temppressure: array<f32>;
@group(0) @binding(3) var<storage, read_write> output: array<vec4<f32>>;

let size = u32(128);
@stage(compute) @workgroup_size(size)
fn main(
    @builtin(global_invocation_id) GlobalInvocationID : vec3<u32>,
    @builtin(num_workgroups) GroupSize: vec3<u32>
) {
    var index = GlobalInvocationID.x;
    if(index >= u32(input[13])){
        return;
    }
    var debug = output[index];
    // output[index][0] = f32(index);
    // output[index][1] = f32(index);
    // output[index][2] = f32(index);
    // output[index][3] = f32(index);

    pressure[index] = temppressure[index];
}