import React, { useState } from 'react';
import axios from 'axios';
import './SentimentAnalyzerPage.css'; // Specific styles for this page

const SentimentAnalyzerPage = () => {
  const [ticker, setTicker] = useState('');
  const [sentimentData, setSentimentData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!ticker.trim()) {
      setError('Please enter a stock ticker.');
      setSentimentData(null);
      return;
    }
    setIsLoading(true);
    setError('');
    setSentimentData(null);
    try {
      // Use the new backend endpoint
      const response = await axios.get(`http://localhost:5000/analyze-ticker?ticker=${ticker.toUpperCase()}`);
      setSentimentData(response.data);
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
      <form onSubmit={handleSubmit} className="ticker-form">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Enter Stock Ticker (e.g., AAPL, MSFT)"
          aria-label="Stock Ticker Input"
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {isLoading && <p className="loading-message">Fetching and analyzing news...</p>}
      {error && <p className="error-message">{error}</p>}

      {sentimentData && (
        <div className="results-container">
          <div className="overall-sentiment-section">
            <h3>Overall Sentiment for {ticker.toUpperCase()}</h3>
            <p className={`sentiment-value ${getSentimentColorClass(sentimentData.score)}`}>
              {sentimentData.sentiment}
              <span className="sentiment-score">(Score: {formatScore(sentimentData.score)})</span>
            </p>
            {sentimentData.details && !sentimentData.analyzed_articles?.length && (
              <p className="details-message"><em>{sentimentData.details}</em></p>
            )}
          </div>

          {sentimentData.analyzed_articles && sentimentData.analyzed_articles.length > 0 && (
            <div className="articles-section">
              <h4>Analyzed News Articles:</h4>
              <ul className="article-list">
                {sentimentData.analyzed_articles.map((article, index) => (
                  <li key={article.url || index} className="article-item">
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