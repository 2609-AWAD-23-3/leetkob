// Exact ECMAScript trim whitespace; username policy itself permits ASCII only.
const whitespace =
  '0009 000a 000b 000c 000d 0020 00a0 1680 2000 2001 2002 2003 2004 2005 2006 2007 2008 2009 200a 2028 2029 202f 205f 3000 feff'
    .split(' ')
    .map((point) => String.fromCodePoint(Number.parseInt(point, 16)))
    .join('');
export const NORMALIZED_USERNAME_SQL = `(lower(btrim(username, '${whitespace}') COLLATE "C"))`;
