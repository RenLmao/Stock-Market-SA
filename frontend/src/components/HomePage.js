import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HomePage.css'; // Specific styles for HomePage

const HomePage = () => {
  const [generalNews, setGeneralNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGeneralNews = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await axios.get('http://localhost:5000/general-news');
        setGeneralNews(response.data.articles || []);
      } catch (err) {
        console.error("Error fetching general news:", err);
        setError(err.response?.data?.error || 'Could not fetch general news. Is the backend server running?');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGeneralNews();
  }, []);

  const getSentimentColor = (score) => {
    if (score > 0.05) return 'positive-sentiment';
    if (score < -0.05) return 'negative-sentiment';
    return 'neutral-sentiment';
  };

  return (
    <div className="home-page">
      <h2 className="page-title">Latest Business & Market News</h2>
      {isLoading && <p className="loading-message">Loading news...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && generalNews.length === 0 && (
        <p className="no-news-message">No news articles found at the moment. Try again later.</p>
      )}

      {!isLoading && !error && generalNews.length > 0 && (
        <div className="news-grid">
          {generalNews.map((article, index) => (
            <div key={article.url || index} className="news-card"> {/* Use URL as key if available */}
              {article.imageUrl && (
                <div className="news-image-container">
                  <img src={article.imageUrl} alt={article.title || 'News image'} className="news-image" />
                </div>
              )}
              <div className="news-content">
                <h3>
                  <a href={article.url} target="_blank" rel="noopener noreferrer">
                    {article.title}
                  </a>
                </h3>
                <p className="news-description">{article.description || "No description available."}</p>
                <div className="news-footer">
                  <span className="news-source">{article.source || 'N/A'}</span>
                  <span className="news-date">
                    {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'N/A'}
                  </span>
                  {article.sentiment_score !== undefined && (
                     <span className={`news-sentiment-label ${getSentimentColor(article.sentiment_score)}`}>
                       {article.sentiment_label} ({article.sentiment_score.toFixed(2)})
                     </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;