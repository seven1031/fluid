import { BoxGeometry } from 'https://cdn.skypack.dev/three@0.136/src/geometries/BoxGeometry.js'
import basicVertex from './shader/basicVertex.wgsl?raw'
import basicColor from './shader/basicColor.wgsl?raw'
import computeMatrix from './shader/computeMatrix.wgsl?raw'
import common from './shader/common.wgsl?raw'
import transferToGrid from './shader/transferToGrid.wgsl?raw'
import normalizegrid from './shader/normalizegrid.wgsl?raw'
import addforce from './shader/addforce.wgsl?raw'
import enforceboundaries from './shader/enforceboundaries.wgsl?raw'
import divergence from './shader/divergence.wgsl?raw'
import jacobi from './shader/jacobi.wgsl?raw'
import copy from './shader/copy.wgsl?raw'
import subtract from './shader/subtract.wgsl?raw'
import transferToParticles from './shader/transferToParticles.wgsl?raw'
import advect from './shader/advect.wgsl?raw'
import clearState from './shader/clearState.wgsl?raw'
import * as mat4 from './util/math'
import Raycaster from './util/raycaster?worker'
import { Stats } from './util/stats'


const rayWorker = new Raycaster()    
const GROUP_SIZE = 128
const XMIN = 0
const XMAX = 15
const YMIN = 10
const YMAX = 20
const ZMIN = 0
const ZMAX = 20
const scaleV = 3 
const scale = Math.pow(scaleV, 1.0 / 3.0)
const gridSizeX = 30
const gridSizeY = 20
const gridSizeZ = 20
const gridResolutionX = Math.ceil(gridSizeX * 1);
const gridResolutionY = Math.ceil(gridSizeY * 1);
const gridResolutionZ = Math.ceil(gridSizeZ * 1);
const initDensity = 20
const NUM = Math.ceil(initDensity * (XMAX - XMIN) * (YMAX - YMIN) * (ZMAX - ZMIN) * scaleV)
            // gridResolutionX * gridResolutionY * gridResolutionZ / gridSizeX / gridSizeY / gridSizeZ)
const dispatchNUM = Math.ceil(NUM / GROUP_SIZE)
const GRIDNUM = (gridResolutionX+1) * (gridResolutionY+1) * (gridResolutionZ+1)
const dispatchGRID = Math.ceil(GRIDNUM / GROUP_SIZE)
const CELLNUM = (gridResolutionX) * (gridResolutionY) * (gridResolutionZ)
const dispatchCELL = Math.ceil(CELLNUM / GROUP_SIZE)
const maxDensity = NUM / (XMAX - XMIN) / (YMAX - YMIN) / (ZMAX - ZMIN)
const timeStep = 1.0 / 60.0
const PRESSURE_JACOBI_ITERATIONS = 100
const flipness = 0.95
console.log('NUM of particles:', NUM)
// console.log('Resolution:', gridResolutionX, gridResolutionY, gridResolutionZ)

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
    const device = await adapter.requestDevice({requiredLimits: {maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize}})
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = context.getPreferredFormat(adapter)
    const devicePixelRatio = window.devicePixelRatio || 1
    const size = {
        width: canvas.clientWidth * devicePixelRatio,
        height: canvas.clientHeight * devicePixelRatio,
    }
    context.configure({
        device, format, size,
        compositingAlphaMode: 'opaque'
    })
    let depthTexture = device.createTexture({
        size: size,
        format: 'depth24plus-stencil8',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    })
    const renderPassDescriptor = {
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthLoadOp: 'clear',
            depthClearValue: 1.0,
            depthStoreOp: 'store',
            stencilLoadOp: 'clear',
            stencilClearValue: 0,
            stencilStoreOp: 'store'
        }
    }
    window.addEventListener('resize', ()=>{
        size.width = canvas.clientWidth * devicePixelRatio
        size.height = canvas.clientHeight * devicePixelRatio
        context.configure({
            device, format, size,
            compositingAlphaMode: 'opaque'
        })
        depthTexture.destroy()
        depthTexture = device.createTexture({
            size: size,
            format: 'depth24plus-stencil8',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        })
        renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView()
    }, false)

    /********** init buffers/pipelines/groups for computing position **********/
    const {
        transferToGridPipeline,
        normalizegridPipeline,
        addforcePipeline,
        enforceboundariesPipeline,
        divergencePipeline,
        jacobiPipeline,
        copyPipeline,
        subtractPipeline,
        transferToParticlesPipeline,
        advectPipeline,
        clearStatePipeline,
        transferToGridGroup0,
        transferToGridGroup1,
        normalizegridGroup0,
        normalizegridGroup1,
        addforceGroup0,
        enforceboundariesGroup0,
        divergenceGroup0,
        divergenceGroup1,
        jacobiGroup0,
        jacobiGroup1,
        copyGroup0,
        subtractGroup0,
        transferToParticlesGroup0,
        transferToParticlesGroup1,
        advectGroup0,
        advectGroup1,
        clearStateGroup0,
        clearStateGroup1,
        positionBuffer,
        colorBuffer,
        gridvelocityBuffer,
        orivelocityBuffer,
        divergenceBuffer,
        pressureBuffer,
        weightBuffer,
        tempweightBuffer,
        atomicweightBuffer,
        debug0Buffer,
        debug1Buffer,
        debug2Buffer,
        output0Buffer,
        output1Buffer,
        output2Buffer,
        inputBuffer,
        input
    } = await initCompute(device)

    /********** init buffers/pipelines/groups for renderering sphere**********/
    const {
        computeMatrixPipeline,
        computeMatrixGroup,
        renderPipeline,
        vsGroup,
        vertexBuffer,
        indexBuffer,
        indexCount
    } = await initRender(device, canvas, size, format, positionBuffer, colorBuffer)
    
    /********** start renderring loop **********/
    let stats = new Stats()
    document.body.appendChild(stats.container)
    let handler = null
    let debug0Array = new Float32Array(4 * (NUM+10))
    let debug1Array = new Float32Array(4 * (CELLNUM+10))
    let debug2Array = new Float32Array(4 * (GRIDNUM+10))
    let testArray = []
    async function frame(){
        // update input
        device.queue.writeBuffer(inputBuffer, 0, input)
        let commandEncoder = device.createCommandEncoder()
        // start comupte
        let computeEncoder = commandEncoder.beginComputePass()
        // start other compute shader
        computeEncoder.setPipeline(transferToGridPipeline)
        computeEncoder.setBindGroup(0, transferToGridGroup0)
        computeEncoder.setBindGroup(1, transferToGridGroup1)
        computeEncoder.dispatchWorkgroups(dispatchNUM)
              
        computeEncoder.setPipeline(normalizegridPipeline)
        computeEncoder.setBindGroup(0, normalizegridGroup0)
        computeEncoder.setBindGroup(1, normalizegridGroup1)
        computeEncoder.dispatchWorkgroups(dispatchGRID)
        
        computeEncoder.setPipeline(addforcePipeline)
        computeEncoder.setBindGroup(0, addforceGroup0)
        computeEncoder.dispatchWorkgroups(dispatchGRID)

        computeEncoder.setPipeline(enforceboundariesPipeline)
        computeEncoder.setBindGroup(0, enforceboundariesGroup0)
        computeEncoder.dispatchWorkgroups(dispatchGRID)
        
        computeEncoder.setPipeline(divergencePipeline)
        computeEncoder.setBindGroup(0, divergenceGroup0)
        computeEncoder.setBindGroup(1, divergenceGroup1)
        computeEncoder.dispatchWorkgroups(dispatchCELL)

        for (var i = 0; i < PRESSURE_JACOBI_ITERATIONS; ++i) {
            computeEncoder.setPipeline(jacobiPipeline)
            computeEncoder.setBindGroup(0, jacobiGroup0)
            computeEncoder.setBindGroup(1, jacobiGroup1)
            computeEncoder.dispatchWorkgroups(dispatchCELL)
            computeEncoder.setPipeline(copyPipeline)
            computeEncoder.setBindGroup(0, copyGroup0)
            computeEncoder.dispatchWorkgroups(dispatchCELL)
        }

        computeEncoder.setPipeline(subtractPipeline)
        computeEncoder.setBindGroup(0, subtractGroup0)
        computeEncoder.dispatchWorkgroups(dispatchGRID)

        computeEncoder.setPipeline(transferToParticlesPipeline)
        computeEncoder.setBindGroup(0, transferToParticlesGroup0)
        computeEncoder.setBindGroup(1, transferToParticlesGroup1)
        computeEncoder.dispatchWorkgroups(dispatchNUM)
        // // DEBUG
        // computeEncoder.end()     
        // // commandEncoder.copyBufferToBuffer(pressureBuffer, 0, debug0Buffer, 0, 4 * (CELLNUM))
        // commandEncoder.copyBufferToBuffer(output0Buffer, 0, debug0Buffer, 0, 16 * (NUM+10))
        // device.queue.submit([commandEncoder.finish()])
        // await debug0Buffer.mapAsync(GPUMapMode.READ)
        // let copyArrayBuffer = debug0Buffer.getMappedRange();
        // debug0Array.set(new Float32Array(copyArrayBuffer));
        // debug0Buffer.unmap()
        // // await debug0Buffer.mapAsync(GPUMapMode.READ)
        // // copyArrayBuffer = debug0Buffer.getMappedRange();
        // // debug0Array.set(new Float32Array(copyArrayBuffer));
        // // debug0Buffer.unmap()
        // commandEncoder = device.createCommandEncoder()
        // computeEncoder = commandEncoder.beginComputePass()
        // // DEBUG END 
        computeEncoder.setPipeline(advectPipeline)
        computeEncoder.setBindGroup(0, advectGroup0)
        computeEncoder.setBindGroup(1, advectGroup1)
        computeEncoder.dispatchWorkgroups(dispatchNUM)
        computeEncoder.setPipeline(clearStatePipeline)
        computeEncoder.setBindGroup(0, clearStateGroup0)
        computeEncoder.setBindGroup(1, clearStateGroup1)
        computeEncoder.dispatchWorkgroups(dispatchGRID)

        // generate matrix for render
        computeEncoder.setPipeline(computeMatrixPipeline)
        computeEncoder.setBindGroup(0, computeMatrixGroup)
        computeEncoder.dispatchWorkgroups(dispatchNUM)
        computeEncoder.end()
        // start render
        renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView()
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor as GPURenderPassDescriptor)
        passEncoder.setPipeline(renderPipeline)
        passEncoder.setBindGroup(0, vsGroup)
        passEncoder.setVertexBuffer(0, vertexBuffer)
        passEncoder.setIndexBuffer(indexBuffer, 'uint16')
        passEncoder.drawIndexed(indexCount, NUM)
        passEncoder.end()
        device.queue.submit([commandEncoder.finish()])

        stats.update()
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    // handler = setInterval(frame,200)
    // setTimeout(()=>{
    //     console.log('canceled')
    //     // cancelAnimationFrame(handler)
    //     clearInterval(handler)
    //     console.log('debug0Buffer', debug0Array.subarray(0));
    //     // console.log('debug1Buffer', debug1Array.subarray(0));
    //     // console.log('debug2Buffer', debug2Array.subarray(0));
    //     for (let i = 0; i< NUM; ++i){
    //         // if (Math.floor(i/40/20) == 19.0){
    //             // if (debug2Array[i*4] != 0.0 || (debug2Array[i*4+1] != 0.0) || (debug2Array[i*4+2] != 0.0)){
    //                 // let array =[]
    //                 // array.push(i%40)
    //                 // array.push(Math.floor(i/40)%20)
    //                 // array.push(debug0Array[i])
    //                 // testArray.push(array)
    //                 // console.log((i%40), (Math.floor(i/40)%20), debug0Array[i]);//*4],debug0Array[i*4+1],debug0Array[i*4+2],debug0Array[i*4+3]);
    //                 // console.log(testArray)
    //                 console.log('offset',debug0Array[i*4],debug0Array[i*4+1],debug0Array[i*4+2],debug0Array[i*4+3]);
    //             // }
                
    //         // }
    //     }
    // }, 40000)
}

async function initCompute(device: GPUDevice){
    /********** init buffers for compute shader **********/
    // core position buffer
    const position = new Float32Array(4 * NUM)
    for(let i = 0; i < NUM; ++i){
        position[i * 4 + 0] = Math.random() * (XMAX - XMIN) + XMIN // x
        position[i * 4 + 1] = Math.random() * (YMAX - YMIN) + YMIN // y
        position[i * 4 + 2] = Math.random() * (ZMAX - ZMIN) + ZMIN // z
        position[i * 4 + 3] = 0 // w
    }
    const positionBuffer = device.createBuffer({
        size: position.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(positionBuffer, 0, position)
    
    // velocity for computing position
    const velocity = new Float32Array(4 * NUM)
    // for(let i = 0; i < NUM; ++i){
    //     velocity[i * 4 + 0] = (Math.random() - 0.5) * 0.01 // x
    //     velocity[i * 4 + 1] = (Math.random() - 0.5) * 0.01 // y
    //     velocity[i * 4 + 2] = (Math.random() - 0.5) * 0.01 // z
    //     velocity[i * 4 + 3] = 1 // w
    // }
    const velocityBuffer = device.createBuffer({
        size: velocity.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    //device.queue.writeBuffer(velocityBuffer, 0, velocity)
    const tempvelocity = new Float32Array(4 * NUM)
    const tempvelocityBuffer = device.createBuffer({
        size: tempvelocity.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    const gridvelocity = new Float32Array(4 * GRIDNUM)
    const gridvelocityBuffer = device.createBuffer({
        size: gridvelocity.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    const orivelocity = new Float32Array(4 * GRIDNUM)
    const orivelocityBuffer = device.createBuffer({
        size: orivelocity.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })    
    const atomicvelocity = new Int32Array(4 * GRIDNUM)
    const atomicvelocityBuffer = device.createBuffer({
        size: atomicvelocity.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })    
    // could add other buffers for position
    const mark = new Float32Array(CELLNUM)
    const markBuffer = device.createBuffer({
        size: mark.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    // weight for transfer particle velocities to grid
    const weight = new Float32Array(4 * GRIDNUM)
    const weightBuffer = device.createBuffer({
        size: weight.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    const tempweight = new Float32Array(4 * NUM)
    const tempweightBuffer = device.createBuffer({
        size: tempweight.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    const atomicweight = new Int32Array(4 * GRIDNUM)
    const atomicweightBuffer = device.createBuffer({
        size: atomicweight.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })

    const divergenceinit = new Float32Array(CELLNUM)
    const divergenceBuffer = device.createBuffer({
        size: divergenceinit.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })

    const pressureinit = new Float32Array(CELLNUM)
    const pressureBuffer = device.createBuffer({
        size: pressureinit.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    const temppressureBuffer = device.createBuffer({
        size: pressureinit.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })

    const color = new Float32Array(4 * NUM)
    for(let i = 0; i < NUM; ++i){
        color[i * 4 + 0] = 1 // r
        color[i * 4 + 1] = 0 // g
        color[i * 4 + 2] = 0 // b
        color[i * 4 + 3] = 1 // a
    }
    const colorBuffer = device.createBuffer({
        size: color.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(colorBuffer, 0, color)

    // input vars
    const input = new Float32Array(1000)
    input[0] = NUM //xmin
    input[1] = 30 //xmax
    input[2] = 0 //ymin
    input[3] = 20 //ymax
    input[4] = 0 //zmin
    input[5] = 20 //zmax
    // add anything you want
    input[6] = gridResolutionX
    input[7] = gridResolutionY
    input[8] = gridResolutionZ
    input[9] = GRIDNUM
    input[10] = gridSizeX
    input[11] = gridSizeY
    input[12] = gridSizeZ
    input[13] = CELLNUM
    input[14] = timeStep
    input[24] = flipness
    input[25] = maxDensity
    // update input
    let timer: number
    rayWorker.onmessage = (e:MessageEvent)=>{
        clearTimeout(timer)
        // console.log(e.data)
        input[15] = e.data.vx
        input[16] = e.data.vy
        input[17] = e.data.vz
        input[18] = e.data.ox + 15
        input[19] = e.data.oy 
        input[20] = e.data.oz + 10
        input[21] = e.data.dx
        input[22] = e.data.dy
        input[23] = e.data.dz
        timer = setTimeout(()=>{
            input[15] = 0
            input[16] = 0
            input[17] = 0
        },100)
    }
    const inputBuffer = device.createBuffer({
        size: input.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(inputBuffer, 0, input)
    // DENUG BUFFERS
    const output0 = new Float32Array(4 * (NUM+10))
    const output0Buffer = device.createBuffer({
        size: output0.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    const output1 = new Float32Array(4 * (CELLNUM+10))
    const output1Buffer = device.createBuffer({
        size: output1.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    const output2 = new Float32Array(4 * (GRIDNUM+10))
    const output2Buffer = device.createBuffer({
        size: output2.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    const debug0 = new Float32Array(4 * (NUM+10))
    const debug0Buffer = device.createBuffer({
        size: debug0.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })
    const debug1 = new Float32Array(4 * (CELLNUM+10))
    const debug1Buffer = device.createBuffer({
        size: debug1.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })
    const debug2 = new Float32Array(4 * (GRIDNUM+10))
    const debug2Buffer = device.createBuffer({
        size: debug2.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })

    /********** init pipelines **********/
    const transferToGridPipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + transferToGrid
            }),
            entryPoint: "main"
        }
    })  
    const normalizegridPipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + normalizegrid
            }),
            entryPoint: "main"
        }
    })
    const addforcePipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + addforce
            }),
            entryPoint: "main"
        }
    })
    const enforceboundariesPipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + enforceboundaries
            }),
            entryPoint: "main"
        }
    })
    const divergencePipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + divergence
            }),
            entryPoint: "main"
        }
    })
    const jacobiPipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + jacobi
            }),
            entryPoint: "main"
        }
    })
    const copyPipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + copy
            }),
            entryPoint: "main"
        }
    })
    const subtractPipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + subtract
            }),
            entryPoint: "main"
        }
    })
    const transferToParticlesPipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + transferToParticles
            }),
            entryPoint: "main"
        }
    })
    const advectPipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + advect
            }),
            entryPoint: "main"
        }
    })    
    const clearStatePipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: common + clearState
            }),
            entryPoint: "main"
        }
    })

    /********** init bindGroups **********/
    const transferToGridGroup0 = device.createBindGroup({
        layout: transferToGridPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: positionBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: velocityBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: markBuffer,
                }
            }
        ]
    })
    const transferToGridGroup1 = device.createBindGroup({
        layout: transferToGridPipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: atomicweightBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: atomicvelocityBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: output0Buffer,
                }
            }
        ]
    }) 
    const normalizegridGroup0 = device.createBindGroup({
        layout: normalizegridPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: weightBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: gridvelocityBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: orivelocityBuffer,
                }
            }
        ]
    })
    const normalizegridGroup1 = device.createBindGroup({
        layout: normalizegridPipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: atomicweightBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: atomicvelocityBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: output2Buffer,
                }
            }
        ]
    }) 
    const addforceGroup0 = device.createBindGroup({
        layout: addforcePipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: gridvelocityBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: output2Buffer,
                }
            }            
        ]
    })
    const enforceboundariesGroup0 = device.createBindGroup({
        layout: enforceboundariesPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: gridvelocityBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: output2Buffer,
                }
            }
            
        ]
    })
    const divergenceGroup0 = device.createBindGroup({
        layout: divergencePipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: gridvelocityBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: divergenceBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: weightBuffer,
                }
            }         
        ]
    })
    const divergenceGroup1 = device.createBindGroup({
        layout: divergencePipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: markBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: output1Buffer,
                }
            }      
        ]
    })
    const jacobiGroup0 = device.createBindGroup({
        layout: jacobiPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: divergenceBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: pressureBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: temppressureBuffer,
                }
            }      
        ]
    })
    const jacobiGroup1 = device.createBindGroup({
        layout: jacobiPipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: markBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: output1Buffer,
                }
            }       
        ]
    })
    const copyGroup0 = device.createBindGroup({
        layout: copyPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: pressureBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: temppressureBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: output1Buffer,
                }
            }       
        ]
    })
    const subtractGroup0 = device.createBindGroup({
        layout: subtractPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: pressureBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: gridvelocityBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: output2Buffer,
                }
            }            
        ]
    })
    const transferToParticlesGroup0 = device.createBindGroup({
        layout: transferToParticlesPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: positionBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: velocityBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: gridvelocityBuffer,
                }
            }           
        ]
    })
    const transferToParticlesGroup1 = device.createBindGroup({
        layout: transferToParticlesPipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: orivelocityBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: colorBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: output0Buffer,
                }
            }            
        ]
    })
    const advectGroup0 = device.createBindGroup({
        layout: advectPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: positionBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: velocityBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: gridvelocityBuffer,
                }
            }           
        ]
    })    
    const advectGroup1 = device.createBindGroup({
        layout: advectPipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: output0Buffer,
                }
            }    
        ]
    })
    const clearStateGroup0 = device.createBindGroup({
        layout: clearStatePipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: inputBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: markBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: atomicweightBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: atomicvelocityBuffer,
                }
            }           
        ]
    })
    const clearStateGroup1 = device.createBindGroup({
        layout: clearStatePipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: weightBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: divergenceBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: pressureBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: temppressureBuffer,
                }
            }           
        ]
    })

    return {
        transferToGridPipeline,
        normalizegridPipeline,
        addforcePipeline,
        enforceboundariesPipeline,
        divergencePipeline,
        jacobiPipeline,
        copyPipeline,
        subtractPipeline,
        transferToParticlesPipeline,
        advectPipeline,
        clearStatePipeline,
        transferToGridGroup0, 
        transferToGridGroup1,
        normalizegridGroup0,
        normalizegridGroup1,
        addforceGroup0,
        enforceboundariesGroup0,
        divergenceGroup0,
        divergenceGroup1,
        jacobiGroup0,
        jacobiGroup1,
        copyGroup0,
        subtractGroup0,
        transferToParticlesGroup0,
        transferToParticlesGroup1,
        advectGroup0,
        advectGroup1,
        clearStateGroup0,
        clearStateGroup1,
        positionBuffer,
        colorBuffer,
        gridvelocityBuffer,
        orivelocityBuffer,
        divergenceBuffer,
        pressureBuffer,
        weightBuffer,
        tempweightBuffer,
        atomicweightBuffer,
        debug0Buffer,
        debug1Buffer,
        debug2Buffer,
        output0Buffer,
        output1Buffer,
        output2Buffer,
        inputBuffer,
        input
    }
}

async function initRender(
    device:GPUDevice, 
    canvas: HTMLCanvasElement, 
    size : {width: number, height: number}, 
    format: GPUTextureFormat, 
    positionBuffer: GPUBuffer,
    colorBuffer: GPUBuffer
) {
    /********** init buffers for renderring **********/
    const {vertex, indexCount, index} = getThreeGeometry(new BoxGeometry(0.1 / scale, 0.1 / scale, 0.1 / scale))
    const vertexBuffer = device.createBuffer({
        size: vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })
    const indexBuffer = device.createBuffer({
        size: index.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(vertexBuffer, 0, vertex)
    device.queue.writeBuffer(indexBuffer, 0, index)

    const modelView = new Float32Array(16 * NUM)
    for(let i = 0; i < NUM; ++i){
        const offset = i * 16
        modelView[offset + 0] = 1
        modelView[offset + 5] = 1
        modelView[offset + 10] = 1
        modelView[offset + 15] = 1
    }
    const modelViewBuffer = device.createBuffer({
        size: modelView.byteLength * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(modelViewBuffer, 0, modelView)
    
    const projectionBuffer = device.createBuffer({
        size: 16 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    const mvp = new Float32Array(16 * NUM)
    for(let i = 0; i < NUM; ++i){
        const offset = i * 16
        mvp[offset + 0] = 1
        mvp[offset + 5] = 1
        mvp[offset + 10] = 1
        mvp[offset + 15] = 1
    }
    const mvpBuffer = device.createBuffer({
        size: mvp.byteLength * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(mvpBuffer, 0, mvp)

    addCamera(projectionBuffer, size, device, canvas)
    /********** init pipelines for renderring **********/
    const renderPipeline = await device.createRenderPipelineAsync({
        vertex: {
            module: device.createShaderModule({
                code: basicVertex
            }),
            entryPoint: 'main',
            buffers: [
                {
                    arrayStride: 8 * 4,
                    attributes: [
                        {
                            // position
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3',
                        },
                        {
                            // normal
                            shaderLocation: 1,
                            offset: 3 * 4,
                            format: 'float32x3',
                        },
                        {
                            // uv
                            shaderLocation: 2,
                            offset: 6 * 4,
                            format: 'float32x2',
                        }
                    ]
                } as GPUVertexBufferLayout,
            ]
        },
        fragment: {
            module: device.createShaderModule({
                code: basicColor
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
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus-stencil8',
        },
        layout: 'auto'
    })
    const computeMatrixPipeline = await device.createComputePipelineAsync({
        compute: {
            module: device.createShaderModule({
                code: computeMatrix
            }),
            entryPoint: "main"
        },
        layout: 'auto'
    })

    /********** init bindGroups for renderring **********/
    const vsGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: modelViewBuffer
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: mvpBuffer
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: colorBuffer
                }
            }
        ]
    })
    const computeMatrixGroup = device.createBindGroup({
        layout: computeMatrixPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: modelViewBuffer,
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: projectionBuffer,
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: mvpBuffer,
                }
            },
            {
                binding: 3,
                resource: {
                    buffer: positionBuffer,
                }
            }
        ]
    })
    return {
        computeMatrixPipeline,
        computeMatrixGroup,
        renderPipeline,
        vsGroup,
        vertexBuffer,
        indexBuffer,
        indexCount
    }
}

// others
function addCamera(
    projectionBuffer:GPUBuffer, 
    size:{
        width: number;
        height: number;
    }, 
    device: GPUDevice,
    canvas: HTMLCanvasElement
){
    const minDistance = 10
    const maxDistance = 10000
    const projection = mat4.create()
    const perspective = mat4.create()
    const viewMatrix = mat4.create()
    
    const camera = {x:0, y:25, z:50, a:0, b:0, r:0}
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
        mat4.multiply(projection, perspective, viewMatrix)
        device.queue.writeBuffer(projectionBuffer, 0, projection)
    }
    updatPerspective()
    updateCamera()
    let mouseDown = false
    let lastMouseX = -1
    let lastMouseY = -1
    canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.stopPropagation()
        camera.r += e.deltaY / 10
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
        if (!mouseDown)
            return raycaster(e)
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


    // mouse intersection
    function raycaster(e:PointerEvent){
        let x = e.clientX / canvas.clientWidth * 2 - 1
        let y = -(e.clientY / canvas.clientHeight) * 2 + 1
        rayWorker.postMessage({type: 'move', x, y, camera})
    }
    rayWorker.postMessage({type: 'init', camera, size, fov, near, far})
    window.addEventListener('resize', ()=>{
        rayWorker.postMessage({type: 'resize', size})
        updatPerspective()
        updateCamera()
    }, false)
}
function getThreeGeometry(geometry:any){
    const count = geometry.attributes.position.count
    const position = geometry.attributes.position
    const normal = geometry.attributes.normal
    const uv = geometry.attributes.uv
    const index = geometry.index
    const offset = position.itemSize + normal.itemSize + uv.itemSize
    const vertex = new Float32Array(count * offset)
    for(let i = 0; i < count; ++i){
        vertex.set( (position.array as Float32Array).subarray(i * position.itemSize, (i + 1) * position.itemSize), i * offset )
        vertex.set( (normal.array as Float32Array).subarray(i * normal.itemSize, (i + 1) * normal.itemSize), i * offset + position.itemSize )
        vertex.set( (uv.array as Float32Array).subarray(i * uv.itemSize, (i + 1) * uv.itemSize), i * offset + position.itemSize + normal.itemSize )
    }
    return {vertex, vertexCount:count, index:index.array, indexCount: index.count}
}
demo()