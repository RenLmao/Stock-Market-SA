import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, Filler
} from 'chart.js';
import { format, subDays, subMonths, subYears, startOfYear } from 'date-fns'; // Date manipulation
import 'chartjs-adapter-date-fns'; // Adapter for date/time functionality
import './SentimentAnalyzerPage.css'; // Your custom CSS

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, Filler
);

const MAX_RECENT_SEARCHES = 5;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Define time period options
const PRICE_CHART_PERIODS = [
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: 'YTD', days: 'ytd' },
    { label: '1Y', days: 365 },
    { label: '5Y', days: 365 * 5 },
    // { label: 'Max', days: 'max' }, // FMP default often gives max if no from/to
];

const SentimentAnalyzerPage = () => {
  const [ticker, setTicker] = useState('');
  const [sentimentData, setSentimentData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);

  const [historicalSentiment, setHistoricalSentiment] = useState(null);
  const [historicalPrice, setHistoricalPrice] = useState(null);

  const [activeChart, setActiveChart] = useState('sentiment');
  const [activePricePeriod, setActivePricePeriod] = useState(PRICE_CHART_PERIODS[4]); // Default to 1Y

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
    setHistoricalPrice(null);
    setActiveChart('sentiment');
    setActivePricePeriod(PRICE_CHART_PERIODS[4]); // Reset period to default
  };

  const fetchHistoricalSentiment = async (tickerToFetch) => {
    if (!tickerToFetch) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/historical-sentiment?ticker=${tickerToFetch.toUpperCase()}`);
      setHistoricalSentiment(response.data && response.data.history ? response.data : { ticker: tickerToFetch.toUpperCase(), history: [] });
    } catch (err) {
      console.error("Error fetching historical sentiment:", err);
      setHistoricalSentiment({ ticker: tickerToFetch.toUpperCase(), history: [] });
    }
  };

  const fetchHistoricalPrice = async (tickerToFetch, period = activePricePeriod) => {
    if (!tickerToFetch) return;
    setIsPriceLoading(true);
    setHistoricalPrice(null); // Clear previous price data before new fetch

    const today = new Date();
    const toDateStr = format(today, 'yyyy-MM-dd');
    let fromDateStr;

    if (period.days === 'ytd') {
      fromDateStr = format(startOfYear(today), 'yyyy-MM-dd');
    } else if (period.days === 'max') { // If you add 'max' back
      fromDateStr = null;
    } else {
      fromDateStr = format(subDays(today, period.days), 'yyyy-MM-dd');
    }

    try {
      let url = `${API_BASE_URL}/historical-price?ticker=${tickerToFetch.toUpperCase()}`;
      if (fromDateStr) { // Only add from_date if it's calculated (not null for 'max')
        url += `&from_date=${fromDateStr}`;
      }
      // FMP's to_date is inclusive and usually defaults to latest if not provided.
      // You might want to always include it if specific end date is needed.
      url += `&to_date=${toDateStr}`;

      const response = await axios.get(url);
      console.log(`Fetched FMP price for ${tickerToFetch} (${period.label}):`, response.data);
      if (response.data && response.data.prices) {
        setHistoricalPrice(response.data);
      } else {
        setHistoricalPrice({ ticker: tickerToFetch.toUpperCase(), prices: [], error: response.data?.error || "No price data found." });
      }
    } catch (err) {
      console.error("Error fetching FMP historical price:", err);
      setHistoricalPrice({ ticker: tickerToFetch.toUpperCase(), prices: [], error: err.message || "Failed to fetch price data." });
    } finally {
      setIsPriceLoading(false);
    }
  };

  const handleSubmit = async (event, tickerToAnalyzeOverride = null) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const finalTickerToAnalyze = (tickerToAnalyzeOverride || ticker).trim();

    if (!finalTickerToAnalyze) {
      setError('Please enter a stock ticker.');
      setSentimentData(null); setHistoricalSentiment(null); setHistoricalPrice(null);
      return;
    }

    setIsLoading(true); setError(''); // Global loading for sentiment
    setSentimentData(null); setHistoricalSentiment(null); setHistoricalPrice(null); // Clear all data

    if (tickerToAnalyzeOverride) setTicker(finalTickerToAnalyze);

    let sentimentFetchError = false;
    try {
      const sentimentResponse = await axios.get(`${API_BASE_URL}/analyze-ticker?ticker=${finalTickerToAnalyze.toUpperCase()}`);
      setSentimentData(sentimentResponse.data);
      if (sentimentResponse.data && !sentimentResponse.data.error && !sentimentResponse.data.details?.toLowerCase().includes("api key not configured")) {
         addTickerToRecentSearches(finalTickerToAnalyze);
      }
      // Fetch sentiment history regardless of current sentiment success (as long as it's not an API key error)
      if (!sentimentResponse.data?.details?.toLowerCase().includes("api key not configured")) {
        fetchHistoricalSentiment(finalTickerToAnalyze);
      }
    } catch (err) {
      sentimentFetchError = true;
      console.error("Error fetching sentiment:", err);
      const errorMessage = err.response?.data?.error || (err.request ? 'No response from server.' : 'Error setting up request.');
      setError(errorMessage);
      setSentimentData(null);
      // Still try to fetch sentiment history if the ticker was valid
      fetchHistoricalSentiment(finalTickerToAnalyze);
    } finally {
        // Fetch price data after sentiment attempt.
        // This will also set isPriceLoading and then turn off global isLoading.
        await fetchHistoricalPrice(finalTickerToAnalyze, activePricePeriod);
        setIsLoading(false); // Turn off global loading after all primary data fetches
    }
    // Default to sentiment chart if sentiment data was successfully fetched, otherwise price if price data exists
    if (sentimentData && !sentimentFetchError) {
        setActiveChart('sentiment');
    } else if (historicalPrice && historicalPrice.prices && historicalPrice.prices.length > 0) {
        setActiveChart('price');
    } else {
        setActiveChart('sentiment'); // Default fallback
    }
  };

  const handleRecentSearchClick = (recentTicker) => handleSubmit(null, recentTicker);

  const getSentimentColorClass = (score) => {
    if (score === null || score === undefined) return 'sentiment-neutral';
    if (score > 0.05) return 'sentiment-positive';
    if (score < -0.05) return 'sentiment-negative';
    return 'sentiment-neutral';
  };

  const formatScore = (score) => {
    if (score === null || score === undefined) return 'N/A';
    return score.toFixed(3);
  };

  const sentimentChartData = {
    datasets: [{
        label: `Sentiment Score Trend`,
        data: historicalSentiment?.history?.map(d => ({ x: new Date(d.timestamp), y: d.score })) || [],
        borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.5)',
        showLine: historicalSentiment?.history?.length > 1,
        pointRadius: historicalSentiment?.history?.length === 1 ? 6 : 4,
        tension: 0.1, pointHoverRadius: historicalSentiment?.history?.length === 1 ? 8 : 6,
      }],
  };
  const sentimentChartOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { type: 'time', time: { unit: 'day', tooltipFormat: 'MMM d, yyyy, h:mm a', displayFormats: { minute: 'h:mm a', hour: 'hA', day: 'MMM d'} }, title: { display: true, text: 'Date & Time of Analysis' }, grid: {display: false}},
      y: { min: -1, max: 1, title: { display: true, text: 'Sentiment Score (-1 to +1)' }, ticks: { stepSize: 0.25 }}
    },
    plugins: {
      legend: {display: true, position: 'top'},
      title: { display: true, text: `Historical Sentiment for ${historicalSentiment?.ticker || ticker.toUpperCase() || ''}`, padding: {top:10, bottom:10}, font:{size:16} },
      tooltip: { mode: 'index', intersect: false, callbacks: { title: (items) => items.length ? new Date(items[0].parsed.x).toLocaleString() : '', label: (ctx) => `Score: ${ctx.parsed.y.toFixed(3)}` } }
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false }
  };

  const priceChartData = {
    datasets: [{
        label: `Stock Price (USD)`,
        data: historicalPrice?.prices?.map(d => ({ x: new Date(d.timestamp), y: d.price })) || [],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 1.5,
      }],
  };
  const priceChartOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { type: 'time', time: { unit: 'month', tooltipFormat: 'MMM d, yyyy' }, title: { display: true, text: 'Date' }, grid: {display:false} },
      y: { title: { display: true, text: 'Price (USD)' }, ticks: { callback: value => '$' + value.toFixed(2) } }
    },
    plugins: {
      legend: {display: true, position: 'top'},
      title: { display: true, text: `Historical Price for ${historicalPrice?.ticker || ticker.toUpperCase() || ''} (${activePricePeriod.label})`, padding:{top:10,bottom:10}, font:{size:16} },
      tooltip: { mode: 'index', intersect: false, callbacks: { label: context => `Price: $${context.parsed.y.toFixed(2)}` } }
    },
    interaction: { mode: 'index', axis: 'x', intersect: false }
  };

  const handlePricePeriodChange = (period) => {
    setActivePricePeriod(period);
    if (ticker) {
      fetchHistoricalPrice(ticker, period);
    }
  };

  return (
    <div className="sentiment-analyzer-container">
      <h2 className="page-title">Analyze Stock Ticker Sentiment</h2>
      <div className="form-and-recent-container">
        <form onSubmit={(e) => handleSubmit(e)} className="ticker-form">
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Enter Stock Ticker (e.g., AAPL)"/>
          <button type="submit" disabled={isLoading || isPriceLoading}>
            {(isLoading || isPriceLoading) ? 'Loading...' : 'Analyze'}
          </button>
          {(ticker || sentimentData || error || historicalSentiment || historicalPrice) && (
            <button type="button" onClick={clearResultsAndInput} className="clear-button" title="Clear">Clear</button>
          )}
        </form>
        {recentSearches.length > 0 && (
          <div className="recent-searches-container">
            <strong>Recent:</strong>
            {recentSearches.map((s, i) => <button key={i} onClick={() => handleRecentSearchClick(s)} className="recent-search-item">{s}</button>)}
          </div>
        )}
      </div>

      {(isLoading && !isPriceLoading) && <p className="loading-message">Fetching sentiment & articles...</p>}
      {isPriceLoading && <p className="loading-message">Fetching price history...</p>}
      {error && <p className="error-message">{error}</p>}

      {sentimentData && (
        <div className="results-container current-sentiment-results">
          <div className="overall-sentiment-section">
            <h3>Current Sentiment for {ticker.toUpperCase()}</h3>
            <p className={`sentiment-value ${getSentimentColorClass(sentimentData.score)}`}>
              {sentimentData.sentiment} <span className="sentiment-score">(Score: {formatScore(sentimentData.score)})</span>
            </p>
            {sentimentData.details && (!sentimentData.analyzed_articles || sentimentData.analyzed_articles.length === 0) && (
              <p className="details-message"><em>{sentimentData.details}</em></p>
            )}
          </div>
        </div>
      )}

      {/* Charts Area: Only show if not globally loading AND (some historical data exists OR a ticker has been input) */}
      {!isLoading && !isPriceLoading && (ticker || historicalSentiment?.ticker || historicalPrice?.ticker) && (
        <div className="charts-container">
          <div className="chart-toggle-buttons">
            <button onClick={() => setActiveChart('sentiment')} className={activeChart === 'sentiment' ? 'active' : ''}>Sentiment Trend</button>
            <button onClick={() => setActiveChart('price')} className={activeChart === 'price' ? 'active' : ''}>Price History</button>
          </div>

          {activeChart === 'sentiment' && (
            historicalSentiment?.history?.length > 0 ? (
                <div className="historical-chart-wrapper">
                <div style={{ height: '350px', position: 'relative' }}>
                    <Line options={sentimentChartOptions} data={sentimentChartData} />
                </div>
                {historicalSentiment.history.length === 1 && sentimentData && (
                    <p className="details-message chart-footnote">First sentiment analysis for {historicalSentiment.ticker}. More data builds the trend.</p>
                )}
                </div>
            ) : (
                // Show this message if historicalSentiment object exists (meaning a fetch was attempted) but history is empty
                historicalSentiment && <p className="details-message">No historical sentiment data to display for {historicalSentiment.ticker || ticker.toUpperCase()}.</p>
            )
          )}


          {activeChart === 'price' && (
            <>
              <div className="price-chart-controls">
                {PRICE_CHART_PERIODS.map(period => (
                  <button
                    key={period.label}
                    onClick={() => handlePricePeriodChange(period)}
                    className={activePricePeriod.label === period.label ? 'active' : ''}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
              {/* Note: isPriceLoading is handled globally for the whole chart section,
                  but you could add another specific loading indicator here if desired. */}
              {historicalPrice?.prices?.length > 0 ? (
                <div className="historical-chart-wrapper">
                  <div style={{ height: '350px', position: 'relative' }}>
                    <Line options={priceChartOptions} data={priceChartData} />
                  </div>
                </div>
              ) : (
                // Show error or no data message if historicalPrice object exists (fetch attempted)
                historicalPrice && <p className="details-message">{historicalPrice.error || `No historical price data available for ${historicalPrice.ticker || ticker.toUpperCase()}.`}</p>
              )}
            </>
          )}
        </div>
      )}

      {sentimentData && sentimentData.analyzed_articles && sentimentData.analyzed_articles.length > 0 && (
        <div className="articles-section">
          <h4>Analyzed News Articles (Current):</h4>
          <ul className="article-list">
            {sentimentData.analyzed_articles.map((article, index) => (
              <li key={article.url || index} className="article-item">
                {article.imageUrl && (<div className="article-image-container"><img src={article.imageUrl} alt={article.title || ""} className="article-image"/></div>)}
                <div className="article-content">
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="article-title">{article.title || "Untitled"}</a>
                  <div className="article-meta">
                    <span className="article-source">{article.source || 'N/A'}</span> | <span className="article-date">{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <p className={`article-sentiment-score ${getSentimentColorClass(article.sentiment_score)}`}>
                    Article Score: {formatScore(article.sentiment_score)}
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