from dataclasses import dataclass, asdict
from datetime import date, datetime
from typing import List, Optional, Callable
import json
from urllib.request import urlopen
from urllib.parse import urlencode

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from dateutil import parser as date_parser  # robust date parsing
from database import DatabaseManager
from elasticsearch_service import ElasticsearchService
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
    url: str
    full_text: Optional[str] = None

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
    press_release_link: Optional[str] = None
    requires_click_navigation: bool = False
    main_content_selector: Optional[str] = None

novonordisk_config = SiteConfig(
    name="novonordisk",
    base_url="https://www.novonordisk.com",
    listing_url="https://www.novonordisk.com/news-and-media/news-and-ir-materials.html",
    card_selector="div.g-row.p-s-top.p-s-bottom.animate",
    title_selector="div.title-desktop.right-arrow-animation p.bold.h4",
    date_selector="p.bold.infotext",
    category_selector=None,
    press_release_link='div.title-desktop.right-arrow-animation a, div.title-desktop.right-arrow-animation',
    requires_click_navigation=True,
    main_content_selector='main, article, div.article-content, div.text-block, div.content'
)


jnj_config = SiteConfig(
    name="Johnson & Johnson",
    base_url="https://www.jnj.com",
    listing_url="https://www.jnj.com/media-center/press-releases",
    card_selector="li.SearchResultsModule-results-item",
    title_selector="h2.PagePromo-title",
    date_selector="div.PagePromo-date",
    category_selector=None,
    press_release_link='a.PagePromo-itemLink',
    requires_click_navigation=False,
    main_content_selector='main article, article, div.article-body, div.article-content, main'
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
    press_release_link='a.az-filter-items__results-item',
    requires_click_navigation=False,
    main_content_selector='main article, article, div.rich-text, div.article-body, main'
)


merck_config = SiteConfig(
    name="Merck",
    base_url="https://www.merck.com",
    listing_url="https://www.merck.com/media/news/",
    card_selector="div.d8-result-item",
    title_selector="div.d8-result-item-headline span",
    date_selector="div.d8-result-item-date",
    category_selector=None,
    next_page_selector="a[rel='next']",
    parse_date=parse_date_safe,
    press_release_link="div.d8-result-item-headline a",
    requires_click_navigation=False,
    main_content_selector='main article, article, div.article-body, div.d8-node-content, main'
)


pfizer_config = SiteConfig(
    name="Pfizer",
    base_url="https://www.pfizer.com",
    listing_url="https://www.pfizer.com/newsroom/press-releases",
    card_selector="li.grid-x",
    title_selector="h5 a",
    date_selector="p.date",
    category_selector='li.field_media_asset_category a.tag',
    press_release_link="h5 a",
    requires_click_navigation=False,
    main_content_selector='main article, article, div.field--name-body, div.article-content, main'
)


def fetch_page_content(page, url: str) -> BeautifulSoup:
    try:
        page.goto(url, timeout=45000, wait_until="domcontentloaded")
        dismiss_cookie_banner(page)
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            pass
        html = page.content()
        return BeautifulSoup(html, "html.parser")
    except Exception as e:
        print(f"[ERROR] Failed to fetch {url}: {e}")
        return BeautifulSoup("", "html.parser")


def build_absolute_url(base_url: str, url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    if url.startswith("http"):
        return url
    return base_url.rstrip('/') + '/' + url.lstrip('/')


def normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(value.split()).strip().lower()


def extract_main_content_text(detail_soup: BeautifulSoup, config: SiteConfig) -> str:
    if not detail_soup:
        return ""

    candidate = None
    if config.main_content_selector:
        candidate = detail_soup.select_one(config.main_content_selector)

    if candidate is None:
        fallback_selectors = [
            "main article",
            "article",
            "main",
            "[role='main']",
            ".article-content",
            ".article-body",
            ".content",
        ]
        for selector in fallback_selectors:
            candidate = detail_soup.select_one(selector)
            if candidate is not None:
                break

    if candidate is None:
        candidate = detail_soup.body if detail_soup.body else detail_soup

    working = BeautifulSoup(str(candidate), "html.parser")
    for tag in working.select(
        "script, style, noscript, nav, header, footer, aside, form, button, "
        "svg, figure figcaption, .cookie, .cookie-banner, .breadcrumb, .social, "
        ".share, .related, .newsletter, .menu"
    ):
        tag.decompose()

    lines = [line.strip() for line in working.get_text(separator="\n").split("\n")]
    cleaned_lines = []
    for line in lines:
        if not line:
            continue
        lowered = line.lower()
        if lowered in {
            "skip to content",
            "search everything",
            "menu",
            "close",
            "main menu",
        }:
            continue
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


def fetch_novonordisk_news_map(start_date: date) -> dict:
    end_date = datetime.utcnow().date()
    params = {
        "searchtext": "null",
        "start": start_date.isoformat(),
        "end": end_date.isoformat(),
        "newspath": "/content/dam/nncorp/global/en/investors/content-fragments/ir-materials",
        "limit": "100",
        "currentresults": "0",
        "function": "search",
        "language": "all",
        "type": "Annual reports,Investor presentations,5355,5356",
        "disablesearchfromdb": "false",
    }

    endpoint = "https://www.novonordisk.com/bin/nncorp/news-search?" + urlencode(params)
    try:
        with urlopen(endpoint, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"[ERROR] Failed to fetch Novo Nordisk API data: {e}")
        return {}

    items = payload.get("data", {}).get("resultBeanList", [])
    result_map = {}
    for item in items:
        title_key = normalize_text(item.get("title"))
        if not title_key:
            continue

        news_html = item.get("newsContent") or ""
        full_text = BeautifulSoup(news_html, "html.parser").get_text(separator="\n", strip=True) if news_html else None
        result_map[title_key] = {
            "url": item.get("pdfLink"),
            "full_text": full_text,
        }

    return result_map


def extract_url_from_card(card, config: SiteConfig) -> Optional[str]:
    link_elem = card.select_one(config.press_release_link) if config.press_release_link else None
    if link_elem is None:
        return None

    href = link_elem.get('href') if link_elem.has_attr('href') else None
    if not href:
        nested_anchor = link_elem.select_one('a[href]')
        href = nested_anchor.get('href') if nested_anchor else None

    return build_absolute_url(config.base_url, href)


def dismiss_cookie_banner(page):
    selectors = [
        "#accept-recommended-btn-handler",
        "button:has-text('Accept all cookies')",
        "button:has-text('Accept all')",
        "button:has-text('Accept')",
    ]
    for selector in selectors:
        try:
            button = page.locator(selector).first
            if button.is_visible(timeout=1500):
                button.click(timeout=3000)
                return
        except Exception:
            continue


def navigate_via_click(page, listing_url: str, card_selector: str, card_index: int):
    try:
        page.goto(listing_url, timeout=45000, wait_until="domcontentloaded")
        dismiss_cookie_banner(page)
        cards = page.locator(card_selector)
        if cards.count() <= card_index:
            return None, None

        with page.expect_navigation(wait_until="domcontentloaded", timeout=45000):
            cards.nth(card_index).click()

        detail_url = page.url
        dismiss_cookie_banner(page)
        html = page.content()
        detail_soup = BeautifulSoup(html, "html.parser")
        return detail_url, detail_soup
    except Exception as e:
        print(f"[ERROR] Click navigation failed for card {card_index}: {e}")
        return None, None

# Scrape all press releases for a given site config, normalized and filtered by date
def scrape_site(config: SiteConfig) -> List[PressRelease]:
    results: List[PressRelease] = []
    count = 0
    page_url = config.listing_url

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        while page_url:
            print(f"[SCRAPE] Fetching listing page: {page_url}")
            page_content = fetch_page_content(page, page_url)
            cards = page_content.select(config.card_selector)
            print(f"[SCRAPE] Found {len(cards)} cards on {page_url}")
            if not cards:
                print(f"[SCRAPE] No cards found, breaking.")
                break

            for card_index, card in enumerate(cards):
                print(f"[SCRAPE] Processing card {count+1} for {config.name}")
                title_elem = card.select_one(config.title_selector)
                title = title_elem.get_text(strip=True) if title_elem else None

                url = extract_url_from_card(card, config)
                detail_soup = None

                if config.requires_click_navigation and not url:
                    url, detail_soup = navigate_via_click(page, page_url, config.card_selector, card_index)

                date_elem = card.select_one(config.date_selector)
                date_str = date_elem.get_text(strip=True) if date_elem else None
                published_date = config.parse_date(date_str) if date_str else None

                if not published_date or published_date < START_DATE:
                    print(f"[SCRAPE] Skipping card {count+1}: date {published_date}")
                    continue

                results.append(
                    PressRelease(
                        company=config.name,
                        published_date=published_date,
                        title=title,
                        url=url,
                        full_text=extract_main_content_text(detail_soup, config) if detail_soup else None,
                    )
                )
                print(f"[SCRAPE] Card {count+1} processed.")
                count += 1

            next_page = None
            if config.next_page_selector:
                next_elem = page_content.select_one(config.next_page_selector)
                if next_elem and next_elem.has_attr('href'):
                    next_page = next_elem['href']
                    if not next_page.startswith('http'):
                        next_page = config.base_url.rstrip('/') + '/' + next_page.lstrip('/')
            page_url = next_page

        if normalize_text(config.name) == "novonordisk":
            novo_map = fetch_novonordisk_news_map(START_DATE)
            for item in results:
                if item.url and item.full_text:
                    continue
                match = novo_map.get(normalize_text(item.title))
                if not match:
                    continue
                if not item.url:
                    item.url = match.get("url")
                if not item.full_text:
                    item.full_text = match.get("full_text")

        for item in results:
            if not item.url or item.full_text:
                continue
            print(f"[SCRAPE] Fetching detail page: {item.url}")
            detail_soup = fetch_page_content(page, item.url)
            item.full_text = extract_main_content_text(detail_soup, config)

        context.close()
        browser.close()

    return results


# Example: Scrape all companies and save only the required fields to JSON
if __name__ == "__main__":
    all_configs = [
        astrazeneca_config,
        jnj_config,
        merck_config,
        pfizer_config,
        novonordisk_config,
    ]
    all_results = []
    for config in all_configs:
        results = scrape_site(config)
        all_results.extend(results)

    # Print all results for verification
    # Print statements removed to avoid TypeError


    # Save to JSON file
    with open("press_releases.json", "w") as f:
        json.dump([
            {
                **asdict(item),
                "published_date": item.published_date.isoformat() if item.published_date else None,
            }
            for item in all_results
        ], f, indent=2)

    print(f"Saved {len(all_results)} press releases to press_releases.json")

    # Replace PostgreSQL data from scratch
    print("\nReplacing press releases in PostgreSQL database...")
    db_manager = DatabaseManager()
    db_manager.reset_press_releases_table()

    for item in all_results:
        db_manager.insert_press_release(
            company=item.company,
            published_date=item.published_date,
            title=item.title,
            url=item.url,
            full_text=item.full_text,
        )

    print(f"All {len(all_results)} press releases stored in DB.\n")

    # Replace Elasticsearch data from scratch
    print("Rebuilding Elasticsearch index...")
    es_service = ElasticsearchService()
    if es_service.client:
        if es_service.client.indices.exists(index=es_service.index_name):
            es_service.client.indices.delete(index=es_service.index_name)
            print(f"Deleted existing index '{es_service.index_name}'")
        es_service.ensure_index()

        documents = [
            {
                "company": item.company,
                "published_date": item.published_date.isoformat() if item.published_date else None,
                "title": item.title,
                "url": item.url,
                "full_text": item.full_text,
            }
            for item in all_results
            if item.url
        ]

        indexed_count = es_service.bulk_index(documents)
        print(f"Indexed {indexed_count} documents into Elasticsearch.\n")
    else:
        print("Skipping Elasticsearch indexing because connection failed.\n")