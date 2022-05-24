
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> gridvelocity: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> output: array<vec4<f32>>;

fn kernel (position: vec3<f32>, radius: f32, direction: vec3<f32>, origin: vec3<f32>) -> f32{
    var distanceToMouseRay: f32 = length(cross(direction, position - origin));
    var normalizedDistance = max(0.0, distanceToMouseRay / radius);
    return smoothstep(1.0, 0.9, normalizedDistance);
}

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
    var gridSize = vec3<f32>(input[10], input[11], input[12]);
    var timeStep = input[14];
    var mouseVelocity = vec3<f32>(input[15], input[16], input[17]);
    var mouseRayOrigin = vec3<f32>(input[18], input[19], input[20]);
    var mouseRayDirection = vec3<f32>(input[21], input[22], input[23]);

    var cellIndex = gridtocell(index, gridResolution + 1.0);  
    var debug = output[index];    
    // output[index][0] = f32(cellIndex.x);
    // output[index][1] = f32(cellIndex.y);
    // output[index][2] = f32(cellIndex.z);
    // output[index][3] = f32(index);

    var tempvelocity = vec3<f32>(gridvelocity[index][0], gridvelocity[index][1], gridvelocity[index][2]) 
                     + vec3<f32>(0.0, -40.0 * timeStep, 0.0); //add gravity

    var xPosition = vec3<f32>(cellIndex.x, cellIndex.y + 0.5, cellIndex.z + 0.5);
    var yPosition = vec3<f32>(cellIndex.x + 0.5, cellIndex.y, cellIndex.z + 0.5);
    var zPosition = vec3<f32>(cellIndex.x + 0.5, cellIndex.y + 0.5, cellIndex.z);

    var mouseRadius: f32 = 5.0;
    var kernelValues = vec3<f32>(kernel(xPosition,mouseRadius,mouseRayDirection,mouseRayOrigin), kernel(yPosition,mouseRadius,mouseRayDirection,mouseRayOrigin), kernel(zPosition,mouseRadius,mouseRayDirection,mouseRayOrigin));

    tempvelocity.x += mouseVelocity.x * kernelValues.x * 3.0 * smoothstep(0.0, 1.0 / 200.0, timeStep);
    tempvelocity.y += mouseVelocity.y * kernelValues.y * 3.0 * smoothstep(0.0, 1.0 / 200.0, timeStep);
    tempvelocity.z += mouseVelocity.z * kernelValues.z * 3.0 * smoothstep(0.0, 1.0 / 200.0, timeStep);

    gridvelocity[index][0] = tempvelocity.x;
    gridvelocity[index][1] = tempvelocity.y;
    gridvelocity[index][2] = tempvelocity.z;

    // output[index][0] = f32(mouseVelocity.x);
    // output[index][1] = f32(mouseVelocity.y);
    // output[index][2] = f32(mouseVelocity.z);
    // output[index][3] = f32(index);
// float kernel (vec3 position, float radius) {
//     vec3 worldPosition = (position / u_gridResolution) * u_gridSize;

//     float distanceToMouseRay = length(cross(u_mouseRayDirection, worldPosition - u_mouseRayOrigin));

//     float normalizedDistance = max(0.0, distanceToMouseRay / radius);
//     return smoothstep(1.0, 0.9, normalizedDistance);
// }

// void main () {
//     vec3 velocity = texture2D(u_velocityTexture, v_coordinates).rgb;

//     vec3 newVelocity = velocity + vec3(0.0, -40.0 * u_timeStep, 0.0); //add gravity

//     vec3 cellIndex = floor(get3DFragCoord(u_gridResolution + 1.0));
//     vec3 xPosition = vec3(cellIndex.x, cellIndex.y + 0.5, cellIndex.z + 0.5);
//     vec3 yPosition = vec3(cellIndex.x + 0.5, cellIndex.y, cellIndex.z + 0.5);
//     vec3 zPosition = vec3(cellIndex.x + 0.5, cellIndex.y + 0.5, cellIndex.z);

//     float mouseRadius = 5.0;
//     vec3 kernelValues = vec3(kernel(xPosition, mouseRadius), kernel(yPosition, mouseRadius), kernel(zPosition, mouseRadius));

//     newVelocity += u_mouseVelocity * kernelValues * 3.0 * smoothstep(0.0, 1.0 / 200.0, u_timeStep);

//     gl_FragColor = vec4(newVelocity * 1.0, 0.0);

    // position[index][0] = cellIndex.x;
    // position[index][1] = cellIndex.y;
    // position[index][2] = cellIndex.z;
    
}