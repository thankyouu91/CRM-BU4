/**
 * Plain JSON copy of server data, exactly what the matching API route returns
 * (dates as ISO strings), for passing to client views as their first data.
 */
export const asJson = <T,>(value: unknown): T => JSON.parse(JSON.stringify(value));
