# BigQuery Release Notes Dashboard

**A real-time web dashboard for tracking and categorizing Google BigQuery release notes.**

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)

## Getting Started

Follow these steps to set up the project locally:

1. Clone the repository and navigate to the project directory:
   ```bash
   cd agy-cli-projects
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the application:
   ```bash
   python3 app.py
   ```
5. Open your browser and navigate to `http://127.0.0.1:5000`.

## Features

- **Real-time Synchronization:** Fetches the latest Google BigQuery release notes via their Atom feed.
- **Smart Parsing:** Utilizes BeautifulSoup4 to automatically parse and categorize release items.
- **Performance Optimized:** Includes a built-in memory cache to prevent rate-limiting and ensure fast page loads.
- **Interactive UI:** Provides a clean and modern web dashboard to filter and read updates.

## Architecture

This project is built using a lightweight Python architecture:
- **Backend Framework:** Flask handles routing and API requests.
- **Data Ingestion:** `requests` fetches XML data, while `xml.etree.ElementTree` and `BeautifulSoup4` extract release information.
- **Frontend:** Jinja2 templates (`index.html`) serve the interface.
- **Caching:** A simple dictionary-based, time-sensitive cache (`CACHE_DURATION = 300s`) minimizes external API calls.

## License

This project currently has no associated license file.
