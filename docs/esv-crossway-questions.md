# ESV API: questions for Crossway

manna.cards builds Anki flashcard decks (`.apkg` files) for memorizing Scripture. A user types a list of references, the site shows a preview, and the user downloads a deck file that they import into Anki, a free spaced-repetition app. Each card asks for one verse and shows the previous verse as a lead-in. Long verses are split across several cards. The site is free, non-commercial, has no ads, and takes no donations.

ESV support is built but runs **only on a private, access-restricted test site** until these questions are answered. Production (manna.cards) does not offer ESV.

## How ESV is used today (test site)

- **API key.** The key is held as a Cloudflare secret by a small server-side proxy (`/api/esv/passage`). It never reaches the browser, the git repository or the logs. The proxy fixes every API parameter, accepts only same-origin requests, and stores nothing.
- **Requests.** Each deck build sends at most one batched `passage/text` query, for only the verses the browser doesn't already hold. Every query stays within 500 verses and half a book.
- **Caching.** Text is cached in browser memory only, capped at 500 verses with least-recently-used eviction. It is never written to localStorage or IndexedDB and never cached on the server. Saved decks store references, not text.
- **Per-deck limits.** An ESV deck may contain at most 500 verses, and at most half of any one book. Lead-in verses count toward both limits. Larger decks are blocked with an explanation.
- **Attribution.**
  - Every card shows the reference and "ESV", linked to https://www.esv.org.
  - Wherever the site shows ESV text, it also shows "ESV" and a link to www.esv.org.
  - The About page carries the full notice, starting "Scripture quotations marked 'ESV' …", followed by the Creative Commons, translation and 500-verse sentences.
  - The deck file's description carries the copyright notice returned by the API.
- **Text.** Words, punctuation and capitalization are kept exactly as returned. Headings, footnotes and verse numbers are omitted, which the terms allow. Only line layout is adapted: poetry indentation and paragraph breaks.

## Questions

### Downloads and storage

1. **Is a downloadable Anki deck allowed?** The deck file holds up to 500 verses, which the user keeps permanently in Anki on their own devices, possibly synced through AnkiWeb. Does this count as the user "downloading" up to 500 verses, which the terms allow? Or is it a storage or redistribution use that needs a formal license?
2. **Does the 500-verse cap apply per deck, or per user in total?** A user can build several 500-verse decks, each one a separate download. We can't enforce a lifetime total, because there are no accounts. Is a per-deck limit enough?
3. **Do single- and double-chapter books have to stay under half a book?** The terms exempt them for _queries_. For _downloads_, the copyright notice says "more than one half of any book" with no exemption. We currently cap every book at half, which means a user can't download all of Philemon, Jude, 2 John or 3 John. Is that the intended reading, or do these books get the same exemption for downloads?
4. **Do lead-in verses count toward the limits?** Each card shows the previous verse as context, so a deck of John 3:16 also shows John 3:15. We count lead-in verses toward the 500-verse and half-book limits. Is that required, or do only the memorized verses count?
5. **Can users share deck files?** Users could share a downloaded deck with others, for example a church small group. Is that allowed as "redistribution" within the 500-verse and half-book rules? Should the site tell users not to share ESV decks?

### Changes to how the text is shown

6. **Is splitting a verse across cards allowed?** Long verses are split across several cards, at points the user can adjust. Each card asks for one part and shows the earlier parts as context. No words are changed, but a card shows only part of a verse. Is that acceptable?
7. **Is a first-letter hint allowed?** Cards have an optional hint that shows the first letter of each word, for example "F G s l t w" for "For God so loved the world". Is a derived aid like this allowed, or is it "changing the words"?
8. **Is moving "Selah" onto its own line acceptable?** The API returns "Selah" at the end of a poetry line. To match the site's other translations, it may be shown on its own line, as many printed Bibles do. No words are added or removed.
9. **Is it acceptable to omit psalm superscriptions?** A superscription such as "A Psalm of David…" is shown only on the card for verse 1. Would leaving it out entirely be acceptable, since it is closer to a heading?

### Attribution

10. **Is attribution on each card enough?** Each card is a "page" in Anki. It shows "ESV" linked to www.esv.org, and the deck description carries the copyright notice. Is that sufficient, or must every card carry the full copyright notice?
11. **Is the copyright notice wording right?** The About page uses the "Scripture quotations marked 'ESV' …" variant, because the site also offers public-domain translations (BSB, WEB, KJV). Is that the right variant?
12. **Which notice belongs in the deck file?** The deck description uses the notice the API returns: "ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway…". Should it be the longer copyright-page notice instead, including the Creative Commons, translation and 500-verse sentences?

### Technical and policy

13. **Is the proxy set-up acceptable?** The site is static, and a server-side proxy (a Cloudflare Worker) holds the key. Is that acceptable for a site where every visitor's requests go through one shared key? It's protected by same-origin checks and the site's own limits, but anyone can visit the public site.
14. **Is the site's licence a problem?** The site's source code is hosted on GitHub. ESV text is never committed to the repository, not even in test fixtures. Is a public, open-source codebase that calls the API acceptable, given the Creative Commons restriction applies to "publications"?
15. **Does the expected traffic fit the free rate limits?** If the site grows, all users share one key's limits: 5,000 queries a day, 1,000 an hour, 60 a minute. Is there a process for a higher limit for a non-commercial ministry tool, or should we expect to apply for a formal license? (The terms say formal licenses go to organizations only.)
16. **Is the derived versification data allowed?** To enforce the half-book limit, the site stores ESV verse counts per chapter, taken from the API's `passage_meta`. No text is kept. We assume verse counts aren't covered by copyright. Please confirm.
