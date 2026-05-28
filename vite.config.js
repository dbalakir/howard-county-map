import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/wms': {
        target: 'https://hcgeoserver.howardcountymd.gov:8443',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/wms/, '/geoserver/wms'),
      },
    },
  },
});
