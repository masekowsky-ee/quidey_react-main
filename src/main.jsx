import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from './i18n/LanguageContext'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import {Provider} from "react-redux";
import store from "./features/store";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <Provider store={store}>
          <App />
        </Provider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
