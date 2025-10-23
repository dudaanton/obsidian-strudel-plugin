import { nanoid } from 'nanoid'
import { App } from 'obsidian'
import { createPinia } from 'pinia'
import { createApp, defineComponent, Component as VueComponent } from 'vue'

/**
 * Helper class for managing Vue components in Obsidian
 */
export class VueRenderer {
  private static instance: VueRenderer
  private app: App
  private vueApps: Map<string, any> = new Map()

  private constructor(app: App) {
    this.app = app
  }

  /**
   * Get the singleton instance of VueRenderer
   * @param app Obsidian App instance
   * @returns VueRenderer instance
   */
  public static getInstance(app: App): VueRenderer {
    if (!VueRenderer.instance) {
      VueRenderer.instance = new VueRenderer(app)
    }
    return VueRenderer.instance
  }

  /**
   * Mount a Vue component to a DOM element
   * @param container The DOM element to mount the component to
   * @param component The Vue component to mount
   * @param props Props to pass to the component
   * @returns A unique ID for the mounted component
   */
  public mountComponent(
    container: HTMLElement,
    component: VueComponent,
    props: Record<string, any> = {}
  ): string {
    // Create a unique ID for this component instance
    const id = `vue-component-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    // Create a wrapper div for the Vue app
    const mountPoint = document.createElement('div')
    mountPoint.id = id
    container.appendChild(mountPoint)

    const pinia = createPinia()

    // Create a Vue app with the component
    const app = createApp(component, props)

    app.use(pinia)

    // Mount the app to the container
    app.mount(`#${id}`)

    // Store the app reference for cleanup
    this.vueApps.set(id, app)

    return id
  }

  /**
   * Unmount a Vue component by its ID
   * @param id The ID of the component to unmount
   */
  public unmountComponent(id: string): void {
    const app = this.vueApps.get(id)
    if (app) {
      app.unmount()
      this.vueApps.delete(id)
      const mountPoint = document.getElementById(id)
      if (mountPoint) {
        mountPoint.remove()
      }
    }
  }

  /**
   * Create a wrapper for a Vue component that can be used with Obsidian's Component system
   * @param component The Vue component to wrap
   * @param props Props to pass to the component
   * @returns A function that can be used to mount the component
   */
  public createComponentWrapper(
    component: VueComponent,
    props: Record<string, any> = {}
  ): (container: HTMLElement) => string {
    return (container: HTMLElement) => {
      return this.mountComponent(container, component, props)
    }
  }
}

/**
 * Create a simple Vue component from a template string
 * @param template The Vue template string
 * @param options Additional Vue component options
 * @returns A Vue component
 */
export function createVueComponent(
  template: string,
  options: Record<string, any> = {}
): VueComponent {
  return defineComponent({
    template,
    ...options,
  })
}

export function genid(): string {
  return `vue-${nanoid()}`
}
