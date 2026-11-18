# RuaxBonz Desktop — Công cụ tự động hóa trình duyệt

RuaxBonz Desktop là ứng dụng tự động hóa trình duyệt trên máy tính, hỗ trợ xử lý liên kết, tìm kiếm web, đọc nội dung bằng AI và gửi thông báo qua Telegram. Ứng dụng được thiết kế để hỗ trợ các quy trình mà người dùng có quyền thực hiện; hãy tuân thủ điều khoản dịch vụ của website và luật áp dụng.

Từ khóa: RuaxBonz, tự động hóa trình duyệt, ứng dụng desktop, xử lý liên kết, AI đọc nội dung, thông báo Telegram.

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Cài đặt các thư viện phụ thuộc:
```bash
npm install
```

### 2. Cấu hình biến môi trường:
Sao chép file `.env.example` thành `.env`:
```bash
copy .env.example .env
```

Mở file `.env` và điền các API Key / Token của bạn:
- `TELEGRAM_BOT_TOKEN`: Token của Telegram Bot tạo từ @BotFather.
- `TELEGRAM_DEFAULT_CHAT_ID`: ID tài khoản hoặc nhóm Telegram để nhận mã tự động.
- `ROUTER9_API_KEY`: API Key của 9Router AI để phân tích ảnh bước 3.
- `ROUTER9_LOCAL_ENDPOINT`: Endpoint local (mặc định: `http://127.0.0.1:20128/v1/chat/completions`).
- `ROUTER9_TUNNEL_ENDPOINT`: Endpoint online tunnel (nếu có).
- `FREEIMAGE_API_KEY`: API Key upload ảnh miễn phí từ Freeimage.host.

### 3. Chạy ứng dụng:
```bash
npm start
```

## 🔒 Bảo mật
File `.env` đã được thêm vào `.gitignore` để tránh bị lộ Token / API Key khi đẩy mã nguồn lên GitHub.

## Bản quyền và sử dụng hợp pháp
© 2026 RuaxBonz.com. Người dùng có trách nhiệm bảo đảm việc sử dụng ứng dụng tuân thủ pháp luật, quyền của bên thứ ba và điều khoản dịch vụ áp dụng. Nhà phát triển không khuyến khích hành vi vi phạm; thông báo này không loại trừ trách nhiệm trong phạm vi pháp luật quy định.
