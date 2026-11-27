/** Display names for the supported translations, in the order the picker lists them. */

import type { TranslationId } from './model.ts';

export interface Translation {
	id: TranslationId;
	/** e.g. "BSB", shown on cards. */
	short: string;
	/** e.g. "Berean Standard Bible", shown in the picker. */
	name: string;
	/**
	 * Set when the text is not bundled under static/text/ but fetched at build time, verse by verse
	 * (the ESV, through the same-origin proxy; see sources/esv.ts).
	 */
	remote?: true;
	/** Notice the publisher requires wherever the text is shown, e.g. in the deck description. */
	copyright?: string;
	/** The publisher's site, linked from the translation name on every card and from the notice. */
	link?: string;
}

export const TRANSLATIONS: Record<TranslationId, Translation> = {
	bsb: { id: 'bsb', short: 'BSB', name: 'Berean Standard Bible' },
	web: { id: 'web', short: 'WEB', name: 'World English Bible' },
	kjv: { id: 'kjv', short: 'KJV', name: 'King James Version' },
	lsv: {
		id: 'lsv',
		short: 'LSV',
		name: 'Literal Standard Version',
		link: 'https://lsvbible.com',
		// CC BY-SA 4.0 asks for the copyright and source, a note of the changes, and the same license.
		copyright:
			'Literal Standard Version (LSV), copyright © 2020 Covenant Press, from eBible.org (https://ebible.org/find/details.php?id=engLSV), licensed under Creative Commons Attribution-ShareAlike 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Changes: the text is cut into flashcards, with long verses split into parts, lead-in verses and first-letter hints added. Covenant Press does not endorse these changes. This deck is shared under the same license.'
	},
	esv: {
		id: 'esv',
		short: 'ESV',
		name: 'English Standard Version',
		remote: true,
		link: 'https://www.esv.org',
		copyright:
			'ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.'
	}
};

/** Crossway's full notice, for the site's copyright page. */
export const ESV_COPYRIGHT_PAGE =
	'Scripture quotations marked “ESV” are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language. Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible.';
