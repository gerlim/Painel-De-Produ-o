import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.gesleyson.painelproducao',
  appName: 'Painel Producao',
  webDir: 'public',
  server: {
    url: 'https://delpapeis-app2.vercel.app',
    cleartext: false,
  },
}

export default config
