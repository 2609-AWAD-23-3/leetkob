# T05 — Chạy lại secrets scan và đọc kết quả

## Công cụ và tính tái lập

- [Release chính thức Gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1), Windows x64, dùng portable trong thư mục tạm.
- Archive: gitleaks_8.30.1_windows_x64.zip.
- SHA-256 archive đã đối chiếu file checksums của release: d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e.
- [Config chính thức theo tag](https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml); SHA-256 e163e53b9e7e8a8511e77271e2b323ed057759542a6d988258afe3a1fa329caf.
- Dùng nguyên config mặc định kể cả allowlists mặc định của công cụ; không thêm suppression/baseline riêng. Collector bỏ qua gitleaks:allow trong source và dùng ignore file rỗng.

Collector xác nhận version/config hash, dùng argument arrays thay vì dựng shell command, không in config/remote thô. Report bỏ các trường Match, Secret, Line, Author, Email và commit message; chỉ giữ rule, vị trí và commit để phân loại. Các report redacted trung gian được xóa theo đúng đường dẫn file do collector tạo. Snapshot tạm giữ bản sao file để đối chiếu local; không đưa snapshot vào repo hoặc upload. Thư mục tạm vẫn có thể chứa bản sao file local nhạy cảm nếu trong repo có chúng, nên chỉ người thực hiện được dùng và xử lý theo chính sách dữ liệu của nhóm.

## Lệnh chạy

Chạy từ root repo. Nếu công cụ tạm từ phiên này còn tồn tại:

```powershell
$t05Tools = Join-Path $env:TEMP 'leetkob-t05-gitleaks-8.30.1'
node --check docs/evidence/PA02/T05/scan-secrets.mjs
node --check docs/evidence/PA02/T05/triage-digests.mjs
git fetch origin --tags
node docs/evidence/PA02/T05/scan-secrets.mjs "$t05Tools\gitleaks.exe" "$t05Tools\default-gitleaks.toml"
```

Scanner có findings thì collector trả exit 1 và vẫn lưu report đã loại dữ liệu nhạy cảm. Lỗi công cụ/config/history shallow thì dừng, không ghi nhận scan thành công. **Không ghép điều kiện chỉ chạy triage khi scan exit 0**, vì lịch sử hiện có bốn findings cần triage:

```powershell
node docs/evidence/PA02/T05/triage-digests.mjs
git diff --check
```

triage-digests chỉ chấp nhận finding trong sha256WorkingFiles của evidence T03 khi digest khớp source tại commit tương ứng hoặc file local có hash trùng snapshot. Nếu source local đã format, helper chỉ xét digest của source lịch sử ở HEAD khi toàn bộ tài liệu evidence T03 vẫn trùng bản ở HEAD (xét LF/CRLF); report ghi verifiedAgainst để không nhầm hash lịch sử với bytes mới. Đây là kiểm chứng giá trị cụ thể, không phải allowlist bỏ qua path/rule. Gặp finding ở vị trí khác, tài liệu lịch sử bị đổi hoặc hash không khớp thì dừng để kiểm tra riêng.

Report có timestamp, HEAD, refs/SHA, số commits, danh sách snapshot/hash, scanner/config version, các exit codes và giới hạn. Nếu source/refs thay đổi sau scan, chạy lại và phân loại mới; không tái sử dụng kết luận của snapshot cũ.

security-scan.json, security-triage.json và verification.json là output tự sinh nên không nằm trong snapshot/hash của chính chúng. Chúng được kiểm tra bổ sung bằng Gitleaks stdin sau khi tạo, giữ exit code và số findings tại verification.json. Nếu scanner bắt SHA-256 trong manifest, chỉ phân loại false positive sau khi đối chiếu giá trị với file local; không mặc định bỏ qua findings trong report.

Nếu cần cài lại công cụ, tải đúng asset/config từ nguồn chính thức bên trên bằng gh release download/gh api hoặc cách được nhóm cho phép. Đối chiếu archive với checksum chính thức trước khi giải nén/chạy. Không tải binary từ mirror không xác minh hoặc cài global thay cho reviewer mà chưa được phép.

## Phạm vi lệnh bên trong collector

```text
gitleaks git <repo> --log-opts="--all --full-history --reflog --root -m" <các flags an toàn>
gitleaks dir <snapshot-working-tree> <các flags an toàn>
git log --all --reflog và for-each-ref → gitleaks stdin <các flags an toàn>
git config --list --show-origin và git remote -v → gitleaks stdin <các flags an toàn>
```

Các flags an toàn gồm config được pin, redact=100, ignore-gitleaks-allow, ignore file rỗng, JSON report, no-banner/no-color và log-level=error. Raw config và metadata đi qua pipe trong bộ nhớ, không in ra console. Không thực thi credential helper, không gọi model/provider và không validate secret bằng cách gửi credential ra mạng.

## Nếu có secret thật

Giữ evidence đã che gồm rule/vị trí/commit và phạm vi ảnh hưởng, báo người quản lý credential. Người có quyền revoke/rotate, kiểm tra usage và xác nhận xử lý. Chỉ xóa file hiện tại không xóa secret trong history; không rewrite history đã công bố hoặc xóa evidence khi chưa có phương án được duyệt. T11 ghi nhận sự cố trung thực, không nhận đã rotate khi chưa có bằng chứng.

Chi tiết số findings và bằng chứng phân loại nằm trong [security-scan.json](security-scan.json), [security-triage.json](security-triage.json). Thông tin model/cap/cost ở [model-cost.md](model-cost.md) là gate riêng; scan không xác minh được cap hoặc chi phí.
