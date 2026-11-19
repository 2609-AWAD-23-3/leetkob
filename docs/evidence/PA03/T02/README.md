# PA03-T02 — Kiểm tra host và spending cap

Quyết định đầy đủ ở [ADR 0001](../../../architecture/decisions/0001-host-model-and-spending-cap.md). Các lệnh dưới đây chạy ngày 19/11/2026 qua SSH bằng user quản trị `azureuser`, từ máy Windows của người thực hiện.

## Host

| Kiểm tra | Lệnh | Kết quả |
| --- | --- | --- |
| VM, region, đĩa | `curl -H Metadata:true http://169.254.169.254/metadata/instance/compute?api-version=2021-02-01` | `IndonesiaCentral`, `Standard_B2als_v2`, đĩa OS 64 GiB `Premium_LRS`, image `ubuntu-24_04-lts` |
| OS và tài nguyên | `cat /etc/os-release`, `nproc`, `free -h` | Ubuntu 24.04.5 LTS x86_64, 2 vCPU, 3.8 GiB RAM khả dụng |
| Docker | `docker --version`, `docker compose version`, `systemctl is-active docker` | Docker 29.10.0, Compose v5.8.0, `active`, `enabled` |
| cgroup | `sudo docker info --format '{{.CgroupVersion}} {{.CgroupDriver}}'` | `2 systemd` |
| User `deploy` | `id deploy`, `sudo -l -U deploy`, `sudo passwd -S deploy` | Thuộc nhóm `docker`; không được chạy `sudo`; mật khẩu khóa (`L`) |
| Container bằng `deploy` | `sudo -iu deploy docker run --rm hello-world` | In `Hello from Docker!`, exit 0 |
| Key của `deploy` | `sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys` | 2 key ED25519 của Phúc và Vỹ; file `600`, thư mục `.ssh` `700`, chủ sở hữu `deploy` |
| SSH | `sudo sshd -T` | `passwordauthentication no`, `kbdinteractiveauthentication no`, `permitrootlogin without-password` |
| Public IP | `az network public-ip list -g leetkob-rg` (Cloud Shell) | `leetkob-vm-ip`, Standard, Static, `70.153.86.114` |

Chưa kiểm tra: đăng nhập trực tiếp `ssh deploy@70.153.86.114` bằng key của Phúc hoặc Vỹ, vì người thực hiện không giữ private key của họ. Đây là mục đầu tiên trong checklist review của Phúc.

## Spending cap

Ảnh chụp Claude Console ngày 19/11/2026, organization `leetkob`:

- [Spend limits](claude-console-spend-limits.png): organization $10/tháng, cảnh báo admin ở $4; workspace `leetkob` $5/tháng; cả hai đã dùng $0.
- [Billing](claude-console-billing-auto-reload-off.png): credit $5.00, "Auto-reload is off. API requests will stop when your balance runs out."

Ảnh đã cắt bỏ tab trình duyệt, URL, địa chỉ thanh toán và thông tin thẻ. API key chưa được tạo tại thời điểm chụp.

Xem thêm [nhật ký AI theo task](AI-LOG.md).
