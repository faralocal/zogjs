import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // 1. مشخص می‌کند که خروجی در فولدر 'dist' قرار گیرد.
    outDir: 'dist', 
    
    // 2. استفاده از Terser برای فشرده‌سازی حداکثری
    // 'terser' به جای 'esbuild' برای Minification استفاده می‌شود.
    minify: 'terser', 

    // 3. تنظیمات Terser برای فشرده‌سازی تهاجمی
    terserOptions: {
      compress: {
        // حذف تمام دستورات console.*
        drop_console: true, 
        // حذف تمام دستورات debugger
        drop_debugger: true, 
        // بهینه‌سازی بیشتر برای حذف کدهای غیرقابل دسترس (مثلاً در if/else)
        // این می‌تواند کمی زمان Build را افزایش دهد، اما خروجی کوچکتری می‌دهد.
        // passes: 3, 
      },
      format: {
        // حذف کامنت‌ها از خروجی
        comments: false, 
      },
      // حذف تمام نام‌های متغیرها و توابع غیرضروری در صورت امکان
      mangle: true, 
    },
    
    // 4. تنظیمات Library Mode
    lib: {
      entry: resolve(__dirname, 'src/zog.js'),
      name: 'ZogLibrary', 
      fileName: (format) => `zog.${format}.js` 
    },
  },
});