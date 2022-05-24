import vertexShader from './shader/vertex.wgsl?raw'
import fragShader from './shader/frag.wgsl?raw'
import rayShader from './shader/ray.wgsl?raw'
import * as mat4 from './util/math'
import { Stats } from './util/stats'

const NUMSPHERE = 1000
const NUMCUBE  = 1
async function demo() {
    /********** configure webgpu **********/
    if (!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const canvas = document.querySelector('canvas')
    if(!canvas)
        throw new Error('no canvas')
    const adapter = await navigator.gpu.requestAdapter({powerPreference: 'high-performance'})
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice()
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = context.getPreferredFormat(adapter)
    const devicePixelRatio = Math.floor(window.devicePixelRatio) || 1
    const size = {
        width: canvas.clientWidth * devicePixelRatio,
        height: canvas.clientHeight * devicePixelRatio,
    }
    // console.log(window.devicePixelRatio,size.width,canvas.clientWidth,size.height,canvas.clientHeight)
    context.configure({
        device, format, size,
        compositingAlphaMode: 'opaque'
    })
    const renderPassDescriptor = {
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store'
        }]
    }

    // data
    let camera = {x:0, y:0, z:0}
    const angleX = 0;
    const angleY = 0;
    const zoomZ = 2;
    camera.x = zoomZ * Math.sin(angleY) * Math.cos(angleX);
    camera.y = zoomZ * Math.sin(angleX);
    camera.z = zoomZ * Math.cos(angleY) * Math.cos(angleX);
    const light = new Float32Array([0.4, 0.6, -0.6, 0.0]) 
    const wall = new Float32Array([-1.0, -1.0, -1.0, 0.0, 1.0, 1.0, 1.0, 0.0])
    const cube = new Float32Array(8 * NUMCUBE)
    for(let i = 0; i < NUMCUBE; ++i){
        if (i == 0){
            cube[i * 8 + 0] = -0.1
            cube[i * 8 + 1] = -1.0
            cube[i * 8 + 2] = -0.1
            cube[i * 8 + 4] =  0.1
            cube[i * 8 + 5] = -0.9
            cube[i * 8 + 6] =  0.1
        }else {
            cube[i * 8 + 0] = -0.1 
            cube[i * 8 + 1] = -1.0
            cube[i * 8 + 2] = -0.1
            cube[i * 8 + 4] =  0.1
            cube[i * 8 + 5] = -0.9
            cube[i * 8 + 6] =  0.1
        }

    }
    const sphere = new Float32Array(4* NUMSPHERE)
    for(let i = 0; i < NUMSPHERE; ++i){
        sphere[i * 4 + 0] = (i % 10) * 0.2 - 0.9
        sphere[i * 4 + 1] = Math.random() - 0.8
        sphere[i * 4 + 2] = Math.floor(i / 10) % 10 * 0.2 - 0.9
        sphere[i * 4 + 3] = 0.025
        // if (i == 0){
        //     sphere[i * 4 + 0] =  0.0
        //     sphere[i * 4 + 1] = -0.5
        //     sphere[i * 4 + 2] =  0.0
        //     sphere[i * 4 + 3] =  0.25
        // }else{
        //     sphere[i * 4 + 0] =  0.0
        //     sphere[i * 4 + 1] = -0.5
        //     sphere[i * 4 + 2] =  0.0
        //     sphere[i * 4 + 3] =  0.01
        // }
    }
    // console.log(sphere)
    
    // buffers
    const wallBuffer = device.createBuffer({
        size: 8 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(wallBuffer, 0, wall) // [min, max]

    const cubeBuffer = device.createBuffer({
        size: NUMCUBE * 8 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(cubeBuffer, 0, cube) // [min, max]

    const sphereBuffer = device.createBuffer({
        size: NUMSPHERE * 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(sphereBuffer, 0, sphere) //[center, r]

    const lighteyeBuffer = device.createBuffer({
        size: 8 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(lighteyeBuffer, 0, light) //[center]

    const info = new Float32Array([size.width, size.height, 0.0, 0.0, NUMCUBE, NUMSPHERE])
    const infoBuffer = device.createBuffer({
        size: 8 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    // device.queue.writeBuffer(infoBuffer, 0, info)

    const projectionBuffer = device.createBuffer({
        size: 16 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    addCamera(camera, projectionBuffer, size, device, canvas, info)
    // final results    
    const result1 = device.createBuffer({
        size: size.width * size.height * 4 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    const result2 = device.createBuffer({
        size: size.width * size.height * 4 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    // DENUG BUFFERS
    const output0Buffer = device.createBuffer({
        size: size.width * size.height * 4 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    const debug0Buffer = device.createBuffer({
        size: size.width * size.height * 4 * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })
    // pipelines
    const rayPipeline = await device.createRenderPipelineAsync({
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: vertexShader
            }),
            entryPoint: 'main'
        },
        fragment: {
            module: device.createShaderModule({
                code: rayShader
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format
                }
            ]
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: 'ccw',
            cullMode: 'back'
        }
    })
    const renderPipeline = await device.createRenderPipelineAsync({
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code: vertexShader
            }),
            entryPoint: 'main'
        },
        fragment: {
            module: device.createShaderModule({
                code: fragShader
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format
                }
            ]
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: 'ccw',
            cullMode: 'back'
        }
    })

    // groups
    const rayGroup1 = device.createBindGroup({
        layout: rayPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: wallBuffer
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: cubeBuffer
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: sphereBuffer
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: lighteyeBuffer
                }
            },
            {
                binding: 4,
                resource: {
                    buffer: projectionBuffer
                }
            }
        ]
    })
    const rayGroup2 = device.createBindGroup({
        layout: rayPipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: infoBuffer
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: result1
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: result2
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: output0Buffer
                }
            }
        ]
    })
    const renderGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: result1
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: result2
                }
            }
        ]
    })


    /********** start renderring loop **********/
    let stats = new Stats()
    document.body.appendChild(stats.container)
    let handler = null
    let debug0Array = new Float32Array(size.width * size.height * 4)
    async function frame(){
        info[2] = performance.now() * 0.001
        // console.log(info[2])
        device.queue.writeBuffer(infoBuffer, 0, info)
        // update input
        let commandEncoder = device.createCommandEncoder()
        // start render
        renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView()
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor as GPURenderPassDescriptor)
        // process ray
        passEncoder.setPipeline(rayPipeline)
        passEncoder.setBindGroup(0, rayGroup1)
        passEncoder.setBindGroup(1, rayGroup2)
        passEncoder.draw(6)
        // render
        // passEncoder.setPipeline(renderPipeline)
        // passEncoder.setBindGroup(0, renderGroup)
        // passEncoder.draw(6)
        passEncoder.end()
        // DEBUG   
        commandEncoder.copyBufferToBuffer(output0Buffer, 0, debug0Buffer, 0, 4 * (size.width * size.height * 4))
        device.queue.submit([commandEncoder.finish()])
        await debug0Buffer.mapAsync(GPUMapMode.READ)
        let copyArrayBuffer = debug0Buffer.getMappedRange();
        debug0Array.set(new Float32Array(copyArrayBuffer));
        debug0Buffer.unmap()
        // DEBUG END 
        // device.queue.submit([commandEncoder.finish()])

        stats.update()
        requestAnimationFrame(frame)
        info[3] = info[3] + 1.0
        device.queue.writeBuffer(infoBuffer, 0, info)
        // console.log(info)
    }
    requestAnimationFrame(frame)
    // handler = setInterval(frame,200)
    // setTimeout(()=>{
    //     console.log('canceled')
    //     // cancelAnimationFrame(handler)
    //     clearInterval(handler)
    //     // console.log('debug0Buffer', debug0Array.subarray(0));
    //     for (let i = 0; i< size.width * size.height; ++i){
    //         // if (debug0Array[i*4] !=  debug0Array[i*4+2])
    //         console.log('offset',i%512, Math.floor(i/512), debug0Array[i*4],debug0Array[i*4+1],debug0Array[i*4+2],debug0Array[i*4+3]);
    //     }
    // }, 2000)
    window.addEventListener('resize', ()=>{
        size.width = canvas.clientWidth * devicePixelRatio
        size.height = canvas.clientHeight * devicePixelRatio
        context.configure({
            device, format, size,
            compositingAlphaMode: 'opaque'
        })
        // depthTexture.destroy()
        // depthTexture = device.createTexture({
        //     size: size,
        //     format: 'depth24plus-stencil8',
        //     usage: GPUTextureUsage.RENDER_ATTACHMENT
        // })
        // renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView()
    }, false)

}

// others
function addCamera(
    _camera: {x:number, y:number, z:number},
    projectionBuffer:GPUBuffer, 
    size:{
        width: number;
        height: number;
    }, 
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    info: Float32Array
){
    const minDistance = 0.5
    const maxDistance = 10000
    const projection = mat4.create()
    const perspective = mat4.create()
    const viewMatrix = mat4.create()
    
    const camera = Object.assign(_camera, {a:0,b:0,r:0})
    const a = Math.atan( camera.x / camera.y)
    const b = Math.atan( camera.y / camera.z)
    camera.a = a ? a / Math.PI * 180 : 0
    camera.b = b ? b / Math.PI * 180 : 0
    camera.r = Math.sqrt(camera.x * camera.x + camera.y * camera.y + camera.z * camera.z)

    const fov = 50
    const near = 0.1
    const far = 100000000
    function updatPerspective(){
        const aspect = size.width / size.height
        const top = near * Math.tan(fov / 180 * Math.PI * 0.5)
        const height = 2 * top
        const width = aspect * height
        const left = - 0.5 * width
        
        mat4.makePerspective(perspective, left, left + width, top, top - height, near, far)
    }
    function updateCamera(){
        const a = camera.a / 180 * Math.PI
        const b = camera.b / 180 * Math.PI
        const x = camera.r * Math.sin(a) * Math.cos(b)
        const y = camera.r * Math.sin(b)
        const z = camera.r * Math.cos(a) * Math.cos(b)
        camera.x = x
        camera.y = y
        camera.z = z
        mat4.lookAt(viewMatrix, x,y,z, 0,0,0, 0,1,0)
        viewMatrix[12] = x
        viewMatrix[13] = y
        viewMatrix[14] = z
        // mat4.multiply(projection, perspective, viewMatrix)
        device.queue.writeBuffer(projectionBuffer, 0, viewMatrix)
        // console.log('projection \n',viewMatrix)
        info[3] = -1.0
        
    }
    updatPerspective()
    updateCamera()
    let mouseDown = false
    let lastMouseX = -1
    let lastMouseY = -1
    canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.stopPropagation()
        camera.r += e.deltaY / 1000
        if(camera.r < minDistance)
            camera.r = minDistance
        else if(camera.r > maxDistance)
            camera.r = maxDistance
        updateCamera()
    }, { passive: true })
    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation()
        e.preventDefault()
        mouseDown = true;
        lastMouseX = e.clientX
        lastMouseY = e.clientY
    }, false)
    canvas.addEventListener('pointermove', (e: PointerEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (!mouseDown){
            const x = e.clientX / canvas.clientWidth * 2 - 1
            const y = -(e.clientY / canvas.clientHeight) * 2 + 1
            return
        }
        let mousex = e.pageX
        let mousey = e.pageY

        if (lastMouseX > 0 && lastMouseY > 0) {                
            const ra = -(mousex - lastMouseX) / 2
            const rb = (mousey - lastMouseY) / 2
            camera.a += ra
            camera.b += rb
            if(camera.b > 90)
                camera.b = 90
            else if(camera.b < -90)
                camera.b = -90
            updateCamera()
        }
        lastMouseX = mousex
        lastMouseY = mousey
    }, false)
    canvas.addEventListener('pointerup', (e: PointerEvent) => {
        e.stopPropagation()
        e.preventDefault()
        mouseDown = false
    }, false)
    canvas.addEventListener('pointercancel', () => {
        mouseDown = false
    }, false)
    canvas.addEventListener('pointerleave', () => {
        mouseDown = false
    }, false)
    canvas.addEventListener('contextmenu', (e:Event)=>{
        e.preventDefault()
    }, false)

    window.addEventListener('resize', ()=>{
        updatPerspective()
        updateCamera()
    }, false)
}

demo()