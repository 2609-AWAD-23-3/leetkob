# 0001 — Host deployment, model provider và spending cap cho PA03

- **Trạng thái:** đề xuất, chờ review của @BHVPhuc trên PR PA03-T02.
- **Người ghi:** @vinny2707 (PA03-T02, [Issue #31](https://github.com/2609-AWAD-23-3/leetkob/issues/31)).
- **Reviewer:** @BHVPhuc; @tranquocvy xác nhận mức cap theo checklist review của T02.
- **Ngày:** 19/11/2026.

## Bối cảnh

PA03 cần deployment public chạy luồng nộp bài → queue → sandbox → hard rules → model → review queue, và giữ chạy tới khi có điểm PA04 (xem [plan PA03](../../plans/PA03.md#t02--host-model-provider-và-spending-cap)). Tài khoản test trong `PA3.md` là public nên model thật phải có hard spending cap ở phía provider.

Ràng buộc chính:

- Sandbox của PA03-T05 tạo một container cho mỗi job, cần Docker daemon và cgroup v2 để giới hạn memory, CPU và process. Lệnh sandbox không được dùng `--privileged` hay mount Docker socket.
- API, worker, Postgres và reverse proxy HTTPS chạy chung một máy, khoảng 2 vCPU và 4 GB RAM theo gợi ý của plan.
- Thẻ Visa của người thực hiện bị từ chối khi thanh toán, nên host phải dùng được không cần thẻ, còn model do thành viên khác thanh toán.

## Host

### Phương án đã xem xét

| Phương án | Chi phí | Cần thẻ | Đánh giá |
| --- | --- | --- | --- |
| **Azure for Students**, VM B2als_v2 | Trừ vào $100 credit, dùng trong 12 tháng | Không, xác minh bằng email trường | **Chọn.** Có Docker daemon, không cần thẻ, hết credit thì subscription bị vô hiệu hóa chứ không phát sinh nợ |
| Hetzner Cloud CX23 | Khoảng €5.49/tháng | Có | Rẻ nhất, nhưng thẻ của người thực hiện bị từ chối |
| Google Cloud free trial | $300 credit trong 90 ngày | Có | Cần thẻ; VM miễn phí lâu dài (e2-micro, 1 GB) không đủ RAM |
| PaaS (Render, Railway, Heroku…) | Free tier hoặc vài USD/tháng | Tùy | **Loại.** Không cung cấp Docker daemon cho sandbox; plan cũng loại PaaS serverless |

Giá Hetzner và Google Cloud lấy theo trang công bố tại thời điểm tra cứu, chưa đối chiếu lại hôm nay.

### Cấu hình đã dựng

| Mục | Giá trị |
| --- | --- |
| Subscription | Azure for Students của @vinny2707 |
| Resource group / VM | `leetkob-rg` / `leetkob-vm` |
| Region | Indonesia Central. Policy của subscription chỉ cho phép `indonesiacentral`, `koreacentral`, `japaneast`, `indiasouthcentral`, `uaenorth`; East Asia và Southeast Asia bị chặn |
| Size | `Standard_B2als_v2`: 2 vCPU, 4 GiB RAM |
| OS | Ubuntu 24.04.5 LTS x86_64, kernel `7.0.0-1017-azure`, cgroup v2 |
| Đĩa OS | 64 GiB, `Premium_LRS` |
| Public IP | `70.153.86.114`, Standard SKU, Static (không đổi khi Stop/Start) |
| Docker | Docker Engine 29.10.0 và Compose v5.8.0 từ repo chính thức; cgroup driver systemd; tự khởi động khi boot |
| Firewall | NSG của Azure chỉ mở cổng 22. Cổng 80/443 mở ở PA03-T12 khi deploy |
| Auto-shutdown | Không hỗ trợ ở region này; Stop (deallocate) thủ công trên Portal nếu cần tiết kiệm |

### Truy cập

| User | Quyền | Người dùng |
| --- | --- | --- |
| `azureuser` | Quản trị, có `sudo` | Vượng |
| `deploy` | Thuộc nhóm `docker`, không có `sudo`, mật khẩu bị khóa | Phúc (deploy ở PA03-T12) và Vỹ, chỉ đăng nhập bằng SSH key |

SSH chỉ chấp nhận key: `PasswordAuthentication no`, `PermitRootLogin without-password`. Fingerprint các key của `deploy`:

- Phúc: `SHA256:gF1uSRDegyqzy9MDCQk9v4Boc2e4FH/c6fH1hluXbaQ`
- Vỹ: `SHA256:mIgNgPwpPWryKxH2hmluJbes2mn3m8QhZ979+Fosz9Q`

Thành viên nhóm `docker` có quyền tương đương root trên máy. Chấp nhận đánh đổi này vì `deploy` cần chạy Docker cho deployment; chỉ cấp cho thành viên nhóm. Vỹ có quyền vào `deploy` theo yêu cầu của người thực hiện, ngoài phạm vi tối thiểu của plan (chỉ Phúc).

### Chi phí và người trả

- Máy: $0.0428/giờ, khoảng $31.24/tháng theo giá trên Portal cho region đã chọn.
- Đĩa Premium SSD 64 GiB và Public IP tính thêm. Ước tính tổng khoảng $40–46/tháng; số thực xem trong Azure Cost Management.
- Người trả: $100 credit Azure for Students của Vượng. Nếu chạy liên tục từ 19/11/2026, credit dự kiến hết khoảng cuối tháng 01 đến đầu tháng 02/2027.
- Khi hết credit, VM bị dừng. Nếu PA04 chưa có điểm, nhóm dựng lại trên subscription Azure for Students của thành viên khác và backup Postgres trước đó.

## Model provider và spending cap

### Phương án đã xem xét

| Phương án | Giá (USD / 1M token, input / output) | Đánh giá |
| --- | --- | --- |
| **Anthropic Claude API, `claude-haiku-5-5`** | $0.10 / $0.50 (prompt ≤100K token) | **Chọn.** Rẻ nhất trong các phương án trả phí đã so sánh; structured outputs validate theo JSON schema; request id có sẵn trong SDK; spend limit theo workspace |
| DeepSeek API, `deepseek-flash` (V4.1 Flash) | $0.30 / $1.20 theo nguồn tổng hợp, có giá cao điểm và thấp điểm | Đắt hơn khoảng 2.5 lần; JSON mode cần tự validate schema; dữ liệu bài nộp gửi tới server ở Trung Quốc |
| OpenRouter (cùng model qua trung gian) | Giá model cộng phí nạp credit | Thêm một bên trung gian; request id là generation id của OpenRouter |
| Free tier (Gemini qua Google AI Studio, model `:free` của OpenRouter) | $0 | Rate limit dễ làm hỏng dev run và demo; free tier có thể dùng prompt để huấn luyện; không đo được chi phí thật cho rubric |

Giá của Anthropic theo bảng giá model tháng 11/2026. Giá DeepSeek theo các trang tổng hợp, cần đối chiếu trang chính thức nếu cân nhắc lại.

### Lựa chọn

- Provider: Anthropic, gọi trực tiếp Claude API bằng `@anthropic-ai/sdk`.
- Model: `claude-haiku-5-5`. Đặt `output_config.effort` = `low` để giới hạn token thinking, vì token thinking tính như output.
- Biến môi trường: `MODEL_API_KEY`, chỉ nằm trong env của server, truyền vào client qua `apiKey` (SDK mặc định đọc `ANTHROPIC_API_KEY`).
- Call log ghi provider request id (`_request_id` của SDK, header `request-id`).
- Unit test không gọi model thật, chỉ dùng fake/stub ([AGENTS.md](../../../AGENTS.md)).

### Ước tính chi phí một lab 80 bài

Giả định mỗi bài có 2 constraint semantic cần gọi model, mỗi call khoảng 2.000 token input và 1.000 token output (gồm cả thinking):

- Input: 80 × 2 × 2.000 = 320.000 token × $0.10 / 1M = $0.032.
- Output: 80 × 2 × 1.000 = 160.000 token × $0.50 / 1M = $0.080.
- Tổng khoảng **$0.11 cho một lab 80 bài**.

PA03-T08 đo số token thật trên một call và cập nhật lại phép tính này cho README và `AI-LOG.md` (PA03-T13).

### Spending cap

| Lớp | Cấu hình |
| --- | --- |
| Workspace `leetkob` | Spend limit $5/tháng, reset ngày 01 hằng tháng (UTC) |
| Organization | Spend limit $10/tháng; email cho admin khi chi tới $4 |
| Billing | Credit trả trước $5.00 (mua 19/11/2026); Auto-reload tắt, API dừng khi hết số dư |

Bằng chứng: [spend limits](../../evidence/PA03/T02/claude-console-spend-limits.png) và [billing](../../evidence/PA03/T02/claude-console-billing-auto-reload-off.png). Ảnh đã cắt bỏ địa chỉ thanh toán và thông tin thẻ.

### Vai trò

| Vai trò | Người |
| --- | --- |
| Tạo organization, nạp credit, tạo workspace `leetkob` và limit workspace | Vỹ |
| Hạ limit organization xuống $10 và thêm cảnh báo $4 (role Admin) | Vượng |
| Tạo và giữ API key, trong workspace `leetkob` | Vỹ (key chưa tạo tại thời điểm ghi) |
| Đặt `MODEL_API_KEY` lên server | Người giữ key cùng Phúc ở PA03-T12, qua kênh riêng |

Key không được đưa vào Git, Issue, PR, chat nhóm, log hay sandbox. Key phải được tạo trong workspace `leetkob`; key ở workspace Default chỉ bị chặn bởi limit của organization.

## Hệ quả và giới hạn

- PA03-T08 dùng SDK của Anthropic với `claude-haiku-5-5`; PA03-T12 có host và biết biến `MODEL_API_KEY`.
- Cap $5/tháng đủ cho dev run PA03 và vài lần chạy PA04 theo ước tính trên; nếu cần thêm, Admin tăng limit và nạp credit, ghi lại trong tài liệu này.
- Một VM duy nhất, không có dự phòng; multi-host và autoscaling nằm ngoài scope PA03.
- Cấu hình host được kiểm tra bằng các lệnh trong [evidence T02](../../evidence/PA03/T02/README.md). Đăng nhập trực tiếp bằng `deploy` do Phúc kiểm chứng khi review.

Quay lại [danh sách quyết định](README.md) hoặc [cấu trúc project](../project-structure.md).
