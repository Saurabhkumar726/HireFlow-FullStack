import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './InformationPage.css'

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || ''


const POLICY_VERSION = 'Working draft · 10 November 2026'

const privacySections = [
    {
        id: 'privacy-operator', number: '01', title: 'Who operates HireFlow',
        lead: 'HireFlow is an online job-discovery and recruitment-workflow platform for candidates and employers.',
        paragraphs: [
            'Before this policy is published as the final legal notice, the platform operator must be identified by its full legal name, registered or principal business address, and a monitored privacy contact. Those details are not present in the current project configuration, so this draft does not invent them.'
        ]
    },
    {
        id: 'privacy-information', number: '02', title: 'Information the platform handles',
        lead: 'The information handled depends on the features you choose to use and the information you provide.',
        bullets: [
            'Account and sign-in details: name, email address, account role, contact details you provide, authentication records, and information needed for password resets. If you choose Google Sign-In, the platform receives identity information such as your verified email address, name and Google account subject identifier.',
            'Candidate profile information: profile photo, resume, resume headline, summary, skills, education, employment history, desired role or industry, preferred locations, work mode, employment type, salary expectations and notice period, where those fields are used.',
            'Job-search activity: saved jobs, saved-job collections and job preferences that you create or update.',
            'Application information: the job applied for, applicant name, email, phone number, location, LinkedIn or portfolio links, resume, cover letter, application status, status history, withdrawal details and related timestamps. Recruiter notes are part of the employer-side workflow.',
            'Recruitment and interview information: screening questions and answers, interview type, scheduled time, meeting link, notes, candidate response or rescheduling request, interviewer feedback, evaluation ratings and reminder activity.',
            'Employer and company information: company name, description, industry, location, website, logo, job-posting details and company-review or approval information.',
            'Communication preferences and delivery information: in-app and email notification preferences, notification records, and operational information needed to queue and deliver emails.'
        ]
    },
    {
        id: 'privacy-purposes', number: '03', title: 'Why information is used',
        lead: 'HireFlow uses information to provide the features requested by candidates and employers and to operate the service.',
        bullets: [
            'Create, authenticate, maintain and secure user accounts, including password-reset and Google sign-in workflows.',
            'Build and maintain candidate profiles, store resumes, show relevant jobs, save opportunities and manage job preferences.',
            'Submit applications to the employer responsible for a job and let authorized hiring users review applications, screening answers and application history.',
            'Coordinate interviews, record candidate responses and feedback, and send the in-app or email notifications enabled for the relevant workflow.',
            'Review employer and company information, moderate job listings, investigate misuse and protect the platform.',
            'Respond to support requests, diagnose errors, maintain service reliability and meet applicable legal obligations.'
        ]
    },
    {
        id: 'privacy-visibility', number: '04', title: 'When information is shared',
        lead: 'Information is shared according to the action you take and the role of the people involved in that recruitment workflow.',
        bullets: [
            'When you apply for a job, the application details and documents you submit are made available to the employer responsible for that job and the authorized hiring users who need them to assess the application.',
            'Job listings and approved company information may be displayed publicly so visitors can discover opportunities and employers.',
            'Authorized HireFlow administrators may access information when needed for account approval, moderation, support, security and platform administration.',
            'Hosting, database, email-delivery, identity and other technical providers may process information to provide the service. The production policy must name the actual providers and describe relevant processing locations once those providers are selected and configured.',
            'Information may also be disclosed where required by applicable law, valid legal process, or to protect users and the platform from fraud, security incidents or unlawful activity.'
        ]
    },
    {
        id: 'privacy-google-email', number: '05', title: 'Google Sign-In and email delivery',
        lead: 'Some platform functions depend on third-party services.',
        paragraphs: [
            'If you choose Google Sign-In, Google processes your sign-in activity under Google’s own terms and privacy information. HireFlow validates the Google credential and uses the verified account information returned for account sign-in and account association.',
            'HireFlow also supports email workflows for account and recruitment communications. The specific SMTP or email-delivery provider is determined by the deployment configuration. The final policy should identify that provider and link to its privacy information before public launch.'
        ]
    },
    {
        id: 'privacy-controls', number: '06', title: 'Your controls and requests',
        lead: 'Use the account features available to you to keep information accurate and control optional platform activity.',
        bullets: [
            'Update profile and career information from your candidate account when those profile controls are available.',
            'Replace or delete a resume using the resume controls provided in the candidate profile.',
            'Review and change available in-app and email notification preferences.',
            'Withdraw an application where the application workflow provides that option.',
            'For a request to access, correct or delete personal information, or to raise a privacy concern, use the Contact page. Requests may require enough information to verify the account and may be subject to lawful retention or other applicable exceptions.'
        ],
        paragraphs: [
            'The current Contact page prepares a message in the visitor’s email application when a support email is configured. It does not currently submit the message to a HireFlow contact API or store the form contents in the HireFlow application database. A monitored privacy contact and a documented request-handling process must be configured before launch.'
        ]
    },
    {
        id: 'privacy-retention', number: '07', title: 'Storage and retention',
        lead: 'Information should be kept only for as long as it is needed for the purposes described in this policy, subject to applicable legal requirements.',
        paragraphs: [
            'The current application stores account and recruitment records in its configured database and stores uploaded resumes in application-managed file storage. The email outbox stores recipient, subject, message body, delivery status and attempt metadata so messages can be sent and retried. The supplied project does not define an automatic cleanup period for sent or failed email records, or a complete retention schedule for inactive accounts, resumes, applications, interview records, logs or backups.',
            'Before production, the operator must set and implement retention periods for each data category, explain what happens when an account closes, and ensure that deletion from active systems and backups follows the documented schedule.'
        ]
    },
    {
        id: 'privacy-security', number: '08', title: 'Security',
        lead: 'HireFlow uses account authentication and role-based access controls as part of its protection of account and recruitment information.',
        paragraphs: [
            'No website or storage system can be guaranteed completely secure. The production operator must confirm HTTPS, secure secret management, restricted access to resume files, database and file backups, monitoring, incident response and appropriate safeguards with the actual hosting and email providers. Do not send your password, one-time password or sign-in token to anyone claiming to provide support.'
        ]
    },
    {
        id: 'privacy-changes', number: '09', title: 'Changes and contact',
        lead: 'This notice may be revised when HireFlow features, vendors or legal requirements change.',
        paragraphs: [
            'When a material change is made, the operator should update the version date on this page and provide any notice or choice required by applicable law. For privacy questions or requests, visit the Contact page and use the published privacy contact details.'
        ]
    }
]

const termsSections = [
    {
        id: 'terms-agreement', number: '01', title: 'About these terms',
        lead: 'These terms describe the rules for accessing and using HireFlow’s job-discovery and recruitment-workflow features.',
        paragraphs: [
            'By creating an account or using the platform, you agree to follow these terms and the Privacy Policy. If you do not agree, do not use the platform. Before these terms are published as a binding agreement, the operator’s full legal name, registered address and the final governing-law and dispute provisions must be inserted and reviewed.'
        ]
    },
    {
        id: 'terms-accounts', number: '02', title: 'Accounts and access',
        lead: 'You are responsible for the information and activity associated with your account.',
        bullets: [
            'Provide accurate, current information and update it when it changes.',
            'Keep your password, one-time codes and other sign-in credentials confidential. Do not share an account or allow another person to use your credentials.',
            'Tell the platform operator promptly if you believe your account has been accessed without permission.',
            'Use only the account role and features assigned to you. Employer accounts or company profiles may be subject to review or approval before employer features are enabled.',
            'Do not create multiple or misleading accounts to bypass an access restriction or approval decision.'
        ]
    },
    {
        id: 'terms-candidates', number: '03', title: 'Candidate responsibilities',
        lead: 'Candidates control the accuracy and appropriateness of the profile and application information they submit.',
        bullets: [
            'Keep your resume, qualifications, work history, contact information and application answers accurate and up to date.',
            'Submit only content you are entitled to share and do not impersonate another person or misrepresent qualifications.',
            'Review job details and the employer information before applying. You are responsible for deciding whether an opportunity is suitable for you.',
            'Use interview scheduling, acceptance, decline and rescheduling features honestly and communicate changes promptly.',
            'Do not upload malicious files, unlawful content or another person’s confidential information without authorization.'
        ]
    },
    {
        id: 'terms-employers', number: '04', title: 'Employer responsibilities',
        lead: 'Employers are responsible for the jobs they publish and the way they use candidate information.',
        bullets: [
            'Publish genuine, accurate and current job descriptions, requirements, locations, compensation details and application instructions.',
            'Ensure that you are authorized to represent the company and that you have permission to use its name, logo and other materials.',
            'Do not publish deceptive, discriminatory, unlawful, exploitative or misleading job opportunities.',
            'Use candidate profiles, resumes, applications, screening answers and interview records only for legitimate recruitment and related administration.',
            'Limit candidate-data access to authorized hiring personnel and protect information obtained through HireFlow from unauthorized disclosure.',
            'Follow applicable employment, privacy, anti-discrimination and recordkeeping requirements when reviewing and contacting candidates.'
        ]
    },
    {
        id: 'terms-jobs-applications', number: '05', title: 'Job listings and applications',
        lead: 'HireFlow provides tools for discovery and recruitment workflows; the hiring decision remains with the employer.',
        paragraphs: [
            'Employers are responsible for the accuracy, availability and legality of their job listings. A listing may be changed, paused or removed when required for moderation, safety, accuracy or legal reasons.',
            'When a candidate submits an application, the information and documents submitted for that application are shared with the employer responsible for the relevant job and authorized hiring users. HireFlow does not promise that an application will be viewed, that a candidate will be shortlisted, or that a job offer or employment relationship will result.'
        ]
    },
    {
        id: 'terms-screening-interviews', number: '06', title: 'Screening, interviews and feedback',
        lead: 'Screening questions and interview tools help candidates and employers coordinate a recruitment process.',
        paragraphs: [
            'Candidates must provide honest answers to screening questions and respond to interview invitations using the available workflow. Employers are responsible for the relevance and fairness of their screening questions, interview process and evaluations. Interview feedback is intended for recruitment assessment and should be handled confidentially by authorized users.',
            'Candidates and employers should independently confirm interview details, meeting links and schedule changes. HireFlow cannot guarantee uninterrupted email, notification or third-party meeting-service delivery.'
        ]
    },
    {
        id: 'terms-content', number: '07', title: 'Your content and platform materials',
        lead: 'You remain responsible for the content you upload, publish or submit.',
        paragraphs: [
            'You retain any rights you already hold in the resumes, profile information, job descriptions, logos, messages and other materials you submit. You give HireFlow permission to host, store, display, transmit and process that content only as reasonably needed to operate the platform, provide the features you request, support recruitment workflows, maintain security and enforce these terms.',
            'The HireFlow name, brand, interface, software and platform materials are owned by the platform operator or its licensors. You may not copy, resell, misuse or claim ownership of those materials except where the operator or applicable law permits it.'
        ]
    },
    {
        id: 'terms-acceptable-use', number: '08', title: 'Acceptable use',
        lead: 'Use HireFlow lawfully and in a way that respects other users.',
        bullets: [
            'Do not post fake jobs, scams, spam, unlawful, harassing, discriminatory or deceptive content.',
            'Do not scrape, harvest or bulk collect candidate or employer information without authorization.',
            'Do not attempt to access another user’s account, private records, resume files, APIs or administrative functions without permission.',
            'Do not upload malware, interfere with platform operation, bypass security controls or abuse notification and messaging features.',
            'Do not use candidate information for unrelated marketing or any purpose inconsistent with the recruitment context in which it was provided.'
        ]
    },
    {
        id: 'terms-third-party', number: '09', title: 'Third-party services and communications',
        lead: 'Some features depend on services operated by other providers.',
        paragraphs: [
            'Google Sign-In, email delivery, hosting and other integrations may be subject to the separate terms and privacy notices of the providers involved. HireFlow is not responsible for services that it does not operate, although it will take reasonable steps to manage integrations used by the platform.',
            'The platform may send in-app or email communications related to account access, applications, interviews, reminders and preferences. Delivery may be delayed or blocked by email providers, spam filters, networks or device settings.'
        ]
    },
    {
        id: 'terms-suspension', number: '10', title: 'Suspension and account closure',
        lead: 'Access may be restricted where necessary to protect users, the platform or compliance with these terms.',
        paragraphs: [
            'HireFlow may review, limit, suspend or close an account or remove content where there is a reasonable concern about a breach of these terms, security, fraud, unlawful activity, employer verification or risk to users. Where appropriate and legally permitted, the operator should provide the reason and a way to contact support or request review.',
            'You may stop using the platform at any time. Closing an account does not automatically mean every related record is immediately erased; retention, deletion and backup handling must follow the Privacy Policy and applicable law.'
        ]
    },
    {
        id: 'terms-availability', number: '11', title: 'Availability and disclaimers',
        lead: 'The platform is provided to support recruitment workflows, not to guarantee a hiring outcome.',
        paragraphs: [
            'HireFlow may update, suspend or discontinue features for maintenance, security, legal or product reasons. The operator will use reasonable efforts to maintain the service but does not promise that it will always be available, uninterrupted or error-free.',
            'To the extent permitted by applicable law, HireFlow does not guarantee the accuracy of every employer-provided listing, the conduct of every user, the suitability of a candidate for a role, or that any candidate will obtain employment. Users should verify important information directly with the relevant party.'
        ]
    },
    {
        id: 'terms-legal', number: '12', title: 'Legal terms to finalize before publication',
        lead: 'Some contractual details depend on the actual platform operator and its jurisdiction and must not be guessed.',
        bullets: [
            'Insert the full legal name and address of the entity providing HireFlow.',
            'Select and review the governing law, courts or dispute-resolution process with qualified counsel.',
            'Finalize legally appropriate warranty disclaimers, liability limits, indemnity terms and any consumer protections that apply.',
            'Add payment, subscription, cancellation and refund terms if paid features are introduced.',
            'Publish a monitored legal-notice and grievance contact.'
        ]
    },
    {
        id: 'terms-changes-contact', number: '13', title: 'Changes and contact',
        lead: 'The terms may be updated as the platform changes.',
        paragraphs: [
            'The version date should be updated whenever these terms are materially revised. Continued use after an updated version takes effect may be subject to the revised terms where permitted by applicable law. For questions, use the Contact page and the operator’s published contact details.'
        ]
    }
]

function PolicyPage({ type }) {
    const isPrivacy = type === 'privacy'
    const sections = isPrivacy ? privacySections : termsSections
    const subtitle = isPrivacy
        ? 'Understand what information HireFlow handles, why it is used, and how it moves through recruitment workflows.'
        : 'The responsibilities and practical rules for candidates, employers and anyone using the HireFlow platform.'

    return (
        <main className="hf-info-page hf-policy-page">
            <div className="hf-info-container hf-policy-container">
                <header className="hf-info-hero hf-policy-hero">
                    <span className="hf-eyebrow">HIREFLOW POLICIES</span>
                    <h1>{isPrivacy ? <>Privacy <em>Policy.</em></> : <>Terms of <em>Service.</em></>}</h1>
                    <p>{subtitle}</p>
                    <div className="hf-policy-meta" aria-label="Policy version information">
                        <span>{POLICY_VERSION}</span>
                        <span>{sections.length} sections</span>
                        <Link to={isPrivacy ? '/terms' : '/privacy'}>{isPrivacy ? 'Read Terms of Service' : 'Read Privacy Policy'} <span aria-hidden="true">↗</span></Link>
                    </div>
                </header>

                <aside className="hf-policy-review-note" role="note">
                    <span className="hf-policy-review-mark" aria-hidden="true">i</span>
                    <div>
                        <strong>Publication review required</strong>
                        <p>This is a product-specific working draft based on the current HireFlow project. Before public launch, confirm the legal operator, actual service providers, data-retention schedule, privacy-request process and applicable legal terms with qualified counsel. Do not treat this draft as legal advice or a finalized legal agreement.</p>
                    </div>
                </aside>

                <div className="hf-policy-layout">
                    <aside className="hf-policy-toc" aria-label="On this page">
                        <span className="hf-policy-toc-title">ON THIS PAGE</span>
                        <nav>
                            {sections.map((section) => (
                                <a key={section.id} href={`#${section.id}`}>
                                    <span>{section.number}</span>{section.title}
                                </a>
                            ))}
                        </nav>
                    </aside>

                    <div className="hf-policy-content">
                        <section className="hf-policy-overview">
                            <span className="hf-policy-overview-label">{isPrivacy ? 'PRIVACY AT A GLANCE' : 'USING HIREFLOW'}</span>
                            <h2>{isPrivacy ? 'Clear information. Purposeful use.' : 'A fair and useful recruitment experience.'}</h2>
                            <p>{isPrivacy
                                ? 'HireFlow supports candidate profiles, job applications, employer review, screening, interviews and platform notifications. The sections below explain the information involved in those features and the controls currently available.'
                                : 'HireFlow connects job seekers and employers through job listings, applications and interview workflows. These terms set expectations for accurate information, responsible recruitment and respectful platform use.'}</p>
                        </section>

                        {sections.map((section) => (
                            <section className="hf-policy-section" id={section.id} key={section.id}>
                                <div className="hf-policy-section-heading">
                                    <span>{section.number}</span>
                                    <div>
                                        <h2>{section.title}</h2>
                                        {section.lead && <p className="hf-policy-lead">{section.lead}</p>}
                                    </div>
                                </div>
                                {section.paragraphs?.map((paragraph, index) => <p key={`${section.id}-p-${index}`}>{paragraph}</p>)}
                                {section.bullets && (
                                    <ul>
                                        {section.bullets.map((item, index) => <li key={`${section.id}-b-${index}`}>{item}</li>)}
                                    </ul>
                                )}
                            </section>
                        ))}

                        <section className="hf-policy-contact-card">
                            <div>
                                <span className="hf-eyebrow">NEED HELP?</span>
                                <h2>{isPrivacy ? 'Have a privacy question?' : 'Need help using HireFlow?'}</h2>
                                <p>{isPrivacy
                                    ? 'Use the Contact page to raise a data-access, correction, deletion or privacy concern. A monitored privacy email must be configured before launch.'
                                    : 'For account, job-posting or recruitment workflow questions, contact the HireFlow team through the Contact page.'}</p>
                            </div>
                            <Link to="/contact">Contact HireFlow <span aria-hidden="true">↗</span></Link>
                        </section>

                        <p className="hf-policy-crosslink">{isPrivacy ? 'Using HireFlow also means following the ' : 'For information about how account and recruitment information is handled, read the '}<Link to={isPrivacy ? '/terms' : '/privacy'}>{isPrivacy ? 'Terms of Service' : 'Privacy Policy'}</Link>.</p>
                    </div>
                </div>
            </div>
        </main>
    )
}

export default function InformationPage() {
    const { pathname } = useLocation()
    const page = pathname.replace(/^\/+|\/+$/g, '')
    const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
    const [notice, setNotice] = useState('')

    if (page === 'about') {
        return (
            <main className="hf-info-page">
                <div className="hf-info-container">
                    <header className="hf-info-hero">
                        <span className="hf-eyebrow">ABOUT HIREFLOW</span>
                        <h1>Where careers find <em>their flow.</em></h1>
                        <p>One connected place to discover opportunities and manage hiring.</p>
                    </header>

                    <section className="hf-info-card hf-about-story">
                        <div>
                            <span className="hf-eyebrow">WHY WE EXIST</span>
                            <h2>A clearer path from opportunity to hire.</h2>
                        </div>
                        <p>HireFlow connects job discovery, applications and candidate review in one recruitment workspace.</p>
                    </section>

                    <div className="hf-about-pillars">
                        <article>
                            <span>01</span>
                            <h2>Our Mission</h2>
                            <p>Make job discovery and hiring simpler for candidates and employers.</p>
                        </article>
                        <article>
                            <span>02</span>
                            <h2>Our Vision</h2>
                            <p>Create a clear, connected experience from application to interview.</p>
                        </article>
                        <article>
                            <span>03</span>
                            <h2>Our Values</h2>
                            <p>Build with transparency, trust, accessibility and respect.</p>
                        </article>
                    </div>

                    <section className="hf-info-card hf-about-audience">
                        <div>
                            <span className="hf-eyebrow">BUILT FOR BOTH SIDES</span>
                            <h2>One platform. Two connected experiences.</h2>
                        </div>
                        <div>
                            <h3>For job seekers</h3>
                            <p>Find roles, save opportunities and track applications.</p>
                            <h3>For recruiters</h3>
                            <p>Publish jobs, review candidates and coordinate interviews.</p>
                        </div>
                    </section>

                    <p className="hf-info-footnote">From discovering a role to coordinating an interview, HireFlow keeps the recruitment journey organized in one place.</p>
                </div>
            </main>
        )
    }

    if (page === 'contact') {
        function submitContact(event) {
            event.preventDefault()
            if (!SUPPORT_EMAIL) {
                setNotice('The contact form layout is ready. Message delivery will be connected when the backend Contact API is added; no message has been sent.')
                return
            }
            const subject = encodeURIComponent(form.subject.trim() || 'HireFlow enquiry')
            const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)
            window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
            setNotice('Your email application has opened. Send the prepared message to contact the HireFlow team.')
        }

        return (
            <main className="hf-info-page">
                <div className="hf-info-container">
                    <header className="hf-info-hero"><span className="hf-eyebrow">CONTACT HIREFLOW</span><h1>We're here to <em>help.</em></h1><p>Have a question about finding a role, managing a hiring process, or using HireFlow? Send the team a message.</p></header>
                    <div className="hf-contact-layout">
                        <form className="hf-contact-form" onSubmit={submitContact}>
                            <h2>Send us a message</h2>
                            <label>Full name<input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label>
                            <label>Email address<input type="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
                            <label>Subject<input required maxLength={150} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="How can we help?" /></label>
                            <label>Message<textarea required maxLength={4000} rows={6} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Write your message" /></label>
                            {notice && <p className="hf-contact-notice" role="status">{notice}</p>}
                            <button type="submit">{SUPPORT_EMAIL ? 'Open email to send' : 'Prepare message'} <span>↗</span></button>
                        </form>
                        <aside className="hf-contact-aside"><span className="hf-eyebrow">HOW WE CAN HELP</span><h2>Tell us what you need.</h2><p>For account access, application questions, employer onboarding, or platform feedback, use the form and include enough detail for the team to understand your request.</p><div><strong>Candidate support</strong><span>Questions about profiles, saved jobs, and applications.</span></div><div><strong>Employer support</strong><span>Questions about job listings, applicants, and hiring workflows.</span></div><div><strong>Technical support</strong><span>Report an error and include the page where it occurred.</span></div></aside>
                    </div>
                </div>
            </main>
        )
    }

    if (page === 'privacy' || page === 'terms') {
        return <PolicyPage type={page === 'privacy' ? 'privacy' : 'terms'} />
    }

    return <main className="hf-info-page"><div className="hf-info-container"><h1>Page not found</h1><p>This page is not available.</p><Link to="/">Return to HireFlow</Link></div></main>
}
