import localForage from 'localforage'
import pLimit from 'p-limit'
import { DedupPool } from '../dedup'

export type BlobImage = {
  id: string
  urls: string[]
}

export type AnyBlobImage = string | BlobImage

export type BlobFlavour = 'soul' | 'normal'
export type BlobImages = string | Partial<Record<BlobFlavour, AnyBlobImage>>

export function blobImage(urls: string[], id?: string): BlobImage | undefined {
  if (!urls.length && id) return { id: id, urls: urls }
  return urls[0] ? { id: id || urls[0], urls: urls } : undefined
}

const blobStore = localForage.createInstance({
  name: 'cpp_blob',
})

const blobMap = new Map<string, string>()
const pool = new DedupPool<string>()
export const badUrl = 'data:image/webp,'

function mime(url: string) {
  try {
    const p = new URL(url).pathname.toLowerCase()
    if (p.endsWith('.png')) return 'image/png'
    if (p.endsWith('.webp')) return 'image/webp'
    return undefined
  } catch {
    return undefined
  }
}

function commit(url: string, blobUrl: string) {
  blobMap.set(url, blobUrl)
  return blobUrl
}

const limit = pLimit(8)

export function pure(url: BlobImages, prefer: BlobFlavour = 'soul'): BlobImage | undefined {
  if (typeof url === 'string') {
    return { id: url, urls: [url] }
  }
  const u = url[prefer] || url['normal'] || url['soul']
  if (!u) return undefined
  if (typeof u === 'string') {
    return { id: u, urls: [u] }
  }
  return u
}

export function load(inputUrl: BlobImages, prefer?: BlobFlavour): string | Promise<string> {
  const url = pure(inputUrl, prefer)
  if (!url) return badUrl

  if (blobMap.has(url.id)) {
    return blobMap.get(url.id)!
  }

  return pool.run(url.id, () =>
    limit(async () => {
      const existing = (await blobStore.getItem(url.id)) as ArrayBuffer
      if (existing) {
        const blobUrl = URL.createObjectURL(new Blob([existing], { type: mime(url.id) }))
        return commit(url.id, blobUrl)
      }

      if (!url.urls.length) {
        return commit(url.id, badUrl)
      }

      try {
        const res = await multifetch(url.urls)
        if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`, { cause: res })
        const ab = await res.arrayBuffer()
        await blobStore.setItem(url.id, ab)
        const blobUrl = URL.createObjectURL(new Blob([ab], { type: mime(url.id) }))
        return commit(url.id, blobUrl)
      } catch (e) {
        console.error(`Cannot cache ${JSON.stringify(url)}.`, e)
        return commit(url.id, badUrl)
      }
    }),
  )
}

async function multifetch(urls: string[]) {
  let originalError: any = null
  for (const url of urls) {
    try {
      const result = await superfetch(url)
      if (result.status === 404) {
        console.warn(`Failed to load ${url}: 404`)
        continue
      }
      return result
    } catch (e) {
      if (!originalError) {
        originalError = e
      }
      continue
    }
  }

  throw originalError
}

async function superfetch(url: string) {
  const github = parseGitHubRawUrl(url)
  if (!github) return fetch(url, { referrerPolicy: 'no-referrer' })

  let originalError: any = null
  try {
    const res = await fetch(url, { referrerPolicy: 'no-referrer' })
    if (res.status === 404) return res
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`, { cause: res })
    return res
  } catch (e) {
    originalError = e
  }

  for (const v of Object.values(githubRawTargets)) {
    try {
      const res = await fetch(v(github), { referrerPolicy: 'no-referrer' })
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`, { cause: res })
      return res
    } catch (e) {
      continue
    }
  }

  throw originalError
}

const githubRawTargets = {
  'cdn.jsdelivr.net': (c) =>
    `https://cdn.jsdelivr.net/gh/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}@${encodeURIComponent(
      c.ref,
    )}/${c.path}`,

  'ghproxy.com': (c) =>
    `https://ghproxy.com/https://raw.githubusercontent.com/${encodeURIComponent(c.owner)}/${encodeURIComponent(
      c.repo,
    )}/${encodeURIComponent(c.ref)}/${c.path}`,

  'raw.gitmirror.com': (c) =>
    `https://raw.gitmirror.com/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/${encodeURIComponent(
      c.ref,
    )}/${c.path}`,
} satisfies Record<string, (c: Exclude<ReturnType<typeof parseGitHubRawUrl>, undefined>) => string>

function parseGitHubRawUrl(url: string): { owner: string; repo: string; ref: string; path: string } | undefined {
  // url is https://raw.githubusercontent.com/Aceship/Arknight-Images/main/equip/type/bom-x.png
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return undefined
  }
  if (u.host.toLowerCase() !== 'raw.githubusercontent.com') return
  const parts = u.pathname.split('/')
  if (parts[0]) return
  const owner = decodeURIComponent(parts[1])
  const repo = decodeURIComponent(parts[2])
  const ref = decodeURIComponent(parts[3])
  const path = parts.slice(4).join('/')
  return { owner, repo, ref, path }
}
