import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale // Import TimeScale for time-based x-axis
} from 'chart.js';
import 'chartjs-adapter-date-fns'; // Adapter for date/time functionality
import './SentimentAnalyzerPage.css'; // Your custom CSS

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const MAX_RECENT_SEARCHES = 5;

const SentimentAnalyzerPage = () => {
  const [ticker, setTicker] = useState('');
  const [sentimentData, setSentimentData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [historicalSentiment, setHistoricalSentiment] = useState(null); // Stores { ticker: 'XYZ', history: [...] }

  useEffect(() => {
    const storedSearches = localStorage.getItem('recentStockSearches');
    if (storedSearches) {
      try {
        const parsedSearches = JSON.parse(storedSearches);
        if (Array.isArray(parsedSearches)) {
          setRecentSearches(parsedSearches);
        }
      } catch (e) {
        console.error("Error parsing recent searches from localStorage", e);
        localStorage.removeItem('recentStockSearches');
      }
    }
  }, []);

  const addTickerToRecentSearches = (searchedTicker) => {
    const upperCaseTicker = searchedTicker.toUpperCase();
    const updatedSearches = [upperCaseTicker, ...recentSearches.filter(t => t !== upperCaseTicker)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentStockSearches', JSON.stringify(updatedSearches));
  };

  const clearResultsAndInput = () => {
    setTicker('');
    setSentimentData(null);
    setError('');
    setHistoricalSentiment(null);
  };

  const fetchHistoricalSentiment = async (tickerToFetch) => {
    if (!tickerToFetch) return;
    try {
      // Use process.env.REACT_APP_API_BASE_URL for deployed environments
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/historical-sentiment?ticker=${tickerToFetch.toUpperCase()}`);
      console.log("Fetched historical data:", response.data);
      if (response.data && response.data.history) {
        setHistoricalSentiment(response.data);
      } else {
        setHistoricalSentiment({ ticker: tickerToFetch.toUpperCase(), history: [] });
      }
    } catch (err) {
      console.error("Error fetching historical sentiment:", err);
      setHistoricalSentiment({ ticker: tickerToFetch.toUpperCase(), history: [] });
    }
  };

  const handleSubmit = async (event, tickerToAnalyzeOverride = null) => {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    const finalTickerToAnalyze = (tickerToAnalyzeOverride || ticker).trim();
    if (!finalTickerToAnalyze) {
      setError('Please enter a stock ticker.');
      setSentimentData(null);
      setHistoricalSentiment(null); // Clear historical on empty submit
      return;
    }

    setIsLoading(true);
    setError('');
    setSentimentData(null);
    setHistoricalSentiment(null); // Clear previous historical data before new search

    if (tickerToAnalyzeOverride) {
        setTicker(finalTickerToAnalyze); // Update input field if called programmatically
    }

    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/analyze-ticker?ticker=${finalTickerToAnalyze.toUpperCase()}`);
      setSentimentData(response.data);

      const hasError = response.data?.error;
      const hasDetailsError = response.data?.details?.toLowerCase().includes("no news articles found") || response.data?.details?.toLowerCase().includes("api key not configured");

      // Add to recent searches if it was a valid ticker attempt (even if no news found, but not on API key error)
      if (!hasError && !response.data?.details?.toLowerCase().includes("api key not configured")) {
         addTickerToRecentSearches(finalTickerToAnalyze);
      }

      // Always attempt to fetch historical data
      fetchHistoricalSentiment(finalTickerToAnalyze);

    } catch (err) {
      console.error("Error fetching sentiment:", err);
      const errorMessage = err.response?.data?.error ||
                           (err.request ? 'No response from server. Is the backend running?' : 'Error setting up request.');
      setError(errorMessage);
      setSentimentData(null);
      // Attempt to fetch historical data even on error for the current ticker, to show past trends if available
      fetchHistoricalSentiment(finalTickerToAnalyze);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecentSearchClick = (recentTicker) => {
    handleSubmit(null, recentTicker);
  };

  const getSentimentColorClass = (score) => {
    if (score === null || score === undefined) return 'sentiment-neutral';
    if (score > 0.05) return 'sentiment-positive';
    if (score < -0.05) return 'sentiment-negative';
    return 'sentiment-neutral';
  };

  const formatScore = (score) => {
    if (score === null || score === undefined) return 'N/A';
    return score.toFixed(3);
  }

  // Prepare data for the chart
  const chartData = {
    datasets: [
      {
        label: `Sentiment Score Trend`, // Simpler label
        data: historicalSentiment?.history?.map(d => ({ x: new Date(d.timestamp), y: d.score })) || [],
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
        pointRadius: historicalSentiment?.history?.length === 1 ? 6 : 4, // Make single point more prominent
        pointHoverRadius: historicalSentiment?.history?.length === 1 ? 8 : 6,
        showLine: historicalSentiment?.history?.length > 1, // Only show line if more than one point
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day', // Let Chart.js auto-detect best unit, or set dynamically
          tooltipFormat: 'MMM d, yyyy, h:mm a', // e.g. May 27, 2023, 10:30 AM
          displayFormats: {
            millisecond: 'h:mm:ss.SSS a',
            second: 'h:mm:ss a',
            minute: 'h:mm a',
            hour: 'hA', // e.g. 10AM
            day: 'MMM d', // e.g. May 27
            week: 'MMM d, yyyy',
            month: 'MMM yyyy',
            quarter: 'QQQ yyyy',
            year: 'yyyy',
          }
        },
        title: { display: true, text: 'Date & Time of Analysis' },
        grid: { display: false }
      },
      y: {
        min: -1, max: 1,
        title: { display: true, text: 'Sentiment Score (-1 to +1)' },
        ticks: { stepSize: 0.25 }
      },
    },
    plugins: {
      legend: { display: true, position: 'top' },
      title: {
        display: true,
        text: `Historical Sentiment for ${historicalSentiment?.ticker || ticker.toUpperCase() || ''}`,
        padding: { top: 10, bottom: 10 },
        font: { size: 16 }
       },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
            title: function(tooltipItems) { // Custom title for tooltip
                if (tooltipItems.length > 0) {
                    const date = new Date(tooltipItems[0].parsed.x);
                    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString();
                }
                return '';
            },
            label: function(context) {
                let label = context.dataset.label || 'Score';
                if (label.includes("Trend")) label = "Score"; // Cleaner label in tooltip

                if (context.parsed.y !== null) {
                    label += ': ' + context.parsed.y.toFixed(3);
                }
                return label;
            }
        }
      }
    },
    interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
    }
  };

  return (
    <div className="sentiment-analyzer-container">
      <h2 className="page-title">Analyze Stock Ticker Sentiment</h2>
      <div className="form-and-recent-container">
        <form onSubmit={(e) => handleSubmit(e)} className="ticker-form">
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
          {(ticker || sentimentData || error || (historicalSentiment && historicalSentiment.history.length > 0) ) && (
            <button type="button" onClick={clearResultsAndInput} className="clear-button" title="Clear input and results">
              Clear
            </button>
          )}
        </form>
        {recentSearches.length > 0 && (
          <div className="recent-searches-container">
            <strong>Recent:</strong>
            {recentSearches.map((search, index) => (
              <button key={index} onClick={() => handleRecentSearchClick(search)} className="recent-search-item" title={`Analyze ${search}`}>
                {search}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && <p className="loading-message">Fetching and analyzing news...</p>}
      {error && <p className="error-message">{error}</p>}

      {/* Current Sentiment Display */}
      {sentimentData && (
        <div className="results-container current-sentiment-results">
          <div className="overall-sentiment-section">
            <h3>Current Sentiment for {ticker.toUpperCase()}</h3>
            <p className={`sentiment-value ${getSentimentColorClass(sentimentData.score)}`}>
              {sentimentData.sentiment}
              <span className="sentiment-score">(Score: {formatScore(sentimentData.score)})</span>
            </p>
            {sentimentData.details && (!sentimentData.analyzed_articles || sentimentData.analyzed_articles.length === 0) && (
              <p className="details-message"><em>{sentimentData.details}</em></p>
            )}
          </div>
        </div>
      )}

      {/* Historical Sentiment Chart Area - Renders if history array has at least one point */}
      {!isLoading && historicalSentiment && historicalSentiment.history && historicalSentiment.history.length > 0 && (
        <div className="historical-chart-container">
          {/* Title is now part of chartOptions.plugins.title */}
          <div style={{ height: '350px', position: 'relative' }}>
            <Line options={chartOptions} data={chartData} />
          </div>
          {historicalSentiment.history.length === 1 && sentimentData && ( // Show message only if current sentiment is also displayed
            <p className="details-message chart-footnote">
              This is the first sentiment analysis for {historicalSentiment.ticker}. More data points will build a trend over time.
            </p>
          )}
        </div>
      )}
      {/* Message if explicitly searched but no historical data (e.g., history is empty array) AND current analysis happened */}
      {!isLoading && historicalSentiment && historicalSentiment.history && historicalSentiment.history.length === 0 && sentimentData && (
        <p className="details-message">
          No historical sentiment data yet for {historicalSentiment.ticker}. This is the first analysis.
        </p>
      )}

      {/* Analyzed Articles Display (from current sentiment analysis) */}
      {sentimentData && sentimentData.analyzed_articles && sentimentData.analyzed_articles.length > 0 && (
        <div className="articles-section">
          <h4>Analyzed News Articles (Current):</h4>
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
  );
};

export default SentimentAnalyzerPage;