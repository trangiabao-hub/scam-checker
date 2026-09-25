import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin Tailwind đã được bỏ: index.css không hề `@import "tailwindcss"` nên
// plugin chạy mà không sinh ra utility nào, và preflight của Tailwind v4 sẽ
// reset mất style của Ant Design nếu bật lên.
export default defineConfig({
  plugins: [react()],
})
