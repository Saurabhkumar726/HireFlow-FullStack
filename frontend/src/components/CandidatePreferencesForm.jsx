import { useMemo, useState } from 'react'
import CityLocationAutocomplete from './CityLocationAutocomplete'
import './CandidatePreferencesForm.css'

const EMPTY_PREFERENCES = {
    preferredRoles: [],
    preferredIndustries: [],
    preferredSkills: [],
    preferredLocations: [],
    employmentTypes: [],
    workModes: [],
    experienceLevel: '',
    expectedSalary: '',
    salaryCurrency: 'INR',
    salaryPeriod: 'Yearly',
}

function normalizePreferences(value = {}) {
    return {
        ...EMPTY_PREFERENCES,
        ...value,
        preferredRoles: Array.isArray(value.preferredRoles) ? value.preferredRoles : [],
        preferredIndustries: Array.isArray(value.preferredIndustries) ? value.preferredIndustries : [],
        preferredSkills: Array.isArray(value.preferredSkills) ? value.preferredSkills : [],
        preferredLocations: Array.isArray(value.preferredLocations) ? value.preferredLocations : [],
        employmentTypes: Array.isArray(value.employmentTypes) ? value.employmentTypes : [],
        workModes: Array.isArray(value.workModes) ? value.workModes : [],
        expectedSalary: value.expectedSalary ?? '',
        salaryCurrency: value.salaryCurrency || 'INR',
        salaryPeriod: value.salaryPeriod || 'Yearly',
    }
}

function TagInput({ label, hint, values, onChange, placeholder, max = 20, cityLocations = false }) {
    const [draft, setDraft] = useState('')

    function addValue(value = draft) {
        const clean = value.trim().replace(/,$/, '')
        if (!clean || values.some(item => item.toLowerCase() === clean.toLowerCase())) {
            setDraft('')
            return
        }
        if (values.length >= max) return
        onChange([...values, clean])
        setDraft('')
    }

    function handleKeyDown(event) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            addValue()
        } else if (event.key === 'Backspace' && !draft && values.length) {
            onChange(values.slice(0, -1))
        }
    }

    return (
        <div className="candidate-preference-field">
            <div className="candidate-preference-label-row">
                <label>{label}</label>
                <span>{values.length}/{max}</span>
            </div>
            {hint && <p className="candidate-preference-hint">{hint}</p>}
            <div className="candidate-tag-control">
                <div className="candidate-tag-list">
                    {values.map(value => (
                        <span className="candidate-tag" key={value}>
                            {value}
                            <button type="button" onClick={() => onChange(values.filter(item => item !== value))} aria-label={`Remove ${value}`}>×</button>
                        </span>
                    ))}
                    {cityLocations ? (
                        <CityLocationAutocomplete
                            value={draft}
                            onChange={setDraft}
                            onSelect={location => addValue(location.displayName)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => draft.trim() && addValue()}
                            placeholder={values.length ? 'Add another city…' : placeholder}
                            ariaLabel={label}
                            maxLength={100}
                            className="candidate-location-autocomplete"
                            inputClassName="candidate-tag-location-input"
                        />
                    ) : (
                        <input
                            value={draft}
                            onChange={event => setDraft(event.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => draft.trim() && addValue()}
                            placeholder={values.length ? 'Add another…' : placeholder}
                            aria-label={label}
                            maxLength={100}
                        />
                    )}
                </div>
                <button type="button" className="candidate-tag-add" onClick={() => addValue()} disabled={!draft.trim() || values.length >= max}>Add</button>
            </div>
            <small>Press Enter or Add to save each item.</small>
        </div>
    )
}

function ChoiceGroup({ label, hint, options, values, onChange }) {
    function toggle(value) {
        const exists = values.some(item => item.toLowerCase() === value.toLowerCase())
        onChange(exists ? values.filter(item => item.toLowerCase() !== value.toLowerCase()) : [...values, value])
    }

    return (
        <div className="candidate-preference-field">
            <label>{label}</label>
            {hint && <p className="candidate-preference-hint">{hint}</p>}
            <div className="candidate-preference-choices">
                {options.map(option => {
                    const selected = values.some(item => item.toLowerCase() === option.toLowerCase())
                    return (
                        <button
                            type="button"
                            key={option}
                            className={`candidate-preference-choice ${selected ? 'is-selected' : ''}`}
                            aria-pressed={selected}
                            onClick={() => toggle(option)}
                        >
                            {selected && <span aria-hidden="true">✓</span>}{option}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default function CandidatePreferencesForm({ initialPreferences, onSubmit, submitting = false, compact = false, submitLabel = 'Save preferences' }) {
    const [form, setForm] = useState(() => normalizePreferences(initialPreferences))

    const hasAnyPreference = useMemo(() => Object.entries(form).some(([key, value]) => {
        if (Array.isArray(value)) return value.length > 0
        if (key === 'salaryCurrency' || key === 'salaryPeriod') return false
        return value !== '' && value !== null && value !== undefined
    }), [form])

    function update(key, value) {
        setForm(current => ({ ...current, [key]: value }))
    }

    function handleSubmit(event) {
        event.preventDefault()
        onSubmit?.({
            ...form,
            expectedSalary: form.expectedSalary === '' ? null : Number(form.expectedSalary),
            salaryCurrency: String(form.salaryCurrency || 'INR').toUpperCase(),
        })
    }

    return (
        <form className={`candidate-preferences-form ${compact ? 'is-compact' : ''}`} onSubmit={handleSubmit}>
            <div className="candidate-preferences-section">
                <div className="candidate-preferences-section-heading">
                    <span>01</span><div><h3>Career interests</h3><p>Tell HireFlow what kind of opportunities you want to discover.</p></div>
                </div>
                <div className="candidate-preferences-grid">
                    <TagInput label="Preferred job roles" hint="Examples: Full Stack Developer, .NET Developer" values={form.preferredRoles} onChange={value => update('preferredRoles', value)} placeholder="Add a job role" />
                    {!compact && <TagInput label="Preferred industries" hint="Examples: Software & IT, FinTech, Healthcare" values={form.preferredIndustries} onChange={value => update('preferredIndustries', value)} placeholder="Add an industry" />}
                    <TagInput label="Skills and technologies" hint="Start with skills from your profile; add skills you want to use." values={form.preferredSkills} onChange={value => update('preferredSkills', value)} placeholder="e.g. React, C#, SQL" max={50} />
                    <TagInput label="Preferred locations" hint="Select Indian cities or add a location manually. Add Remote as a work mode below." values={form.preferredLocations} onChange={value => update('preferredLocations', value)} placeholder="e.g. Indore, Madhya Pradesh" cityLocations />
                </div>
            </div>

            <div className="candidate-preferences-section">
                <div className="candidate-preferences-section-heading">
                    <span>02</span><div><h3>Work preferences</h3><p>Select all arrangements that you would consider.</p></div>
                </div>
                <div className="candidate-preferences-grid">
                    <ChoiceGroup label="Employment type" options={['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance']} values={form.employmentTypes} onChange={value => update('employmentTypes', value)} />
                    <ChoiceGroup label="Work mode" options={['Remote', 'Hybrid', 'On-site']} values={form.workModes} onChange={value => update('workModes', value)} />
                </div>
            </div>

            {!compact && (
                <div className="candidate-preferences-section">
                    <div className="candidate-preferences-section-heading">
                        <span>03</span><div><h3>Experience and compensation</h3><p>This information helps prioritize opportunities. You can leave either field blank.</p></div>
                    </div>
                    <div className="candidate-preferences-grid">
                        <label className="candidate-preference-field">
                            <span>Experience level</span>
                            <select value={form.experienceLevel || ''} onChange={event => update('experienceLevel', event.target.value)}>
                                <option value="">Not specified</option>
                                <option value="Fresher">Fresher</option>
                                <option value="Entry">Entry level (0–2 years)</option>
                                <option value="Mid">Mid level (3–5 years)</option>
                                <option value="Senior">Senior (6–9 years)</option>
                                <option value="Lead">Lead (10+ years)</option>
                            </select>
                        </label>
                        <div className="candidate-preference-field">
                            <label htmlFor="candidate-expected-salary">Expected salary</label>
                            <p className="candidate-preference-hint">Your target amount, not a minimum eligibility rule.</p>
                            <div className="candidate-salary-row">
                                <select aria-label="Salary currency" value={form.salaryCurrency} onChange={event => update('salaryCurrency', event.target.value)}>
                                    <option value="INR">INR ₹</option><option value="USD">USD $</option><option value="GBP">GBP £</option><option value="EUR">EUR €</option>
                                </select>
                                <input id="candidate-expected-salary" type="number" min="0" max="100000000" step="1000" value={form.expectedSalary} onChange={event => update('expectedSalary', event.target.value)} placeholder="e.g. 800000" />
                                <select aria-label="Salary period" value={form.salaryPeriod} onChange={event => update('salaryPeriod', event.target.value)}>
                                    <option value="Yearly">Yearly</option><option value="Monthly">Monthly</option><option value="Weekly">Weekly</option><option value="Hourly">Hourly</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="candidate-preferences-actions">
                <p>{hasAnyPreference ? 'Your choices will be used to personalize your job feed.' : 'You can save an empty preference set and browse popular jobs anytime.'}</p>
                <button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : submitLabel}<span aria-hidden="true"> →</span>
                </button>
            </div>
        </form>
    )
}
