import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import argparse
import logging
from urllib.request import urlopen
from xml.etree import ElementTree
from typing import List, Set

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cache_warmer.log'),
        logging.StreamHandler()
    ]
)

def setup_driver(mobile=False):
    chrome_options = Options()
    #chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    if mobile:
        mobile_emulation = {
            "deviceMetrics": {"width": 375, "height": 812, "pixelRatio": 3.0},
            "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
        }
        chrome_options.add_experimental_option("mobileEmulation", mobile_emulation)
    
    return webdriver.Chrome(options=chrome_options)

def scroll_to_bottom(driver):
    last_height = driver.execute_script("return document.body.scrollHeight")
    
    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)  # Warte auf das Laden von dynamischen Inhalten
        
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height

def parse_xml_url(url: str) -> ElementTree.Element:
    """Lädt und parsed eine XML URL."""
    try:
        response = urlopen(url)
        return ElementTree.parse(response).getroot()
    except Exception as e:
        logging.error(f"Fehler beim Parsen von {url}: {str(e)}")
        return None

def is_sitemap_index(root: ElementTree.Element) -> bool:
    """Prüft, ob es sich um einen Sitemap-Index handelt."""
    if root is None:
        return False
    
    # Prüfe verschiedene mögliche Namespace-Varianten
    for ns in [
        {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'},
        {'ns': 'http://www.google.com/schemas/sitemap/0.84'},
        None
    ]:
        try:
            # Suche nach sitemapindex Element oder sitemap Einträgen
            if ns:
                if (root.find('.//ns:sitemapindex', ns) is not None or
                    root.find('.//ns:sitemap', ns) is not None):
                    return True
            else:
                if (root.find('.//sitemapindex') is not None or
                    root.find('.//sitemap') is not None):
                    return True
        except:
            continue
    
    return False

def get_urls_from_sitemap(sitemap_url: str, processed_sitemaps: Set[str] = None) -> List[str]:
    """
    Rekursiv alle URLs aus Sitemaps und Sitemap-Indices extrahieren.
    
    Args:
        sitemap_url: URL der Sitemap
        processed_sitemaps: Set von bereits verarbeiteten Sitemap-URLs
    
    Returns:
        Liste aller gefundenen URLs
    """
    if processed_sitemaps is None:
        processed_sitemaps = set()
    
    if sitemap_url in processed_sitemaps:
        return []
    
    processed_sitemaps.add(sitemap_url)
    logging.info(f"Verarbeite Sitemap: {sitemap_url}")
    
    root = parse_xml_url(sitemap_url)
    if root is None:
        return []
    
    urls = []
    namespaces = [
        {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'},
        {'ns': 'http://www.google.com/schemas/sitemap/0.84'},
        None
    ]
    
    if is_sitemap_index(root):
        # Verarbeite Sitemap-Index
        for ns in namespaces:
            try:
                if ns:
                    sitemap_elements = root.findall('.//ns:loc', ns)
                else:
                    sitemap_elements = root.findall('.//loc')
                
                for loc in sitemap_elements:
                    sub_sitemap_url = loc.text
                    if sub_sitemap_url not in processed_sitemaps:
                        urls.extend(get_urls_from_sitemap(sub_sitemap_url, processed_sitemaps))
                break
            except:
                continue
    else:
        # Verarbeite normale Sitemap
        for ns in namespaces:
            try:
                if ns:
                    url_elements = root.findall('.//ns:url/ns:loc', ns)
                else:
                    url_elements = root.findall('.//url/loc')
                
                urls.extend([loc.text for loc in url_elements])
                break
            except:
                continue
    
    return list(set(urls))  # Entferne Duplikate

def warm_cache(url, device_type):
    driver = None
    try:
        driver = setup_driver(mobile=(device_type == "mobile"))
        logging.info(f"Lade {url} für {device_type}")
        
        driver.get(url)
        scroll_to_bottom(driver)
        
        # Warte kurz, um sicherzustellen, dass alles geladen wurde
        time.sleep(2)
        
        logging.info(f"Erfolgreich gecached: {url} ({device_type})")
    except Exception as e:
        logging.error(f"Fehler beim Cachen von {url} ({device_type}): {str(e)}")
    finally:
        if driver:
            driver.quit()

def main():
    parser = argparse.ArgumentParser(description='Cache Warmer für Webseiten')
    parser.add_argument('sitemaps', nargs='+', help='URLs der Sitemaps')
    args = parser.parse_args()

    processed_urls = set()  # Verhindert doppelte Verarbeitung von URLs
    
    for sitemap_url in args.sitemaps:
        urls = get_urls_from_sitemap(sitemap_url)
        logging.info(f"Gefundene URLs in {sitemap_url} und Unter-Sitemaps: {len(urls)}")
        
        for url in urls:
            if url not in processed_urls:
                processed_urls.add(url)
                # Cache für Desktop
                warm_cache(url, "desktop")
                # Cache für Mobile
                warm_cache(url, "mobile")

if __name__ == "__main__":
    main()
