import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBanList } from '../../dist/pipeline/hard-rules/index.js';

// Các ca tổng quát hóa: sinh viên đặt tên trùng thư viện (struct stack, hàm max, enum sort...)
// phải là pass; dùng thật thư viện qua nhiều cách phải là violation. Đoạn C++ ngắn, tự viết,
// không lấy từ dev set. Một dòng test = [tên ca, tên cấm, code, verdict mong đợi].
const cases = [
  [
    'own stack struct under using std',
    ['std::stack'],
    'using namespace std;\nstruct stack { int a[10]; int n; void push(int x){a[n++]=x;} };\nint main(){ stack s; s.push(1); }',
    'pass',
  ],
  [
    'own swap template',
    ['std::swap'],
    'using namespace std;\ntemplate <class T> void swap(T& a, T& b) { T t = a; a = b; b = t; }\nint main(){ int x=1,y=2; swap(x,y); }',
    'pass',
  ],
  [
    'own max',
    ['std::max'],
    'using namespace std;\nint max(int a, int b){ return a>b?a:b; }\nint main(){ return max(1,2); }',
    'pass',
  ],
  [
    'own Vector class capital',
    ['std::vector'],
    'template<class T> class Vector { T* p; };\nint main(){ Vector<int> v; }',
    'pass',
  ],
  [
    'class named vector with using std',
    ['std::vector'],
    'using namespace std;\nclass vector { public: int n; };\nint main(){ vector v; return v.n; }',
    'pass',
  ],
  [
    'struct member called find',
    ['std::find'],
    'using namespace std;\nstruct T { int find(int x); };\nint T::find(int x){ return x; }\nint main(){ T t; return t.find(1); }',
    'pass',
  ],
  [
    'out of class member calling same-name',
    ['std::find'],
    'using namespace std;\nstruct T { int find(int x); int g(int); };\nint T::g(int x){ return find(x); }\nint T::find(int x){ return x; }\nint main(){ T t; return t.g(1); }',
    'pass',
  ],
  [
    'printf_count identifier',
    ['printf'],
    '#include <cstdio>\nint main(){ int printf_count = 0; return printf_count; }',
    'pass',
  ],
  [
    'printf used',
    ['printf'],
    '#include <cstdio>\nint main(){ printf("hi\\n"); }',
    'violation',
  ],
  [
    'cout used with ban std::cout',
    ['std::cout'],
    '#include <iostream>\nusing namespace std;\nint main(){ cout << 1; }',
    'violation',
  ],
  [
    'cin bare',
    ['cin'],
    '#include <iostream>\nusing namespace std;\nint main(){ int x; cin >> x; }',
    'violation',
  ],
  [
    'new keyword',
    ['new'],
    'int main(){ int* p = new int[3]; delete[] p; }',
    'violation',
  ],
  [
    'delete keyword only',
    ['delete'],
    'int main(){ int* p = new int[3]; delete[] p; }',
    'violation',
  ],
  ['no new', ['new'], 'int main(){ int renew = 1; return renew; }', 'pass'],
  [
    'own pow',
    ['std::pow'],
    '#include <cmath>\nlong long pow(long long a, int b){ long long r=1; while(b--) r*=a; return r; }\nint main(){ return (int)pow(2,3); }',
    'pass',
  ],
  [
    'pow from cmath global bare',
    ['pow'],
    '#include <cmath>\nint main(){ return (int)pow(2,3); }',
    'violation',
  ],
  [
    'std::pow qualified',
    ['std::pow'],
    '#include <cmath>\nint main(){ return (int)std::pow(2,3); }',
    'violation',
  ],
  [
    'stringstream',
    ['std::stringstream'],
    '#include <sstream>\nint main(){ std::stringstream ss; }',
    'violation',
  ],
  [
    'map via using decl',
    ['std::map'],
    '#include <map>\nusing std::map;\nint main(){ map<int,int> m; }',
    'violation',
  ],
  [
    'lambda param named sort',
    ['std::sort'],
    'using namespace std;\nint main(){ auto f = [](int sort){ return sort; }; return f(1); }',
    'pass',
  ],
  [
    'struct field sort',
    ['std::sort'],
    'using namespace std;\nstruct S { int sort; };\nint main(){ S s{1}; return s.sort; }',
    'pass',
  ],
  [
    'local lambda named sort',
    ['std::sort'],
    'using namespace std;\nint main(){ auto sort = [](int x){ return x; }; return sort(1); }',
    'pass',
  ],
  [
    'loop var named count',
    ['std::count'],
    'using namespace std;\nint main(){ int s=0; for (int count = 0; count < 3; ++count) s += count; return s; }',
    'pass',
  ],
  [
    'global var count',
    ['std::count'],
    'using namespace std;\nint count = 0;\nint main(){ count++; return count; }',
    'pass',
  ],
  [
    'unqualified count std',
    ['std::count'],
    '#include <algorithm>\nusing namespace std;\nint main(){ int a[3]={1,1,2}; return (int)count(a, a+3, 1); }',
    'violation',
  ],
  [
    'member count of map',
    ['std::count'],
    '#include <map>\nint main(){ std::map<int,int> m; return (int)m.count(1); }',
    'pass',
  ],
  [
    'own reverse in ns',
    ['std::reverse'],
    'namespace u { void reverse(char* a, char* b){} }\nint main(){ char s[3]; u::reverse(s, s+2); }',
    'pass',
  ],
  [
    'own reverse global using std',
    ['std::reverse'],
    '#include <string>\nusing namespace std;\nvoid reverse(string& s){ }\nint main(){ string t; reverse(t); }',
    'pass',
  ],
  [
    'macro with for',
    ['for'],
    '#define LOOP(n) for (int i = 0; i < n; ++i)\nint main(){ int s = 0; LOOP(3) s++; return s; }',
    'violation',
  ],
  [
    'unused macro W',
    ['while'],
    '#define W while\nint main(){ return 0; }',
    'pass',
  ],
  [
    'escaped quote in string',
    ['for'],
    'const char* s = "a \\" for \\" b";\nint main(){ return 0; }',
    'pass',
  ],
  [
    'escaped char literal',
    ['for'],
    "char c = '\\''; int format = 1;\nint main(){ return format; }",
    'pass',
  ],
  [
    '>> closing',
    ['std::vector'],
    '#include <vector>\nint main(){ std::vector<std::vector<int>> g; }',
    'violation',
  ],
  [
    'own vector in ns',
    ['std::vector'],
    'namespace ds { struct vector { int n; }; }\nint main(){ ds::vector v; return v.n; }',
    'pass',
  ],
  [
    'using namespace ds only',
    ['std::vector'],
    'namespace ds { struct vector { int n; }; }\nusing namespace ds;\nint main(){ vector v; return v.n; }',
    'pass',
  ],
  [
    'do-while macro',
    ['do'],
    '#define ONCE(x) do { x; } while (0)\nint main(){ int a; ONCE(a = 1); return a; }',
    'violation',
  ],
  [
    'switch not banned',
    ['for', 'while'],
    'int main(){ int a=1; switch(a){ case 1: return 1; default: return 0; } }',
    'pass',
  ],
  [
    'ternary only',
    ['goto'],
    'int main(){ int a = 1; return a ? 1 : 2; }',
    'pass',
  ],
  [
    'comment inside qualified',
    ['std::sort'],
    '#include <algorithm>\nint main(){ int a[2]; std::/*x*/sort(a, a+2); }',
    'violation',
  ],
  [
    'own member sort defined out of class',
    ['std::sort'],
    'struct A { void sort(); };\nvoid A::sort(){}\nint main(){ A a; a.sort(); }',
    'pass',
  ],
  [
    'member declared after use in class',
    ['std::sort'],
    'using namespace std;\nstruct A { void run(){ sort(); } void sort(){} };\nint main(){ A a; a.run(); }',
    'pass',
  ],
  [
    'typedef of std::string',
    ['std::string'],
    '#include <string>\ntypedef std::string Str;\nint main(){ Str s; }',
    'violation',
  ],
  [
    'strlen',
    ['strlen'],
    '#include <cstring>\nint main(){ return (int)strlen("a"); }',
    'violation',
  ],
  [
    'own strlen2',
    ['strlen'],
    'int strlen2(const char* s){ int n=0; while(s[n]) n++; return n; }\nint main(){ return strlen2("a"); }',
    'pass',
  ],
  [
    'own strlen same name',
    ['strlen'],
    'unsigned long strlen(const char* s){ unsigned long n=0; while(s[n]) n++; return n; }\nint main(){ return (int)strlen("a"); }',
    'pass',
  ],
  [
    'prototype param named find then use of find',
    ['std::find'],
    'using namespace std;\nint go(int find);\nint main(){ return go(1); }',
    'pass',
  ],
  [
    'namespace with std using inside function and own function same name outside',
    ['std::sort'],
    '#include <algorithm>\nvoid sort(int* a, int n);\nint main(){ int a[2]; using namespace std; sort(a, a+2); }',
    'pass',
  ],
  [
    'array of struct names',
    ['std::array'],
    '#include <cstdio>\nstruct array { int v[3]; };\nint main(){ array a; return a.v[0]; }',
    'pass',
  ],
  [
    'std::array real',
    ['std::array'],
    '#include <array>\nint main(){ std::array<int,3> a; return a[0]; }',
    'violation',
  ],
  [
    'enum value named sort',
    ['std::sort'],
    'using namespace std;\nenum Mode { sort, merge };\nint main(){ return sort; }',
    'pass',
  ],
];

for (const [name, names, code, expected] of cases) {
  test(`generalisation: ${name}`, () => {
    const result = checkBanList(code, names);
    assert.equal(result.verdict, expected, JSON.stringify(result.evidence));
    if (expected === 'pass') assert.deepEqual(result.evidence, []);
    else assert.ok(result.evidence.length > 0);
  });
}
