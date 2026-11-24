/** Test data only. */

import type { CatechismText } from './catechisms.ts';

/** A small stand-in for static/catechisms/wsc.json. */
export const FIXTURE: CatechismText = {
	id: 'wsc',
	source: 'test',
	questions: [
		{
			n: 1,
			q: 'What is the chief end of man?',
			a: 'Man’s chief end is to glorify God, and to enjoy him for ever.',
			proofs: ['1 Corinthians 10:31', 'Psalm 73:25–28']
		},
		{
			n: 2,
			q: 'What rule hath God given to direct us how we may glorify and enjoy him?',
			a: 'The word of God, which is contained in the scriptures of the Old and New Testaments, is the only rule to direct us how we may glorify and enjoy him.',
			proofs: ['Ephesians 2:20']
		},
		{ n: 3, q: 'Is 1 < 2 & "so"?', a: 'Yes: 1 < 2 & "so" — well-being.', proofs: [] },
		// WSC 31: long enough (45 words) to be split into two parts.
		{
			n: 4,
			q: 'What is effectual calling?',
			a: 'Effectual calling is the work of God’s Spirit, whereby, convincing us of our sin and misery, enlightening our minds in the knowledge of Christ, and renewing our wills, he doth persuade and enable us to embrace Jesus Christ, freely offered to us in the gospel.',
			proofs: ['2 Timothy 1:9']
		}
	]
};
