# Stock Market Sentiment Analyzer

A front-to-back application that interprets the sentiment of latest news stories about a specified stock ticker and shows historical stock price information. Developed using React for the client-side and Python (Flask) for the server-side.

## Features

*   **Stock Sentiment Analysis:** Enter a stock ticker (e.g., AAPL, MSFT) to pull in an overall sentiment (Positive, Negative, Neutral) based on recent news.
*   **News Article Display:** Shows a list of recent news articles used in the sentiment analysis and their respective sentiment scores.
*   **Historical Sentiment Chart:** Monitors and plots the sentiment trend for a ticker over multiple analyses.
*   **Historical Price Chart:** Displays historical stock price data for the analyzed ticker with radio-time intervals (1M, 3M, 6M, YTD, 1Y, 5Y).
*   **General Financial News Homepage:** Displays breaking business and market news on the home page.
*   **Recent Searches:** Stores your last search ticker history for immediate re-analysis.
*   **Responsive Design (Basic):** Operates on multiple screen sizes.
*   **Optimized Frontend:** Utilizes code splitting to allow faster initial load times.
*   **Persistent Local Caching:** Storing API results and history locally on the backend to aid in performance and respect API rate limits.

## Technologies Used

*   **Frontend:**
    *   React.js
    *   Axios (for API requests)
    *   Chart.js (with `react-chartjs-2` and `chartjs-adapter-date-fns`) for chart creation
*   `date-fns` for date management
    *   HTML5, CSS3
*   **Backend:**
    *   Python 3
    *   Flask (micro web framework)
    *   NLTK (VADER for sentiment analysis)
    *   Requests (for making HTTP requests to outside APIs)
*   `python-dotenv` (for environment variable management)
    *   `Flask-Caching` (using FileSystemCache for local cache)
*   **APIs:**
    *   [NewsAPI.org](https://newsapi.org/) (for news articles)
    *   [Financial Modeling Prep (FMP)](https://site.financialmodelingprep.com/developer/docs/) (for stock prices history)

## Prerequisites

Make sure you have the following installed before proceeding:

*   **Python 3.8+:** [Download Python](https://www.python.org/downloads/)
*   Make sure `pip` (Python package manager) is installed and in your PATH.
*   **Node.js and npm:**
    Download Node.js (npm comes bundled with Node.js)
    *   `npm` (Node Package Manager) is required for frontend dependencies.
*   **Git:** For cloning the repository.

## Setup & Installation

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/RenLmao/Stock-Market-SA.git
    cd Stock-Market-SA
    ```

2.  **API Key Setup (Important!):**
    The application needs API keys for two services. You should get your own free API keys.

    *   **NewsAPI.org Key (for news articles):**
1.  Go to [https://newsapi.org/](https://newsapi.org/) and create a free account.
    2.  Find your API key on your account dashboard.
    *   **Financial Modeling Prep (FMP) Key (for stock prices):**
        1.  Go to [https://site.financialmodelingprep.com/register](https://site.financialmodelingprep.com/register) and create a free plan.
2.  Your API key will be in your FMP dashboard.

    *   **Create the `.env` file for the backend:**
        1.  Go to the `backend` directory: `cd backend`
        2.  Create a new file called `.env` (pay attention to the leading dot).
3. Put your API keys here as follows:
            ```env
            NEWS_API_KEY=YOUR_ACTUAL_NEWSAPI_ORG_KEY_HERE
            FMP_API_KEY=YOUR_ACTUAL_FMP_KEY_HERE
            ```
4.  Insert your actual keys for the placeholder values.
        5.  Save the file. This file is specifically ignored by Git in order to store your keys securely.
        6.  Return to the project root: `cd .`

3.  **Backend Setup (Python Flask):**
*   Navigate to the `backend` directory:
        ```bash
        cd backend
        ```
    *   Install a Python virtual environment (highly recommended):
        ```bash
        python -m venv venv
        ```

    *   Switch to the virtual environment:
        *   Windows: `venv\Scripts\activate`
        *   macOS/Linux: `source venv/bin/activate`
    *   Install the Python dependencies:
        ``` bash
        pip install -r requirements.txt
        ```
*   The NLTK VADER lexicon (used in sentiment analysis) will download on the first run automatically if not already installed. If there is an issue, you can download manually by opening a Python interpreter in your activated `venv` and running:
```python
        import nltk
        nltk.download('vader_lexicon')
        nltk.download('punkt')
        exit()
```

4.  **Frontend Setup (React):**
    *   Navigate to the `frontend` directory:
```bash
        cd frontend
```
*   Install Node.js dependencies:
        ```bash
        npm install
        ```

## Running the Application

You need to run the backend and frontend servers simultaneously.

1.  **Start the Backend Server:**
    *   Open a terminal.
    *   Navigate to the `backend` directory (`cd Stock-Market-SA/backend`).
    *   Ensure your Python virtual environment is active.
    *   Run the Flask app:
        ```bash
python app.py
    ```
    *   The backend server will begin, typically at `http://localhost:5000`. You will see log messages in this terminal.

2.  **Start the Frontend Server:**
    *   Open a **new, separate** terminal.
    *   Enter the `frontend` directory (`cd Stock-Market-SA/frontend`).
*   Run the React development server:
        ```bash
        npm start
        ```
    *   This should automatically open the application in your default web browser at `http://localhost:3000`. If not, open it by hand.

Now you are ready to utilize the Stock Market Sentiment Analyzer!

