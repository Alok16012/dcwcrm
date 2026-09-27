/**
 * Distance & Online College — UG/PG admission qualification.
 *
 * Follows the brief's recommended first ten questions and its conditional
 * logic: UG asks about 12th, PG about graduation; a working professional is
 * asked why they want the degree; an undecided student is not pushed to name
 * a university.
 */

import { say } from '../tone.mjs'

const o = (value, label, ...match) => ({ value, label, match })

const isUG = a => a.level === 'UG'
const isPG = a => a.level === 'PG'

export const college = {
  id: 'college',
  department: a => (a.mode === 'Online' ? 'Online' : 'Distance'),
  welcome: p => say(p,
    'Hi! 😊 Main aapki college admission requirement samajhne me help karta hoon — bas kuch chhote sawaal.',
    'Namaste! 🙏 Main aapke bachche ki college admission requirement samajhne me help karta hoon — bas kuch chhote sawaal.'),

  steps: [
    {
      id: 'level', fill: true, fillFromQuestions: true, slot: 'level', label: 'Admission Level', kind: 'option',
      ask: p => say(p, 'Aap UG (Graduation) ke liye admission dekh rahe hain ya PG (Post Graduation)?',
                       'Aap bachche ke liye UG (Graduation) dekh rahe hain ya PG (Post Graduation)?'),
      options: [
        o('UG', 'UG (Graduation)', /\bug\b/, /(?<!post ?)\bgraduation\b/, /\bbachelor/, /\bb\.?\s?(a|com|ba|ca|sc)\b/, /\bbba\b/, /\bbca\b/),
        o('PG', 'PG (Post Graduation)', /\bpg\b/, /\bpost ?graduation\b/, /\bmasters?\b/, /\bmba\b/, /\bmca\b/, /\bm\.?\s?(a|com)\b/),
        o('Not Sure', 'Not Sure', /\bnot sure\b/, /\bpata nahi\b/, /\bpta nhi\b/, /\bconfus/),
      ],
    },
    {
      id: 'course_ug', fill: true, fillFromQuestions: true, slot: 'course', label: 'Course', kind: 'option', when: isUG,
      ask: () => 'Graduation me kis course me interested hain?',
      options: [
        o('BBA', 'BBA', /\bbba\b/),
        o('BCA', 'BCA', /\bbca\b/),
        o('BA', 'BA', /\bb\.?\s?a\b(?!\w)/, /\barts\b/),
        o('B.Com', 'B.Com', /\bb\.?\s?com\b/, /\bcommerce\b/),
        o('Other', 'Other', /\bother\b/, /\bkoi aur\b/, /\baur koi\b/),
        o('Not Sure', 'Not Sure', /\bnot sure\b/, /\bpata nahi\b/, /\bpta nhi\b/, /\bdecide nahi\b/),
      ],
    },
    {
      id: 'course_pg', fill: true, fillFromQuestions: true, slot: 'course', label: 'Course', kind: 'option', when: isPG,
      ask: () => 'PG me kis course me interested hain?',
      options: [
        o('MBA', 'MBA', /\bmba\b/),
        o('MCA', 'MCA', /\bmca\b/),
        o('MA', 'MA', /\bm\.?\s?a\b(?!\w)/),
        o('M.Com', 'M.Com', /\bm\.?\s?com\b/),
        o('Other', 'Other', /\bother\b/, /\bkoi aur\b/),
        o('Not Sure', 'Not Sure', /\bnot sure\b/, /\bpata nahi\b/, /\bdecide nahi\b/),
      ],
    },
    {
      id: 'qualification', slot: 'qualification', label: 'Highest Qualification', kind: 'option',
      ask: (p, a) => isPG(a)
        ? say(p, 'Aapki graduation ka status kya hai?', 'Bachche ki graduation ka status kya hai?')
        : say(p, 'Aapki highest qualification kya hai?', 'Bachche ki highest qualification kya hai?'),
      options: [
        o('12th Passed', '12th Passed', /\b12(th)?\b.*\bpass/, /\binter\b.*\bpass/, /^12(th)?$/),
        o('12th Appearing', '12th Appearing', /\b12(th)?\b.*\b(appearing|de raha|de rahi|chal raha|abhi)\b/),
        o('Diploma', 'Diploma', /\bdiploma\b/, /\bpolytechnic\b/, /\biti\b/),
        o('Graduation Passed', 'Graduation Passed', /\bgraduat(e|ion)\b.*\b(pass|complete|done|ho gaya)/, /\b(ba|bsc|bcom|bba|bca|btech)\b.*\bpass/),
        o('Final Year', 'Graduation Final Year', /\bfinal year\b/, /\blast year\b/, /\b3rd year\b/),
        o('Other', 'Other', /\bother\b/),
      ],
    },
    {
      id: 'percent', slot: 'percent', label: 'Percentage/CGPA', kind: 'percent',
      ask: (p, a) => say(p,
        `Approximate percentage ya CGPA kitna hai${isPG(a) ? ' graduation me' : ''}? (Jaise 57% ya 7.2 CGPA)`,
        `Bachche ke approximate percentage ya CGPA kitne hain? (Jaise 57% ya 7.2 CGPA)`),
    },
    {
      id: 'mode', fill: true, slot: 'mode', label: 'Mode Preference', kind: 'option',
      ask: () => 'Aap Online mode prefer karenge ya Distance?',
      options: [
        o('Online', 'Online', /^(?!.*\b(distance|dono|both)\b).*\bonline\b/),
        o('Distance', 'Distance', /^(?!.*\b(online|dono|both)\b).*\b(distance|correspondence)\b/),
        o('Both', 'Dono options bataiye', /\b(dono|both)\b/),
        o('Not Sure', 'Not Sure', /\bnot sure\b/, /\bpata nahi\b/, /\bsamajh nahi\b/),
      ],
    },
    {
      id: 'university', fill: true, slot: 'university', label: 'University Preference', kind: 'option',
      ask: () => 'Koi university decide ki hai?',
      options: [
        o('Manglayatan', 'Manglayatan University', /\bmang(a)?l(a)?y(a)?tan\b/),
        o('MATS', 'MATS University', /\bmats\b/),
        o('Shubharti', 'Shubharti University', /\bsh?ubh?arti\b/, /\bsubharti\b/),
        o('Not Decided', 'Abhi decide nahi / Options bataiye', /\bnot decided\b/, /\bdecide nahi\b/, /\boptions? (batao|bataiye)\b/, /\bpata nahi\b/, /\bkoi bhi\b/),
      ],
    },
    {
      id: 'purpose', slot: 'purpose', label: 'Career Purpose', kind: 'option',
      ask: p => say(p, 'Degree kis purpose se karna chahte hain?', 'Bachcha degree kis purpose se karna chahta hai?'),
      options: [
        o('Job + qualification', 'Job ke saath qualification', /\bjob ke saath\b/, /\bnaukri ke saath\b/),
        o('Career growth', 'Career growth', /\bgrowth\b/, /\bcareer\b/),
        o('Promotion', 'Promotion', /\bpromotion\b/, /\bpromote\b/),
        o('Business', 'Business', /\bbusiness\b/, /\bdhanda\b/, /\bvyapar\b/),
        o('Govt Job', 'Government job', /\b(govt|government|sarkari)\b/),
        o('Higher Studies', 'Higher studies', /\bhigher stud/, /\baage padh/, /\bphd\b/),
        o('Other', 'Other', /\bother\b/, /\bpersonal\b/),
      ],
    },
    {
      id: 'work', slot: 'workStatus', label: 'Work Status', kind: 'option',
      ask: p => say(p, 'Aap abhi kya kar rahe hain?', 'Bachcha abhi kya kar raha hai?'),
      options: [
        o('Job', 'Full-time job', /\b(job|naukri|service|kaam) (kar|karta|karti|karte)\b/, /\bfull.?time\b/, /\bworking\b/),
        o('Business', 'Business', /\bbusiness\b/, /\bdukaan\b/, /\bdhanda\b/),
        o('Part-time', 'Part-time work', /\bpart.?time\b/),
        o('Student', 'Student', /\bstudent\b/, /\bpadh (raha|rahi)\b/, /\bpadhai\b/),
        o('Not Working', 'Not working', /\bnot working\b/, /\bkuch nahi\b/, /\bghar pe\b/, /\bberozgar\b/),
      ],
    },
    {
      id: 'city', slot: 'city', label: 'City/State', kind: 'place',
      ask: () => 'Aap kis city/state se hain?',
    },
    {
      id: 'timeline', slot: 'timeline', label: 'Admission Timeline', kind: 'option',
      ask: () => 'Admission kab tak lena chahte hain?',
      options: [
        o('Immediately', 'Immediately', /\b(immediately|turant|abhi|jaldi|asap|urgent)\b/),
        o('Within 7 days', 'Within 7 days', /\b(7 din|saat din|week|hafte)\b/),
        o('This month', 'This month', /\b(is mahine|this month|isi mahine)\b/),
        o('Next month', 'Next month', /\b(agle mahine|next month)\b/),
        o('Just exploring', 'Abhi sirf information', /\b(exploring|sirf info|information|abhi nahi|dekh raha|soch raha)\b/),
      ],
    },
    {
      id: 'documents', slot: 'documents', label: 'Document Status', kind: 'option',
      ask: p => say(p, 'Marksheet/documents available hain?', 'Bachche ki marksheet/documents available hain?'),
      options: [
        o('Available', 'Haan, ready hain', /^(haan|han|ha|yes|y|hai|available|ready)$/, /\b(ready hai|available hai|haan hai)\b/),
        o('Photo Available', 'Photo bhej sakta hoon', /\bphoto\b/, /\bpic\b/, /\bscan\b/),
        o('Not Available', 'Abhi nahi hai', /^(nahi|nhi|no|n|nahin)$/, /\b(nahi hai|abhi nahi|pass nahi)\b/),
        o('Later', 'Baad me share karunga', /\bbaad me\b/, /\blater\b/, /\bkal\b/),
      ],
    },
  ],

  /** The brief's "qualified lead output format", college edition. */
  summary(a) {
    return [
      a.level, a.course,
      a.qualification && `${a.qualification}${a.percent ? ` ${a.percent}` : ''}`,
      a.mode && `Mode: ${a.mode}`,
      a.university && `Uni: ${a.university}`,
      a.purpose, a.workStatus,
      a.city,
      a.timeline && `Timeline: ${a.timeline}`,
      a.documents && `Docs: ${a.documents}`,
    ].filter(Boolean).join(' | ')
  },
}
