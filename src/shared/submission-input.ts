import { requireLabText } from './lab-input.js';

export const SUBMISSION_CODE_BYTES = 65_536;
export const SUBMISSION_BODY_BYTES = 1024 * 1024;
export const SUBMISSION_NOTICE =
  'Mã nguồn được soát bằng luật cứng và mô hình AI. Dữ liệu gửi tới mô hình được loại bỏ comment và thông tin định danh sinh viên. Mô hình không quyết điểm; TA duyệt trước khi công bố.';

export function validateSubmissionCode(code: unknown): asserts code is string {
  requireLabText(code, 'code', SUBMISSION_CODE_BYTES);
}
