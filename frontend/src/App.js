import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link, Outlet } from 'react-router-dom';
import './App.css';
import HomePage from './components/HomePage';
import SentimentAnalyzerPage from './components/SentimentAnalyzerPage';

// Layout component: Renders the common structure (Header, Footer)
// and an <Outlet /> for child routes to render their content into.
function AppLayout() {
  return (
    <div className="App">
      <header className="App-header">
        <Link to="/" className="logo-title-link">
          <h1>Stock Sentiment Analyzer</h1>
        </Link>
        <nav>
          {/* Use NavLink for active styling */}
          <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>Home</NavLink>
          <NavLink to="/analyze" className={({ isActive }) => isActive ? "active" : ""}>Analyze Ticker</NavLink>
          {/* Add more NavLinks here for future pages */}
        </nav>
      </header>
      <main>
        <Outlet /> {/* Child route components will be rendered here */}
      </main>
      <footer className="App-footer">
        <p>© {new Date().getFullYear()} Stock Sentiment Analyzer. For educational purposes only. Not financial advice.</p>
      </footer>
    </div>
  );
}

// Main App component that defines the routing structure
function App() {
  return (
    <Router>
      <Routes>
        {/* Route for the layout itself */}
        <Route path="/" element={<AppLayout />}>
          {/* Child routes that render within AppLayout's <Outlet /> */}
          <Route index element={<HomePage />} /> {/* 'index' makes this the default for '/' */}
          <Route path="analyze" element={<SentimentAnalyzerPage />} />
          {/* Example of another potential page:
          <Route path="about" element={<AboutPage />} /> */}
        </Route>
        {/* You could have other top-level routes here that don't use AppLayout
            e.g., <Route path="/login" element={<LoginPage />} />
        */}
      </Routes>
    </Router>
  );
}

export default App;