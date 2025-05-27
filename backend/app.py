import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_caching import Cache
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone  # Added timezone
import pathlib
import json  # For JSON file storage

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Cache Configuration ---
BASE_DIR = pathlib.Path(__file__).resolve().parent
CACHE_DIR = BASE_DIR / "flask_cache"

if not CACHE_DIR.exists():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Created cache directory: {CACHE_DIR}")

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
# --- End API Configuration ---

# --- Historical Data Storage ---
HISTORICAL_DATA_FILE = BASE_DIR / "historical_sentiment_data.json"


def load_historical_data():
    if HISTORICAL_DATA_FILE.exists():
        try:
            with open(HISTORICAL_DATA_FILE, 'r') as f:
                # Handle empty file case
                content = f.read()
                if not content:
                    return {}
                return json.loads(content)
        except json.JSONDecodeError:
            print(f"Warning: Could not decode JSON from {HISTORICAL_DATA_FILE}. Starting fresh.")
            return {}
    return {}


def save_historical_data(data):
    try:
        with open(HISTORICAL_DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except IOError as e:
        print(f"Error saving historical data: {e}")


def add_historical_sentiment(ticker, score):
    data = load_historical_data()
    ticker_upper = ticker.upper()  # Ensure consistent casing for keys
    if ticker_upper not in data:
        data[ticker_upper] = []

    timestamp = datetime.now(timezone.utc).isoformat()

    data[ticker_upper].append({"timestamp": timestamp, "score": score})

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

    print("Downloading NLTK resources (VADER lexicon, Punkt)...")
    nltk.download('vader_lexicon')
    nltk.download('punkt')
    analyzer = SentimentIntensityAnalyzer()


def format_newsapi_article(article_raw):
    source_info = article_raw.get('source', {})
    return {
        'title': article_raw.get('title'),
        'description': article_raw.get('description'),
        'url': article_raw.get('url'),
        'imageUrl': article_raw.get('urlToImage'),
        'publishedAt': article_raw.get('publishedAt'),
        'source': source_info.get('name') if source_info else None
    }


def fetch_stock_news_from_newsapi(ticker_symbol):
    if not NEWS_API_KEY:
        print("Error: NewsAPI.org API key not configured.")
        return {"error": "API key not configured", "articles": []}
    from_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    params = {
        'q': ticker_symbol,
        'apiKey': NEWS_API_KEY,
        'language': 'en',
        'sortBy': 'relevance',  # 'relevance' might be better for specific tickers
        'pageSize': 20,
        'from': from_date
    }
    try:
        print(f"Fetching NewsAPI.org stock news for {ticker_symbol} with params: {params}")
        response = requests.get(NEWS_API_EVERYTHING_URL, params=params)
        response.raise_for_status()
        news_data = response.json()

        articles_raw = news_data.get('articles', [])
        formatted_articles = [format_newsapi_article(article) for article in articles_raw]
        print(f"NewsAPI.org Meta for {ticker_symbol}: TotalResults={news_data.get('totalResults')}")
        print(f"Number of raw articles received from NewsAPI.org for {ticker_symbol}: {len(articles_raw)}")
        return {"articles": formatted_articles}
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error fetching stock news for {ticker_symbol} from NewsAPI.org: {http_err}")
        print(f"Response content: {response.text}")
        return {"error": f"API request failed: {str(http_err)}", "articles": []}
    except requests.exceptions.RequestException as e:
        print(f"Error fetching stock news for {ticker_symbol} from NewsAPI.org: {e}")
        return {"error": f"Could not fetch news: {str(e)}", "articles": []}
    except ValueError as json_err:
        print(f"JSON decode error for {ticker_symbol} from NewsAPI.org: {json_err}")
        print(f"Response content: {response.text}")  # Log if response is not JSON
        return {"error": "Invalid response format from news API.", "articles": []}
    except Exception as e:
        print(f"An unexpected error occurred fetching NewsAPI.org stock news: {e}")
        return {"error": "An unexpected server error occurred during news fetch.", "articles": []}


def analyze_sentiment_for_articles(articles):
    if not articles:
        return {"sentiment": "neutral", "score": 0, "details": "No articles provided for analysis.",
                "analyzed_articles": []}
    compound_scores = []
    analyzed_articles_details = []
    for article in articles:
        title = article.get('title', '')
        description = article.get('description', '')
        content_to_analyze = f"{title}. {description if description else ''}"
        if not content_to_analyze.strip() or content_to_analyze.strip() == ".":
            continue
        vs = analyzer.polarity_scores(content_to_analyze)
        compound_scores.append(vs['compound'])
        # Pass through imageUrl for frontend display
        analyzed_articles_details.append({
            "title": title, "url": article.get('url'), "source": article.get('source'),
            "publishedAt": article.get('publishedAt'), "imageUrl": article.get('imageUrl'),
            "sentiment_score": vs['compound']
        })
    if not compound_scores:
        return {"sentiment": "neutral", "score": 0, "details": "No analyzable content in articles.",
                "analyzed_articles": analyzed_articles_details}
    average_compound_score = sum(compound_scores) / len(compound_scores)
    overall_sentiment = "neutral"
    if average_compound_score >= 0.05:
        overall_sentiment = "positive"
    elif average_compound_score <= -0.05:
        overall_sentiment = "negative"
    return {
        "sentiment": overall_sentiment, "score": average_compound_score,
        "analyzed_articles": analyzed_articles_details[:10]  # Limit to 10 articles for display
    }


@app.route('/analyze-ticker', methods=['GET'])
@cache.cached(timeout=900, query_string=True)
def analyze_stock_sentiment_route():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "Ticker symbol is required"}), 400

    # Note: The print log for cache miss is part of the cached function,
    # so it only prints when the function body is executed (i.e., on a cache miss).
    print(f"LOG: Executing /analyze-ticker for ticker={ticker.upper()} (cache miss or expired).")

    news_response = fetch_stock_news_from_newsapi(ticker)

    if "error" in news_response or not news_response.get("articles"):
        error_detail = news_response.get("error", f"No news articles found for {ticker}.")
        # Still try to add a historical entry even if no news, to show "neutral" attempt?
        # For now, only add if we get articles and a score.
        return jsonify({
            "sentiment": "neutral", "score": 0,
            "details": error_detail, "analyzed_articles": []
        }), 200

    sentiment_result = analyze_sentiment_for_articles(news_response["articles"])

    if "score" in sentiment_result and news_response.get("articles"):  # Only add if actual analysis happened
        try:
            add_historical_sentiment(ticker, sentiment_result["score"])
        except Exception as e:
            print(f"Error adding to historical data for {ticker.upper()}: {e}")

    return jsonify(sentiment_result)


@app.route('/historical-sentiment', methods=['GET'])
def get_historical_sentiment_route():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "Ticker symbol is required"}), 400

    data = load_historical_data()
    historical_scores = data.get(ticker.upper(), [])  # Use .upper() for consistency
    return jsonify({"ticker": ticker.upper(), "history": historical_scores})


@app.route('/general-news', methods=['GET'])
@cache.cached(timeout=1800)
def get_general_news_route():
    if not NEWS_API_KEY:
        print("Error: NewsAPI.org API key not configured for general news.")
        return jsonify({"error": "API key not configured", "articles": []}), 500

    print(f"LOG: Executing /general-news (cache miss or expired).")

    params = {
        'apiKey': NEWS_API_KEY,
        'category': 'business',
        'country': 'us',
        'pageSize': 15
    }
    try:
        response = requests.get(NEWS_API_TOP_HEADLINES_URL, params=params)
        response.raise_for_status()
        news_data = response.json()

        articles_raw = news_data.get('articles', [])
        processed_articles = []

        for article_raw in articles_raw:
            formatted_article = format_newsapi_article(article_raw)
            title = formatted_article.get('title', '')
            description = formatted_article.get('description', '')
            content_to_analyze = f"{title}. {description if description else ''}"

            sentiment_score = 0.0
            sentiment_label = "neutral"
            if content_to_analyze.strip() and content_to_analyze.strip() != ".":
                vs = analyzer.polarity_scores(content_to_analyze)
                sentiment_score = vs['compound']
                if sentiment_score >= 0.05:
                    sentiment_label = "positive"
                elif sentiment_score <= -0.05:
                    sentiment_label = "negative"

            formatted_article['sentiment_score'] = sentiment_score
            formatted_article['sentiment_label'] = sentiment_label
            processed_articles.append(formatted_article)

        return jsonify({"articles": processed_articles})
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error fetching general news from NewsAPI.org: {http_err}")
        print(f"Response content: {response.text}")
        return jsonify({"error": f"API request failed for general news: {str(http_err)}", "articles": []}), 500
    except requests.exceptions.RequestException as e:
        print(f"Error fetching general news from NewsAPI.org: {e}")
        return jsonify({"error": f"Could not fetch general news: {str(e)}", "articles": []}), 500
    except ValueError as json_err:  # Handle cases where response is not valid JSON
        print(f"JSON decode error for general news from NewsAPI.org: {json_err}")
        print(f"Response content: {response.text}")
        return jsonify({"error": "Invalid response format from news API for general news.", "articles": []}), 500
    except Exception as e:
        print(f"An unexpected error occurred fetching NewsAPI.org general news: {e}")
        return jsonify({"error": "An unexpected server error occurred.", "articles": []}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)