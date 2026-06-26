/**
 * Sets Index Service
 * Maintains a lightweight index for local sample sets to avoid full DB scans
 */
import * as DB from '../../wailsjs/go/main/DB'

// Index entry contains only fields needed for listing/filtering
export interface SetIndexEntry {
  id: string
  label_lv1: string | null
  label_lv2: string | null
  prompt_preview: string // First 100 chars of prompt_text for search
  output_preview: string // First 100 chars of expected_output for search
  version: string
  lang: string
  min_plan: 'trial' | 'pro' | 'team'
  created_at: string
}

const INDEX_PREFIX = 'sets_index:'
const INDEX_META_KEY = 'sets_index:meta'
const LEGACY_INDEX_PREFIX = 'sets:idx:'
const LEGACY_INDEX_META_KEY = 'sets:idx:meta'
const INDEX_VERSION = 2
const LIST_LIMIT = 200

interface IndexMeta {
  version: number
  count: number
  updatedAt: string
}

/**
 * Add or update an entry in the sets index
 */
export async function upsertIndexEntry(entry: SetIndexEntry): Promise<void> {
  await DB.PutString(INDEX_PREFIX + entry.id, JSON.stringify(entry))
  await deleteIfExists(LEGACY_INDEX_PREFIX + entry.id)
  await syncIndexMeta()
}

/**
 * Remove an entry from the sets index
 */
export async function removeIndexEntry(id: string): Promise<void> {
  await Promise.all([deleteIfExists(INDEX_PREFIX + id), deleteIfExists(LEGACY_INDEX_PREFIX + id)])
  await syncIndexMeta()
}

/**
 * Get all index entries with optional filtering
 */
export async function listIndexEntries(options?: {
  category?: string
  keyword?: string
}): Promise<SetIndexEntry[]> {
  await migrateLegacyIndexEntries()

  const entriesById = new Map<string, SetIndexEntry>()
  const rows = await listAllKeyValues(INDEX_PREFIX)
  for (const kv of rows) {
    const entry = parseIndexEntry(kv, INDEX_META_KEY)
    if (entry) {
      entriesById.set(entry.id, entry)
    }
  }

  // Apply filters
  let filtered = Array.from(entriesById.values())
  if (options?.category && options.category !== 'all') {
    filtered = filtered.filter((e) => e.label_lv1 === options.category)
  }
  if (options?.keyword) {
    const k = options.keyword.toLowerCase()
    filtered = filtered.filter(
      (e) =>
        (e.prompt_preview || '').toLowerCase().includes(k) ||
        (e.output_preview || '').toLowerCase().includes(k),
    )
  }

  return filtered
}

/**
 * Check if index exists and is populated
 */
export async function hasIndex(): Promise<boolean> {
  await migrateLegacyIndexEntries()

  let metaCount: number | null = null
  try {
    const meta = await DB.GetString(INDEX_META_KEY)
    if (meta) {
      metaCount = (JSON.parse(meta) as IndexMeta).count
    }
  } catch {
    // Fall through to a direct count; meta may be missing or invalid.
  }

  const count = await countCurrentIndexEntries()
  if (metaCount !== count) await writeIndexMeta(count)
  return count > 0
}

/**
 * Rebuild index from existing sets:* entries (migration utility)
 */
export async function rebuildIndex(): Promise<number> {
  const existingIndexRows = await listAllKeyValues(INDEX_PREFIX)
  await Promise.all(
    existingIndexRows.filter((kv) => kv.key !== INDEX_META_KEY).map((kv) => deleteIfExists(kv.key)),
  )

  const rows = await listAllKeyValues('sets:')
  let indexed = 0

  for (const kv of rows) {
    // Skip legacy index entries that lived under the sets: data prefix.
    if (kv.key.startsWith(LEGACY_INDEX_PREFIX)) continue
    try {
      const data = JSON.parse(kv.value) as {
        id?: string
        label_lv1?: string | null
        label_lv2?: string | null
        prompt_text?: string
        expected_output?: string | null
        version?: string
        lang?: string
        min_plan?: string
        created_at?: string
      }
      if (!data.id) continue

      const entry: SetIndexEntry = {
        id: data.id,
        label_lv1: data.label_lv1 ?? null,
        label_lv2: data.label_lv2 ?? null,
        prompt_preview: (data.prompt_text || '').slice(0, 100),
        output_preview: (data.expected_output || '').slice(0, 100),
        version: data.version || 'v1',
        lang: data.lang || 'zh',
        min_plan: (['trial', 'pro', 'team'].includes(data.min_plan || '')
          ? data.min_plan
          : 'trial') as 'trial' | 'pro' | 'team',
        created_at: data.created_at || new Date().toISOString(),
      }
      await DB.PutString(INDEX_PREFIX + entry.id, JSON.stringify(entry))
      indexed++
    } catch {
      // Invalid entry, skip
    }
  }

  await cleanupLegacyIndex()
  await writeIndexMeta(indexed)

  return indexed
}

type DBKeyValue = Awaited<ReturnType<typeof DB.ListPrefix>>[number]

async function listAllKeyValues(prefix: string): Promise<DBKeyValue[]> {
  const rows: DBKeyValue[] = []
  let offset = 0

  while (true) {
    const chunk = await DB.ListPrefix(prefix, offset, LIST_LIMIT)
    rows.push(...chunk)
    offset += chunk.length
    if (chunk.length < LIST_LIMIT) break
  }

  return rows
}

function parseIndexEntry(kv: DBKeyValue, metaKey: string): SetIndexEntry | null {
  if (kv.key === metaKey) return null

  try {
    const entry = JSON.parse(kv.value) as Partial<SetIndexEntry>
    if (!entry.id) return null
    return {
      id: entry.id,
      label_lv1: entry.label_lv1 ?? null,
      label_lv2: entry.label_lv2 ?? null,
      prompt_preview: entry.prompt_preview || '',
      output_preview: entry.output_preview || '',
      version: entry.version || 'v1',
      lang: entry.lang || 'zh',
      min_plan: (['trial', 'pro', 'team'].includes(entry.min_plan || '')
        ? entry.min_plan
        : 'trial') as 'trial' | 'pro' | 'team',
      created_at: entry.created_at || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

async function migrateLegacyIndexEntries(): Promise<void> {
  const legacyRows = await listAllKeyValues(LEGACY_INDEX_PREFIX)
  if (legacyRows.length === 0) return

  let changed = false
  for (const kv of legacyRows) {
    if (kv.key === LEGACY_INDEX_META_KEY) continue

    const entry = parseIndexEntry(kv, LEGACY_INDEX_META_KEY)
    if (entry) {
      const existing = await getStringOrNull(INDEX_PREFIX + entry.id)
      if (!existing) {
        await DB.PutString(INDEX_PREFIX + entry.id, JSON.stringify(entry))
        changed = true
      }
    }

    await deleteIfExists(kv.key)
  }

  await deleteIfExists(LEGACY_INDEX_META_KEY)
  if (changed) await syncIndexMeta()
}

async function cleanupLegacyIndex(): Promise<void> {
  const legacyRows = await listAllKeyValues(LEGACY_INDEX_PREFIX)
  await Promise.all(legacyRows.map((kv) => deleteIfExists(kv.key)))
}

async function getStringOrNull(key: string): Promise<string | null> {
  try {
    const raw = await DB.GetString(key)
    return raw || null
  } catch {
    return null
  }
}

async function deleteIfExists(key: string): Promise<void> {
  try {
    await DB.Delete(key)
  } catch {
    // Missing keys are safe to ignore.
  }
}

async function countCurrentIndexEntries(): Promise<number> {
  const rows = await listAllKeyValues(INDEX_PREFIX)
  return rows.filter((kv) => kv.key !== INDEX_META_KEY).length
}

async function syncIndexMeta(): Promise<void> {
  await writeIndexMeta(await countCurrentIndexEntries())
}

async function writeIndexMeta(count: number): Promise<void> {
  try {
    await DB.PutString(
      INDEX_META_KEY,
      JSON.stringify({
        version: INDEX_VERSION,
        count,
        updatedAt: new Date().toISOString(),
      }),
    )
  } catch {
    // Metadata is only an optimization; callers can recover via direct counts.
  }
}
