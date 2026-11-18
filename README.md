# RuaxBonz Desktop Link Bypass & Code Grabber

Ứng dụng Desktop tự động hóa vượt link rút gọn (Link4M, Traffic120, v.v.), tự tìm kiếm Google, cuộn trang lấy mã xác nhận và gửi kết quả về Telegram Bot.

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
