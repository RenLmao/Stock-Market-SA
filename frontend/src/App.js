import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link, Outlet } from 'react-router-dom';
import './App.css'; // Assuming you have this for global styles
import HomePage from './components/HomePage';
import SentimentAnalyzerPage from './components/SentimentAnalyzerPage';

function AppLayout() {
  return (
    <div className="App">
      <header className="App-header">
        <Link to="/" className="logo-title-link">
          <h1>Stock Sentiment Analyzer</h1>
        </Link>
        <nav>
          <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>Home</NavLink>
          <NavLink to="/analyze" className={({ isActive }) => isActive ? "active" : ""}>Analyze Ticker</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="App-footer">
        <p>© {new Date().getFullYear()} Stock Sentiment Analyzer. For educational purposes only. Not financial advice.</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="analyze" element={<SentimentAnalyzerPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;