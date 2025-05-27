import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_caching import Cache  # Keep Cache
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Cache Configuration (KEEP THIS) ---
cache_config = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 300
}
app.config.from_mapping(cache_config)
cache = Cache(app)
# --- End Cache Configuration ---

# --- API Configuration (Revert to NewsAPI.org) ---
NEWS_API_KEY = os.getenv('NEWS_API_KEY')  # Use this key again
NEWS_API_EVERYTHING_URL = 'https://newsapi.org/v2/everything'
NEWS_API_TOP_HEADLINES_URL = 'https://newsapi.org/v2/top-headlines'
# --- End API Configuration ---

# Initialize VADER sentiment analyzer
try:
    analyzer = SentimentIntensityAnalyzer()
except LookupError:
    import nltk

    print("Downloading NLTK resources (VADER lexicon, Punkt)...")
    nltk.download('vader_lexicon')
    nltk.download('punkt')
    analyzer = SentimentIntensityAnalyzer()


# --- Helper function to format NewsAPI.org articles (if needed, often direct mapping) ---
# NewsAPI.org structure is often quite direct, so a complex formatter might not be strictly needed
# if your frontend directly uses keys like 'title', 'description', 'url', 'urlToImage', 'publishedAt', 'source.name'
def format_newsapi_article(article_raw):
    """Helper to ensure consistent structure if slight mapping is needed."""
    source_info = article_raw.get('source', {})
    return {
        'title': article_raw.get('title'),
        'description': article_raw.get('description'),
        'url': article_raw.get('url'),
        'imageUrl': article_raw.get('urlToImage'),  # NewsAPI uses 'urlToImage'
        'publishedAt': article_raw.get('publishedAt'),
        'source': source_info.get('name') if source_info else None  # NewsAPI source is an object
    }


def fetch_stock_news_from_newsapi(ticker_symbol):
    """Fetches news articles for a given stock ticker from NewsAPI.org."""
    if not NEWS_API_KEY:
        print("Error: NewsAPI.org API key not configured.")
        return {"error": "API key not configured", "articles": []}

    # Search for news from the past ~7 days for relevance for sentiment
    from_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    params = {
        'q': ticker_symbol,  # Query term
        'apiKey': NEWS_API_KEY,
        'language': 'en',
        'sortBy': 'publishedAt',  # relevance or popularity also options
        'pageSize': 20,  # How many articles to fetch (max 100 for 'everything')
        'from': from_date
    }
    try:
        print(f"Fetching NewsAPI.org stock news for {ticker_symbol} with params: {params}")
        response = requests.get(NEWS_API_EVERYTHING_URL, params=params)
        response.raise_for_status()
        news_data = response.json()

        articles_raw = news_data.get('articles', [])
        # Use the formatter to ensure consistency, though direct use might also work
        formatted_articles = [format_newsapi_article(article) for article in articles_raw]
        print(f"NewsAPI.org Meta: TotalResults={news_data.get('totalResults')}")
        print(f"Number of raw articles received from NewsAPI.org: {len(articles_raw)}")
        return {"articles": formatted_articles}
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error fetching stock news for {ticker_symbol} from NewsAPI.org: {http_err}")
        print(f"Response content: {response.text}")
        return {"error": f"API request failed: {http_err}", "articles": []}
    except requests.exceptions.RequestException as e:
        print(f"Error fetching stock news for {ticker_symbol} from NewsAPI.org: {e}")
        return {"error": f"Could not fetch news: {e}", "articles": []}
    except ValueError as json_err:
        print(f"JSON decode error for {ticker_symbol} from NewsAPI.org: {json_err}")
        print(f"Response content: {response.text}")
        return {"error": "Invalid response format from news API.", "articles": []}
    except Exception as e:
        print(f"An unexpected error occurred fetching NewsAPI.org stock news: {e}")
        return {"error": "An unexpected server error occurred during news fetch.", "articles": []}


# --- analyze_sentiment_for_articles function remains IDENTICAL to before ---
# It expects a list of articles with 'title' and 'description'
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
        analyzed_articles_details.append({
            "title": title,
            "url": article.get('url'),
            "source": article.get('source'),  # Now comes from format_newsapi_article
            "publishedAt": article.get('publishedAt'),
            "imageUrl": article.get('imageUrl'),  # Ensure this is passed through
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
        "analyzed_articles": analyzed_articles_details[:10]
    }


@app.route('/analyze-ticker', methods=['GET'])
@cache.cached(timeout=900, query_string=True)  # Keep caching (15 minutes)
def analyze_stock_sentiment_route():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "Ticker symbol is required"}), 400

    print(f"LOG: Cache miss or expired for /analyze-ticker?ticker={ticker}. Fetching fresh data using NewsAPI.org.")
    news_response = fetch_stock_news_from_newsapi(ticker)  # Call the NewsAPI fetch function

    if "error" in news_response or not news_response.get("articles"):
        error_detail = news_response.get("error", f"No news articles found for {ticker}.")
        return jsonify({
            "sentiment": "neutral", "score": 0,
            "details": error_detail, "analyzed_articles": []
        }), 200

    sentiment_result = analyze_sentiment_for_articles(news_response["articles"])
    return jsonify(sentiment_result)


@app.route('/general-news', methods=['GET'])
@cache.cached(timeout=1800)  # Keep caching (30 minutes)
def get_general_news_route():
    if not NEWS_API_KEY:
        print("Error: NewsAPI.org API key not configured for general news.")
        return jsonify({"error": "API key not configured", "articles": []}), 500

    print("LOG: Cache miss or expired for /general-news. Fetching fresh data using NewsAPI.org.")

    # Using NewsAPI.org's top-headlines for general news
    params = {
        'apiKey': NEWS_API_KEY,
        'category': 'business',  # or 'technology', 'general'
        'country': 'us',  # For US-centric news
        'pageSize': 15  # Number of articles for homepage
    }
    try:
        print(f"Fetching NewsAPI.org general news with params: {params}")
        response = requests.get(NEWS_API_TOP_HEADLINES_URL, params=params)
        response.raise_for_status()
        news_data = response.json()

        articles_raw = news_data.get('articles', [])
        processed_articles = []

        for article_raw in articles_raw:
            formatted_article = format_newsapi_article(article_raw)  # Use formatter

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
        return jsonify({"error": f"API request failed for general news: {http_err}", "articles": []}), 500
    except requests.exceptions.RequestException as e:
        print(f"Error fetching general news from NewsAPI.org: {e}")
        return jsonify({"error": f"Could not fetch general news: {e}", "articles": []}), 500
    except ValueError as json_err:
        print(f"JSON decode error for general news from NewsAPI.org: {json_err}")
        print(f"Response content: {response.text}")
        return jsonify({"error": "Invalid response format from news API for general news.", "articles": []}), 500
    except Exception as e:
        print(f"An unexpected error occurred fetching NewsAPI.org general news: {e}")
        return jsonify({"error": "An unexpected server error occurred.", "articles": []}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)