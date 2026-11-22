// Lexer C++ tối thiểu cho hard rules: bỏ comment, string, char, raw string, ghép dòng
// bằng `\`, giữ số dòng gốc cho từng token và tách các dòng preprocessor ra khỏi dòng code.

export type TokenKind = 'id' | 'num' | 'str' | 'op';

export interface Token {
  kind: TokenKind;
  text: string;
  /** Dòng gốc (từ 1). Với token sinh ra từ macro: dòng nơi macro được dùng. */
  line: number;
  /** Các dòng macro (dòng `#define` và dòng thân macro) mà token này đi qua. */
  via: readonly number[];
}

export interface DefineItem {
  type: 'define';
  line: number;
  name: string;
  params: string[] | null;
  variadic: boolean;
  body: Token[];
}

export type Item =
  | { type: 'tok'; tok: Token }
  | DefineItem
  | { type: 'dir'; name: string; line: number; tokens: Token[] };

interface RawToken extends Token {
  start: number;
  end: number;
}

const NEWLINE: unique symbol = Symbol('newline');

const isIdStart = (c: string): boolean =>
  (c >= 'a' && c <= 'z') ||
  (c >= 'A' && c <= 'Z') ||
  c === '_' ||
  c === '$' ||
  c > '\u007f';
const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isIdPart = (c: string): boolean => isIdStart(c) || isDigit(c);

const OPS3 = new Set(['<<=', '>>=', '...', '->*', '<=>']);
const OPS2 = new Set([
  '::',
  '->',
  '.*',
  '<<',
  '>>',
  '<=',
  '>=',
  '==',
  '!=',
  '&&',
  '||',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '##',
]);
const STRING_PREFIXES = new Set(['u8', 'u', 'U', 'L']);
const RAW_PREFIXES = new Set(['R', 'LR', 'uR', 'UR', 'u8R']);

/** Bỏ `\` + xuống dòng nhưng nhớ số dòng gốc của từng ký tự còn lại. */
const prepare = (source: string): { text: string; lineOf: number[] } => {
  const normalized = source.replace(/\r\n?/g, '\n');
  const chars: string[] = [];
  const lineOf: number[] = [];
  let line = 1;
  for (let i = 0; i < normalized.length; i += 1) {
    const c = normalized[i] as string;
    if (c === '\\' && normalized[i + 1] === '\n') {
      i += 1;
      line += 1;
      continue;
    }
    chars.push(c);
    lineOf.push(line);
    if (c === '\n') line += 1;
  }
  return { text: chars.join(''), lineOf };
};

class Scanner {
  private pos = 0;
  constructor(
    private readonly text: string,
    private readonly lineOf: readonly number[],
  ) {}

  private lineAt(index: number): number {
    return this.lineOf[Math.min(index, this.lineOf.length - 1)] ?? 1;
  }

  private make(kind: TokenKind, start: number, text: string): RawToken {
    return {
      kind,
      text,
      line: this.lineAt(start),
      via: [],
      start,
      end: this.pos,
    };
  }

  /** Đọc literal chuỗi/ký tự bắt đầu tại `pos` (đang trỏ vào dấu nháy). */
  private quoted(quote: string): void {
    this.pos += 1;
    while (this.pos < this.text.length) {
      const c = this.text[this.pos] as string;
      if (c === '\\') {
        this.pos += 2;
        continue;
      }
      if (c === '\n') return; // literal không đóng: dừng ở hết dòng
      this.pos += 1;
      if (c === quote) return;
    }
  }

  private rawString(): void {
    // pos đang ở dấu `"` sau tiền tố R
    this.pos += 1;
    let delimiter = '';
    while (this.pos < this.text.length) {
      const c = this.text[this.pos] as string;
      if (c === '(' || delimiter.length > 16 || c === '\n') break;
      delimiter += c;
      this.pos += 1;
    }
    if (this.text[this.pos] !== '(') return;
    const closing = `)${delimiter}"`;
    const found = this.text.indexOf(closing, this.pos + 1);
    this.pos = found === -1 ? this.text.length : found + closing.length;
  }

  /** Token kế tiếp, `NEWLINE` ở cuối dòng, `null` khi hết file. */
  next(): RawToken | typeof NEWLINE | null {
    const { text } = this;
    while (this.pos < text.length) {
      const c = text[this.pos] as string;
      if (c === '\n') {
        this.pos += 1;
        return NEWLINE;
      }
      if (c === ' ' || c === '\t' || c === '\f' || c === '\v') {
        this.pos += 1;
        continue;
      }
      if (c === '/' && text[this.pos + 1] === '/') {
        const eol = text.indexOf('\n', this.pos);
        this.pos = eol === -1 ? text.length : eol;
        continue;
      }
      if (c === '/' && text[this.pos + 1] === '*') {
        const close = text.indexOf('*/', this.pos + 2);
        this.pos = close === -1 ? text.length : close + 2;
        continue;
      }
      const start = this.pos;
      if (c === '"' || c === "'") {
        this.quoted(c);
        return this.make('str', start, text.slice(start, this.pos));
      }
      if (isIdStart(c)) {
        while (this.pos < text.length && isIdPart(text[this.pos] as string)) {
          this.pos += 1;
        }
        const word = text.slice(start, this.pos);
        const nextChar = text[this.pos];
        if (nextChar === '"' && RAW_PREFIXES.has(word)) {
          this.rawString();
          return this.make('str', start, text.slice(start, this.pos));
        }
        if (
          (nextChar === '"' || nextChar === "'") &&
          STRING_PREFIXES.has(word)
        ) {
          this.quoted(nextChar);
          return this.make('str', start, text.slice(start, this.pos));
        }
        return this.make('id', start, word);
      }
      if (isDigit(c) || (c === '.' && isDigit(text[this.pos + 1] ?? ''))) {
        this.pos += 1;
        while (this.pos < text.length) {
          const d = text[this.pos] as string;
          const prev = text[this.pos - 1] as string;
          if (isIdPart(d) || d === '.') {
            this.pos += 1;
          } else if (d === "'" && isIdPart(text[this.pos + 1] ?? '')) {
            this.pos += 1; // dấu tách chữ số: 1'000'000
          } else if ((d === '+' || d === '-') && 'eEpP'.includes(prev)) {
            this.pos += 1;
          } else {
            break;
          }
        }
        return this.make('num', start, text.slice(start, this.pos));
      }
      const three = text.slice(this.pos, this.pos + 3);
      const two = text.slice(this.pos, this.pos + 2);
      const length = OPS3.has(three) ? 3 : OPS2.has(two) ? 2 : 1;
      this.pos += length;
      return this.make('op', start, text.slice(start, this.pos));
    }
    return null;
  }
}

const toToken = (raw: RawToken): Token => ({
  kind: raw.kind,
  text: raw.text,
  line: raw.line,
  via: [],
});

const parseDefine = (line: number, rest: RawToken[]): DefineItem | null => {
  const name = rest[2];
  if (name === undefined || name.kind !== 'id') return null;
  const open = rest[3];
  let params: string[] | null = null;
  let variadic = false;
  let bodyStart = 3;
  if (open !== undefined && open.text === '(' && open.start === name.end) {
    params = [];
    let index = 4;
    for (; index < rest.length; index += 1) {
      const part = rest[index] as RawToken;
      if (part.text === ')') break;
      if (part.text === '...') {
        variadic = true;
        params.push('__VA_ARGS__');
      } else if (part.kind === 'id') {
        params.push(part.text);
      }
    }
    bodyStart = index + 1;
  }
  return {
    type: 'define',
    line,
    name: name.text,
    params,
    variadic,
    body: rest.slice(bodyStart).map(toToken),
  };
};

/** Tách source thành token và directive. `#include` bị bỏ: nó không phải là việc dùng. */
export const lex = (source: string): Item[] => {
  const { text, lineOf } = prepare(source);
  const scanner = new Scanner(text, lineOf);
  const items: Item[] = [];
  let atLineStart = true;
  for (let raw = scanner.next(); raw !== null; raw = scanner.next()) {
    if (raw === NEWLINE) {
      atLineStart = true;
      continue;
    }
    if (atLineStart && raw.kind === 'op' && raw.text === '#') {
      const rest: RawToken[] = [raw];
      for (let part = scanner.next(); part !== null; part = scanner.next()) {
        if (part === NEWLINE) break;
        rest.push(part);
      }
      atLineStart = true;
      const nameToken = rest[1];
      const name =
        nameToken !== undefined && nameToken.kind === 'id'
          ? nameToken.text
          : '';
      if (name === 'include' || name === 'import' || name === 'include_next')
        continue;
      if (name === 'define') {
        const define = parseDefine(raw.line, rest);
        if (define !== null) items.push(define);
        continue;
      }
      items.push({
        type: 'dir',
        name,
        line: raw.line,
        tokens: rest.slice(2).map(toToken),
      });
      continue;
    }
    atLineStart = false;
    items.push({ type: 'tok', tok: toToken(raw) });
  }
  return items;
};
