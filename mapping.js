{ 'ἀ': 'α',
  'ἁ': 'α',
  'ἂ': 'ὰ',
  'ἃ': 'ὰ',
  'ἄ': 'ά',
  'ἅ': 'ά',
  'ἆ': 'ᾶ',
  'ἐ': 'ε',
  'ἑ': 'ε',
  'ἓ': 'ὲ',
  'ἔ': 'έ',
  'ἕ': 'έ',
  'ἠ': 'η',
  'ἡ': 'η',
  'ἢ': 'ὴ',
  'ἣ': 'ὴ',
  'ἤ': 'ή',
  'ἥ': 'ή',
  'ἦ': 'ῆ',
  'ἧ': 'ῆ',
  'ἰ': 'ι',
  'ἱ': 'ι',
  'ἳ': 'ὶ',
  'ἴ': 'ί',
  'ἵ': 'ί',
  'ἶ': 'ῖ',
  'ἷ': 'ῖ',
  'ὀ': 'ο',
  'ὁ': 'ο',
  'ὂ': 'ὸ',
  'ὃ': 'ὸ',
  'ὄ': 'ό',
  'ὅ': 'ό',
  'ὐ': 'υ',
  'ὑ': 'υ',
  'ὒ': 'ὺ',
  'ὓ': 'ὺ',
  'ὔ': 'ύ',
  'ὕ': 'ύ',
  'ὖ': 'ῦ',
  'ὗ': 'ῦ',
  'ὠ': 'ω',
  'ὡ': 'ω',
  'ὢ': 'ὼ',
  'ὤ': 'ώ',
  'ὥ': 'ώ',
  'ὦ': 'ῶ',
  'ὧ': 'ῶ',
  'ᾄ': 'ά',
  'ᾅ': 'ά',
  'ᾐ': 'η',
  'ᾑ': 'η',
  'ᾔ': 'ή',
  'ᾖ': 'ῆ',
  'ᾗ': 'ῆ',
  'ᾠ': 'ω',
  'ᾧ': 'ῶ',
  'ᾳ': 'α',
  'ᾴ': 'ά',
  'ᾷ': 'ᾶ',
  '᾽': '',
  '－': '',
  'ῃ': 'η',
  'ῄ': 'ή',
  'ῇ': 'ῆ',
  'ῥ': 'ρ',
  'ῳ': 'ω',
  'ῴ': 'ώ',
  'ῷ': 'ῶ' }

let mappingsEff = Object.entries(mappings).map(([k, v]) => [new RegExp(k, 'g'), v])

let mx2 = s => mappingsEff.reduce((acc, [k, v]) => acc.replace(k, v), s)

const normalise = s => s.toLowerCase().normalize('NFKD').replace(/[\u0313\u0314\u0345-]/g, '').normalize('NFC')

[...new Set([].concat(...results.map(r => r.text).map(s => mx2(s.toLowerCase()).split(''))))].sort().join('').trim()


// a clause finding algorithm given a text
text.replace(/[’.,·]/g, '').split(' ').map(t => normalise(t)).filter(t => t).map(w => [w, clauses.filter(c => c.search.includes(w)).sort(() => Math.random() < 0.5 ? 1 : -1).sort((a, b) => a.search.length < b.search.length ? -1 : 1).slice(0, 5).map(c => c.text + '  |  ' + c.plain)])

const rows = []; fs.createReadStream('rawtexts/OpenGNT_version3_3.csv').pipe(csv({ separator: '\t', mapHeaders: ({ header, index }) => header.trim(), mapValues: ({ header, index, value }) => value.trim() })).on('data', data => rows.push(data)).on('end', () => console.log('got:', rows.length)).on('error', e => console.warn('error:', e))
function split (r, key) { const v = r[key]; key = key.replace(/[〔〕]/g, '').split('｜'); const value = v.replace(/[〔〕]/g, '').split('｜'); key.forEach((k, i) => r[k] = value[i]); }
rows.forEach(r => { split(r, '〔BGBsortI｜LTsortI｜STsortI〕'); split(r, '〔Book｜Chapter｜Verse〕'); split(r, '〔OGNTk｜OGNTu｜OGNTa｜lexeme｜rmac｜sn〕'); split(r, '〔BDAGentry｜EDNTentry｜MounceEntry｜GoodrickKohlenbergerNumbers｜LN-LouwNidaNumbers〕'); split(r, '〔transSBLcap｜transSBL｜modernGreek｜Fonética_Transliteración〕'); split(r, '〔TBESG｜IT｜LT｜ST｜Español〕'); split(r, '〔PMpWord｜PMfWord〕'); split(r, '〔Note｜Mvar｜Mlexeme｜Mrmac｜Msn｜MTBESG〕'); })
rows.forEach(r => { Object.keys(r).forEach(k => r[k] = parseInt(r[k]) || r[k] ) })
