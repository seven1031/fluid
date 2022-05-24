
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> position: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> tempweight: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> tempvelocity: array<vec4<f32>>;
@group(1) @binding(0) var<storage, read_write> atomicweight: array<atomic<i32>>;
@group(1) @binding(1) var<storage, read_write> atomicvelocity: array<atomic<i32>>;
@group(1) @binding(2) var<storage, read_write> output: array<vec4<f32>>;

fn celltogrid (index: vec3<f32>, resolution: vec3<f32>) -> u32{
    var clampindex = clamp(index, vec3<f32>(0.0), resolution - vec3<f32>(1.0));
    var gridindex = u32(clampindex.x + clampindex.y * resolution.x + clampindex.z * resolution.x * resolution.y);
    return gridindex;//clamp(gridindex, u32(0), u32(resolution.x * resolution.y * resolution.z - 1.0));
}

let size = u32(128);
@stage(compute) @workgroup_size(size)
fn main(
    @builtin(global_invocation_id) GlobalInvocationID : vec3<u32>,
    @builtin(num_workgroups) GroupSize: vec3<u32>
) {
    var index = GlobalInvocationID.x;
    if(index >= u32(input[0])){
        return;
    }

    var gridResolution = vec3<f32>(input[6], input[7], input[8]);
    var gridSize = vec3<f32>(input[10], input[11], input[12]);

    var particlePosition = vec3<f32>(position[index][0], position[index][1], position[index][2]) / gridSize * gridResolution;
    var cellIndex = vec3<f32>(floor(particlePosition));
    var cellTotIndex = celltogrid(cellIndex, gridResolution + 1.0);

    var debug = output[index];
    // output[index][0] = f32(cellIndex.x);
    // output[index][1] = f32(cellIndex.y);
    // output[index][2] = f32(cellIndex.z);
    // output[index][3] = f32(cellTotIndex);

    atomicAdd(&atomicweight[cellTotIndex * u32(4) + u32(0)], i32(tempweight[index][0] * 1000.0));
    atomicAdd(&atomicweight[cellTotIndex * u32(4) + u32(1)], i32(tempweight[index][1] * 1000.0));
    atomicAdd(&atomicweight[cellTotIndex * u32(4) + u32(2)], i32(tempweight[index][2] * 1000.0));
    atomicAdd(&atomicweight[cellTotIndex * u32(4) + u32(3)], i32(tempweight[index][3] * 1000.0));

    atomicAdd(&atomicvelocity[cellTotIndex * u32(4) + u32(0)], i32(tempvelocity[index][0] * 1000.0));
    atomicAdd(&atomicvelocity[cellTotIndex * u32(4) + u32(1)], i32(tempvelocity[index][1] * 1000.0));
    atomicAdd(&atomicvelocity[cellTotIndex * u32(4) + u32(2)], i32(tempvelocity[index][2] * 1000.0));

}