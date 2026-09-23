import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'com.lifeos.app',
  appName: 'LifeOS',
  webDir: 'dist',
  server: { hostname: 'localhost', androidScheme: 'https' },
  android: { allowMixedContent: false, backgroundColor: '#f5f4ef' },
}
export default config
