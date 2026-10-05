import { defineConfig } from 'vite';

// Relative base so the build works on itch.io (and any subfolder host).
export default defineConfig({
    base: './',
});
