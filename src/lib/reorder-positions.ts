import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Builds `case when <id> = $1 then 0 when <id> = $2 then 1 ... end` so a
 * reorder lands as one UPDATE rather than one round-trip per row.
 *
 * Positions are cast to integer: postgres-js sends numbers untyped, and a CASE
 * whose branches are all untyped parameters resolves to text, which an integer
 * column rejects (42804).
 *
 * Pair it with `inArray(idColumn, orderedIds)` — every matched row must have a
 * branch, otherwise the CASE yields NULL and a NOT NULL position rejects it.
 *
 * `offset` exists for tables with a unique (parent, position) index: those need
 * two passes, one parking the rows outside the target range and one assigning
 * the final values.
 */
export function positionCase(idColumn: PgColumn, orderedIds: string[], offset = 0): SQL {
  return sql`case ${sql.join(
    orderedIds.map((id, index) => sql`when ${idColumn} = ${id} then ${index + offset}::integer`),
    sql` `
  )} end`;
}
