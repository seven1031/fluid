class Stats{
    mode:number = 0
    container:HTMLElement
    beginTime:number = performance.now()
    prevTime:number = this.beginTime
    frames:number = 0
    fpsPanel:Panel
    msPanel:Panel
    memPanel:Panel
    constructor(){
        const container = this.container = document.createElement('div')
        container.setAttribute('style', 'position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000')
        container.addEventListener( 'click', ( event ) => {
            event.preventDefault()
            this.showPanel( ++ this.mode % container.children.length )
        }, false )

        this.fpsPanel = this.addPanel( new Panel( 'FPS', '#0ff', '#002' ) )
        this.msPanel = this.addPanel( new Panel( 'MS', '#0f0', '#020' ) )
        this.memPanel = this.addPanel( new Panel( 'MB', '#f08', '#201' ) )
        this.showPanel( 0 )
    }

	addPanel( panel: Panel) {
		this.container.appendChild( panel.canvas )
		return panel
	}

	showPanel( id:number ) {
        for ( let i = 0; i < this.container.children.length; i ++ ) {
			(this.container.children[ i ] as HTMLElement).style.display = i === id ? 'block' : 'none'
		}
		this.mode = id
	}

    begin() {
        this.beginTime = ( performance || Date ).now()
    }

    end() {
        this.frames ++
        const time = performance.now()
        if(this.mode == 1)
            this.msPanel.update( time - this.beginTime, 100 )
        else if ( time >= this.prevTime + 1000 ) {
            if(this.mode == 0)
                this.fpsPanel.update( ( this.frames * 1000 ) / ( time - this.prevTime ), 100 )
            else if(this.mode == 2){
                const memory = (performance as any).memory
                this.memPanel.update( memory.totalJSHeapSize / 1048576, 128 )
            }
            this.prevTime = time
            this.frames = 0
        }
        return time
    }
    update() {
        this.beginTime = this.end()
    }
}

class Panel{
    min:number = Infinity
    max:number = 0
    name:string
    bg:string
    fg:string
    PR:number = 1
    WIDTH = 80 * this.PR
    HEIGHT = 48 * this.PR
    TEXT_X = 3 * this.PR
    TEXT_Y = 2 * this.PR
    GRAPH_X = 3 * this.PR
    GRAPH_Y = 15 * this.PR
    GRAPH_WIDTH = 74 * this.PR
    GRAPH_HEIGHT = 30 * this.PR

    canvas: HTMLCanvasElement
    context:CanvasRenderingContext2D

    constructor(name:string, fg:string, bg:string){
        this.name = name
        this.bg = bg
        this.fg = fg
        const canvas = this.canvas = document.createElement( 'canvas' )
        canvas.width = this.WIDTH
        canvas.height = this.HEIGHT
        canvas.style.cssText = 'width:80pxheight:48px'
        const context = this.context = canvas.getContext( '2d' ) as CanvasRenderingContext2D
        context.font = 'bold ' + ( 9 * this.PR ) + 'px Helvetica,Arial,sans-serif'
        context.textBaseline = 'top'
        context.fillStyle = bg
        context.fillRect( 0, 0, this.WIDTH, this.HEIGHT )
        context.fillStyle = fg
        context.fillText( name, this.TEXT_X, this.TEXT_Y )
        context.fillRect( this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH, this.GRAPH_HEIGHT )
        context.fillStyle = bg
        context.globalAlpha = 0.9
        context.fillRect( this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH, this.GRAPH_HEIGHT )
    }

    update( value:number, maxValue:number ) {
        this.min = Math.min( this.min, value )
        this.max = Math.max( this.max, value )
        this.context.fillStyle = this.bg
        this.context.globalAlpha = 1
        this.context.fillRect( 0, 0, this.WIDTH, this.GRAPH_Y )
        this.context.fillStyle = this.fg
        this.context.fillText( Math.round( value ) + ' ' + this.name + ' (' + Math.round( this.min ) + '-' + Math.round( this.max ) + ')', this.TEXT_X, this.TEXT_Y )
        this.context.drawImage( this.canvas, this.GRAPH_X + this.PR, this.GRAPH_Y, this.GRAPH_WIDTH - this.PR, this.GRAPH_HEIGHT, this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH - this.PR, this.GRAPH_HEIGHT )
        this.context.fillRect( this.GRAPH_X + this.GRAPH_WIDTH - this.PR, this.GRAPH_Y, this.PR, this.GRAPH_HEIGHT )
        this.context.fillStyle = this.bg
        this.context.globalAlpha = 0.9
        this.context.fillRect( this.GRAPH_X + this.GRAPH_WIDTH - this.PR, this.GRAPH_Y, this.PR, Math.round( ( 1 - ( value / maxValue ) ) * this.GRAPH_HEIGHT ) )
    }
}

export {Stats}
