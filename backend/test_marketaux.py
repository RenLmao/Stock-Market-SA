import requests
import os
from dotenv import load_dotenv
import json

load_dotenv()
MARKETAUX_API_KEY = os.getenv('MARKETAUX_API_KEY')
MARKETAUX_BASE_URL = "https://api.marketaux.com/v1"

if not MARKETAUX_API_KEY:
    print("Error: MARKETAUX_API_KEY not found in .env file.")
else:
    ticker_symbol = 'AAPL' # Or any other ticker
    endpoint = f"{MARKETAUX_BASE_URL}/news/all"
    params = {
        'api_token': MARKETAUX_API_KEY,
        'symbols': ticker_symbol.upper(),
        'language': 'en',
        'limit': 20 # Just need a few to see the structure
    }
    try:
        print(f"Requesting: {endpoint} with params: {params}")
        response = requests.get(endpoint, params=params)
        response.raise_for_status() # Check for HTTP errors
        data = response.json()
        print("\nSUCCESS! API Response:")
        print(json.dumps(data, indent=2)) # Pretty print the JSON

        # Specifically check the 'data' array and first article structure
        if 'data' in data and len(data['data']) > 0:
            print("\nStructure of the first article in 'data':")
            print(json.dumps(data['data'][0], indent=2))
        else:
            print("\n'data' array not found or is empty in the response.")

    except requests.exceptions.HTTPError as http_err:
        print(f"\nHTTP error: {http_err}")
        print(f"Response Text: {response.text}")
    except Exception as e:
        print(f"\nAn error occurred: {e}")