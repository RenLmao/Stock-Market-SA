import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link, Outlet } from 'react-router-dom';
import './App.css'; // Your global styles

// Lazy load page components
const HomePage = lazy(() => import('./components/HomePage'));
const SentimentAnalyzerPage = lazy(() => import('./components/SentimentAnalyzerPage'));

// Basic loader component for Suspense fallback
const PageLoader = () => (
  <div className="page-loading-spinner">
    <p>Loading Page...</p>
    {/* You can add an actual CSS spinner animation here */}
  </div>
);

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
        {/* Suspense wraps the Outlet where lazy-loaded components will render */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
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
          {/* These routes will now use the lazy-loaded components */}
          <Route index element={<HomePage />} />
          <Route path="analyze" element={<SentimentAnalyzerPage />} />
          {/* <Route path="about" element={<lazy(() => import('./components/AboutPage')) />} /> */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;