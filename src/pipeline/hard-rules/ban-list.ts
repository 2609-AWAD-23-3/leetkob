import { lex, type Token } from './lexer.js';
import { preprocess } from './preprocess.js';
import {
  buildScopes,
  findTemplateClose,
  isOp,
  KEYWORDS,
  typedefInfo,
  type Scope,
  type ScopeModel,
} from './scopes.js';
import type { BanListResult, Evidence } from './types.js';

// Quyết định ban list bằng cách đọc token và phân giải tên theo scope, không tìm text thô.
// Nguyên tắc: không chắc thì KHÔNG đoán violation (khấu trừ oan nặng hơn bỏ sót).

interface BannedNames {
  keywords: ReadonlySet<string>;
  qualified: readonly (readonly string[])[];
  bare: ReadonlySet<string>;
}

const splitNames = (names: readonly string[]): BannedNames => {
  const keywords = new Set<string>();
  const bare = new Set<string>();
  const qualified: string[][] = [];
  for (const raw of names) {
    const name = raw.startsWith('::') ? raw.slice(2) : raw;
    if (name === '') continue;
    if (KEYWORDS.has(name)) keywords.add(name);
    else if (name.includes('::')) qualified.push(name.split('::'));
    else bare.add(name);
  }
  return { keywords, qualified, bare };
};

const startsWith = (
  path: readonly string[],
  prefix: readonly string[],
): boolean =>
  prefix.length <= path.length && prefix.every((part, i) => path[i] === part);

const chainOf = (scope: Scope): Scope[] => {
  const chain: Scope[] = [];
  for (let s: Scope | null = scope; s !== null; s = s.parent) chain.push(s);
  return chain;
};

const lookup = <T extends { at: number }>(
  chain: readonly Scope[],
  pick: (scope: Scope) => T | undefined,
  index: number,
): T | undefined => {
  for (const scope of chain) {
    const found = pick(scope);
    if (found !== undefined && found.at < index) return found;
  }
  return undefined;
};

const tokenLines = (tok: Token): number[] => [tok.line, ...tok.via];

const analyse = (
  tokens: readonly Token[],
  banned: BannedNames,
): Map<number, number[]> => {
  const model: ScopeModel = buildScopes(tokens);
  const { scopeAt, byName, declaredAnywhere, declarators } = model;

  const sameNameScopes = (scope: Scope): readonly Scope[] =>
    (scope.kind === 'namespace' || scope.kind === 'class') &&
    scope.name !== null
      ? (byName.get(scope.name) ?? [scope])
      : [scope];

  /** Tên có do sinh viên khai báo ở scope đang thấy được tại vị trí `index` không. */
  const declaredByStudent = (
    name: string,
    chain: readonly Scope[],
    index: number,
  ): boolean => {
    for (const scope of chain) {
      if (sameNameScopes(scope).some((s) => s.declared.has(name))) return true;
      if (scope.classRef !== null) {
        if (
          (byName.get(scope.classRef) ?? []).some((s) => s.declared.has(name))
        )
          return true;
      }
      for (const using of scope.usingNamespaces) {
        if (using.at >= index) continue;
        const key = using.path[using.path.length - 1] ?? '';
        if ((byName.get(key) ?? []).some((s) => s.declared.has(name)))
          return true;
      }
    }
    return false;
  };

  const matches = (candidate: readonly string[]): boolean => {
    if (banned.qualified.some((prefix) => startsWith(candidate, prefix)))
      return true;
    const head = candidate[0];
    if (head === undefined) return false;
    if (banned.bare.has(head)) return true;
    return head === 'std' && banned.bare.has(candidate[1] ?? '');
  };

  /** Các dòng vi phạm bắt đầu tại token `i`, hoặc null nếu token này không phải vi phạm. */
  const hitAt = (i: number): number[] | null => {
    const tok = tokens[i] as Token;
    if (tok.kind !== 'id') return null;
    if (banned.keywords.has(tok.text)) return tokenLines(tok);
    if (declarators.has(i)) return null; // tên đang được khai báo, không phải lần dùng
    const prev = tokens[i - 1];
    if (isOp(prev, '.') || isOp(prev, '->')) {
      if (banned.bare.has(tok.text) && !declaredAnywhere.has(tok.text))
        return tokenLines(tok);
      return null;
    }
    let global = false;
    if (isOp(prev, '::')) {
      const left = tokens[i - 2];
      if (
        left !== undefined &&
        (left.kind === 'id' || isOp(left, '>') || isOp(left, '>>'))
      ) {
        return null; // đoạn giữa/cuối của một tên qualified đã xét từ đoạn đầu
      }
      global = true;
    }
    if (KEYWORDS.has(tok.text)) return null;

    // Đọc các đoạn `a::b<...>::c` bắt đầu từ token này.
    const segments: number[] = [i];
    for (let j = i; ;) {
      let k = j + 1;
      if (isOp(tokens[k], '<')) {
        const close = findTemplateClose(tokens, k);
        if (close < 0 || !isOp(tokens[close + 1], '::')) break;
        k = close + 1;
      }
      const after = tokens[k + 1];
      if (isOp(tokens[k], '::') && after !== undefined && after.kind === 'id') {
        j = k + 1;
        segments.push(j);
        continue;
      }
      break;
    }
    const names = segments.map((index) => (tokens[index] as Token).text);
    const first = names[0] as string;
    const rest = names.slice(1);
    const chain = chainOf(scopeAt[i] as Scope);

    const candidates: string[][] = [];
    if (global) {
      candidates.push(names);
    } else {
      for (const scope of chain) {
        const lines = scope.bannedAliases.get(first);
        if (lines !== undefined) return [...lines, ...tokenLines(tok)];
      }
      const alias = lookup(chain, (s) => s.namespaceAliases.get(first), i);
      const declaration = lookup(
        chain,
        (s) => s.usingDeclarations.get(first),
        i,
      );
      if (alias !== undefined) {
        candidates.push([...alias.path, ...rest]);
      } else if (declaration !== undefined) {
        candidates.push([...declaration.path, ...rest]);
      } else if (declaredByStudent(first, chain, i)) {
        return null;
      } else {
        candidates.push(names);
        for (const scope of chain) {
          for (const using of scope.usingNamespaces) {
            if (using.at < i) candidates.push([...using.path, ...names]);
          }
        }
      }
    }
    if (!candidates.some(matches)) return null;
    const last = segments[segments.length - 1] as number;
    const lines: number[] = [];
    for (let index = i; index <= last; index += 1)
      lines.push(...tokenLines(tokens[index] as Token));
    return lines;
  };

  const hits = new Map<number, number[]>();
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i] as Token;
    // Alias kiểu: nếu phần định nghĩa chứa tên bị cấm thì alias mang theo vi phạm.
    if (tok.kind === 'id' && (tok.text === 'using' || tok.text === 'typedef')) {
      let name: string | null = null;
      let from = i + 1;
      let end = i + 1;
      if (tok.text === 'typedef') {
        const info = typedefInfo(tokens, i);
        name = info.name;
        end = info.end;
      } else {
        const head = tokens[i + 1];
        if (
          head !== undefined &&
          head.kind === 'id' &&
          isOp(tokens[i + 2], '=')
        ) {
          name = head.text;
          from = i + 3;
          end = from;
          while (end < tokens.length && !isOp(tokens[end], ';')) end += 1;
        }
      }
      if (name !== null) {
        const lines: number[] = [];
        for (let k = from; k < end; k += 1) lines.push(...(hitAt(k) ?? []));
        if (lines.length > 0) {
          (scopeAt[i] as Scope).bannedAliases.set(name, [...new Set(lines)]);
        }
      }
    }
    const lines = hitAt(i);
    if (lines !== null) hits.set(i, lines);
  }
  if (banned.keywords.has('goto')) addGotoLabels(tokens, hits);
  return hits;
};

/** Nhãn mà `goto` nhảy tới cũng là dòng thể hiện vi phạm (`goto done;` ... `done:`). */
const addGotoLabels = (
  tokens: readonly Token[],
  hits: Map<number, number[]>,
): void => {
  const targets = new Set<string>();
  tokens.forEach((tok, i) => {
    const target = tokens[i + 1];
    if (tok.kind === 'id' && tok.text === 'goto' && target?.kind === 'id') {
      targets.add(target.text);
    }
  });
  tokens.forEach((tok, i) => {
    if (
      tok.kind !== 'id' ||
      !targets.has(tok.text) ||
      !isOp(tokens[i + 1], ':')
    )
      return;
    const before = tokens[i - 1];
    const startsStatement =
      before === undefined ||
      (before.kind === 'op' && [';', '{', '}', ':'].includes(before.text));
    if (startsStatement) hits.set(i, tokenLines(tok));
  });
};

export const checkBanList = (
  code: string,
  names: readonly string[],
): BanListResult => {
  const banned = splitNames(names);
  const empty =
    banned.keywords.size === 0 &&
    banned.qualified.length === 0 &&
    banned.bare.size === 0;
  if (empty || code.trim() === '') return { verdict: 'pass', evidence: [] };

  const tokens = preprocess(lex(code));
  const hits = analyse(tokens, banned);
  const lines = new Set<number>();
  for (const list of hits.values()) for (const line of list) lines.add(line);
  const sourceLines = code.replace(/\r\n?/g, '\n').split('\n');
  const evidence: Evidence[] = [...lines]
    .filter((line) => line >= 1 && line <= sourceLines.length)
    .sort((a, b) => a - b)
    .map((line) => ({ line, text: sourceLines[line - 1] as string }));
  return { verdict: evidence.length > 0 ? 'violation' : 'pass', evidence };
};
