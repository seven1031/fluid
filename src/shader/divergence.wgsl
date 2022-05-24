
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> gridvelocity: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> divergence: array<f32>;
@group(0) @binding(3) var<storage, read_write> weight: array<vec4<f32>>;
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
    var maxDensity = input[25];

    var cellIndex = gridtocell(index, gridResolution);  
    var debug = output[index];    
    // output[index][0] = f32(cellIndex.x);
    // output[index][1] = f32(cellIndex.y);
    // output[index][2] = f32(cellIndex.z);
    // output[index][3] = f32(densityIndex);

    if(mark[index] == 0.0){
        return;
    }

    var leftXIndex = celltogrid(cellIndex, gridResolution + 1.0);
    var leftX = gridvelocity[leftXIndex][0];
    var rightXIndex = celltogrid(cellIndex + vec3<f32>(1.0, 0.0, 0.0), gridResolution + 1.0);
    var rightX = gridvelocity[rightXIndex][0];

    var bottomYIndex = celltogrid(cellIndex, gridResolution + 1.0);
    var bottomY = gridvelocity[bottomYIndex][1];
    var topYIndex = celltogrid(cellIndex + vec3<f32>(0.0, 1.0, 0.0), gridResolution + 1.0);
    var topY = gridvelocity[topYIndex][1];

    var backZIndex = celltogrid(cellIndex, gridResolution + 1.0);
    var backZ = gridvelocity[backZIndex][2];
    var frontZIndex = celltogrid(cellIndex + vec3<f32>(0.0, 0.0, 1.0), gridResolution + 1.0);
    var frontZ = gridvelocity[frontZIndex][2];    

    divergence[index] = ((rightX - leftX) + (topY - bottomY) + (frontZ - backZ)) / 6.0;

    var densityIndex = celltogrid(cellIndex, gridResolution + 1.0);
    var density = weight[densityIndex][3];

    divergence[index] -= max((density - maxDensity) * 1.0, 0.0);
    // output[index][0] = f32(cellIndex.x);
    // output[index][1] = f32(cellIndex.y);
    // output[index][2] = f32(cellIndex.z);
    // output[index][3] = f32(index);
    // vec3 cellIndex = floor(get3DFragCoord(u_gridResolution));

    // //divergence = 0 in air cells
    // float fluidCell = texture3DNearest(u_markerTexture, (cellIndex + 0.5) / u_gridResolution, u_gridResolution).x;
    // if (fluidCell == 0.0) discard;


    // float leftX = texture3DNearest(u_velocityTexture, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).x;
    // float rightX = texture3DNearest(u_velocityTexture, (cellIndex + vec3(1.0, 0.0, 0.0) + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).x;

    // float bottomY = texture3DNearest(u_velocityTexture, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).y;
    // float topY = texture3DNearest(u_velocityTexture, (cellIndex + vec3(0.0, 1.0, 0.0) + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).y;

    // float backZ = texture3DNearest(u_velocityTexture, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).z;
    // float frontZ = texture3DNearest(u_velocityTexture, (cellIndex + vec3(0.0, 0.0, 1.0) + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).z;

    // float divergence = ((rightX - leftX) + (topY - bottomY) + (frontZ - backZ)) / 1.0;

    // float density = texture3DNearest(u_weightTexture, (cellIndex + 0.5) / (u_gridResolution + 1.0), u_gridResolution + 1.0).a;
    // divergence -= max((density - u_maxDensity) * 1.0, 0.0); //volume conservation

    // gl_FragColor = vec4(divergence, 0.0, 0.0, 0.0);    
     
    // position[index][0] = cellIndex.x;
    // position[index][1] = cellIndex.y;
    // position[index][2] = cellIndex.z;
    
}