/**
 * Pagination utilities
 *
 * parsePagination(query)
 *   Extracts and validates ?page= and ?limit= from Express query params.
 *   Defaults: page=1, limit=20, max limit=100.
 *
 * paginateQuery(prismaModel, { where, select, orderBy, page, limit })
 *   Runs a count + findMany in parallel and returns a standardised
 *   pagination envelope:
 *   {
 *     data:       [...],
 *     pagination: { total, page, limit, totalPages, hasNext, hasPrev }
 *   }
 *
 * Usage:
 *   const { page, limit } = parsePagination(req.query);
 *   const result = await paginateQuery(prisma.booking, { where, select, orderBy, page, limit });
 *   res.json(result);
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

/**
 * Parse ?page and ?limit from Express query.
 * Always returns valid integers safe to pass to paginateQuery.
 */
export function parsePagination(query = {}) {
  const page  = Math.max(1, parseInt(query.page  ?? "1",  10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(query.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );
  return { page, limit };
}

/**
 * Run a paginated Prisma query.
 *
 * @param {object} model       — Prisma model delegate (e.g. prisma.booking)
 * @param {object} options
 * @param {object} options.where     — Prisma where clause
 * @param {object} options.select    — Prisma select clause
 * @param {object} options.orderBy   — Prisma orderBy clause
 * @param {number} options.page      — 1-based page number
 * @param {number} options.limit     — items per page
 * @returns {{ data: any[], pagination: object }}
 */
export async function paginateQuery(model, { where = {}, select, orderBy, page, limit }) {
  const skip = (page - 1) * limit;

  const [total, data] = await Promise.all([
    model.count({ where }),
    model.findMany({
      where,
      select,
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
