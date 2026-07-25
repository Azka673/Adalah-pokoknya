/**
 * File: src/App.tsx
 * Purpose: Main application root. Includes routing and global UI elements (Toasts).
 */

import { HashRouter, Route, Routes } from 'react-router'
import HomePage from './pages/Home'
import Toasts from './components/Toasts'

export default function App() {
  return (
    <HashRouter>
      {/* Global toasts provider (listens for 'sider-toast' events) */}
      <Toasts />
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </HashRouter>
  )
}
