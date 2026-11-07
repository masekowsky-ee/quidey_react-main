import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// the app's two typefaces, bundled so the Content-Security-Policy (font-src 'self') allows them:
// Instrument Sans for everything you work with, Newsreader (with its optical-size axis) for the
// page titles and the task in focus
import '@fontsource-variable/instrument-sans/wght.css'
import '@fontsource-variable/newsreader/opsz.css'
import './index.css'
import App from './App.jsx'
import AppIntro from './components/intro/AppIntro.jsx'
import {Provider} from "react-redux";
import store from "./features/store";
import { registerServiceWorker } from './features/pwa/registerServiceWorker'
import { listenForInstallPrompt } from './features/pwa/install'
import { setupNativeApp } from './features/native/native'
import { startOwnColors } from './features/tasks/ownColors'

registerServiceWorker()
listenForInstallPrompt()
setupNativeApp(store)
startOwnColors()

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
