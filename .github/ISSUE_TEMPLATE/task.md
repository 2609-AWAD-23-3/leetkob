---
name: Work package
about: Một task review độc lập được, có một người thực hiện và đủ tiêu chí nghiệm thu.
title: "[PAxx][Txx] Tên task kỹ thuật"
labels: "type:task"
assignees: ""
---

## Thông tin task

- Milestone và task ID: PAxx-Txx
- Người thực hiện: @<account>
- Reviewer độc lập: @<account-khác>
- Mục plan chuẩn:
- Phụ thuộc: task ID và link Issue, hoặc Không

Viết tiếng Việt, giữ nguyên thuật ngữ kỹ thuật, identifier và lệnh; không dùng icon trang trí. Mỗi task một Issue, không tách theo từng checkbox. Reviewer không phải người thực hiện thứ hai.

## Mô tả

Mô tả trọn task và hành vi quan sát được. Không tự mở rộng scope đã duyệt.

## Checklist thực hiện

- [ ] Thay bằng toàn bộ checklist thực hiện trong plan đã duyệt, đúng thứ tự.

## Checklist review

- [ ] Thay bằng toàn bộ checklist review trong plan đã duyệt, đúng thứ tự.

## Kết quả cần đạt và nghiệm thu

Liệt kê artifact, hành vi bắt buộc và kết quả nghiệm thu quan sát được.

## Ranh giới và bàn giao

Ghi quyền sở hữu file, đầu vào từ đồng đội, file dùng chung, ranh giới tài khoản/quyền và phần không làm.

## Evidence và kết quả thực tế

Chưa cập nhật. Thêm link PR/commit/run và kết quả tái lập được khi có. Không bịa evidence hay đánh dấu xong việc chưa quan sát được.

## Tiến độ và blocker

Chưa cập nhật. Ghi rõ dependency, quyền, đầu vào hoặc năng lực còn thiếu và ai giải quyết.

## Tích hợp và đóng Issue

PR task thường target develop và ghi Refs #N. main vẫn là default branch nên merge vào develop không tự đóng Issue. Chỉ đóng thủ công khi đủ mọi tiêu chí nghiệm thu, review độc lập và merge dự kiến. Task release giữ thêm gate tag/ZIP/nộp bài. Đồng bộ trạng thái checklist và evidence với plan chuẩn; không duy trì hai định nghĩa hoàn thành mâu thuẫn.
