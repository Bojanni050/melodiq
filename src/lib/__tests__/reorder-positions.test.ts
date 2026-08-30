import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import { positionCase } from "@/lib/reorder-positions";
import { coverImages, playlistTracks } from "@/db/schema";

const dialect = new PgDialect();

describe("positionCase", () => {
  it("emits one CASE branch per id, in order, as bound parameters", () => {
    const query = dialect.sqlToQuery(positionCase(coverImages.id, ["a", "b", "c"]));

    expect(query.sql).toBe(
      'case when "cover_images"."id" = $1 then $2 ' +
        'when "cover_images"."id" = $3 then $4 ' +
        'when "cover_images"."id" = $5 then $6 end'
    );
    expect(query.params).toEqual(["a", 0, "b", 1, "c", 2]);
  });

  it("applies the offset used by the two-phase reorder", () => {
    const query = dialect.sqlToQuery(positionCase(playlistTracks.id, ["x", "y"], 100000));

    expect(query.params).toEqual(["x", 100000, "y", 100001]);
    expect(query.sql).toContain('"playlist_tracks"."id"');
  });

  it("assigns a distinct position to every id", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    const { params } = dialect.sqlToQuery(positionCase(coverImages.id, ids));

    const positions = params.filter((_, i) => i % 2 === 1);
    expect(positions).toEqual(ids.map((_, i) => i));
    expect(new Set(positions).size).toBe(ids.length);
  });
});
