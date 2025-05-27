import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SentimentAnalyzerPage.css';

const MAX_RECENT_SEARCHES = 5; // Display up to 5 recent searches

const SentimentAnalyzerPage = () => {
  const [ticker, setTicker] = useState('');
  const [sentimentData, setSentimentData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);

  // Load recent searches from localStorage on component mount
  useEffect(() => {
    const storedSearches = localStorage.getItem('recentStockSearches');
    if (storedSearches) {
      setRecentSearches(JSON.parse(storedSearches));
    }
  }, []);

  const addTickerToRecentSearches = (searchedTicker) => {
    const upperCaseTicker = searchedTicker.toUpperCase();
    // Add to front, remove duplicates, and limit length
    const updatedSearches = [upperCaseTicker, ...recentSearches.filter(t => t !== upperCaseTicker)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentStockSearches', JSON.stringify(updatedSearches));
  };

  const handleRecentSearchClick = (recentTicker) => {
    setTicker(recentTicker); // Set the input field
    // Optionally, you could directly trigger handleSubmit here:
    // handleSubmit(new Event('submit'), recentTicker); // Or pass recentTicker directly
  };

  const clearResultsAndInput = () => {
    setTicker('');
    setSentimentData(null);
    setError('');
  };


  const handleSubmit = async (event, tickerToAnalyze = ticker) => {
    if (event) event.preventDefault(); // Prevent default if called by form submission

    const finalTicker = tickerToAnalyze.trim();
    if (!finalTicker) {
      setError('Please enter a stock ticker.');
      setSentimentData(null);
      return;
    }

    setIsLoading(true);
    setError('');
    setSentimentData(null);

    try {
      const response = await axios.get(`http://localhost:5000/analyze-ticker?ticker=${finalTicker.toUpperCase()}`);
      setSentimentData(response.data);
      if (response.data && !response.data.error) { // Add to recent only on success
          addTickerToRecentSearches(finalTicker);
      }
    } catch (err) {
      console.error("Error fetching sentiment:", err);
      const errorMessage = err.response?.data?.error ||
                           (err.request ? 'No response from server. Is the backend running?' : 'Error setting up request.');
      setError(errorMessage);
      setSentimentData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getSentimentColorClass = (score) => {
    if (score > 0.05) return 'sentiment-positive';
    if (score < -0.05) return 'sentiment-negative';
    return 'sentiment-neutral';
  };

  const formatScore = (score) => score.toFixed(3);

  return (
    <div className="sentiment-analyzer-container">
      <h2 className="page-title">Analyze Stock Ticker Sentiment</h2>

      <div className="form-and-recent-container"> {/* New wrapper */}
        <form onSubmit={handleSubmit} className="ticker-form">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Enter Stock Ticker (e.g., AAPL)"
            aria-label="Stock Ticker Input"
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
          {/* Clear Button */}
          {(ticker || sentimentData || error) && ( // Show button if there's something to clear
            <button type="button" onClick={clearResultsAndInput} className="clear-button" title="Clear input and results">
              Clear
            </button>
          )}
        </form>

        {recentSearches.length > 0 && (
          <div className="recent-searches-container">
            <strong>Recent:</strong>
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => handleRecentSearchClick(search)}
                className="recent-search-item"
                title={`Analyze ${search}`}
              >
                {search}
              </button>
            ))}
          </div>
        )}
      </div>


      {isLoading && <p className="loading-message">Fetching and analyzing news...</p>}
      {error && <p className="error-message">{error}</p>}

      {sentimentData && (
        // ... (results display remains the same) ...
        <div className="results-container">
          <div className="overall-sentiment-section">
            <h3>Overall Sentiment for {sentimentData.analyzed_articles && sentimentData.analyzed_articles.length > 0 ? ticker.toUpperCase() : ticker.toUpperCase()}</h3>
            <p className={`sentiment-value ${getSentimentColorClass(sentimentData.score)}`}>
              {sentimentData.sentiment}
              <span className="sentiment-score">(Score: {formatScore(sentimentData.score)})</span>
            </p>
            {sentimentData.details && (!sentimentData.analyzed_articles || sentimentData.analyzed_articles.length === 0) && (
              <p className="details-message"><em>{sentimentData.details}</em></p>
            )}
          </div>

          {sentimentData.analyzed_articles && sentimentData.analyzed_articles.length > 0 && (
            <div className="articles-section">
              <h4>Analyzed News Articles:</h4>
              <ul className="article-list">
                {sentimentData.analyzed_articles.map((article, index) => (
                  <li key={article.url || index} className="article-item">
                    {article.imageUrl && (
                        <div className="article-image-container">
                            <img src={article.imageUrl} alt={article.title || 'Article image'} className="article-image" />
                        </div>
                    )}
                    <div className="article-content">
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="article-title">
                        {article.title || "Untitled Article"}
                        </a>
                        <div className="article-meta">
                        <span className="article-source">{article.source || 'N/A'}</span>
                        <span className="article-date">
                            {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'N/A'}
                        </span>
                        </div>
                        <p className={`article-sentiment-score ${getSentimentColorClass(article.sentiment_score)}`}>
                        Article Sentiment: {formatScore(article.sentiment_score)}
                        </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SentimentAnalyzerPage;