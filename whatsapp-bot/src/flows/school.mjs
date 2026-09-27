/**
 * Open Schooling — 10th/12th via NIOS, BBOSE, BOSSE, NWAC.
 *
 * Branches as the brief lays out: Fail/Compartment goes to failed subjects and
 * the marksheet (TOC may apply); Improvement to current and target marks;
 * JEE/IIT to PCM and target year; New Admission skips exam-result questions.
 */

import { say } from '../tone.mjs'

const o = (value, label, ...match) => ({ value, label, match })

const failed = a => a.situation === 'Fail' || a.situation === 'Compartment'
const improving = a => a.situation === 'Improvement'
const jee = a => a.situation === 'JEE/IIT 75%'
const newAdmission = a => a.situation === 'New Admission'

export const school = {
  id: 'school',
  department: () => 'Open School',
  welcome: p => say(p,
    'Hello! 😊 Welcome to Distance Courses Wala. Hum 10th & 12th Open Schooling admission me guidance dete hain.',
    'Namaste! 🙏 Welcome to Distance Courses Wala. Hum 10th & 12th Open Schooling admission me guidance dete hain — aapke bachche ka case samajh lete hain.'),

  steps: [
    {
      id: 'class', fill: true, fillFromQuestions: true, slot: 'klass', label: 'Class', kind: 'option',
      ask: p => say(p, 'Aap 10th ke liye admission chahte hain ya 12th ke liye?',
                       'Bachche ke liye 10th ka admission chahiye ya 12th ka?'),
      options: [
        o('10th', '10th', /\b10(th)?\b/, /\bdasvi\b/, /\bdaswi\b/, /\bmatric\b/, /\bsecondary\b(?!.*senior)/),
        o('12th', '12th', /\b12(th)?\b/, /\bbarahvi\b/, /\bbarhvi\b/, /\binter(mediate)?\b/, /\bsenior secondary\b/),
      ],
    },
    {
      id: 'situation', fill: true, fillFromQuestions: true, slot: 'situation', label: 'Purpose', kind: 'option',
      ask: (p, a) => say(p,
        `${a.klass ?? 'Class'} me aapki current situation kya hai?`,
        `${a.klass ?? 'Class'} me bachche ki current situation kya hai?`),
      options: [
        o('Fail', 'Fail ho gaya', /\bfail\b/, /\bfel\b/, /\bpass nahi\b/),
        o('Compartment', 'Compartment', /\bcompartment\b/, /\bcompart/, /\bsupplementary\b/, /\bsupply\b/),
        o('Improvement', 'Pass hoon, marks improve karne hain', /\bimprove/, /\bmarks (badhane|badhana|increase)\b/, /\bnumber badhane\b/),
        o('New Admission', 'Abhi tak nahi ki / New admission', /\bnew admission\b/, /\babhi tak nahi\b/, /\bnahi ki\b/, /\bfresh\b/, /\bpehli baar\b/),
        o('JEE/IIT 75%', 'IIT/JEE ke liye 75%+ chahiye', /\b(jee|iit|nit|75\s*%|75 percent)\b/),
      ],
    },
    {
      id: 'board', fill: true, fillFromQuestions: true, slot: 'previousBoard', label: 'Previous Board', kind: 'option',
      ask: (p, a) => newAdmission(a)
        ? say(p, 'Pichhli class aapne kis board se padhi thi?', 'Bachche ne pichhli class kis board se padhi thi?')
        : say(p, 'Aap kis board se padh rahe the?', 'Bachcha kis board se padh raha tha?'),
      options: [
        o('CBSE', 'CBSE', /\bcbse\b/, /\bcentral board\b/),
        o('Bihar Board', 'Bihar Board (BSEB)', /\bbihar board\b/, /\bbseb\b/, /\bbihar\b/),
        o('ICSE', 'ICSE', /\bicse\b/, /\bisc\b/),
        o('Other State Board', 'Other State Board', /\b(up|jharkhand|jac|mp|rajasthan|west bengal|wb) board\b/, /\bstate board\b/),
        o('Open Board', 'Pehle se open board (NIOS etc.)', /\b(nios|bbose|bosse|open board)\b/),
        o('Other', 'Other', /\bother\b/),
      ],
    },
    {
      id: 'year', slot: 'examYear', label: 'Exam Year', kind: 'year', when: a => !newAdmission(a),
      ask: () => 'Result kis year me aaya tha? (Jaise 2025)',
    },
    {
      id: 'subject_count', slot: 'subjectCount', label: 'Subjects with problem', kind: 'subjects',
      when: a => failed(a) || improving(a),
      // ask() is called as (persona, answers) — take both, or the answers
      // arrive in the persona slot and a failed student is asked about
      // "improving" marks.
      ask: (p, a) => failed(a)
        ? 'Kitne subjects me fail/compartment hai? (1, 2, 3, 4+ ya sabhi)'
        : 'Kitne subjects ke marks improve karne hain? (1, 2, 3, 4+ ya sabhi)',
    },
    {
      id: 'subjects', slot: 'subjects', label: 'Subjects', kind: 'text',
      when: a => failed(a) || improving(a),
      ask: () => 'Kaunse subjects? Naam bhej dijiye. (Jaise Physics, Maths)',
    },
    {
      id: 'current_percent', slot: 'currentPercent', label: 'Current %', kind: 'percent',
      when: a => improving(a) || jee(a),
      ask: p => say(p, 'Abhi aapke kitne percent hain?', 'Bachche ke abhi kitne percent hain?'),
    },
    {
      id: 'target', slot: 'targetPercent', label: 'Target %', kind: 'option',
      when: a => improving(a) || jee(a),
      ask: () => 'Target percentage kya hai?',
      options: [
        o('75%+', '75%+', /\b7[5-9]\s*%?/, /\b75\+/),
        o('80%+', '80%+', /\b8[0-9]\s*%?/, /\b80\+/),
        o('90%+', '90%+', /\b9[0-9]\s*%?/, /\b90\+/),
        o('Other', 'Other', /\bother\b/),
      ],
    },
    {
      id: 'pcm', slot: 'pcm', label: 'PCM', kind: 'option',
      when: a => jee(a) && a.klass !== '10th',
      ask: () => '12th me PCM (Physics, Chemistry, Maths) hai?',
      options: [
        o('Yes', 'Haan, PCM hai', /^(haan|han|ha|yes|y|hai)$/, /\bpcm hai\b/, /\bpcm\b/),
        o('No', 'Nahi', /^(nahi|nhi|no|n|nahin)$/, /\bpcm nahi\b/, /\bpcb\b/, /\barts\b/, /\bcommerce\b/),
      ],
    },
    {
      id: 'deadline', slot: 'deadline', label: 'Deadline', kind: 'year',
      when: a => jee(a),
      ask: () => 'Kis saal ke admission/JEE ka target hai? (Jaise 2027)',
    },
    {
      id: 'city', slot: 'city', label: 'City', kind: 'place',
      ask: () => 'Aap kis city se hain?',
    },
    {
      id: 'documents', slot: 'documents', label: 'Documents', kind: 'option',
      ask: (p, a) => failed(a) || improving(a)
        ? say(p, 'Marksheet available hai? Clear photo yahin bhej sakte hain — isse case jaldi verify hoga.',
                 'Bachche ki marksheet available hai? Clear photo yahin bhej sakte hain — isse case jaldi verify hoga.')
        : 'Documents (marksheet, Aadhaar) available hain?',
      options: [
        o('Available', 'Haan, available hai', /^(haan|han|ha|yes|y|hai|available|ready)$/, /\b(available hai|ready hai|haan hai)\b/),
        o('Photo Available', 'Photo bhej raha hoon', /\bphoto\b/, /\bpic\b/, /\bscan\b/, /\bbhej (raha|rahi|dunga|dungi)\b/),
        o('Not Available', 'Abhi nahi hai', /^(nahi|nhi|no|n|nahin)$/, /\b(nahi hai|abhi nahi|kho gayi)\b/),
      ],
    },
  ],

  /** The brief's "qualified lead output format", open-schooling edition. */
  summary(a) {
    return [
      a.klass,
      a.previousBoard,
      a.examYear && `Exam ${a.examYear}`,
      a.situation && a.subjectCount ? `${a.subjectCount} ${a.situation === 'Improvement' ? 'to improve' : a.situation.toLowerCase()}` : a.situation,
      a.subjects,
      a.currentPercent && `Current ${a.currentPercent}`,
      a.targetPercent && `Target ${a.targetPercent}`,
      a.pcm && `PCM: ${a.pcm}`,
      a.documents && `Marksheet: ${a.documents}`,
      a.city && `City: ${a.city}`,
      a.deadline && `Deadline: ${a.deadline} admission`,
    ].filter(Boolean).join(' | ')
  },
}
