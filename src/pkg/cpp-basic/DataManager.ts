import localForage from 'localforage'
import pProps from 'p-props'
import { IGame } from './types'

const store = localForage.createInstance({
  name: 'cpp_dm',
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export abstract class BasicDataManager<G extends IGame> {
  public constructor(private storagePrefix: string) {}

  public async init() {
    this.initialized = false
    try {
      this.raw = await this.loadRaw()
      this.data = await this.transform()
    } catch (e) {
      this.error = e as any
      throw e
    }
    this.initialized = true
  }
  public initialized = false
  public error?: Error

  public abstract transform(): Promise<any>
  public data!: Awaited<ReturnType<this['transform']>>

  public async refresh() {
    return await this.loadRaw(true)
  }

  public async loadRaw(refresh?: boolean): Promise<{
    [K in keyof Awaited<ReturnType<this['getLoadRawTasks']>>]: Awaited<Awaited<ReturnType<this['getLoadRawTasks']>>[K]>
  }> {
    const task = this.getLoadRawTasks(refresh) as Awaited<ReturnType<this['getLoadRawTasks']>>
    return (await pProps(task)) as any as { [K in keyof typeof task]: Awaited<(typeof task)[K]> }
  }
  public raw!: {
    [K in keyof Awaited<ReturnType<this['getLoadRawTasks']>>]: Awaited<Awaited<ReturnType<this['getLoadRawTasks']>>[K]>
  }

  public abstract getLoadRawTasks(refresh?: boolean): Record<string, Promise<any>>

  protected async loadJson<T>(
    url: string,
    refresh = false,
    key = url,
    shitDefault: (() => T) | undefined = undefined,
  ): Promise<T> {
    const fullKey = `${this.storagePrefix}${key}`
    const timeKey = `${this.storagePrefix}--time--${key}`
    const existing = (await store.getItem<string>(fullKey)) || ''
    if (!refresh && existing) {
      try {
        return JSON.parse(existing)
      } catch {
        //
      }
    }
    let log = undefined
    let response: Response | undefined = undefined
    try {
      response = await fetch(url)
      if (!response.ok) {
        log = `status ${response.status} ${response.statusText}`
      }
    } catch (e: any) {
      log = String(e?.message || '')
    }
    if (log !== undefined || !response) {
      if (existing) {
        try {
          console.warn(`Failed to fetch ${url}: ${log}, using existing`)
          return JSON.parse(existing)
        } catch {
          //
        }
      }
      if (shitDefault !== undefined) {
        console.warn(`Failed to fetch ${url}: ${log}, using shit default`)
        return shitDefault()
      }
      throw new Error(`Failed to fetch ${url}: ${log}`)
    }
    const result = await response.json()
    await store.setItem(fullKey, JSON.stringify(result))
    await store.setItem(timeKey, Date.now())
    console.log(`Updated ${url}`)
    return result
  }
}
