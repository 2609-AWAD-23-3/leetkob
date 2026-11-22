# AI log — PA03-T07

## 2026-11-21 — Hard rules cho constraint ban-list

Tool: Claude Code.
Asked for: Chạy prompt `prompt-pa03-t07.md` cho T07: spike cách phân tích C++, viết test trước, implement hard rules trong `src/pipeline/hard-rules/`, chạy model-off trên dev set và viết evidence kèm giải thích kỹ thuật cho Vỹ.
Kept: Hướng lexer tự viết có theo dõi scope, không thêm dependency, như gợi ý mặc định của prompt. API `classifyConstraint`, `checkBanList`, `runHardRules` và bản ghi quyết định theo prompt. Phần lớn lexer, tiền xử lý macro, cây scope và các bộ test được giữ như Claude viết, sau khi chạy test và dev set.
Changed: Test viết trước nhưng chạy lần đầu có 8 test đỏ: lỗi lệch chỉ số khi đọc `#define` làm macro không khai triển, tên tham số hàm bị tính là lần sử dụng, và một số số dòng kỳ vọng trong test tôi đếm sai (sửa kỳ vọng sai về đúng dòng, không nới điều kiện). Thêm dòng nhãn cho `goto` và hằng enum như tên do sinh viên khai báo sau khi chạy thử các ca ngoài dev set. Mọi sửa đổi theo lớp cú pháp tổng quát, không theo bài.
Rejected: tree-sitter-cpp (thêm dependency, vẫn phải tự khai triển macro và phân giải tên). Đồng nhất `std::string` với `std::basic_string` vì dễ khấu trừ oan khi ban list chỉ nêu một tên. Mô phỏng ADL. Không đưa id hay code dev set vào rule hoặc test; không sửa dev set, `eval.mjs`, nhãn. Con số 18 vi phạm ban-list trong prompt không khớp dev set (đếm được 15), ghi đúng 15 vào evidence.
By hand: Vỹ giao prompt và đọc lại code. Claude viết code, test, evidence và chạy lệnh trên worktree `leetkob-t07`; lint, format-check, type-check, `npm test` (234 test) và `git diff --check` exit 0.
