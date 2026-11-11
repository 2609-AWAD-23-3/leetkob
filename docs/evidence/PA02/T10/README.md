# T10 — Chứng minh quality gate bắt lỗi

**Thực hiện:** Bửu Huỳnh Vĩnh Phúc (`@BHVPhuc`, Role C)  
**Reviewer độc lập:** Nguyễn Khắc Vượng (`@vinny2707`, Role A)  
**Phụ thuộc:** T08 (Publish endpoint), T09 (Shared CI & Branch Protection)  
**Nguồn acceptance:** [T10 trong plan PA02](../../../plans/PA02.md#t10--ch%E1%BB%A9ng-minh-quality-gate-b%E1%BA%AFt-l%E1%BB%97i), [GitHub Issue #10](https://github.com/2609-AWAD-23-3/leetkob/issues/10).

---

## 1. Mục tiêu và phạm vi thí nghiệm

Task T10 thực hiện thí nghiệm cố tình phá vỡ một quy tắc nghiệp vụ trong hợp đồng API publish (implementation-only contract break) trên nhánh tách từ `main`, mở Pull Request hướng vào `main` để chứng minh:
1. **CI quality gate bắt lỗi chính xác:** GitHub Actions bắt đúng lỗi vi phạm assertion của hợp đồng API (không phải lỗi lint, compile, hay setup).
2. **Hàng rào Branch Protection hoạt động thực tế:** Nút merge trên PR hướng vào `main` bị chặn đứng hoàn toàn (`BLOCKED`) khi CI còn đỏ; không cho phép bypass.
3. **Sửa lỗi và khôi phục trạng thái xanh:** Commit sửa chữa khôi phục logic đúng, đưa CI trở lại màu XANH (`SUCCESS`) trên cùng một PR, bảo toàn đầy đủ chuỗi commit và bằng chứng để reviewer thẩm định.

---

## 2. Invariant được lựa chọn: Pending-Review Gate

- **Tên invariant:** Pending-Review Gate (`409 pending-reviews`) của endpoint `POST /labs/{labId}/publish`.
- **Đặc tả trong Contract ([`docs/contract/publish.md`](../../../contract/publish.md)):**
  - Khi một lab còn bài nộp chưa được chấm xong (`store.publishLab` trả về `{ kind: 'pending_reviews', pendingCount: N }`), endpoint bắt buộc phải từ chối yêu cầu với HTTP Status `409 Conflict`, `Content-Type: application/problem+json; charset=utf-8`, và Problem Details type `https://leetkob.example/problems/pending-reviews`.
- **Bài test khẳng định invariant:**
  - File: `tests/contract/publish.test.mjs:304`
  - Tên test: `POST /labs/{labId}/publish — 409 pending-reviews with pendingCount member when reviews remain pending`
  - Khẳng định: `assert.equal(response.statusCode, 409)` và `assert.equal(body.type, 'https://leetkob.example/problems/pending-reviews')`.

---

## 3. Chuỗi bằng chứng thực tế (Chain of Evidence: ĐỎ ➔ XANH)

### Bước 1: Baseline xanh trên nhánh `main`
- **Pull Request đồng bộ:** [PR #23: chore(release): promote reviewed PA02 baseline to main](https://github.com/2609-AWAD-23-3/leetkob/pull/23)
- **Baseline Commit SHA:** `91a738b5e967a3dcd1717ce406429a764e4cfae3`
- **Trạng thái:** 83/83 tests pass, toàn bộ quality checks đạt chuẩn.

### Bước 2: Commit Deliberate Break (Cố tình làm sai implementation)
- **Nhánh thử nghiệm:** `test/t10-contract-break-fix` (tách từ baseline `main` tại `91a738b`).
- **Break Commit SHA:** [`934af86e190384eacfb7ce7c6de06e0c6362db59`](https://github.com/2609-AWAD-23-3/leetkob/commit/934af86e190384eacfb7ce7c6de06e0c6362db59)
- **Nội dung sửa đổi:** Chỉ sửa duy nhất file `src/modules/publish/index.ts`, cố tình bỏ qua nhánh kiểm tra `pending_reviews` và trả về `200 OK` (fake publication). **Tuyệt đối không sửa contract `publish.md` hay test `publish.test.mjs`**.
- **Pull Request target `main`:** [PR #24: test(t10): prove contract break is blocked by quality gate](https://github.com/2609-AWAD-23-3/leetkob/pull/24)
- **Kết quả CI GitHub Actions:**
  - **Run ID:** [42994215858](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/42994215858) (Job ID: `130434141775`)
  - **Trạng thái:** **FAILURE (ĐỎ)** (Exit code 1).
  - **Chi tiết bắt lỗi:** Lint, format-check, type-check đều PASS; bước `npm test` thất bại chính xác tại assertion của contract:
    ```
    ✖ failing tests:
    test at tests/contract/publish.test.mjs:304:1
    ✖ POST /labs/{labId}/publish — 409 pending-reviews with pendingCount member when reviews remain pending (4.5ms)
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
      200 !== 409
    ```
- **Bằng chứng Merge bị chặn bởi Branch Protection:**
  - **Thời điểm ghi nhận:** `2026-11-11T09:20:13Z` - `2026-11-11T09:20:22Z`
  - **Head commit tại thời điểm probe:** `934af86e190384eacfb7ce7c6de06e0c6362db59`
  - **Trạng thái PR qua GitHub CLI (`gh pr view 24 --json mergeStateStatus,statusCheckRollup`):**
    ```json
    {
      "mergeStateStatus": "BLOCKED",
      "number": 24,
      "state": "OPEN",
      "statusCheckRollup": [
        {
          "__typename": "CheckRun",
          "completedAt": "2026-11-11T09:19:44Z",
          "conclusion": "FAILURE",
          "detailsUrl": "https://github.com/2609-AWAD-23-3/leetkob/actions/runs/42994215858/job/130434141775",
          "name": "quality-gate",
          "startedAt": "2026-11-11T09:19:34Z",
          "status": "COMPLETED",
          "workflowName": "CI"
        }
      ]
    }
    ```
  - **Lệnh merge thử nghiệm bằng CLI:**
    ```
    $ gh pr merge 24 --merge
    X Pull request 2609-AWAD-23-3/leetkob#24 is not mergeable: the base branch policy prohibits the merge.
    To have the pull request merged after all the requirements have been met, add the --auto flag.
    To use administrator privileges to immediately merge the pull request, add the --admin flag.
    ```
  - **Ngữ cảnh chính sách và giới hạn bằng chứng (Dual Enforcement & Context):**
    Quy tắc Branch Protection trên `main` được kích hoạt ở T09 bao gồm 2 ràng buộc đồng thời:
    1. Required status check `quality-gate` phải ở trạng thái SUCCESS (tại thời điểm này đang là FAILURE do contract assertion).
    2. Yêu cầu ít nhất 1 approving review từ peer reviewer trước khi merge (tại thời điểm này PR mới tạo và chưa có approval).
    GitHub CLI trả về thông báo chung *"the base branch policy prohibits the merge"* phản ánh sự thực thi đồng thời của cả hai rào chắn bảo vệ này. Hoàn toàn không có hành vi bypass hoặc sử dụng cờ `--admin`. Sau khi Fix commit được push đưa check `quality-gate` về SUCCESS (Run 42994580687) và nhận được review approval từ Vượng (`@vinny2707` tại `2026-11-11T10:08:49Z`), `mergeStateStatus` chuyển sang `CLEAN`.

### Bước 3: Commit Fix (Sửa lại implementation và đưa CI về XANH)
- **Fix Commit SHA:** [`65097bab5deb18fc4aac7706ab139b5f12195a55`](https://github.com/2609-AWAD-23-3/leetkob/commit/65097bab5deb18fc4aac7706ab139b5f12195a55)
- **Nội dung sửa đổi:** Phục hồi kiểm tra `publishResult.kind === 'pending_reviews'` trong `src/modules/publish/index.ts` để trả về problem details `409 pending-reviews`. **Giữ nguyên 100% contract và test files**.
- **Kết quả cục bộ:** 83/83 tests pass (100%), lint, format-check, type-check, diff-check đều đạt Exit 0.
- **Kết quả CI GitHub Actions:**
  - **Run ID:** [42994580687](https://github.com/2609-AWAD-23-3/leetkob/actions/runs/42994580687) (Job ID: `130435353601`)
  - **Trạng thái:** **SUCCESS (XANH)** (Hoàn thành trong 14 giây, 83/83 tests pass).
  - Check `quality-gate` trên PR #24 chuyển sang màu XANH hợp lệ.

---

## 4. Tổng kết đối chiếu tiêu chí Rubric PA02 (R4 & R6)

| Tiêu chí Rubric | Yêu cầu kiểm chứng | Kết quả thực tế đạt được |
| :--- | :--- | :--- |
| **R4 Blocking CI** | PR vào `main` bị chặn cứng khi check còn đỏ | Lệnh `gh pr merge 24 --merge` bị từ chối với thông báo *"the base branch policy prohibits the merge"* khi check `quality-gate` ở trạng thái FAILURE |
| **R4 Blocking CI** | Không có hành vi bypass | Toàn bộ quy trình diễn ra qua PR, không direct push, không `--admin` bypass |
| **R6 Contract tests** | Thí nghiệm deliberate break bị contract assertion bắt | Check `quality-gate` thất bại tại đúng assertion `200 !== 409` của test `tests/contract/publish.test.mjs:304` |
| **R6 Contract tests** | Chuỗi break/fix bảo toàn trên cùng PR | PR #24 chứa cả 2 commit: break [`934af86e`](https://github.com/2609-AWAD-23-3/leetkob/commit/934af86e190384eacfb7ce7c6de06e0c6362db59) (ĐỎ) và fix [`65097bab`](https://github.com/2609-AWAD-23-3/leetkob/commit/65097bab5deb18fc4aac7706ab139b5f12195a55) (XANH), sẵn sàng bàn giao cho reviewer |

