from flask import Flask, render_template, jsonify, request
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import time
from datetime import datetime
import urllib.parse
import re

app = Flask(__name__)

# Simple in-memory cache
CACHE_DURATION = 300  # 5 minutes
cache = {
    'data': None,
    'last_fetched': 0
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_text(text):
    # Remove extra whitespaces
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_release_notes():
    try:
        resp = requests.get(FEED_URL, timeout=10)
        if resp.status_code != 200:
            raise Exception(f"Failed to fetch feed: HTTP {resp.status_code}")
        
        root = ET.fromstring(resp.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = root.findall('atom:entry', ns)
        parsed_items = []
        
        category_counts = {}
        
        for entry in entries:
            date_title = entry.find('atom:title', ns).text
            entry_id = entry.find('atom:id', ns).text
            updated = entry.find('atom:updated', ns).text
            
            link_el = entry.find('atom:link', ns)
            link = link_el.attrib.get('href', '') if link_el is not None else ''
            
            content_el = entry.find('atom:content', ns)
            content_html = content_el.text if content_el is not None else ''
            
            # Parse with BeautifulSoup to split by h3 elements (categories)
            soup = BeautifulSoup(content_html, 'html.parser')
            
            current_h3 = None
            current_content = []
            entry_items = []
            
            for child in soup.contents:
                if child.name == 'h3':
                    if current_h3:
                        html_str = ''.join(str(c) for c in current_content).strip()
                        text_str = clean_text(BeautifulSoup(html_str, 'html.parser').get_text())
                        entry_items.append({
                            'category': current_h3.text.strip(),
                            'html': html_str,
                            'text': text_str
                        })
                        current_content = []
                    current_h3 = child
                else:
                    if current_h3:
                        current_content.append(child)
                    else:
                        # In case there is text before any <h3>
                        current_content.append(child)
            
            # Add the last one
            if current_h3:
                html_str = ''.join(str(c) for c in current_content).strip()
                text_str = clean_text(BeautifulSoup(html_str, 'html.parser').get_text())
                entry_items.append({
                    'category': current_h3.text.strip(),
                    'html': html_str,
                    'text': text_str
                })
            elif current_content:
                # No <h3> tags found at all
                html_str = ''.join(str(c) for c in current_content).strip()
                text_str = clean_text(BeautifulSoup(html_str, 'html.parser').get_text())
                entry_items.append({
                    'category': 'General',
                    'html': html_str,
                    'text': text_str
                })
            
            for index, item in enumerate(entry_items):
                cat = item['category']
                category_counts[cat] = category_counts.get(cat, 0) + 1
                
                # Create a unique local ID
                local_id = f"{entry_id}_{index}"
                
                parsed_items.append({
                    'id': local_id,
                    'date': date_title,
                    'updated': updated,
                    'link': link,
                    'category': cat,
                    'html': item['html'],
                    'text': item['text']
                })
        
        return {
            'success': True,
            'last_fetched_time': datetime.now().isoformat(),
            'stats': {
                'total': len(parsed_items),
                'categories': category_counts
            },
            'releases': parsed_items
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    now = time.time()
    
    if force_refresh or cache['data'] is None or (now - cache['last_fetched'] > CACHE_DURATION):
        data = parse_release_notes()
        if data.get('success'):
            cache['data'] = data
            cache['last_fetched'] = now
        else:
            # If fetch fails but we have cached data, return cached data with warning
            if cache['data']:
                warning_data = cache['data'].copy()
                warning_data['warning'] = f"Could not refresh: {data.get('error')}. Using cached data."
                return jsonify(warning_data)
            return jsonify(data), 500
            
    return jsonify(cache['data'])

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
