# Công cụ vẽ pixel art cho Pet Farm

Hai dịch vụ AI chuyên pixel art mà các phiên Claude (Design Department, game) dùng được để làm sprite, hoạt ảnh và tileset.

## PixelLab (MCP)

- Cấu hình nằm trong `.mcp.json` ở gốc repo: máy chủ `pixellab`, `https://api.pixellab.ai/mcp`, xác thực `Authorization: Bearer ${PIXELLAB_API_TOKEN}`.
- Công cụ: `create_character` (nhân vật 4 hoặc 8 hướng), `animate_character`, `create_tileset`, `create_isometric_tile`.
- Lấy token ở https://www.pixellab.ai/vibe-coding.

## Retro Diffusion (API, chưa có MCP)

- Gọi qua `node scripts/retro-diffusion.mjs`, khóa đọc từ `RETRO_DIFFUSION_API_KEY` (bắt đầu bằng `rdpk-`).
- `credits`: xem số dư. `generate --style <prompt_style> --size WxH [...]`: tạo ảnh, ghi PNG/GIF vào `--out` (mặc định `tmp/retro-diffusion`). Thêm `--cost` để hỏi giá trước, không tốn credit.
- Style hay dùng cho làng top-down:
  - `rd_tile__tileset` (tile 16–32px, kiểu wang), `rd_tile__single_tile`, `rd_tile__tile_object`, `rd_tile__scene_object`;
  - `rd_animation__four_angle_walking` (đi bộ 4 hướng, 48px), `rd_advanced_animation__walking` (từ ảnh mẫu `--input`);
  - `rd_pro__spritesheet`, `rd_plus__item_sheet`.
- Tài liệu API: https://github.com/Retro-Diffusion/api-examples

## Cài khóa

Không dán khóa vào chat hay vào code. Thêm trong cài đặt môi trường cloud (menu môi trường trên thanh tiêu đề phiên, Edit), mục Network secrets hoặc biến môi trường:

- `PIXELLAB_API_TOKEN`
- `RETRO_DIFFUSION_API_KEY`

Mạng cần cho phép `api.pixellab.ai` và `api.retrodiffusion.ai`. Khóa và `.mcp.json` chỉ được đọc khi phiên mới bắt đầu.

## Quy tắc asset

Ảnh AI tạo ra là bản nháp: Design Department duyệt, chỉnh bảng màu và lưới pixel trước khi đưa vào `public/ta-tua/game/`. Không đưa ảnh chưa duyệt vào game.
