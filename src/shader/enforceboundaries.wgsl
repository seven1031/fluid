
@group(0) @binding(0) var<storage, read_write> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> gridvelocity: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> output: array<vec4<f32>>;

// fn mod (x: f32, y: f32) -> f32{
//     return x - floor((x + 0.05) / y) * y;
// }

// fn gridtocell (index: u32, resolution: vec3<f32>) -> vec3<f32>{
//     var indexfloat = f32(index) + f32(0.05);
//     var cellindex = vec3<f32>(mod(indexfloat, resolution.x), mod(floor(indexfloat / resolution.x), resolution.y), 
//                     floor(indexfloat / resolution.x / resolution.y)); 
//     return cellindex;
// }

let size = u32(128);
@stage(compute) @workgroup_size(size)
fn main(
    @builtin(global_invocation_id) GlobalInvocationID : vec3<u32>,
    @builtin(num_workgroups) GroupSize: vec3<u32>
) {
    var index = GlobalInvocationID.x;
    if(index >= u32(input[9])){
        return;
    }

    var gridResolution = vec3<f32>(input[6], input[7], input[8]);
    var cellIndex = gridtocell(index, gridResolution + 1.0);  
    var debug = output[index];
    // output[index][0] = f32(cellIndex.x);
    // output[index][1] = f32(cellIndex.y);
    // output[index][2] = f32(cellIndex.z);
    // output[index][3] = f32(index);

    if(cellIndex.x < 0.5){
        gridvelocity[index][0] = 0.0;
    }
    if(cellIndex.x > gridResolution.x - 0.5){
        gridvelocity[index][0] = 0.0;
    }    
    if(cellIndex.y < 0.5){
        gridvelocity[index][1] = 0.0;
    }
    if(cellIndex.y > gridResolution.y - 0.5){
        gridvelocity[index][1] = min(gridvelocity[index][1], 0.0);
    }
    if(cellIndex.z < 0.5){
        gridvelocity[index][2] = 0.0;
    }
    if(cellIndex.z > gridResolution.z - 0.5){
        gridvelocity[index][2] = 0.0;
    }
    // if (cellIndex.x < 0.5) {
    //     velocity.x = 0.0;
    // }

    // if (cellIndex.x > u_gridResolution.x - 0.5) {
    //     velocity.x = 0.0;
    // }

    // if (cellIndex.y < 0.5) {
    //     velocity.y = 0.0;
    // }

    // if (cellIndex.y > u_gridResolution.y - 0.5) {
    //     velocity.y = min(velocity.y, 0.0);
    // }

    // if (cellIndex.z < 0.5) {
    //     velocity.z = 0.0;
    // }

    // if (cellIndex.z > u_gridResolution.z - 0.5) {
    //     velocity.z = 0.0;
    // }

    // position[index][0] = cellIndex.x;
    // position[index][1] = cellIndex.y;
    // position[index][2] = cellIndex.z;
    
}