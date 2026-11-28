# PA03-T10, PA04-T08: image cho lệnh checker. Build từ root repo:
#   docker build -f docker/checker.Dockerfile -t leetkob-checker .
# Lần chạy held-out (model bật): key đọc từ marking.env lúc chạy, network chỉ qua proxy tới
# api.anthropic.com:443; prediction ra stdout, log ra stderr (README, mục "Lần chạy held-out"):
#   docker run --rm --env-file marking.env -e HTTPS_PROXY=http://<proxy>:<port> \
#     -v "$PWD/<held-out>:/data:ro" leetkob-checker /data > predictions.jsonl
# Model tắt (không key, không network):
#   docker run --rm --network none -e MODEL_OFF=1 \
#     -v "$PWD/leetkob-eval:/data:ro" leetkob-checker /data > predictions.jsonl
# Hoặc mount thư mục output: -v "$PWD/out:/out" ... /data --out /out/predictions.jsonl
# Image không chứa secret: MODEL_API_KEY chỉ được truyền lúc chạy khi bật model.

FROM node:24.22.3-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
    && npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24.22.3-bookworm-slim
ENV NODE_ENV=production
# PA04-T08: lần chạy held-out của người chấm không có network ngoài một proxy tới model host
# (truyền qua HTTPS_PROXY). fetch của Node, SDK model dùng fetch này, chỉ đọc HTTPS_PROXY khi
# bật cờ dưới. Không có HTTPS_PROXY thì cờ không làm gì.
ENV NODE_USE_ENV_PROXY=1
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Đường chính là stdout: container không ghi file nào, chạy được với mọi --user, --cap-drop ALL,
# --read-only. Image vẫn chạy bằng root (không đặt USER) cho người tự mount /out: trên Linux,
# `-v "$PWD/out:/out"` với `out/` chưa tồn tại khiến Docker tạo thư mục thuộc root, user khác
# root sẽ bị EACCES. Checker chỉ đọc text (không compile hay chạy code sinh viên); lần chạy
# held-out chỉ ra ngoài qua proxy tới model host, lần chạy model tắt dùng `--network none`. File
# trong /app đều đọc được nên `--user` vẫn dùng được.
ENTRYPOINT ["node", "dist/cli/checker.js"]
