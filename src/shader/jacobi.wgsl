
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> divergence: array<f32>;
@group(0) @binding(2) var<storage, read_write> pressure: array<f32>;
@group(0) @binding(3) var<storage, read_write> temppressure: array<f32>;
@group(1) @binding(0) var<storage, read> mark: array<f32>;
@group(1) @binding(1) var<storage, read_write> output: array<vec4<f32>>;

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
    if(index >= u32(input[13])){
        return;
    }

    var gridResolution = vec3<f32>(input[6], input[7], input[8]);

    var cellIndex = gridtocell(index, gridResolution);
    var debug = output[index];
    // output[index][0] = f32(cellIndex.x);
    // output[index][1] = f32(cellIndex.y);
    // output[index][2] = f32(cellIndex.z);
    // output[index][3] = f32(index);

    if(mark[index] == 0.0){
        return;
    }

    var leftXIndex = celltogrid(cellIndex + vec3<f32>(-1.0, 0.0, 0.0), gridResolution);
    var leftX = pressure[leftXIndex];
    var rightXIndex = celltogrid(cellIndex + vec3<f32>(1.0, 0.0, 0.0), gridResolution);
    var rightX = pressure[rightXIndex];  

    var bottomYIndex = celltogrid(cellIndex + vec3<f32>(0.0, -1.0, 0.0), gridResolution);
    var bottomY = pressure[bottomYIndex];
    var topYIndex = celltogrid(cellIndex + vec3<f32>(0.0, 1.0, 0.0), gridResolution);
    var topY = pressure[topYIndex];

    var backZIndex = celltogrid(cellIndex + vec3<f32>(0.0, 0.0, -1.0), gridResolution);
    var backZ = pressure[backZIndex];
    var frontZIndex = celltogrid(cellIndex + vec3<f32>(0.0, 0.0, 1.0), gridResolution);
    var frontZ = pressure[frontZIndex];   

    temppressure[index] = f32(rightX + leftX + topY + bottomY + frontZ + backZ - divergence[index]) / 6.0;   
    // pressure[index] = temppressure; 
    // //pressure = 0 in air cells
    // float fluidCell = texture3DNearest(u_markerTexture, centerCoords, u_gridResolution).x;
    // if (fluidCell == 0.0) discard; //if this is an air cell

    // vec3 delta = 1.0 / u_gridResolution;

    // float divergenceCenter = texture3DNearest(u_divergenceTexture, centerCoords, u_gridResolution).r;

    // float left = texture3DNearest(u_pressureTexture, centerCoords + vec3(-delta.x, 0.0, 0.0), u_gridResolution).r;
    // float right = texture3DNearest(u_pressureTexture, centerCoords + vec3(delta.x, 0.0, 0.0), u_gridResolution).r;
    // float bottom = texture3DNearest(u_pressureTexture, centerCoords + vec3(0.0, -delta.y, 0.0), u_gridResolution).r;
    // float top = texture3DNearest(u_pressureTexture, centerCoords + vec3(0.0, delta.y, 0.0), u_gridResolution).r;
    // float back = texture3DNearest(u_pressureTexture, centerCoords + vec3(0.0, 0.0, -delta.z), u_gridResolution).r;
    // float front = texture3DNearest(u_pressureTexture, centerCoords + vec3(0.0, 0.0, delta.z), u_gridResolution).r;

    // float newPressure = (left + right + bottom + top + back + front - divergenceCenter) / 6.0; 
    
    // position[index][0] = cellIndex.x;
    // position[index][1] = cellIndex.y;
    // position[index][2] = cellIndex.z;
    
}