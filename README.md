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

## Rehost image URL ve BE

Co script de clone anh tu URL cu (bao gom URL Supabase va URL ngoai BE) ve BE, sau do cap nhat lai `image_urls` bang URL moi cua BE.
Script tu dong doc cac file `.env`, `.env.local`, `.env.product`, `.env.production` neu co.

Chay:

```bash
npm run sync:be-images
```

Neu can override truc tiep tren command:

```bash
BE_API_BASE_URL=https://api.your-domain.com/api \
npm run sync:be-images
```

Bien moi truong ho tro:

- `BE_API_BASE_URL`: base URL BE (khong can duoi `/`)
- `FORCE_REHOST_ALL_IMAGES` (optional): `true/false`, mac dinh `false`. `false` se chi clone URL khac domain BE.
- `DRY_RUN` (optional): `true/false`, mac dinh `false`. Chay kiem tra khong ghi update.
- `BE_REPORT_UPDATE_ENDPOINT_TEMPLATE` (optional): mac dinh `/public/scam-reports/:id`
- `BE_REPORT_UPDATE_METHODS` (optional): mac dinh `PATCH,PUT`

Script se:

1. Lay tat ca report hien co tren BE
2. Tim report co `image_urls` can rehost
3. Download tung anh URL cu, upload lai qua `POST /public/scam-reports/upload`
4. Cap nhat report de `image_urls` chi con URL moi cua BE
