// Shared by registration, Store implementations and the demo seed.
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidDisplayName(value: string): boolean {
  const length = [...value].length;
  return (
    value.isWellFormed() &&
    !value.includes('\u0000') &&
    length >= 1 &&
    length <= 100 &&
    value === value.trim()
  );
}

export function validateAccount(input: {
  username: string;
  displayName: string;
  passwordHash: string;
}): void {
  if (!/^[a-z0-9._-]{3,32}$/.test(input.username))
    throw new TypeError('Invalid normalized username');
  if (!isValidDisplayName(input.displayName))
    throw new TypeError('Invalid display name');
  if (!input.passwordHash) throw new TypeError('Missing password hash');
}
