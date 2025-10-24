export class Strudel {
  public id: string
  public code: string
  public filePath: string
  public lineFrom: number
  public drawContext: CanvasRenderingContext2D | null = null

  constructor(data: { id: string; code: string; filePath: string; lineFrom: number }) {
    this.id = data.id
    this.code = data.code
    this.filePath = data.filePath
    this.lineFrom = data.lineFrom
  }

  compare(other: Strudel) {
    return (
      (this.code === other.code || this.lineFrom === other.lineFrom) &&
      this.filePath === other.filePath
    )
  }

  setDrawContext(ctx: CanvasRenderingContext2D) {
    this.drawContext = ctx
  }
}
