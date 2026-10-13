/**
 * The bot's own admission questions, as a Flow Builder tree.
 *
 * Migration 120 stores this as the "Admission script" row in wa_flows so admin
 * can edit every question from the CRM (scripts/script-sql.mjs prints it).
 * Built from school.mjs and college.mjs so the words are the same, with the
 * branches those files express as `when` rules:
 *
 *   10th/12th → class → situation ─ Fail / Compartment ─ board, year, subjects ─┐
 *                                 ├ Improvement ─ … current %, target % ────────┤→ city, marksheet
 *                                 ├ New Admission ─ board ───────────────┐
 *                                 └ JEE/IIT ─ … PCM (12th only), year ───┴→ city, documents
 *   College   → level ─ UG / Not Sure ─ course, 12th, % ─┐
 *                     └ PG ─ course, graduation, % ──────┴→ mode … documents
 *
 * Steps keep the built-in answer they fill (`field`) and option `value`s, so
 * the bot still reads typed answers and builds the same lead fields.
 */

import { school } from './school.mjs'
import { college } from './college.mjs'
import { INTENT } from './index.mjs'

const STUDENT = { who: 'student' }
const PARENT = { who: 'parent' }
const ANSWER = { option: 'choice', percent: 'percent', year: 'year', place: 'place', subjects: 'subjects', text: 'text' }

function words(student, parent) {
  return parent && parent !== student ? { text: student, textParent: parent } : { text: student }
}

function stepOf(flow, id) {
  const s = flow.steps.find(x => x.id === id)
  if (!s) throw new Error(`no step ${flow.id}.${id}`)
  return s
}

function asked(s, answers) {
  return words(s.ask(STUDENT, answers), s.ask(PARENT, answers))
}

const slug = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

function ask(id, s, next, answers = {}) {
  return {
    id, type: 'ask', field: s.slot, saveAs: s.label, answer: ANSWER[s.kind], ...asked(s, answers),
    ...(s.options ? { options: s.options.map(o => ({ id: `${id}_${slug(o.value)}`, label: o.label, value: o.value })) } : {}),
    next,
  }
}

function branch(id, s, nexts, answers = {}) {
  return {
    id, type: 'question', field: s.slot, saveAs: s.label, ...asked(s, answers),
    options: s.options.map(o => ({ id: `${id}_${slug(o.value)}`, label: o.label, value: o.value, next: nexts[o.value] ?? null })),
  }
}

const message = (id, student, parent, next) => ({ id, type: 'message', ...words(student, parent), next })
const end = id => ({ id, type: 'handoff', text: '' })
const jump = (id, target) => ({ id, type: 'goto', target })

function schoolTree() {
  const S = id => stepOf(school, id)
  const fail = { situation: 'Fail' }
  const improve = { situation: 'Improvement' }
  const fresh = { situation: 'New Admission' }

  const cityMarks = ask('s_city_marks', S('city'), ask('s_docs_marks', S('documents'), end('s_end_marks'), fail))
  const city = ask('s_city', S('city'), ask('s_docs', S('documents'), end('s_end'), fresh))

  const failed = ask('s_board_fail', S('board'), ask('s_year_fail', S('year'),
    ask('s_count_fail', S('subject_count'), ask('s_subjects_fail', S('subjects'), cityMarks), fail)), fail)

  const improving = ask('s_board_improve', S('board'), ask('s_year_improve', S('year'),
    ask('s_count_improve', S('subject_count'), ask('s_subjects_improve', S('subjects'),
      ask('s_current_improve', S('current_percent'), ask('s_target_improve', S('target'),
        jump('s_jump_improve', 's_city_marks'))), improve), improve)), improve)

  const newAdmission = ask('s_board_new', S('board'), city, fresh)

  // PCM is a 12th question: branch on the class already given.
  const deadline = ask('s_deadline', S('deadline'), jump('s_jump_jee', 's_city'))
  const byClass = branch('s_class_jee', S('class'), {
    '10th': deadline,
    '12th': ask('s_pcm', S('pcm'), jump('s_jump_pcm', 's_deadline')),
  })
  const jee = ask('s_board_jee', S('board'), ask('s_year_jee', S('year'),
    ask('s_current_jee', S('current_percent'), ask('s_target_jee', S('target'), byClass))))

  const situation = branch('s_situation', S('situation'), {
    Fail: failed,
    Compartment: jump('s_jump_compartment', 's_board_fail'),
    Improvement: improving,
    'New Admission': newAdmission,
    'JEE/IIT 75%': jee,
  }, { klass: '{Class}' })

  return message('s_welcome', school.welcome(STUDENT), school.welcome(PARENT),
    ask('s_class', S('class'), situation))
}

function collegeTree() {
  const C = id => stepOf(college, id)
  const ug = { level: 'UG' }
  const pg = { level: 'PG' }

  const rest = ['university', 'purpose', 'work', 'city', 'timeline', 'documents']
    .reduceRight((next, id) => ask(`c_${id}`, C(id), next), end('c_end'))
  const mode = ask('c_mode', C('mode'), rest)

  const level = branch('c_level', C('level'), {
    UG: ask('c_course_ug', C('course_ug'), ask('c_qual_ug', C('qualification'),
      ask('c_percent_ug', C('percent'), mode, ug), ug)),
    PG: ask('c_course_pg', C('course_pg'), ask('c_qual_pg', C('qualification'),
      ask('c_percent_pg', C('percent'), jump('c_jump_pg', 'c_mode'), pg), pg)),
    'Not Sure': jump('c_jump_unsure', 'c_qual_ug'),
  })

  return message('c_welcome', college.welcome(STUDENT), college.welcome(PARENT), level)
}

/** The whole script, as wa_flows.root. */
export function admissionScript() {
  const intent = {
    id: 'intent', type: 'question', field: 'flow', text: INTENT.ask,
    options: INTENT.options.map(o => ({
      id: `intent_${o.value}`, label: o.label, value: o.value,
      next: o.value === 'school' ? schoolTree() : collegeTree(),
    })),
  }
  return message('hello', INTENT.hello, null, intent)
}
