from urllib.parse import urljoin

from crawlers.http_base import Airport
from crawlers.http_eurocontrol_base import HttpEurocontrolBase

COUNTRY = "FR"
ROOT_URL = "https://www.sia.aviation-civile.gouv.fr/plandesite"


class FR(HttpEurocontrolBase):
    """France AIP crawler.

    SIA's site map (`/plandesite`) has an "AIP" section with an
    `eAIP FRANCE` link pointing to the eAIP issues overview. That page
    embeds an `<object data="…">` whose target document carries the link
    to the currently effective eAIP (`index-fr-FR.html`). From there the
    eAIP is the standard eurocontrol frameset.

    Five sections need to be extracted: IFR aerodromes, VFR aerodromes,
    military aerodromes, and heliports. Civil aerodromes are tagged
    `aeroport` because the source publication doesn't split VFR vs IFR
    in a way that maps cleanly onto our taxonomy.
    """

    def __init__(self) -> None:
        super().__init__(COUNTRY)

    def crawl(self) -> list[Airport]:
        self.logger.info(f"Crawling airports in {self.country}")
        airports: list[Airport] = []
        last_url = ROOT_URL
        last_html: str | None = None

        try:
            # 1. /plandesite → AIP section → "eAIP FRANCE" link.
            plandesite_html = self.fetch(ROOT_URL)
            last_url, last_html = ROOT_URL, plandesite_html

            soup = self.soup(plandesite_html)
            eaip_pre_link = None
            for div in soup.find_all(
                "div", id=lambda i: bool(i) and "plandesite" in i
            ):
                h2 = div.find("h2")
                if not h2 or h2.get_text(strip=True) != "AIP":
                    continue
                for a in div.find_all("a", href=True):
                    if "eAIP FRANCE" in a.get_text():
                        eaip_pre_link = a
                        break
                if eaip_pre_link is not None:
                    break
            if eaip_pre_link is None:
                raise ValueError(f"'eAIP FRANCE' link not found in {ROOT_URL}")

            eaip_pre_url = urljoin(ROOT_URL, eaip_pre_link["href"])

            # 2. eAIP issues overview → <object data="…">.
            eaip_pre_html = self.fetch(eaip_pre_url)
            last_url, last_html = eaip_pre_url, eaip_pre_html

            obj = self.soup(eaip_pre_html).find("object", attrs={"data": True})
            if obj is None:
                raise ValueError(
                    f"<object data=…> not found in {eaip_pre_url}"
                )
            object_url = urljoin(eaip_pre_url, obj["data"])

            # 3. Object document → link to the currently effective eAIP.
            object_html = self.fetch(object_url)
            last_url, last_html = object_url, object_html

            edition_link = self.soup(object_html).find(
                "a", href=lambda h: bool(h) and "index-fr-FR.html" in h
            )
            if edition_link is None:
                raise ValueError(
                    f"Current-edition link (index-fr-FR.html) not found in "
                    f"{object_url}"
                )
            edition_url = urljoin(object_url, edition_link["href"])
            self.logger.info(f"Current edition: {edition_url}")

            # 4. Walk the frame chain to the navigation HTML.
            nav_url, nav_html = self.follow_frame_chain(
                edition_url, ["eAISNavigationBase", "eAISNavigation"]
            )
            last_url, last_html = nav_url, nav_html

            # 5. Five sections.
            sections: list[tuple[str, str]] = [
                ("AD-2-IFRdetails", "aeroport"),
                ("AD-2-VFRdetails", "aeroport"),
                ("AD-2-MILdetails", "mil"),
                ("AD-3details", "aeroport"),
            ]
            for menu_id, category in sections:
                airports.extend(
                    self.extract_airports_from_html(
                        nav_html, nav_url, menu_id, category  # type: ignore[arg-type]
                    )
                )
        except Exception as e:
            self.logger.error(f"FR crawl failed: {e}")
            if last_html is not None:
                self.save_response(last_url, last_html, prefix="crawl_error")
            raise
        finally:
            self.close()

        self.logger.info(f"Found {len(airports)} airports for {self.country}.")
        return airports
