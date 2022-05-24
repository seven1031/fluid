const EPSILON = 0.000001;
function makePerspective(out: Float32Array, left:number, right:number, top:number, bottom:number, near: number, far: number) {
    const x = 2 * near / ( right - left );
	const y = 2 * near / ( top - bottom );

	const a = ( right + left ) / ( right - left );
	const b = ( top + bottom ) / ( top - bottom );
	const c = - far / ( far - near );
	const d = - far * near / ( far - near );

	out[ 0] = x;
	out[ 1] = 0;
	out[ 2] = 0;
	out[ 3] = 0;
    out[ 4] = 0;
    out[ 5] = y;
    out[ 6] = 0;
    out[ 7] = 0;
    out[ 8] = a;
    out[ 9] = b;
    out[ 10] = c;
    out[ 11] = - 1;
    out[ 12] = 0;
    out[ 13] = 0;
    out[ 14] = d;
    out[ 15] = 0;
}
function create() {
    let out = new Float32Array(16);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
}
function identity(out:Float32Array) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
function lookAt(out: Float32Array, 
    eye1:number, eye2:number, eye3:number, 
    center1:number, center2:number, center3:number, 
    up1:number, up2:number, up3:number) {
    let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
    let eyex = eye1;
    let eyey = eye2;
    let eyez = eye3;
    let upx = up1;
    let upy = up2;
    let upz = up3;
    let centerx = center1;
    let centery = center2;
    let centerz = center3;

    if (Math.abs(eyex - centerx) < EPSILON && 
        Math.abs(eyey - centery) < EPSILON && 
        Math.abs(eyez - centerz) < EPSILON) {
        return identity(out);
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;
    len = 1 / Math.hypot(z0, z1, z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;
    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.hypot(x0, x1, x2);
    // console.log(x0, x1, x2)
    if (!len) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;
    len = Math.hypot(y0, y1, y2);

    if (!len) {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    } else {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;
    return out;
}
function multiply(out:Float32Array, a:Float32Array, b:Float32Array){
    // 1. get a matrix
    const a11 = a[ 0], a21 = a[ 1], a31 = a[ 2], a41 = a[ 3]
    const a12 = a[ 4], a22 = a[ 5], a32 = a[ 6], a42 = a[ 7]
    const a13 = a[ 8], a23 = a[ 9], a33 = a[ 10], a43 = a[ 11]
    const a14 = a[ 12], a24 = a[ 13], a34 = a[ 14], a44 = a[ 15]
    // 2. get b matrix
    const b11 = b[ 0], b21 = b[ 1], b31 = b[ 2], b41 = b[ 3]
    const b12 = b[ 4], b22 = b[ 5], b32 = b[ 6], b42 = b[ 7]
    const b13 = b[ 8], b23 = b[ 9], b33 = b[ 10], b43 = b[ 11]
    const b14 = b[ 12], b24 = b[ 13], b34 = b[ 14], b44 = b[ 15]
    // 3. update out matrix
    out[ 0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    out[ 1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    out[ 2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    out[ 3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    out[ 4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    out[ 5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    out[ 6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    out[ 7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    out[ 8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    out[ 9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    out[ 10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    out[ 11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    out[ 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    out[ 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    out[ 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    out[ 15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
}
export { create, lookAt, makePerspective, multiply }