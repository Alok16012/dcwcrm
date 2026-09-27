/**
 * DCW's answers to the questions students actually ask, taken from the two
 * chatbot briefs (Distance & Online College, Open Schooling).
 *
 * This is the "training data". It is matched locally, by pattern, so the
 * common questions cost nothing and always get the approved wording. The AI
 * is only asked about questions none of these cover — and even then it is
 * handed the knowledge blocks at the bottom of this file, not the internet.
 *
 * Every answer here follows the briefs' hard rule: no guarantees, no fee
 * figures, no fixed dates.
 */

import { normalize } from './nlu.mjs'
import { say } from './tone.mjs'

const COUNSELOR_NOTE = 'Counselor aapka case verify karke exact details batayega.'

/** @type {{id:string, flow:'college'|'school'|'any', match:RegExp[], answer:(p:any)=>string, escalate?:boolean, sets?:Record<string,string>}[]} */
export const FAQ = [
  // ---------------------------------------------------------- both flows ---
  {
    id: 'fees', flow: 'any',
    match: [/\b(fee|fees|fis|kitne ka|kitna paisa|kitna lagega|kitna kharcha|charges?|price|cost)\b/],
    answer: () =>
      'Fee course/board, mode aur programme ke according alag hoti hai, isliye bina details ke amount batana sahi nahi hoga. ' +
      'Aapki details complete hote hi counselor aapko current, verified fee aur payment options batayega.',
  },
  {
    id: 'cheapest', flow: 'any',
    match: [/\b(sabse sasta|sasta|cheapest|kam fee|low fee|kam paise)\b/],
    answer: () =>
      'Sirf fee dekh kar choose karna advisable nahi hai — purpose, eligibility, subjects aur future admission requirement bhi utne hi zaroori hain. ' +
      'Aap details share karein, applicable options explain kiye jayenge.',
  },
  {
    id: 'installment', flow: 'any',
    match: [/\b(installment|instalment|kisht|kishto|emi|part payment|tukdo me)\b/],
    sets: { feeInterest: 'Installment' },
    answer: () =>
      'Ji, main note kar leta hoon ki aap installment/payment options bhi dekhna chahte hain. ' +
      'Counselor complete fee structure ke saath payment options explain karega.',
  },
  {
    id: 'guarantee', flow: 'any',
    match: [/\b(guarantee|garanti|pakka|100\s*%|100 percent|sure hai|confirm hai)\b/],
    answer: () =>
      'Result, admission aur eligibility official rules, documents aur performance par depend karte hain, isliye 100% guarantee nahi di ja sakti. ' +
      'DCW admission process, documentation aur guidance me poora support karta hai.',
  },
  {
    id: 'dcw_support', flow: 'any',
    match: [/\b(dcw|distance courses? wala|aap log|aapki company|aapka institute)\b.*\b(kya|support|help|karte|dete)\b/, /\bkya support\b/, /\bkya help\b/],
    answer: () =>
      'DCW course aur board/university selection guidance, admission aur documentation assistance, application process, fee/payment guidance ' +
      'aur exam process me support deta hai. Exact facilities programme ke according confirm hoti hain.',
  },
  {
    id: 'after_admission', flow: 'any',
    match: [/\badmission ke baad\b/, /\bbaad me (bhi )?support\b/],
    answer: () =>
      'Ji, admission ke baad bhi student queries aur process ke coordination me DCW support karta hai. ' +
      'Exam, assignment aur academic process ki exact responsibility programme ke according verify hogi.',
  },
  {
    id: 'online_process', flow: 'any',
    match: [/\badmission online\b/, /\bonline (ho|hoga|ho jayega|ho sakta)\b/, /\bghar (se|baithe)\b/, /\baana padega\b/, /\boffice aana\b/],
    answer: () =>
      'Initial admission process aur documentation kaafi had tak online coordinate ho jata hai; exact process board/university ke according depend karta hai.',
  },
  {
    id: 'just_info', flow: 'any',
    match: [/\b(sirf|bas|abhi) (information|info|jankari|details?)\b/, /\bjust exploring\b/, /\babhi decide nahi\b/, /\bsoch (raha|rahi) hu\b/],
    sets: { timeline: 'Just exploring' },
    answer: () =>
      'Bilkul, koi problem nahi — pehle information lijiye. Main aapki requirement note kar leta hoon; ' +
      'jab bhi aap ready hon, yahin message kar dijiye.',
  },
  {
    id: 'send_marksheet', flow: 'any',
    match: [/\bmarksheet (bhej|send|de) (sakta|sakti|sakte|du|doon)\b/, /\bphoto bhej(u|oon|du)\b/, /\bdocument bhej\b/],
    answer: () =>
      'Ji, agar aap comfortable hain to marksheet ka clear photo yahin bhej dijiye — isse counselor aapka case jaldi verify kar payega.',
  },

  // ------------------------------------------------------- college flow ---
  {
    id: 'online_vs_distance', flow: 'college',
    match: [/\b(online|distance)\b.*\b(difference|farak|fark|antar|kya alag)\b/, /\b(difference|farak|fark)\b.*\b(online|distance)\b/],
    answer: () =>
      'Simple language me: online mode me learning/content ka bada hissa online platform par hota hai, jabki distance mode flexible self-learning model ho sakta hai. ' +
      'Exact academic process university aur programme ke according alag ho sakta hai.',
  },
  {
    id: 'degree_valid', flow: 'college',
    match: [/\b(degree|course)\b.*\b(valid|recogni[sz]ed|manya|ugc|approved|fake|asli)\b/, /\b(valid|ugc|recogni[sz]ed)\b.*\b(hai|hogi|hoga)\b/],
    answer: () =>
      'Online/distance programme ki recognition aur acceptance specific university, programme aur applicable regulatory requirements par depend karti hai. ' +
      'Aap university aur course bataiye, current details verify karwa di jayengi.',
  },
  {
    id: 'govt_job', flow: 'college',
    match: [/\b(government|govt|sarkari)\b.*\b(job|naukri|exam)\b/],
    answer: () =>
      'Government job eligibility us recruitment notification, required qualification aur university/programme status par depend karti hai. ' +
      'Kisi specific vacancy ya exam ka naam bataiye to uski requirement check karwa sakte hain.',
  },
  {
    id: 'abroad', flow: 'college',
    match: [/\b(abroad|videsh|foreign|bahar ke desh|canada|uk|usa|australia|dubai)\b/],
    answer: () =>
      'Videsh me acceptance us institution, country aur credential evaluation par depend karti hai. ' +
      'Aap country aur target institution bataiye — iske liye specific verification zaroori hogi.',
  },
  {
    id: 'low_percent_eligibility', flow: 'college',
    match: [/\b\d{2}\s*%?.*\b(kar sakta|kar sakti|kar sakte|eligible|ho jayega|milega)\b/, /\b(eligib|eligibility)\b/],
    escalate: true,
    answer: () =>
      'Course-wise eligibility aur university requirements alag ho sakti hain. Aap apni marksheet aur preferred course share kar dijiye — ' +
      COUNSELOR_NOTE,
  },
  {
    id: 'manglayatan', flow: 'college',
    match: [/\bmang(a)?l(a)?y(a)?tan\b/],
    sets: { university: 'Manglayatan' },
    answer: () =>
      'Bilkul. DCW Manglayatan University ke available distance/online programmes ke liye admission guidance deta hai. ' +
      'Aap UG ya PG aur course bata dijiye, relevant option check kar lete hain.',
  },
  {
    id: 'mats', flow: 'college',
    match: [/\bmats\b/],
    sets: { university: 'MATS' },
    answer: () =>
      'Sure. Aapka course aur qualification bata dijiye — MATS University ke available programme aur admission details counselor verification ke liye forward kar denge.',
  },
  {
    id: 'shubharti', flow: 'college',
    match: [/\bsh?ubh?arti\b/, /\bsubharti\b/],
    sets: { university: 'Shubharti' },
    answer: () =>
      'Sure. Aap UG ya PG aur course ka naam bata dijiye, uske according available programme details verify karwa di jayengi.',
  },

  // --------------------------------------------------- open schooling -----
  {
    id: 'toc', flow: 'school',
    match: [/\btoc\b/, /\btransfer of credit\b/],
    answer: () =>
      'TOC = Transfer of Credit. Previous board me pass kiye subjects ka credit, rules ke according, naye open board me consider ho sakta hai. ' +
      'Har case me TOC applicable nahi hota, isliye marksheet verify karna zaroori hai.',
  },
  {
    id: 'which_board', flow: 'school',
    match: [/\b(kaunsa|konsa|kon sa|which|best)\b.*\bboard\b/, /\bboard\b.*\b(best|achha|accha|sahi)\b/],
    answer: () =>
      'Sahi board aapke purpose, previous result, subjects, timeline aur future admission requirement par depend karta hai — isliye bina situation samjhe kisi ko "best" kehna theek nahi. ' +
      'Hum NIOS, BBOSE, BOSSE aur NWAC ke options par kaam karte hain.',
  },
  {
    id: 'nios_session', flow: 'school',
    match: [/\bnios\b/],
    sets: { preferredBoard: 'NIOS' },
    answer: () =>
      'NIOS me regular/public examination cycles aur On-Demand Examination options hote hain. Current schedule official notification ke according badal sakta hai.',
  },
  {
    id: 'bbose_session', flow: 'school',
    match: [/\bbbose\b/, /\bbihar board open\b/],
    sets: { preferredBoard: 'BBOSE' },
    answer: () =>
      'BBOSE me public examination cycles aam taur par June aur December ke aas-paas hote hain. Current admission/registration dates official notification se verify karni hongi.',
  },
  {
    id: 'bosse_session', flow: 'school',
    match: [/\bbosse\b/],
    sets: { preferredBoard: 'BOSSE' },
    answer: () =>
      'BOSSE ke examination cycles aam taur par April–May aur October–November ke aas-paas hote hain. Current dates official notification se verify karni hongi.',
  },
  {
    id: 'nwac_session', flow: 'school',
    match: [/\bnwac\b/],
    sets: { preferredBoard: 'NWAC' },
    answer: () =>
      'DCW ke current internal admission chart ke according NWAC ke liye 2026–27 Regular session listed hai.',
  },
  {
    id: 'last_date', flow: 'school',
    match: [/\blast date\b/, /\bantim tithi\b/, /\bdeadline\b/, /\bkab tak (admission|form)\b/],
    answer: () =>
      'Admission/registration ki last date board aur session ke according badalti rehti hai, isliye current date counselor verify karke batayega.',
  },
  {
    id: 'documents', flow: 'school',
    match: [/\b(document|documents|kagaz|kaagaz|papers?)\b.*\b(kya|kaun|konse|chahiye|lagenge|required)\b/],
    answer: () =>
      'Initial eligibility check ke liye generally previous marksheet, Aadhaar/valid ID, passport-size photo, previous board details, ' +
      'aur 12th ke liye 10th ki marksheet kaam aati hai. Exact list board ke according confirm hogi.',
  },
  {
    id: 'no_marksheet', flow: 'school',
    match: [/\bmarksheet (nahi|nhi|nahin) hai\b/, /\bmarksheet kho\b/, /\bmarksheet lost\b/],
    answer: () =>
      'Koi baat nahi. Abhi type karke bhej dijiye: Board, Class, Exam Year, Subjects aur Result (Pass/Fail/Compartment). Marksheet photo baad me bhi bhej sakte hain.',
  },
  {
    id: 'age', flow: 'school',
    match: [/\b(age|umar|umra)\b/, /\b(2[0-9]|3[0-9]|4[0-9]) (saal|years?|yrs?)\b/],
    answer: () =>
      'Eligibility age, class aur board ke rules par depend karti hai. Please apni age, 10th/12th aur previous board share kar dijiye.',
  },
  {
    id: 'gap', flow: 'school',
    match: [/\bgap\b/, /\bsaal (se )?padhai (chhod|band)\b/],
    answer: () =>
      'Gap hone se admission apne aap impossible nahi ho jata — exact eligibility board rules aur documents par depend karegi.',
  },
  {
    id: 'result_time', flow: 'school',
    match: [/\bkitne din (me|mein) result\b/, /\bresult kab\b/, /\bjaldi result\b/],
    answer: () =>
      'Result timeline board ke examination cycle aur official declaration par depend karti hai. Agar kisi specific deadline tak certificate chahiye, wo deadline bata dijiye.',
  },
  {
    id: 'certificate_valid', flow: 'school',
    match: [/\bcertificate\b.*\b(valid|manya|chalega|accept)\b/, /\b(open board|open school)\b.*\b(valid|manya|chalega|accept)\b/],
    answer: () =>
      'Certificate ki acceptance aapke board, course aur aage ki institution/authority ke rules par depend karti hai. ' +
      'Aapka target (JEE/IIT, college ya job) bataiye to relevant eligibility verify karwa denge.',
  },
  {
    id: 'direct_board', flow: 'school',
    match: [/\bdirect board\b/, /\bkhud (se )?kar (lunga|lungi|lenge)\b/, /\baapko kyu\b/, /\baapse kyu\b/],
    answer: () =>
      'Direct board admission bhi board ke according available ho sakta hai. DCW ka role admission guidance, documentation, session selection aur student assistance ka hai. ' +
      'Chahein to pehle hum aapki basic eligibility check kar lete hain.',
  },
  {
    id: 'jee_75', flow: 'school',
    match: [/\b(jee|iit|nit|iiit|josaa)\b/],
    sets: { situation: 'JEE/IIT 75%' },
    escalate: true,
    answer: () =>
      'JEE Main dena aur IIT/NIT admission eligibility alag cheezein hain. 75% criterion admission eligibility ke context me apply ho sakta hai, aur ye year/category ke according current JEE/JoSAA rules par depend karta hai. ' +
      'Open schooling qualification ki acceptance ki 100% guarantee nahi di ja sakti — counselor aapka case current rules se verify karega.',
  },
  {
    id: 'fail_open_board', flow: 'school',
    match: [/\b(fail|compartment|supplementary)\b.*\b(open|nios|board se|kar sakta|kar sakti|ho sakta)\b/],
    answer: () =>
      'Aapke case me Open Schooling ek possible route ho sakta hai, par exact option previous board, subjects, result aur documents par depend karega.',
  },
]

/**
 * Find the approved answer for a question, if one exists.
 * Only entries for the current flow (or 'any') are considered, so a college
 * student asking about "board" does not get an Open Schooling answer.
 */
export function matchFaq(text, flow) {
  const t = normalize(text)
  const pool = FAQ.filter(f => f.flow === 'any' || f.flow === flow || flow == null)
  return pool.find(f => f.match.some(re => re.test(t))) ?? null
}

export function renderFaq(entry, persona) {
  return entry.answer(persona)
}

// ------------------------------------------------------ AI knowledge ------
// Handed to the AI only for questions none of the entries above cover. Kept
// short: it is the facts, not the script.

export const KNOWLEDGE = {
  college: `DCW (Distance Courses Wala) gives admission guidance for distance and online UG/PG programmes.
Universities DCW works with: Manglayatan University (primary), MATS University, Shubharti University.
UG courses: BBA, BCA, BA, B.Com. PG courses: MBA, MCA, MA, M.Com.
DCW helps with course/university selection, admission and documentation, application process, fee/payment guidance, exam process guidance and query coordination.
Eligibility, recognition, validity, fees and dates depend on the university, programme and current rules, and are verified by a counselor.`,
  school: `DCW (Distance Courses Wala) gives admission guidance for 10th and 12th Open Schooling.
Boards DCW works with: NIOS, BBOSE, BOSSE, NWAC.
Common cases: fail, compartment, marks improvement, new admission, and students targeting 75% for JEE/IIT eligibility.
TOC (Transfer of Credit) can let passed subjects from a previous board count, subject to rules and marksheet verification.
NIOS has public exam cycles and On-Demand exams. BBOSE cycles are usually around June and December. BOSSE around April-May and October-November. NWAC 2026-27 Regular session is on DCW's internal chart.
Eligibility, fees, dates and IIT/JEE acceptance depend on current official rules and are verified by a counselor.`,
}
