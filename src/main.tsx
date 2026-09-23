import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { prepareOffline } from './lib/offline'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import App from './App'
import './styles.css'
import './reference.css'
import './onboarding.css'
import './sharing.css'
import './product.css'
import { initialTheme } from './lib/theme'
import { Capacitor } from '@capacitor/core'

initialTheme()
if (location.protocol !== 'lifeos:' && !Capacitor.isNativePlatform()) prepareOffline()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
