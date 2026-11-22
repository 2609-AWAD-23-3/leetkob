import type { Token } from './lexer.js';

// Dựng cây scope (global / namespace / class / block) từ chuỗi token để biết một tên không
// qualify trỏ tới thực thể của sinh viên hay của std. Đây KHÔNG phải parser C++ đầy đủ:
// nhận diện khai báo bằng mẫu token (kiểu + tên + dấu kết), và khi không chắc thì nghiêng
// về "sinh viên tự khai báo" để không khấu trừ oan.

export const KEYWORDS: ReadonlySet<string> = new Set(
  (
    'alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t ' +
    'char16_t char32_t class compl concept const consteval constexpr constinit const_cast ' +
    'continue co_await co_return co_yield decltype default delete do double dynamic_cast ' +
    'else enum explicit export extern false float for friend goto if inline int long mutable ' +
    'namespace new noexcept not not_eq nullptr operator or or_eq private protected public ' +
    'register reinterpret_cast requires return short signed sizeof static static_assert ' +
    'static_cast struct switch template this thread_local throw true try typedef typeid ' +
    'typename union unsigned using virtual void volatile wchar_t while xor xor_eq'
  ).split(' '),
);

/** Từ khóa có thể đứng ngay trước tên được khai báo (kiểu hoặc specifier). */
const TYPE_LIKE_KEYWORDS: ReadonlySet<string> = new Set(
  (
    'auto bool char char8_t char16_t char32_t const consteval constexpr constinit double ' +
    'enum explicit extern float friend inline int long mutable register short signed static ' +
    'struct class union thread_local typename unsigned virtual void volatile wchar_t'
  ).split(' '),
);
const NON_TYPE_KEYWORDS: ReadonlySet<string> = new Set(
  [...KEYWORDS].filter((word) => !TYPE_LIKE_KEYWORDS.has(word)),
);
const DECL_SPECIFIERS: ReadonlySet<string> = new Set(
  (
    'const constexpr constinit consteval static extern inline mutable register volatile ' +
    'typename unsigned signed thread_local virtual explicit friend struct class union enum'
  ).split(' '),
);
const BUILTIN_TYPES: ReadonlySet<string> = new Set(
  (
    'auto bool char char8_t char16_t char32_t double float int long short signed unsigned ' +
    'void wchar_t'
  ).split(' '),
);
const CONTROL_KEYWORDS: ReadonlySet<string> = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'sizeof',
  'alignof',
  'decltype',
  'typeid',
  'noexcept',
  'return',
]);
const BOUNDARY_OPS: ReadonlySet<string> = new Set([
  ';',
  '{',
  '}',
  '(',
  ',',
  ':',
]);
const DECL_FOLLOWERS: ReadonlySet<string> = new Set([
  '=',
  ';',
  ',',
  '[',
  '{',
  '(',
  ')',
  ':',
]);
const FUNCTION_SPECIFIERS: ReadonlySet<string> = new Set([
  'const',
  'noexcept',
  'override',
  'final',
  'mutable',
  'volatile',
  'constexpr',
]);

export interface UsingDirective {
  path: string[];
  at: number;
}

export interface Scope {
  parent: Scope | null;
  kind: 'global' | 'namespace' | 'class' | 'block';
  name: string | null;
  /** Với thân hàm định nghĩa ngoài lớp (`Cls::f() {}`): tên lớp/namespace chứa nó. */
  classRef: string | null;
  declared: Set<string>;
  usingNamespaces: UsingDirective[];
  usingDeclarations: Map<string, UsingDirective>;
  namespaceAliases: Map<string, UsingDirective>;
  /** Alias kiểu đã mang tên bị cấm (điền khi phân tích): tên alias → các dòng định nghĩa. */
  bannedAliases: Map<string, number[]>;
}

export interface ScopeModel {
  tokens: readonly Token[];
  scopeAt: readonly Scope[];
  byName: ReadonlyMap<string, Scope[]>;
  declaredAnywhere: ReadonlySet<string>;
  /** Chỉ số các token là tên đang được khai báo (không phải một lần sử dụng). */
  declarators: ReadonlySet<number>;
}

const newScope = (
  parent: Scope | null,
  kind: Scope['kind'],
  name: string | null,
): Scope => ({
  parent,
  kind,
  name,
  classRef: null,
  declared: new Set(),
  usingNamespaces: [],
  usingDeclarations: new Map(),
  namespaceAliases: new Map(),
  bannedAliases: new Map(),
});

export const isOp = (tok: Token | undefined, text: string): boolean =>
  tok !== undefined && tok.kind === 'op' && tok.text === text;

const isId = (tok: Token | undefined): tok is Token =>
  tok !== undefined && tok.kind === 'id';

/** Đọc `a::b::c` bắt đầu tại `from` (cho phép `::` đầu). Trả đường dẫn và chỉ số kết thúc. */
const readPath = (
  tokens: readonly Token[],
  from: number,
): { path: string[]; end: number } => {
  const path: string[] = [];
  let i = from;
  if (isOp(tokens[i], '::')) i += 1;
  for (;;) {
    const part = tokens[i];
    if (!isId(part)) break;
    path.push(part.text);
    i += 1;
    if (isOp(tokens[i], '::')) {
      i += 1;
      continue;
    }
    break;
  }
  return { path, end: i };
};

/** Tìm `>` đóng của `<` tại `open` khi đọc xuôi; -1 nếu không giống danh sách template. */
export const findTemplateClose = (
  tokens: readonly Token[],
  open: number,
): number => {
  let depth = 0;
  for (let k = open; k < tokens.length && k - open <= 64; k += 1) {
    const tok = tokens[k] as Token;
    if (tok.kind === 'op') {
      if (tok.text === '<') depth += 1;
      else if (tok.text === '>') depth -= 1;
      else if (tok.text === '>>') depth -= 2;
      else if (tok.text === ';' || tok.text === '{' || tok.text === '}')
        return -1;
      if (depth === 0) return k;
      if (depth < 0) return -1;
    }
  }
  return -1;
};

/** Tìm `<` mở của `>`/`>>` tại `close` khi đọc ngược; chỉ nhận nội dung giống tham số template. */
const findTemplateOpen = (tokens: readonly Token[], close: number): number => {
  let depth = (tokens[close] as Token).text === '>>' ? 2 : 1;
  for (let k = close - 1; k >= 0 && close - k <= 64; k -= 1) {
    const tok = tokens[k] as Token;
    if (tok.kind === 'id' || tok.kind === 'num') continue;
    if (tok.kind !== 'op') return -1;
    if (tok.text === '<') {
      depth -= 1;
      if (depth === 0) return k;
    } else if (tok.text === '>') depth += 1;
    else if (tok.text === '>>') depth += 2;
    else if (!['::', ',', '*', '&', '&&', '...'].includes(tok.text)) return -1;
  }
  return -1;
};

const isTypeName = (tok: Token | undefined): tok is Token =>
  isId(tok) && !NON_TYPE_KEYWORDS.has(tok.text);

const endsTemplateType = (tokens: readonly Token[], close: number): boolean => {
  const open = findTemplateOpen(tokens, close);
  return open > 0 && isTypeName(tokens[open - 1]);
};

/** Token `i` có phải tên đang được khai báo (biến, hàm, tham số, thành viên) không. */
const isDeclarationName = (tokens: readonly Token[], i: number): boolean => {
  const tok = tokens[i] as Token;
  if (tok.kind !== 'id' || KEYWORDS.has(tok.text)) return false;
  const next = tokens[i + 1];
  if (
    next === undefined ||
    next.kind !== 'op' ||
    !DECL_FOLLOWERS.has(next.text)
  ) {
    return false;
  }
  const prev = tokens[i - 1];
  if (prev === undefined) return false;
  if (prev.kind === 'id') return isTypeName(prev);
  if (prev.kind !== 'op') return false;
  if (prev.text === '>' || prev.text === '>>')
    return endsTemplateType(tokens, i - 1);
  if (prev.text === '*' || prev.text === '&' || prev.text === '&&') {
    let k = i - 1;
    while (
      ['*', '&', '&&'].includes(tokens[k]?.text ?? '') &&
      tokens[k]?.kind === 'op'
    ) {
      k -= 1;
    }
    const base = tokens[k];
    if (base === undefined) return false;
    if (isOp(base, '>') || isOp(base, '>>')) return endsTemplateType(tokens, k);
    if (!isTypeName(base)) return false;
    if (BUILTIN_TYPES.has(base.text)) return true;
    const before = tokens[k - 1];
    if (before === undefined) return true;
    if (before.kind === 'op') return BOUNDARY_OPS.has(before.text);
    return DECL_SPECIFIERS.has(before.text);
  }
  return false;
};

/** `typedef ... name;` → tên alias và chỉ số dấu `;`. */
export const typedefInfo = (
  tokens: readonly Token[],
  from: number,
): { name: string | null; end: number } => {
  let depth = 0;
  let name: string | null = null;
  for (let k = from + 1; k < tokens.length && k - from <= 200; k += 1) {
    const tok = tokens[k] as Token;
    if (tok.kind === 'op') {
      if (tok.text === '(' || tok.text === '{' || tok.text === '[') depth += 1;
      else if (tok.text === ')' || tok.text === '}' || tok.text === ']')
        depth -= 1;
      else if (tok.text === ';' && depth <= 0) return { name, end: k };
      // typedef int (*handler)(int): tên nằm ngay sau `*` trong ngoặc
      if (tok.text === '*' && isOp(tokens[k - 1], '(') && isId(tokens[k + 1])) {
        name = (tokens[k + 1] as Token).text;
      }
    } else if (tok.kind === 'id' && depth === 0 && !KEYWORDS.has(tok.text)) {
      name = tok.text;
    }
  }
  return { name, end: tokens.length };
};

interface Signature {
  params: string[];
  qualifier: string | null;
}

/** Nếu `{` tại `brace` mở thân hàm/lambda thì trả tên tham số và lớp chứa (nếu định nghĩa ngoài lớp). */
const signatureBefore = (
  tokens: readonly Token[],
  brace: number,
): Signature | null => {
  let k = brace - 1;
  for (let guard = 0; guard < 16 && k >= 0; guard += 1) {
    const tok = tokens[k] as Token;
    if (tok.kind === 'op' && tok.text === ')') break;
    const specifier = tok.kind === 'id' && FUNCTION_SPECIFIERS.has(tok.text);
    const trailing =
      tok.kind === 'id' ||
      (tok.kind === 'op' &&
        ['->', '::', '<', '>', '>>', '*', '&', '&&', ','].includes(tok.text));
    if (!specifier && !trailing) return null;
    k -= 1;
  }
  if (!isOp(tokens[k], ')')) return null;
  let depth = 0;
  let open = -1;
  for (let j = k; j >= 0 && k - j <= 400; j -= 1) {
    const tok = tokens[j] as Token;
    if (isOp(tok, ')')) depth += 1;
    else if (isOp(tok, '(')) {
      depth -= 1;
      if (depth === 0) {
        open = j;
        break;
      }
    }
  }
  if (open < 0) return null;
  const nameTok = tokens[open - 1];
  const lambda = isOp(nameTok, ']');
  if (!lambda && (!isId(nameTok) || CONTROL_KEYWORDS.has(nameTok.text))) {
    return { params: [], qualifier: null };
  }
  const params: string[] = [];
  let segment: Token[] = [];
  let nesting = 0;
  const flush = (): void => {
    const body: Token[] = [];
    for (const tok of segment) {
      if (isOp(tok, '=')) break;
      body.push(tok);
    }
    const last = body[body.length - 1];
    if (body.length >= 2 && isId(last) && !KEYWORDS.has(last.text))
      params.push(last.text);
    segment = [];
  };
  for (let j = open + 1; j < k; j += 1) {
    const tok = tokens[j] as Token;
    if (isOp(tok, '(') || isOp(tok, '[') || isOp(tok, '{')) nesting += 1;
    else if (isOp(tok, ')') || isOp(tok, ']') || isOp(tok, '}')) nesting -= 1;
    if (nesting === 0 && isOp(tok, ',')) flush();
    else segment.push(tok);
  }
  flush();
  let qualifier: string | null = null;
  if (!lambda && isOp(tokens[open - 2], '::') && isId(tokens[open - 3])) {
    qualifier = (tokens[open - 3] as Token).text;
  }
  return { params, qualifier };
};

type PendingBrace =
  | { kind: 'namespace' | 'class'; name: string | null }
  | { kind: 'transparent' };

export const buildScopes = (tokens: readonly Token[]): ScopeModel => {
  const global = newScope(null, 'global', null);
  const scopeAt: Scope[] = [];
  const byName = new Map<string, Scope[]>();
  const declaredAnywhere = new Set<string>();
  const declarators = new Set<number>();
  const pending = new Map<number, PendingBrace>();
  const stack: Scope[] = [global];
  const parenStacks: boolean[][] = [[]];
  let current = global;

  const declare = (name: string, scope: Scope = current): void => {
    scope.declared.add(name);
    declaredAnywhere.add(name);
  };
  const register = (scope: Scope): void => {
    if (scope.name === null) return;
    const list = byName.get(scope.name) ?? [];
    list.push(scope);
    byName.set(scope.name, list);
  };

  const onNamespace = (i: number): void => {
    const { path, end } = readPath(tokens, i + 1);
    if (path.length === 0) {
      if (isOp(tokens[i + 1], '{'))
        pending.set(i + 1, { kind: 'namespace', name: null });
      return;
    }
    if (isOp(tokens[end], '=')) {
      const target = readPath(tokens, end + 1);
      const alias = path[0] as string;
      current.namespaceAliases.set(alias, { path: target.path, at: i });
      declare(alias);
      return;
    }
    if (isOp(tokens[end], '{')) {
      declare(path[0] as string);
      pending.set(end, {
        kind: 'namespace',
        name: path[path.length - 1] as string,
      });
    }
  };

  const onUsing = (i: number): void => {
    let j = i + 1;
    const first = tokens[j];
    if (isId(first) && first.text === 'namespace') {
      const { path } = readPath(tokens, j + 1);
      if (path.length > 0) current.usingNamespaces.push({ path, at: i });
      return;
    }
    if (isId(first) && first.text === 'typename') j += 1;
    const head = tokens[j];
    if (isId(head) && isOp(tokens[j + 1], '=')) {
      declare(head.text);
      return;
    }
    const { path } = readPath(tokens, j);
    if (path.length >= 2) {
      current.usingDeclarations.set(path[path.length - 1] as string, {
        path,
        at: i,
      });
    }
  };

  const onClass = (i: number): void => {
    if (isId(tokens[i - 1]) && (tokens[i - 1] as Token).text === 'enum') return;
    const nameTok = tokens[i + 1];
    if (isOp(nameTok, '{')) {
      pending.set(i + 1, { kind: 'class', name: null });
      return;
    }
    if (!isId(nameTok) || KEYWORDS.has(nameTok.text)) return;
    declare(nameTok.text);
    let j = i + 2;
    if (isId(tokens[j]) && (tokens[j] as Token).text === 'final') j += 1;
    if (isOp(tokens[j], ':')) {
      j += 1;
      while (j < tokens.length) {
        const part = tokens[j] as Token;
        const baseToken =
          part.kind === 'id' ||
          part.kind === 'num' ||
          (part.kind === 'op' &&
            ['::', ',', '<', '>', '>>', '*', '...'].includes(part.text));
        if (!baseToken) break;
        j += 1;
      }
    }
    if (isOp(tokens[j], '{'))
      pending.set(j, { kind: 'class', name: nameTok.text });
  };

  const openBrace = (i: number): void => {
    const mark = pending.get(i);
    let scope: Scope;
    if (mark !== undefined && mark.kind === 'transparent') {
      scope = current;
    } else if (mark !== undefined) {
      scope = newScope(current, mark.kind, mark.name);
      register(scope);
    } else {
      scope = newScope(current, 'block', null);
      const signature = signatureBefore(tokens, i);
      if (signature !== null) {
        for (const param of signature.params) declare(param, scope);
        scope.classRef = signature.qualifier;
      }
    }
    stack.push(scope);
    current = scope;
    parenStacks.push([]);
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i] as Token;
    scopeAt.push(current);
    const parens = parenStacks[parenStacks.length - 1] as boolean[];
    if (tok.kind === 'op') {
      if (tok.text === '{') openBrace(i);
      else if (tok.text === '}') {
        if (stack.length > 1) {
          stack.pop();
          parenStacks.pop();
          current = stack[stack.length - 1] as Scope;
        }
      } else if (tok.text === '(') {
        const before = tokens[i - 1];
        parens.push(
          (isId(before) &&
            !CONTROL_KEYWORDS.has(before.text) &&
            !NON_TYPE_KEYWORDS.has(before.text)) ||
            isOp(before, ']'),
        );
      } else if (tok.text === ')') parens.pop();
      continue;
    }
    if (tok.kind !== 'id') continue;
    switch (tok.text) {
      case 'namespace':
        onNamespace(i);
        continue;
      case 'using':
        onUsing(i);
        continue;
      case 'typedef': {
        const { name } = typedefInfo(tokens, i);
        if (name !== null) declare(name);
        continue;
      }
      case 'class':
      case 'struct':
      case 'union':
        onClass(i);
        continue;
      case 'enum': {
        let j = i + 1;
        if (
          isId(tokens[j]) &&
          ['class', 'struct'].includes((tokens[j] as Token).text)
        )
          j += 1;
        const named = tokens[j];
        if (isId(named) && !KEYWORDS.has(named.text)) declare(named.text);
        // Hằng enum (`enum { sort, merge }`) cũng là tên do sinh viên khai báo.
        let open = j;
        while (
          open < tokens.length &&
          open - j <= 8 &&
          !isOp(tokens[open], '{')
        ) {
          if (isOp(tokens[open], ';')) break;
          open += 1;
        }
        if (isOp(tokens[open], '{')) {
          let depth = 0;
          for (let k = open; k < tokens.length; k += 1) {
            const part = tokens[k] as Token;
            if (isOp(part, '{')) depth += 1;
            else if (isOp(part, '}')) {
              depth -= 1;
              if (depth === 0) break;
            } else if (
              depth === 1 &&
              isId(part) &&
              (isOp(tokens[k - 1], '{') || isOp(tokens[k - 1], ','))
            ) {
              declare(part.text);
              declarators.add(k);
            }
          }
        }
        continue;
      }
      case 'extern':
        if (
          (tokens[i + 1] as Token | undefined)?.kind === 'str' &&
          isOp(tokens[i + 2], '{')
        ) {
          pending.set(i + 2, { kind: 'transparent' });
        }
        continue;
      default:
        break;
    }
    if (isDeclarationName(tokens, i)) {
      declarators.add(i);
      if (!parens.includes(true)) declare(tok.text);
    }
  }
  return { tokens, scopeAt, byName, declaredAnywhere, declarators };
};
