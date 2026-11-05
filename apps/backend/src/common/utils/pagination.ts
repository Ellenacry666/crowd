export function paginate(q: { page: number; limit: number }) {
  return { skip: (q.page - 1) * q.limit, take: q.limit };
}

export function pageMeta(q: { page: number; limit: number }, total: number) {
  return { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) };
}
