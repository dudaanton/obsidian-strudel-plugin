export class StrudelConfig {
  private static instance: StrudelConfig

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): StrudelConfig {
    if (!StrudelConfig.instance) {
      StrudelConfig.instance = new StrudelConfig()
    }
    return StrudelConfig.instance
  }
}
