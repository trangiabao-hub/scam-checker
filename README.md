# Scam Checker (API Public)

Frontend React/Vite cho module tra cuu va gui to cao scam CCCD.

## Cau hinh

1. Tao file `.env` tu `.env.example`.
2. Khai bao base URL backend:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

## API duoc su dung

- `GET /public/scam-reports`: lay danh sach to cao
- `POST /public/scam-reports`: tao to cao moi
- `POST /public/scam-reports/upload`: upload anh bang chung, tra ve URL public

Frontend hien tai chap nhan ca response `snake_case` va `camelCase` de de dong bo backend.
