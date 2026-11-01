import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// the app's one typeface, bundled so the Content-Security-Policy (font-src 'self') allows it;
// with its optical-size axis, so titles get Inter's display cut and small text its open text cut
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import App from './App.jsx'
import AppIntro from './components/intro/AppIntro.jsx'
import {Provider} from "react-redux";
import store from "./features/store";
import { registerServiceWorker } from './features/pwa/registerServiceWorker'
import { listenForInstallPrompt } from './features/pwa/install'
import { setupNativeApp } from './features/native/native'

registerServiceWorker()
listenForInstallPrompt()
setupNativeApp(store)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <App />
      </Provider>
      <AppIntro />
    </BrowserRouter>
  </StrictMode>,
)
