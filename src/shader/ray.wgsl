@group(0) @binding(0) var<uniform> wall : array<vec3<f32>, 2>;
@group(0) @binding(1) var<uniform> cube : array<vec3<f32>, 2>;
@group(0) @binding(2) var<uniform> sphere: array<vec4<f32>, 1000>;
@group(0) @binding(3) var<uniform> light: array<vec3<f32>, 2>;
@group(0) @binding(4) var<uniform> camera: mat4x4<f32>;

@group(1) @binding(0) var<uniform> info : array<vec4<f32>, 2>;
@group(1) @binding(1) var<storage, read_write> result1 : array<vec4<f32>>;
@group(1) @binding(2) var<storage, read_write> result2 : array<vec4<f32>>;
@group(1) @binding(3) var<storage, read_write> output : array<vec4<f32>>;

 fn intersectCube(origin: vec3<f32>, ray: vec3<f32>, cubemin: vec3<f32>, cubemax: vec3<f32>) -> vec2<f32>{   
     var tmin = (cubemin - origin) / ray;   
     var tmax = (cubemax - origin) / ray;   
     var t1 = min(tmin, tmax);   
     var t2 = max(tmin, tmax);   
     var tnear = max(max(t1.x, t1.y), t1.z);   
     var tfar = min(min(t2.x, t2.y), t2.z);   
     return vec2<f32>(tnear, tfar); 
 }

 fn normalForCube(hit: vec3<f32>, cubemin: vec3<f32>, cubemax: vec3<f32>) -> vec3<f32>{   
     if(hit.x < cubemin.x + 0.0001) {
         return vec3<f32>(-1.0, 0.0, 0.0);   
     }
     else if(hit.x > cubemax.x - 0.0001) {
         return vec3<f32>(1.0, 0.0, 0.0);   
     }
     else if(hit.y < cubemin.y + 0.0001) {
         return vec3<f32>(0.0, -1.0, 0.0);   
     }
     else if(hit.y > cubemax.y - 0.0001) {
         return vec3<f32>(0.0, 1.0, 0.0);  
     } 
     else if(hit.z < cubemin.z + 0.0001) {
         return vec3<f32>(0.0, 0.0, -1.0);  
     } 
     else {
         return vec3<f32>(0.0, 0.0, 1.0);
     }
 }

 fn intersectSphere(origin: vec3<f32>, ray: vec3<f32>, spherecenter: vec3<f32>, sphereradius: f32) -> f32{   
     var tosphere = origin - spherecenter;   
     var a = dot(ray, ray);   
     var b = 2.0 * dot(tosphere, ray);   
     var c = dot(tosphere, tosphere) - sphereradius*sphereradius;   
     var discriminant = b*b - 4.0*a*c;   
     if(discriminant > 0.0) {     
         var t = (-b - sqrt(discriminant)) / (2.0 * a);     
         if(t > 0.0) {
             return t;
         }   
     }   
     return 10000.0; 
 }

 fn normalForSphere(hit: vec3<f32>, spherecenter: vec3<f32>, sphereradius: f32) -> vec3<f32>{   
     return vec3<f32>((hit - spherecenter) / sphereradius); 
 }

 fn random(scale: vec3<f32>, position: vec4<f32>, seed: f32) -> f32{   
     return f32(fract(sin(dot(position.xyz + seed, scale)) * 43758.5453 + seed)); 
 }

 fn cosineWeightedDirection(seed: f32, position: vec4<f32>, normal: vec3<f32>) -> vec3<f32>{   
     var u = random(vec3<f32>(12.9898, 78.233, 151.7182), position, seed);   
     var v = random(vec3<f32>(63.7264, 10.873, 623.6736), position, seed);   
     var r = sqrt(u);   
     var angle = 6.283185307179586 * v;   
     var sdir: vec3<f32>;
     var tdir: vec3<f32>;   
     if (abs(normal.x) < 0.5) {     
         sdir = cross(normal, vec3<f32>(1.0,0.0,0.0));   
     } else {     
         sdir = cross(normal, vec3<f32>(0.0,1.0,0.0));   
     }   
     tdir = cross(normal, sdir);   
     return r*cos(angle)*sdir + r*sin(angle)*tdir + sqrt(1.0-u)*normal; 
 }

 fn uniformlyRandomDirection(seed: f32, position: vec4<f32>) -> vec3<f32>{   
     var u = random(vec3<f32>(12.9898, 78.233, 151.7182), position, seed);   
     var v = random(vec3<f32>(63.7264, 10.873, 623.6736), position, seed);   
     var z = 1.0 - 2.0 * u;   
     var r = sqrt(1.0 - z * z);   
     var angle = 6.283185307179586 * v;   
     return vec3<f32>(r * cos(angle), r * sin(angle), z); 
 }

 fn uniformlyRandomVector(seed: f32, position: vec4<f32>) -> vec3<f32>{   
     return uniformlyRandomDirection(seed, position) * sqrt(random(vec3<f32>(36.7539, 50.3658, 306.2759), position, seed)); 
 }

 fn shadow(origin: vec3<f32>, ray: vec3<f32>) -> f32{ 
     var tcube = vec2<f32>(0.0); 
     for(var i = 0; i < i32(info[1][0]); i++) {
         tcube = intersectCube(origin, ray, cube[i * 2], cube[i * 2 + 1]); 
         if(tcube.x > 0.0 && tcube.x < 1.0 && tcube.x < tcube.y) {
             return 0.0;
         }
     }

     var tsphere = f32(1.0); 
     for(var i = 0; i < i32(info[1][1]); i++) {
         tsphere = intersectSphere(origin, ray, sphere[i].xyz, sphere[i].w); 
         if(tsphere < 1.0) {
             return 0.0;
         }
     }
    
     return 1.0; 
}

fn calculateColor(eye: vec3<f32>, initialray: vec3<f32>, light: vec3<f32>, position: vec4<f32>, index: u32) -> vec3<f32>{     
    var accumulatedcolor = vec3<f32>(0.0);   
    var colormask = vec3<f32>(1.0);
    var origin = eye;
    var ray = initialray;   
    for(var bounce = 0; bounce < 5; bounce++) {     
        var t: f32 = 10000.0; 
        var troom = intersectCube(origin, ray, wall[0], wall[1]); 
        if(troom.x < troom.y) {
            t = troom.y; 
        }
        var tcube = vec2<f32>(t); 
        var tcube0 = vec2<f32>(0.0);
        var tcube0index: i32 = 0;
        for(var i = 0; i < i32(info[1][0]); i++) {
            tcube = intersectCube(origin, ray, cube[i * 2], cube[i * 2 + 1]); 
            if(tcube.x > 0.0 && tcube.x < tcube.y && tcube.x < t) {
                t = tcube.x; 
                tcube0 = tcube; 
                tcube0index = i;
            }
        }
        var tsphere = t;
        var tsphere0 = 0.0;
        var tsphere0index: i32 = 0;
        for(var i = 0; i < i32(info[1][1]); i++) {
            tsphere = intersectSphere(origin, ray, sphere[i].xyz, sphere[i].w);
            if(tsphere < t) {
                t = tsphere; 
                tsphere0 = tsphere; 
                tsphere0index = i;
            }
        }
        var hit = origin + ray * t;     
        var surfacecolor = vec3<f32>(0.75);     
        var specularhighlight: f32 = 0.0;     
        var normal: vec3<f32>;  
        // output[index][0] = f32(hit.x);   
        // output[index][1] = f32(hit.y);
        // output[index][2] = f32(ray.x);
        // output[index][3] = f32(ray.y);
        if(t == troom.y) {       
            normal = -normalForCube(hit, wall[0], wall[1]); 
            if(hit.x < -0.9999) {
                surfacecolor = vec3<f32>(0.1, 0.5, 1.0); 
            }
            else if(hit.x > 0.9999) {
                surfacecolor = vec3<f32>(1.0, 0.9, 0.1); 
            }
            ray = cosineWeightedDirection(info[0][2] + f32(bounce), position, normal); //timeSinceStart     
        } else if(t == 10000.0) {     
            return vec3<f32>(0.0);    
        } else {       
            if(t == tcube0.x && tcube0.x < tcube0.y) {
                normal = normalForCube(hit, cube[tcube0index * 2], cube[tcube0index * 2 + 1]); 
            }
            else if(t == tsphere0) {
                normal = normalForSphere(hit, sphere[tsphere0index].xyz, sphere[tsphere0index].w); 
            }
            ray = cosineWeightedDirection(info[0][2] + f32(bounce), position, normal); //timeSinceStart     
        }     
        var tolight = light - hit;     
        var diffuse = max(0.0, dot(normalize(tolight), normal));     
        var shadowintensity = shadow(hit + normal * 0.0001, tolight);     
        colormask *= surfacecolor;     
        accumulatedcolor += colormask * (0.5 * diffuse * shadowintensity);     
        accumulatedcolor += colormask * specularhighlight * shadowintensity;     
        origin = hit;   
    }   
    return accumulatedcolor; 
}

fn mod (x: f32, y: f32) -> f32{
    return x - floor(x / y) * y;
}

@stage(fragment)
fn main(
    // @builtin(sample_index) index: u32,
    @location(0) position: vec4<f32>
) -> @location(0) vec4<f32> {
    var image_width = info[0][0];
    var image_height = info[0][1];
    let aspect = image_width / image_height;

    let viewport_heigth = tan(3.1415926536 / 6.0) * 2.0;
    let viewport_width = aspect * viewport_heigth;
    let focal_length = 1.0;

    // let eye = vec3<f32>(0.0, 0.0, 2.0);
    // let horizontal = vec3<f32>(viewport_width, 0.0, 0.0);
    // let vertical = vec3<f32>(0.0, viewport_heigth, 0.0);
    let eye = vec3<f32>(camera[3][0], camera[3][1], camera[3][2]);
    let horizontal = vec3<f32>(camera[0][0], camera[1][0], camera[2][0]) * viewport_width;
    let vertical = vec3<f32>(camera[0][1], camera[1][1], camera[2][1]) * viewport_heigth;
    let depth = vec3<f32>(camera[0][2], camera[1][2], camera[2][2]) * focal_length;
    let lower_left_corner = eye - horizontal / 2.0 - vertical / 2.0 - depth;

    let newposition = position * 0.5 + 0.5 - 0.0001;
    let x = newposition.x;
    let y = newposition.y;
    let index = u32(floor(y * image_height) * image_width + floor(x * image_width));
    output[index][0] = f32(info[0][2]);
    output[index][1] = f32(info[0][3]);
    output[index][2] = f32(info[1][0]);
    output[index][3] = f32(info[1][1]);
    // output[index][2] = f32(eye.z);
    // output[index][3] = f32(viewport_heigth);
    // let wallmin = wall[0];
    // let wallmax = wall[1];
    // let cubemin0 = cube[0];
    // let cubemax0 = cube[1];
    // let spherecenter0 = sphere[0].xyz;
    // let sphereradius0 = sphere[0].w;
    
    let debug = output[0];
    // output[index][0] = f32(index);

    var samplecount = info[0][3];
    var textureweight = samplecount / (samplecount + 1.0);
    var initialray = lower_left_corner + horizontal * x + vertical * y - eye;
    var newlight = light[0] + uniformlyRandomVector((info[0][2] - 53.0), newposition) * 0.1;   //timeSinceStart 

    var temp = calculateColor(eye, initialray, newlight, newposition, index);
    if (u32(samplecount) % u32(2) == u32(0)) {
        result1[index] = vec4(mix(temp, result2[index].xyz, textureweight), 1.0);
    // output[index][0] = f32(result1[index].x);
    // output[index][1] = f32(result1[index].y);
    // output[index][2] = f32(result1[index].z);
    // output[index][3] = f32(index);
        return result1[index];//vec4(mix(temp, result2[index], textureweight), 1.0);
    } else {
        result2[index] = vec4(mix(temp, result1[index].xyz, textureweight), 1.0);
    // output[index][0] = f32(result2[index].x);
    // output[index][1] = f32(result2[index].y);
    // output[index][2] = f32(result2[index].z);
    // output[index][3] = f32(index);
        return result2[index];//vec4(mix(temp, result1[index], textureweight), 1.0);
    }
    // return vec4(calculateColor(eye, initialray, newlight, position, index), 1.0);
     
}