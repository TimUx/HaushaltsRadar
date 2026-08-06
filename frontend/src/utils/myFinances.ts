import type { CostItem, ObjectEntity } from '../api/types'

/** Matches backend analytics person share: direct allocation or object ownership fallback. */
export function costItemBelongsToPerson(
  item: CostItem,
  personId: number,
  objects: Pick<ObjectEntity, 'id' | 'person_id'>[],
): boolean {
  if (item.allocations.some((a) => a.person_id === personId)) return true

  const object = item.object_id != null ? objects.find((o) => o.id === item.object_id) : undefined
  if (object?.person_id === personId) {
    const hasPersonAlloc = item.allocations.some((a) => a.person_id != null)
    if (!item.allocations.length || !hasPersonAlloc) return true
  }
  return false
}

export function overviewRowBelongsToPerson(
  row: { related_person_ids?: number[] },
  personId: number,
): boolean {
  return (row.related_person_ids || []).includes(personId)
}
