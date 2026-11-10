import type { Config } from 'tailwindcss';
export default { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink:'#14231f', muted:'#687771', brand:'#176b52', mint:'#e7f3ed', line:'#e6ece8' }, boxShadow:{ soft:'0 12px 40px rgba(20,35,31,.07)' } } }, plugins: [] } satisfies Config;
