# Connector specs

Each connector must implement:
- buildSearchUrl(query)
- search(query): returns Listing[] from the search results page
- fetchDetails(url): returns enriched Listing (identifiers, variant info)

## Common fields to extract
- name
- brand (if present)
- variant (size/weight/pack/quality)
- identifiers (EAN/GTIN/MPN/SKU)
- price + currency
- url
- image
- availability

## eMAG
- Search URL: `https://www.emag.ro/search/<query>?ref=effective_search`
- Listing page notes:
  - TODO: capture CSS selectors for list items, price, title, image, link.
  - TODO: check for JSON-LD or embedded data on search page.
- Product page notes:
  - TODO: extract EAN/GTIN/MPN and variant details.

## Notino
- Search URL: `https://www.notino.ro/search.asp?exps=<query>`
- Listing page notes:
  - TODO: capture CSS selectors for list items, price, title, image, link.
  - TODO: check for JSON-LD or embedded data on search page.
- Product page notes:
  - TODO: extract size (ml/g), product line, and identifiers.

## BebeTei
- Search URL: `https://comenzi.bebetei.ro/cauti/<query>`
- Listing page notes:
  - TODO: capture CSS selectors for list items, price, title, image, link.
  - TODO: check for JSON-LD or embedded data on search page.
- Product page notes:
  - TODO: extract EAN/GTIN and pack size.

## Extraction checklist
- Verify unauthenticated access in an incognito window.
- Confirm that query params/paths are stable for multi-word searches.
- Determine whether prices are in HTML, JSON-LD, or fetched via XHR.
- Record selectors and sample HTML snippets for regression tests.
