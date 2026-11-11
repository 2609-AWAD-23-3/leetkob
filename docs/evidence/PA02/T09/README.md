# T09 — CI và merge protection

**Thực hiện:** Bửu Huỳnh Vĩnh Phúc (`@BHVPhuc`, Role C)  
**Reviewer độc lập:** Trần Quốc Vỹ (`@tranquocvy`, Role B)  
**Phụ thuộc:** T04 (Harness và commands local, PR #17)  
**Nguồn acceptance:** [T09 trong plan PA02](../../../plans/PA02.md#t09--ci-v%C3%A0-merge-protection), [GitHub Issue #9](https://github.com/2609-AWAD-23-3/leetkob/issues/9).

---

## 1. Mục tiêu và phạm vi

Task T09 chuẩn hóa quy trình Continuous Integration (CI) và chính sách bảo vệ nhánh (Branch Protection) trên repository LeeTKOB nhằm đảm bảo mọi thay đổi đưa vào nhánh `develop` và `main` đều phải vượt qua toàn bộ quality gate bắt buộc.

### Các nguyên tắc cốt lõi:
1. **Một workflow CI thống nhất:** Dùng một file workflow chung `.github/workflows/ci.yml` kích hoạt cho PRs vào `develop`, `main` và push/tag release `pa2`.
2. **Đúng bộ quality commands đã chốt tại T04:** Thực thi chính xác 4 lệnh chất lượng từ root sau `npm ci --ignore-scripts`:
   - `npm run lint` (`oxlint --deny-warnings src tests scripts`)
   - `npm run format-check` (`prettier --check .`)
   - `npm run type-check` (`tsc -p tsconfig.check.json`)
   - `npm test` (`npm run build && node scripts/test.mjs`)
3. **Tên check ổn định:** Đặt tên job và tên check là `quality-gate` để làm cơ sở cho required check của Branch Protection trong T09 và thí nghiệm T10.
4. **Không nuốt lỗi hoặc phụ thuộc task đã hoãn:** CI gom toàn bộ support suites, auth tests, store tests và contract tests của endpoint `POST /labs/{labId}/publish` (83 tests pass). Không đợi các endpoints đã hoãn (T06/T07).

---

## 2. Đặc tả GitHub Actions Workflow (`.github/workflows/ci.yml`)

Workflow được đặt tại `.github/workflows/ci.yml` với cấu hình chi tiết:

```yaml
name: CI

on:
  push:
    branches:
      - main
      - develop
    tags:
      - 'pa2'
      - 'pa02*'
  pull_request:
    branches:
      - main
      - develop

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read

jobs:
  quality-gate:
    name: quality-gate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js 24.x
        uses: actions/setup-node@v4
        with:
          node-version: '24.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --ignore-scripts

      - name: Lint check (oxlint)
        run: npm run lint

      - name: Format check (prettier)
        run: npm run format-check

      - name: Type check (tsc)
        run: npm run type-check

      - name: Test suite (unit, contract, smoke)
        run: npm test
```

### Chi tiết các bước thực thi trong job `quality-gate`:
- **Runner:** `ubuntu-latest` (môi trường Linux sạch theo chuẩn CI).
- **Node runtime:** `24.x` (khớp với Node.js 24 LTS, baseline `24.22.1` ghi trong `.node-version`).
- **Cache:** Kích hoạt cache npm của `actions/setup-node@v4` để tối ưu thời gian cài đặt.
- **Quyền tối thiểu:** `permissions: contents: read` theo nguyên tắc đặc quyền tối thiểu từ T05.
- **Concurrency:** Tự động hủy job cũ khi có commit mới đẩy lên cùng một PR (`cancel-in-progress: true`), tiết kiệm tài nguyên runner.

---

## 3. Chính sách bảo vệ nhánh (Branch Protection) và ghi nhận hạn chế GitHub Free

### Yêu cầu bảo vệ trên nhánh `main`:
Theo rubric PA02 (R4 Blocking CI), nhánh `main` phải được bảo vệ bởi các quy tắc:
1. Yêu cầu Pull Request trước khi merge (không direct push).
2. Yêu cầu ít nhất 1 approval từ reviewer độc lập.
3. Yêu cầu check `quality-gate` phải PASS (Required Status Check) trước khi merge.
4. Áp dụng quy tắc cho cả Administrator (`enforce_admins: true` / không bypass).

### Ghi nhận thực tế hạ tầng và điều kiện tiên quyết:
- **Hiện trạng:** Repository `2609-AWAD-23-3/leetkob` là private repo thuộc tổ chức trên gói GitHub Free.
- **Hạn chế kỹ thuật:** GitHub Free không cho phép bật Branch Protection hoặc Rulesets trên Private Repositories (API trả về HTTP 403: `"Upgrade to GitHub Pro or make this repository public to enable this feature."`).
- **Giải pháp theo kế hoạch PA02:**
  - Nhóm đã hoàn thành quét an toàn secrets và baseline sạch tại Task T05 (`docs/evidence/PA02/T05/security-scan.json`).
  - Trước mốc nộp bài (PA02 submission), repository sẽ được chuyển sang chế độ `public` theo quy định đề bài.
  - Ngay khi repo chuyển sang `public`, tính năng Branch Protection của GitHub Free sẽ được mở khóa hoàn toàn mà không phát sinh chi phí.
  - Khi đó, lệnh thiết lập protection trên `main` sẽ được thực thi như sau:

```bash
gh api --method PUT repos/2609-AWAD-23-3/leetkob/branches/main/protection \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["quality-gate"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOF
```

---

## 4. Kết quả kiểm chứng

### Kiểm chứng cục bộ (Local Node `24.22.1` / npm `11.19.1` trên Windows x64):

| Lệnh | Mô tả | Kết quả | Ghi chú |
| :--- | :--- | :---: | :--- |
| `npm run lint` | Oxlint phân tích cú pháp TS/JS | **Exit 0** | 0 warnings, 0 errors trên 22 files |
| `npm run format-check` | Prettier kiểm tra định dạng | **Exit 0** | All matched files use Prettier code style (bao gồm file YAML mới) |
| `npm run type-check` | TypeScript compiler strict check | **Exit 0** | `tsc -p tsconfig.check.json` hoàn tất không lỗi |
| `npm test` | Build & chạy test runner | **Exit 0** | **83/83 tests pass 100%** (16 contract, 18 auth, 40 data, 7 smoke, 2 lifecycle) |
| `git diff --check` | Kiểm tra khoảng trắng / trailing | **Exit 0** | Sạch hoàn toàn |

### Kiểm chứng thực tế trên GitHub Actions (PR #22):
- **Pull Request:** [#22](https://github.com/2609-AWAD-23-3/leetkob/pull/22)
- **CI Run ID:** [42965009498](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/42965009498)
- **Job Name:** `quality-gate` (Job ID: `130340073976`)
- **Status:** **COMPLETED**
- **Conclusion:** **SUCCESS** (Toàn bộ các bước: checkout, setup-node 24.x, npm ci, lint, format-check, type-check, test đều đạt tick xanh trong 18 giây).

---

## 5. Bàn giao cho Task T10 & T11

1. **Handoff cho T10 (Contract Break/Fix):**
   - Check name xác định: `quality-gate`.
   - Invariant sẵn sàng: Pending-Review Gate (`409 pending-reviews`) của publish endpoint.
   - Thí nghiệm T10 sẽ tạo branch từ `main`, đưa một lỗi vi phạm nghiệp vụ vào implementation của publish (không sửa contract hay tests), chứng minh CI `quality-gate` chuyển sang màu ĐỎ và chặn không cho merge PR vào `main`. Sau đó sửa lại implementation để CI chuyển sang XANH và merge.
2. **Handoff cho T11 (Hồ sơ nộp PA02):**
   - File workflow `.github/workflows/ci.yml`.
   - Bộ bằng chứng kiểm chứng tại `docs/evidence/PA02/T09/`.
