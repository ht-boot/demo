import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    visualizer({
      open: true, // 打包后自动打开页面
      gzipSize: true, // 查看 gzip 压缩大小
      brotliSize: true, // 查看 brotli 压缩大小
    }),
  ],
});
