
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> weight: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> gridvelocity: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> orivelocity: array<vec4<f32>>;
@group(1) @binding(0) var<storage, read_write> atomicweight: array<atomic<i32>>;
@group(1) @binding(1) var<storage, read_write> atomicvelocity: array<atomic<i32>>;
@group(1) @binding(2) var<storage, read_write> output: array<vec4<f32>>;

// fn mod (x: f32, y: f32) -> f32{
//     return x - floor((x + 0.0) / y) * y;
// }

// fn gridtocell (index: u32, resolution: vec3<f32>) -> vec3<f32>{
//     var indexfloat = f32(index);// + f32(0.05);
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

    weight[index][0] = f32(atomicLoad(&atomicweight[index * u32(4) + u32(0)])) / 1000.0;
    weight[index][1] = f32(atomicLoad(&atomicweight[index * u32(4) + u32(1)])) / 1000.0;
    weight[index][2] = f32(atomicLoad(&atomicweight[index * u32(4) + u32(2)])) / 1000.0;
    weight[index][3] = f32(atomicLoad(&atomicweight[index * u32(4) + u32(3)])) / 1000.0;

    gridvelocity[index][0] = 0.0;
    if(weight[index][0] > 0.0){
        gridvelocity[index][0] = f32(atomicLoad(&atomicvelocity[index * u32(4) + u32(0)])) / 1000.0 / weight[index][0];
    }
    gridvelocity[index][1] = 0.0;
    if(weight[index][1] > 0.0){
        gridvelocity[index][1] = f32(atomicLoad(&atomicvelocity[index * u32(4) + u32(1)])) / 1000.0 / weight[index][1];
    }
    gridvelocity[index][2] = 0.0;
    if(weight[index][2] > 0.0){
        gridvelocity[index][2] = f32(atomicLoad(&atomicvelocity[index * u32(4) + u32(2)])) / 1000.0 / weight[index][2];
    }

    var gridResolution = vec3<f32>(input[6], input[7], input[8]);
    var cellIndex = gridtocell(index, gridResolution + 1.0); 
    // var a = output[0];
    // output[index][0] = f32(index);
    // output[index][1] = (gridResolution + 1.0).x;
    // output[index][2] = floor((f32(index)+f32(0.00001)) / (gridResolution + 1.0).x);
    // // output[index][3] = floor(f32(index) / (gridResolution + 1.0).x) * (gridResolution + 1.0).x;
    // output[index][3] = f32(index) - floor(f32(index) / (gridResolution + 1.0).x) * (gridResolution + 1.0).x;
    var debug = output[index];
    // output[index][0] = f32(cellIndex.x);
    // output[index][1] = f32(cellIndex.y);
    // output[index][2] = f32(cellIndex.z);
    // output[index][3] = f32(index);

    if(cellIndex.x > gridResolution.x - 0.5){
        gridvelocity[index][1] = 0.0;
        gridvelocity[index][2] = 0.0;
        weight[index][1] = 0.0;
        weight[index][2] = 0.0;
        weight[index][3] = 0.0;
    }
    if(cellIndex.y > gridResolution.y - 0.5){
        gridvelocity[index][0] = 0.0;
        gridvelocity[index][2] = 0.0;
        weight[index][0] = 0.0;
        weight[index][2] = 0.0;
        weight[index][3] = 0.0;
    }
    if(cellIndex.z > gridResolution.z - 0.5){
        gridvelocity[index][0] = 0.0;
        gridvelocity[index][1] = 0.0;
        weight[index][0] = 0.0;
        weight[index][1] = 0.0;
        weight[index][3] = 0.0;
    }

    orivelocity[index][0] = gridvelocity[index][0];
    orivelocity[index][1] = gridvelocity[index][1];
    orivelocity[index][2] = gridvelocity[index][2];

    // float xVelocity = 0.0;
    // if (weight.x > 0.0) {
    //     xVelocity = accumulatedVelocity.x / weight.x;
    // }

    // float yVelocity = 0.0;
    // if (weight.y > 0.0) {
    //     yVelocity = accumulatedVelocity.y / weight.y;
    // }

    // float zVelocity = 0.0;
    // if (weight.z > 0.0) {
    //     zVelocity = accumulatedVelocity.z / weight.z;
    // }

    // gl_FragColor = vec4(xVelocity, yVelocity, zVelocity, 0.0);

    // position[index][0] = cellIndex.x;
    // position[index][1] = cellIndex.y;
    // position[index][2] = cellIndex.z;
    
}