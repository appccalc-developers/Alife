export const matchesRequiredSearch = (actualSearch: string, requiredSearch: string) => {
  if (!requiredSearch) return !actualSearch
  const actual = new URLSearchParams(actualSearch)
  const required = new URLSearchParams(requiredSearch)
  return [...required.entries()].every(([key, value]) => actual.getAll(key).includes(value))
}
