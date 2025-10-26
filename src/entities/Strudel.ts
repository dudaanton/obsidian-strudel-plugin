export class Strudel {
  public id: string
  public code: string
  public filePath: string
  public from: number
  public to: number
  // posFrom now points to the beginning of the code block (```strudel)
  // This property returns the position where the actual code starts
  public codeFrom: number
  public drawContext: CanvasRenderingContext2D | null = null

  private shown = true

  constructor(data: {
    id: string
    code: string
    filePath: string
    from: number
    to: number
    codeFrom: number
  }) {
    this.id = data.id
    this.code = data.code
    this.filePath = data.filePath
    this.from = data.from
    this.to = data.to
    this.codeFrom = data.codeFrom
  }

  setDrawContext(ctx: CanvasRenderingContext2D) {
    this.drawContext = ctx
  }

  hide() {
    this.shown = false
  }

  show() {
    this.shown = true
  }

  get isHidden() {
    return !this.shown
  }
}
