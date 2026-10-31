import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './pos'
import './index.css'

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
