import { Raycaster } from 'https://cdn.skypack.dev/three@0.136/src/core/Raycaster.js'
import { PerspectiveCamera } from 'https://cdn.skypack.dev/three@0.136/src/cameras/PerspectiveCamera.js'
import { BoxGeometry } from 'https://cdn.skypack.dev/three@0.136/src/geometries/BoxGeometry.js'
import { MeshBasicMaterial } from 'https://cdn.skypack.dev/three@0.136/src/materials/MeshBasicMaterial.js'
import { Mesh } from 'https://cdn.skypack.dev/three@0.136/src/objects/Mesh.js'

const raycaster = new Raycaster()
let camera:any, mesh:any
let lastX:number = 0, lastY:number = 0, lastZ:number = 0

self.addEventListener('message', function(e){
    //console.log(e.data)
    if(e.data.type === 'move'){
        camera.position.x = e.data.camera.x
        camera.position.y = e.data.camera.y
        camera.position.z = e.data.camera.z
        camera.lookAt(0,0,0)
        raycaster.setFromCamera({x: e.data.x, y: e.data.y}, camera)
        const intersect = raycaster.intersectObject(mesh)
        if(intersect.length > 0){
            const point = intersect[0].point
            if(point.y >= 0){
                const vx = point.x - lastX
                const vy = point.y - lastY
                const vz = point.z - lastZ
                lastX = point.x
                lastY = point.y
                lastZ = point.z
                this.self.postMessage({
                    ox: camera.position.x,
                    oy: camera.position.y,
                    oz: camera.position.z,
                    dx: raycaster.ray.direction.x,
                    dy: raycaster.ray.direction.y,
                    dz: raycaster.ray.direction.z,
                    vx, vy, vz
                })
                return
            }
        }
    }
    else if(e.data.type === 'init'){
        const geometry = new BoxGeometry( 30, 20, 20 )
        const material = new MeshBasicMaterial( { color: 0xff0000 } )
        mesh = new Mesh( geometry, material )
        camera = new PerspectiveCamera(e.data.fov, e.data.size.width / e.data.size.height, e.data.near, e.data.far)
    }else if(e.data.type === 'resize'){
        camera.aspect = e.data.size.width / e.data.size.height
        camera.updateProjectionMatrix()
    }
})