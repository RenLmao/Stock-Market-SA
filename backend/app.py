import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_caching import Cache
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import pathlib
import json

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Cache Configuration ---
BASE_DIR = pathlib.Path(__file__).resolve().parent
CACHE_DIR = BASE_DIR / "flask_cache"
if not CACHE_DIR.exists():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    # print(f"Created cache directory: {CACHE_DIR}") # Less verbose for normal runs
cache_config = {
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": str(CACHE_DIR),
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_THRESHOLD": 500
}
app.config.from_mapping(cache_config)
cache = Cache(app)
# --- End Cache Configuration ---

# --- API Configuration ---
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
NEWS_API_EVERYTHING_URL = 'https://newsapi.org/v2/everything'
NEWS_API_TOP_HEADLINES_URL = 'https://newsapi.org/v2/top-headlines'

FMP_API_KEY = os.getenv('FMP_API_KEY')  # New Key for FMP
FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3'
# --- End API Configuration ---

# --- Historical Data Storage (Sentiment) ---
HISTORICAL_DATA_FILE = BASE_DIR / "historical_sentiment_data.json"


def load_historical_data():
    # print("LOG (load_historical_data): Attempting to load ...") # Less verbose
    if HISTORICAL_DATA_FILE.exists():
        try:
            with open(HISTORICAL_DATA_FILE, 'r') as f:
                content = f.read()
                if not content: return {}
                data = json.loads(content)
                if not isinstance(data, dict): return {}
                for ticker_key in data:
                    if not isinstance(data[ticker_key], list): data[ticker_key] = []
                return data
        except Exception:
            return {}  # Catch all for robust load
    return {}


def save_historical_data(data):
    try:
        with open(HISTORICAL_DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        # print("LOG (save_historical_data): Historical data saved.") # Less verbose
    except Exception as e:
        print(f"Error (save_historical_data): {e}")


def add_historical_sentiment(ticker, score):
    data = load_historical_data()
    ticker_upper = ticker.upper()
    if ticker_upper not in data or not isinstance(data[ticker_upper], list):
        data[ticker_upper] = []
    timestamp = datetime.now(timezone.utc).isoformat()
    new_entry = {"timestamp": timestamp, "score": score}
    data[ticker_upper].append(new_entry)
    max_entries_per_ticker = 30
    if len(data[ticker_upper]) > max_entries_per_ticker:
        data[ticker_upper] = data[ticker_upper][-max_entries_per_ticker:]
    save_historical_data(data)


# --- End Historical Data Storage ---

# Initialize VADER
try:
    analyzer = SentimentIntensityAnalyzer()
except LookupError:
    import nltk

    nltk.download('vader_lexicon');
    nltk.download('punkt')
    analyzer = SentimentIntensityAnalyzer()


def format_newsapi_article(article_raw):  # Same as before
    source_info = article_raw.get('source', {});
    return {
        'title': article_raw.get('title'), 'description': article_raw.get('description'),
        'url': article_raw.get('url'), 'imageUrl': article_raw.get('urlToImage'),
        'publishedAt': article_raw.get('publishedAt'), 'source': source_info.get('name') if source_info else None
    }


def fetch_stock_news_from_newsapi(ticker_symbol):  # Same as before
    if not NEWS_API_KEY: return {"error": "News API key not configured.", "articles": []}
    from_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    params = {'q': ticker_symbol, 'apiKey': NEWS_API_KEY, 'language': 'en', 'sortBy': 'relevance', 'pageSize': 20,
              'from': from_date}
    try:
        response = requests.get(NEWS_API_EVERYTHING_URL, params=params)
        response.raise_for_status();
        news_data = response.json()
        articles_raw = news_data.get('articles', [])
        return {"articles": [format_newsapi_article(article) for article in articles_raw]}
    except Exception as e:
        return {"error": f"News fetch error: {str(e)}", "articles": []}


def analyze_sentiment_for_articles(articles):  # Same as before
    if not articles: return {"sentiment": "neutral", "score": 0, "details": "No articles.", "analyzed_articles": []}
    compound_scores = [];
    analyzed_articles_details = []
    for article in articles:
        title = article.get('title', '');
        description = article.get('description', '')
        content_to_analyze = f"{title}. {description if description else ''}"
        if not content_to_analyze.strip() or content_to_analyze.strip() == ".": continue
        vs = analyzer.polarity_scores(content_to_analyze);
        compound_scores.append(vs['compound'])
        analyzed_articles_details.append({
            "title": title, "url": article.get('url'), "source": article.get('source'),
            "publishedAt": article.get('publishedAt'), "imageUrl": article.get('imageUrl'),
            "sentiment_score": vs['compound']
        })
    if not compound_scores: return {"sentiment": "neutral", "score": 0, "details": "No analyzable content.",
                                    "analyzed_articles": []}
    avg_score = sum(compound_scores) / len(compound_scores)
    sentiment = "neutral";
    if avg_score >= 0.05:
        sentiment = "positive"
    elif avg_score <= -0.05:
        sentiment = "negative"
    return {"sentiment": sentiment, "score": avg_score, "analyzed_articles": analyzed_articles_details[:10]}


@app.route('/analyze-ticker', methods=['GET'])
# @cache.cached(timeout=900, query_string=True) # Keep commented for easier history debugging for now
def analyze_stock_sentiment_route():
    ticker = request.args.get('ticker')
    if not ticker: return jsonify({"error": "Ticker symbol is required"}), 400
    print(f"LOG: Executing /analyze-ticker for ticker={ticker.upper()}.")
    news_response = fetch_stock_news_from_newsapi(ticker)
    if "error" in news_response or not news_response.get("articles"):
        error_detail = news_response.get("error", f"No news articles found for {ticker}.")
        return jsonify({"sentiment": "neutral", "score": 0, "details": error_detail, "analyzed_articles": []}), 200
    sentiment_result = analyze_sentiment_for_articles(news_response["articles"])
    if "score" in sentiment_result and sentiment_result.get("analyzed_articles"):
        try:
            add_historical_sentiment(ticker, sentiment_result["score"])
        except Exception as e:
            print(f"Error adding historical sentiment: {e}")
    return jsonify(sentiment_result)


@app.route('/historical-sentiment', methods=['GET'])  # Same as before
def get_historical_sentiment_route():
    ticker = request.args.get('ticker')
    if not ticker: return jsonify({"error": "Ticker symbol is required"}), 400
    data = load_historical_data();
    ticker_upper = ticker.upper()
    historical_scores = data.get(ticker_upper, [])
    print(
        f"LOG (/historical-sentiment): Returning {len(historical_scores)} historical sentiment points for {ticker_upper}")
    return jsonify({"ticker": ticker_upper, "history": historical_scores})


def fetch_historical_price_data_fmp(ticker_symbol, from_date_str=None, to_date_str=None):  # Added from/to
    if not FMP_API_KEY:
        print("CRITICAL: FMP API key not configured in backend/.env")
        return {"error": "Price data API key not configured. Please see README.md."}

    endpoint = f"{FMP_BASE_URL}/historical-price-full/{ticker_symbol.upper()}"
    params = {"apikey": FMP_API_KEY}

    if from_date_str:
        params["from"] = from_date_str
    if to_date_str:  # FMP usually includes the 'to' date
        params["to"] = to_date_str

    # If no range is given, FMP /historical-price-full/ usually returns a lot of data.
    # We could default to a year if no range provided, e.g.:
    # if not from_date_str and not to_date_str:
    #     params["from"] = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
    #     params["to"] = datetime.now().strftime('%Y-%m-%d')

    try:
        print(f"LOG (fetch_price_data_fmp): Fetching FMP price for {ticker_symbol} with params: {params}")
        response = requests.get(endpoint, params=params)
        response.raise_for_status()
        data = response.json()

        if isinstance(data, dict) and "Error Message" in data:
            print(f"Error from FMP API: {data['Error Message']}")
            return {"error": data['Error Message']}
        if not data or (isinstance(data, dict) and not data.get("historical")):
            print(f"No FMP historical price data for {ticker_symbol}. Params: {params}")
            return {"error": "No historical price data found from FMP for the given parameters."}

        price_data_raw = data.get("historical", [])
        prices = []
        for daily_data in price_data_raw:
            try:
                date_str = daily_data.get('date')
                close_price = float(daily_data.get('close'))
                if date_str and close_price is not None:
                    prices.append({"timestamp": date_str, "price": close_price})
            except Exception:
                continue

        print(f"LOG (fetch_price_data_fmp): Parsed {len(prices)} price points for {ticker_symbol}")
        return {"prices": prices}
    except requests.exceptions.HTTPError as http_err:  # ...
        error_content = http_err.response.text if http_err.response else "No response content"
        print(f"HTTP error (fetch_price_data_fmp): {http_err} for {ticker_symbol}. Response: {error_content}")
        return {"error": f"Price API request failed: {str(http_err)}"}
    except requests.exceptions.RequestException as e:  # ...
        print(f"RequestException (fetch_price_data_fmp): {e} for {ticker_symbol}")
        return {"error": f"Could not fetch price data: {str(e)}"}
    except ValueError as json_err:  # ...
        error_content = response.text if 'response' in locals() else "No response object"
        print(f"JSON decode error (fetch_price_data_fmp): {json_err} for {ticker_symbol}. Response: {error_content}")
        return {"error": "Invalid response format from price API."}
    except Exception as e:  # ...
        print(f"Unexpected error (fetch_price_data_fmp): {e} for {ticker_symbol}")
        return {"error": "An unexpected server error occurred during price data fetch."}


@app.route('/historical-price', methods=['GET'])
@cache.cached(timeout=3600 * 4, query_string=True)  # Cache for 4 hours
def get_historical_price_route():
    ticker = request.args.get('ticker')
    from_date = request.args.get('from_date')  # Expect YYYY-MM-DD
    to_date = request.args.get('to_date')  # Expect YYYY-MM-DD (defaults to today if not provided by FMP)

    if not ticker:
        return jsonify({"error": "Ticker symbol is required"}), 400

    print(
        f"LOG: Executing /historical-price for ticker={ticker.upper()}, from={from_date}, to={to_date} (cache miss or expired).")
    # Pass from_date and to_date to the fetch function
    price_data_response = fetch_historical_price_data_fmp(ticker, from_date_str=from_date, to_date_str=to_date)

    if "error" in price_data_response:
        return jsonify({"ticker": ticker.upper(), "error": price_data_response["error"], "prices": []}), 200

    return jsonify({"ticker": ticker.upper(), "prices": price_data_response.get("prices", [])})

@app.route('/general-news', methods=['GET'])  # Same as before
@cache.cached(timeout=1800)
def get_general_news_route():
    if not NEWS_API_KEY: return jsonify({"error": "News API key not configured.", "articles": []}), 500
    print(f"LOG: Executing /general-news (cache miss or expired).")
    params = {'apiKey': NEWS_API_KEY, 'category': 'business', 'country': 'us', 'pageSize': 15}
    try:
        response = requests.get(NEWS_API_TOP_HEADLINES_URL, params=params)
        response.raise_for_status();
        news_data = response.json()
        articles_raw = news_data.get('articles', []);
        processed_articles = []
        for article_raw in articles_raw:
            formatted_article = format_newsapi_article(article_raw)
            title = formatted_article.get('title', '');
            description = formatted_article.get('description', '')
            content_to_analyze = f"{title}. {description if description else ''}"
            sentiment_score = 0.0;
            sentiment_label = "neutral"
            if content_to_analyze.strip() and content_to_analyze.strip() != ".":
                vs = analyzer.polarity_scores(content_to_analyze);
                sentiment_score = vs['compound']
                if sentiment_score >= 0.05:
                    sentiment_label = "positive"
                elif sentiment_score <= -0.05:
                    sentiment_label = "negative"
            formatted_article['sentiment_score'] = sentiment_score
            formatted_article['sentiment_label'] = sentiment_label
            processed_articles.append(formatted_article)
        return jsonify({"articles": processed_articles})
    except Exception as e:
        return jsonify({"error": f"General news fetch error: {str(e)}", "articles": []}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False)  # use_reloader=False for stable file I/O debugging