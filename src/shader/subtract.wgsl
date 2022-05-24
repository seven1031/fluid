
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> pressure: array<f32>;
@group(0) @binding(2) var<storage, read_write> gridvelocity: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> output: array<vec4<f32>>;

// fn celltogrid (index: vec3<f32>, resolution: vec3<f32>) -> u32{
//     var clampindex = clamp(index, vec3<f32>(0.0), resolution - vec3<f32>(1.0));
//     var gridindex = u32(clampindex.x + clampindex.y * resolution.x + clampindex.z * resolution.x * resolution.y);
//     return gridindex;//clamp(gridindex, u32(0), u32(resolution.x * resolution.y * resolution.z - 1.0));
// }

// fn mod (x: f32, y: f32) -> f32{
//     return x - floor((x + 0.0) / y) * y;
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

    var leftXIndex = celltogrid(cellIndex + vec3<f32>(-1.0, 0.0, 0.0), gridResolution);
    var leftX = pressure[leftXIndex];
    var rightXIndex = celltogrid(cellIndex + vec3<f32>(0.0, 0.0, 0.0), gridResolution);
    var rightX = pressure[rightXIndex];  

    var bottomYIndex = celltogrid(cellIndex + vec3<f32>(0.0, -1.0, 0.0), gridResolution);
    var bottomY = pressure[bottomYIndex];
    var topYIndex = celltogrid(cellIndex + vec3<f32>(0.0, 0.0, 0.0), gridResolution);
    var topY = pressure[topYIndex];

    var backZIndex = celltogrid(cellIndex + vec3<f32>(0.0, 0.0, -1.0), gridResolution);
    var backZ = pressure[backZIndex];
    var frontZIndex = celltogrid(cellIndex + vec3<f32>(0.0, 0.0, 0.0), gridResolution);
    var frontZ = pressure[frontZIndex];    

    var gradient = vec3<f32>(rightX - leftX, topY - bottomY, frontZ - backZ) / 1.0;
    var tempvelocity = vec3<f32>(gridvelocity[index][0], gridvelocity[index][1], gridvelocity[index][2]) - gradient;

    gridvelocity[index][0] = tempvelocity.x;
    gridvelocity[index][1] = tempvelocity.y;
    gridvelocity[index][2] = tempvelocity.z;

    // output[index][0] = f32(gradient.x);
    // output[index][1] = f32(gradient.y);
    // output[index][2] = f32(gradient.z);
    // output[index][3] = f32(index);
    // vec3 cellIndex = floor(get3DFragCoord(u_gridResolution + 1.0));

    // float left = texture3DNearest(u_pressureTexture, (cellIndex + vec3(-1.0, 0.0, 0.0) + 0.5) / u_gridResolution, u_gridResolution).r;
    // float right = texture3DNearest(u_pressureTexture, (cellIndex + 0.5) / u_gridResolution, u_gridResolution).r;

    // float bottom = texture3DNearest(u_pressureTexture, (cellIndex + vec3(0.0, -1.0, 0.0) + 0.5) / u_gridResolution, u_gridResolution).r;
    // float top = texture3DNearest(u_pressureTexture, (cellIndex + 0.5) / u_gridResolution, u_gridResolution).r;

    // float back = texture3DNearest(u_pressureTexture, (cellIndex + vec3(0.0, 0.0, -1.0) + 0.5) / u_gridResolution, u_gridResolution).r;
    // float front = texture3DNearest(u_pressureTexture, (cellIndex + 0.5) / u_gridResolution, u_gridResolution).r;


    // //compute gradient of pressure
    // vec3 gradient = vec3(right - left, top - bottom, front - back) / 1.0;

    // vec3 currentVelocity = texture2D(u_velocityTexture, v_coordinates).rgb;

    // vec3 newVelocity = currentVelocity - gradient;

    // position[index][0] = cellIndex.x;
    // position[index][1] = cellIndex.y;
    // position[index][2] = cellIndex.z;
    
}