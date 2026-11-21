import type { DefineItem, Item, Token } from './lexer.js';

// Bộ tiền xử lý tối thiểu: khai triển macro object-like và function-like (kể cả lồng nhau,
// `#`, `##`, __VA_ARGS__) và bỏ các nhánh `#if 0` / `#if 1 ... #else`. Token sinh ra từ macro
// mang dòng nơi macro được dùng, kèm `via` là các dòng define/thân macro để làm evidence.
// Macro không được dùng thì không sinh token nào, nên không bị tính là vi phạm.

const MAX_DEPTH = 24;
const MAX_TOKENS = 200_000;

interface Conditional {
  active: boolean;
  satisfied: boolean;
}

const unique = (lines: readonly number[]): number[] => [...new Set(lines)];

const isOp = (tok: Token | undefined, text: string): boolean =>
  tok !== undefined && tok.kind === 'op' && tok.text === text;

/** Đọc đối số của lời gọi macro; `open` là chỉ số của `(`. */
const readArgs = (
  tokens: readonly Token[],
  open: number,
): { args: Token[][]; end: number } | null => {
  const args: Token[][] = [[]];
  let depth = 0;
  for (let i = open; i < tokens.length; i += 1) {
    const tok = tokens[i] as Token;
    if (tok.kind === 'op') {
      if (tok.text === '(') {
        depth += 1;
        if (depth === 1) continue;
      } else if (tok.text === ')') {
        depth -= 1;
        if (depth === 0) return { args, end: i + 1 };
      } else if (tok.text === ',' && depth === 1) {
        args.push([]);
        continue;
      }
    }
    (args[args.length - 1] as Token[]).push(tok);
  }
  return null;
};

const stringify = (use: Token): Token => ({
  kind: 'str',
  text: '""',
  line: use.line,
  via: use.via,
});

const paste = (left: Token, right: Token): Token => {
  const text = left.text + right.text;
  const kind = /^[A-Za-z_$]/.test(text)
    ? 'id'
    : /^[0-9.]/.test(text)
      ? 'num'
      : 'op';
  return {
    kind,
    text,
    line: left.line,
    via: unique([...left.via, ...right.via]),
  };
};

const instantiate = (
  macro: DefineItem,
  rawArgs: Token[][],
  expandedArgs: Token[][],
  use: Token,
): Token[] => {
  const params = macro.params ?? [];
  const out: Token[] = [];
  const body = macro.body;
  const placeholder = (tok: Token): Token => ({
    ...tok,
    line: use.line,
    via: unique([...use.via, macro.line, tok.line]),
  });
  const paramIndex = (tok: Token | undefined): number =>
    tok !== undefined && tok.kind === 'id' ? params.indexOf(tok.text) : -1;
  const argFor = (index: number, raw: boolean): Token[] => {
    const list = raw ? rawArgs : expandedArgs;
    if (params[index] === '__VA_ARGS__') {
      const rest = list.slice(index);
      const joined: Token[] = [];
      rest.forEach((part, n) => {
        if (n > 0)
          joined.push({ kind: 'op', text: ',', line: use.line, via: use.via });
        joined.push(...part);
      });
      return joined;
    }
    return list[index] ?? [];
  };

  for (let j = 0; j < body.length; j += 1) {
    const tok = body[j] as Token;
    const next = body[j + 1];
    const previous = body[j - 1];
    if (isOp(tok, '#') && paramIndex(next) >= 0) {
      out.push(stringify(use));
      j += 1;
      continue;
    }
    if (isOp(tok, '##')) {
      const left = out.pop();
      const right = body[j + 1];
      if (left === undefined || right === undefined) continue;
      const rightIndex = paramIndex(right);
      const rightTokens =
        rightIndex >= 0 ? argFor(rightIndex, true) : [placeholder(right)];
      const [first, ...others] = rightTokens;
      out.push(first === undefined ? left : paste(left, first), ...others);
      j += 1;
      continue;
    }
    const index = paramIndex(tok);
    if (index >= 0) {
      const raw = isOp(next, '##') || isOp(previous, '##');
      out.push(...argFor(index, raw));
      continue;
    }
    out.push(placeholder(tok));
  }
  return out;
};

const expand = (
  tokens: readonly Token[],
  macros: ReadonlyMap<string, DefineItem>,
  hidden: ReadonlySet<string>,
  depth: number,
): Token[] => {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length;) {
    const tok = tokens[i] as Token;
    const macro =
      tok.kind === 'id' && !hidden.has(tok.text)
        ? macros.get(tok.text)
        : undefined;
    if (macro === undefined || depth > MAX_DEPTH || out.length > MAX_TOKENS) {
      out.push(tok);
      i += 1;
      continue;
    }
    const inner = new Set(hidden).add(macro.name);
    if (macro.params === null) {
      out.push(
        ...expand(instantiate(macro, [], [], tok), macros, inner, depth + 1),
      );
      i += 1;
      continue;
    }
    if (!isOp(tokens[i + 1], '(')) {
      out.push(tok);
      i += 1;
      continue;
    }
    const call = readArgs(tokens, i + 1);
    if (call === null) {
      out.push(tok);
      i += 1;
      continue;
    }
    const expandedArgs = call.args.map((arg) =>
      expand(arg, macros, hidden, depth + 1),
    );
    out.push(
      ...expand(
        instantiate(macro, call.args, expandedArgs, tok),
        macros,
        inner,
        depth + 1,
      ),
    );
    i = call.end;
  }
  return out;
};

/** Giá trị đã biết của điều kiện `#if`: chỉ nhận literal 0 hoặc 1. */
const knownCondition = (tokens: readonly Token[]): boolean | null => {
  if (tokens.length !== 1) return null;
  const only = tokens[0] as Token;
  if (only.kind !== 'num') return null;
  if (only.text === '0') return false;
  if (only.text === '1') return true;
  return null;
};

export const preprocess = (items: readonly Item[]): Token[] => {
  const macros = new Map<string, DefineItem>();
  const stack: Conditional[] = [];
  const out: Token[] = [];
  let run: Token[] = [];
  const active = (): boolean => stack.every((entry) => entry.active);
  const flush = (): void => {
    if (run.length > 0) out.push(...expand(run, macros, new Set(), 0));
    run = [];
  };

  for (const item of items) {
    if (item.type === 'tok') {
      if (active()) run.push(item.tok);
      continue;
    }
    flush();
    if (item.type === 'define') {
      if (active()) macros.set(item.name, item);
      continue;
    }
    switch (item.name) {
      case 'if': {
        const known = knownCondition(item.tokens);
        stack.push({ active: known !== false, satisfied: known === true });
        break;
      }
      case 'ifdef':
      case 'ifndef':
        // Không biết macro nào được định nghĩa ngoài file: giữ nhánh đầu, không giả định.
        stack.push({ active: true, satisfied: false });
        break;
      case 'elif': {
        const top = stack[stack.length - 1];
        if (top === undefined) break;
        const known = knownCondition(item.tokens);
        top.active = !top.satisfied && known !== false;
        if (known === true) top.satisfied = true;
        break;
      }
      case 'else': {
        const top = stack[stack.length - 1];
        if (top === undefined) break;
        top.active = !top.satisfied;
        top.satisfied = true;
        break;
      }
      case 'endif':
        stack.pop();
        break;
      case 'undef': {
        const target = item.tokens[0];
        if (active() && target !== undefined) macros.delete(target.text);
        break;
      }
      default:
        break;
    }
  }
  flush();
  return out;
};
