from dataclasses import dataclass, asdict
from datetime import date, datetime
from typing import List, Optional, Callable

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from dateutil import parser as date_parser  # robust date parsing
from database import DatabaseManager, PressReleaseDB
START_DATE = date(2026, 1, 1)

HEADERS = {
    # Pretend to be a normal browser so sites are less likely to block us
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0 Safari/537.36"
    )
}

# Setting the data structure 
@dataclass
class PressRelease:
    company: str
    published_date: date
    title: str
    category: Optional[str]
    url: str

#parsing human readable date structure to python date
def parse_date_safe(date_str: str) -> date:
    date = date_parser.parse(date_str, dayfirst=False) 
    return date.date()

@dataclass
class SiteConfig:
    name: str
    base_url: str
    listing_url: str
    card_selector: str
    title_selector: str
    date_selector: str
    category_selector: Optional[str] = None
    next_page_selector: Optional[str] = "a[rel='next']"
    parse_date: Callable[[str], date] = parse_date_safe 

novonordisk_config = SiteConfig(
    name="novonordisk",
    base_url="https://www.novonordisk.com",
    listing_url="https://www.novonordisk.com/news-and-media/news-and-ir-materials.html",
    card_selector="div.element-box.display-flex.space-between",        
    title_selector="div.title-desktop.right-arrow-animation p.bold.h4",
    date_selector="p.bold.infotext",
    category_selector=None,
)

jnj_config = SiteConfig(
    name="Johnson & Johnson",
    base_url="https://www.jnj.com",
    listing_url="https://www.jnj.com/media-center/press-releases",
    card_selector="div.bsp-pagepromo.PagePromoSearch",
    title_selector="h2.PagePromo-title a",
    date_selector="div.PagePromo-date",
    category_selector=None,
)

astrazeneca_config = SiteConfig(
    name="AstraZeneca",
    base_url="https://www.astrazeneca.com",
    listing_url="https://www.astrazeneca.com/media-centre/press-releases.html",
    card_selector="li.az-filter-items__results-list-item",
    title_selector="div.az-filter-items__results-item-title",
    date_selector="time.az-filter-items__results-item-date",
    category_selector=None,
    next_page_selector="a[rel='next']",
    parse_date=parse_date_safe,
)

"""
pfizer_config = SiteConfig(
    name="Pfizer",
    base_url="https://www.pfizer.com",
    listing_url="https://www.pfizer.com/newsroom/press-releases",
    card_selector="div.element-box.display-flex.space-between",        
    title_selector="h5 a",
    date_selector="p.date",
    category_selector=None,
)
"""



""" 
 merck_config = SiteConfig(
    name="Merck",
    base_url="https://www.merck.com",
    listing_url="https://www.merck.com/media/news/",
    card_selector="div.d8-result-item",
    title_selector="div.d8-result-item-headline a",
    date_selector="div.d8-result-item-date",
    category_selector=None,
    next_page_selector="a[rel='next']",
    parse_date=parse_date_safe,
)
"""




# Download HTML from a URL using Playwright and return a BeautifulSoup DOM Object
def fetch_html_playwright(url: str) -> BeautifulSoup:
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            # print(f"[DEBUG] Playwright navigating to {url}")
            page.goto(url, timeout=30000) 
            page.wait_for_load_state("networkidle", timeout=30000)
            html = page.content()
            browser.close()
            # Optionally save for debugging
            debug_filename = url.replace('https://', '').replace('http://', '').replace('/', '_') + '.html'
            with open(debug_filename, "w", encoding="utf-8") as f:
                f.write(html)
            # print(f"[DEBUG] Saved rendered HTML to {debug_filename}")
            return BeautifulSoup(html, "html.parser")
    except Exception as e:
        print(f"[ERROR] Playwright failed to fetch {url}: {e}")
        return BeautifulSoup('', "html.parser")

# Scrape all press releases for a given site config, normalized and filtered by date
def scrape_site(config: SiteConfig) -> list:
    results = []
    page_url = config.listing_url

    max_cards = 100  # Limit for testing
    count = 0
    while page_url:
        print(f"[SCRAPE] Fetching listing page: {page_url}")
        page_content = fetch_html_playwright(page_url)
        cards = page_content.select(config.card_selector)
        print(f"[SCRAPE] Found {len(cards)} cards on {page_url}")
        if not cards:
            print(f"[SCRAPE] No cards found, breaking.")
            break

        for card in cards:
            print(f"[SCRAPE] Processing card {count+1} for {config.name}")
            # Title
            title_elem = card.select_one(config.title_selector)
            title = title_elem.get_text(strip=True) if title_elem else None

            # URL (absolute)
            url = title_elem['href'] if title_elem and title_elem.has_attr('href') else None
            if url and not url.startswith('http'):
                url = config.base_url.rstrip('/') + '/' + url.lstrip('/')

            # Date
            date_elem = card.select_one(config.date_selector)
            date_str = date_elem.get_text(strip=True) if date_elem else None
            published_date = config.parse_date(date_str) if date_str else None

            # Only include articles from Jan 1, 2026 onward
            if not published_date or published_date < START_DATE:
                print(f"[SCRAPE] Skipping card {count+1}: date {published_date}")
                continue

            # Category (optional)
            category = None
            if config.category_selector:
                category_elem = card.select_one(config.category_selector)
                category = category_elem.get_text(strip=True) if category_elem else None

            # Scrape detail page for full text
            full_text = None
            if url:
                print(f"[SCRAPE] Fetching detail page: {url}")
                detail_soup = fetch_html_playwright(url)
                print(f"[SCRAPE] Detail page fetched for {url}")
                # Try to extract main content; fallback to all text
                main_content = detail_soup.body
                if main_content:
                    full_text = main_content.get_text(separator="\n", strip=True)
                else:
                    full_text = detail_soup.get_text(separator="\n", strip=True)

            results.append({
                "company": config.name,
                "published_date": published_date.isoformat() if published_date else None,
                "title": title,
                "category": category,
                "url": url,
                "full_text": full_text,
            })
            print(f"[SCRAPE] Card {count+1} processed.")
            count += 1
            if count >= max_cards:
                print(f"[SCRAPE] Reached max_cards limit ({max_cards}), breaking.")
                break

        # Pagination (if needed)
        next_page = None
        if config.next_page_selector:
            next_elem = page_content.select_one(config.next_page_selector)
            if next_elem and next_elem.has_attr('href'):
                next_page = next_elem['href']
                if not next_page.startswith('http'):
                    next_page = config.base_url.rstrip('/') + '/' + next_page.lstrip('/')
        page_url = next_page

    return results


# Example: Scrape all companies and save only the required fields to JSON
if __name__ == "__main__":
    all_configs = [
        astrazeneca_config,
        jnj_config,
        novonordisk_config
    ]
    all_results = []
    for config in all_configs:
        results = scrape_site(config)
        all_results.extend(results)

    # Print all results for verification
    # Print statements removed to avoid TypeError


    # Save to JSON file
    with open("press_releases.json", "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"Saved {len(all_results)} press releases to press_releases.json")

    # Store in PostgreSQL database
    print("\nStoring press releases in PostgreSQL database...")
    db_manager = DatabaseManager()
    
    for item in all_results:
        db_manager.insert_press_release(
            company=item.get("company"),
            published_date=item.get("published_date"),
            title=item.get("title"),
            category=item.get("category"),
            url=item.get("url"),
            full_text=item.get("full_text"),
        )
    
    print(f"All {len(all_results)} press releases stored in DB.\n")