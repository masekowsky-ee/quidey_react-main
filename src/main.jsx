import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// the app's one typeface, bundled so the Content-Security-Policy (font-src 'self') allows it
import '@fontsource-variable/inter'
import './index.css'
import App from './App.jsx'
import AppIntro from './components/intro/AppIntro.jsx'
import {Provider} from "react-redux";
import store from "./features/store";

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
