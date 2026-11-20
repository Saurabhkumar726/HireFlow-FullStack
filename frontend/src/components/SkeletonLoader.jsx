import './SkeletonLoader.css'

function Shape({ className = '', width, height, rounded = false }) {
    return (
        <span
            className={`hf-skeleton-shape ${rounded ? 'is-rounded' : ''} ${className}`.trim()}
            style={{ ...(width ? { width } : {}), ...(height ? { height } : {}) }}
            aria-hidden="true"
        />
    )
}

function Lines({ count = 3, widths = ['92%', '74%', '56%'] }) {
    return (
        <div className="hf-skeleton-lines" aria-hidden="true">
            {Array.from({ length: count }, (_, index) => (
                <Shape key={index} width={widths[index % widths.length]} height="10px" />
            ))}
        </div>
    )
}

function JobGrid({ count }) {
    return (
        <div className="hf-skeleton-job-grid">
            {Array.from({ length: count }, (_, index) => (
                <article className="hf-skeleton-job-card" key={index}>
                    <div className="hf-skeleton-job-top">
                        <Shape width="42px" height="42px" rounded />
                        <div className="hf-skeleton-job-company"><Shape width="64%" height="9px" /><Shape width="42%" height="8px" /></div>
                        <Shape width="28px" height="28px" rounded />
                    </div>
                    <Shape width="78%" height="16px" />
                    <Shape width="52%" height="10px" />
                    <div className="hf-skeleton-chip-row"><Shape width="68px" height="22px" rounded /><Shape width="78px" height="22px" rounded /><Shape width="58px" height="22px" rounded /></div>
                    <div className="hf-skeleton-job-bottom"><Shape width="34%" height="12px" /><Shape width="26%" height="28px" rounded /></div>
                </article>
            ))}
        </div>
    )
}

function JobList({ count }) {
    return (
        <div className="hf-skeleton-job-list">
            {Array.from({ length: count }, (_, index) => (
                <article className="hf-skeleton-job-list-row" key={index}>
                    <Shape width="54px" height="54px" rounded />
                    <div className="hf-skeleton-job-list-content">
                        <Shape width="28%" height="9px" />
                        <Shape width="62%" height="16px" />
                        <Shape width="84%" height="10px" />
                        <div className="hf-skeleton-chip-row"><Shape width="72px" height="21px" rounded /><Shape width="84px" height="21px" rounded /><Shape width="96px" height="21px" rounded /></div>
                        <Shape width="94%" height="9px" />
                    </div>
                    <div className="hf-skeleton-job-list-action"><Shape width="88px" height="12px" /><Shape width="78px" height="30px" rounded /></div>
                </article>
            ))}
        </div>
    )
}

function ApplicationList({ count }) {
    return (
        <div className="hf-skeleton-application-list">
            {Array.from({ length: count }, (_, index) => (
                <article className="hf-skeleton-application-card" key={index}>
                    <div className="hf-skeleton-application-head">
                        <Shape width="48px" height="48px" rounded />
                        <div className="hf-skeleton-application-copy"><Shape width="66%" height="14px" /><Shape width="42%" height="9px" /><Shape width="52%" height="8px" /></div>
                        <Shape width="88px" height="25px" rounded />
                    </div>
                    <div className="hf-skeleton-application-progress"><Shape width="100%" height="5px" rounded /><div><Shape width="50px" height="8px" /><Shape width="50px" height="8px" /><Shape width="50px" height="8px" /><Shape width="50px" height="8px" /></div></div>
                </article>
            ))}
        </div>
    )
}

function NotificationList({ count, compact = false }) {
    return (
        <div className={`hf-skeleton-notification-list ${compact ? 'is-compact' : ''}`}>
            {Array.from({ length: count }, (_, index) => (
                <div className="hf-skeleton-notification-row" key={index}>
                    <Shape width={compact ? '30px' : '42px'} height={compact ? '30px' : '42px'} rounded />
                    <div className="hf-skeleton-notification-copy"><Shape width="58%" height="11px" /><Shape width="92%" height="9px" /><Shape width="34%" height="8px" /></div>
                    <Shape width="7px" height="7px" rounded />
                </div>
            ))}
        </div>
    )
}

function InterviewList({ count }) {
    return (
        <div className="hf-skeleton-interview-list">
            {Array.from({ length: count }, (_, index) => (
                <article className="hf-skeleton-interview-card" key={index}>
                    <div className="hf-skeleton-interview-date"><Shape width="42px" height="10px" /><Shape width="34px" height="24px" /></div>
                    <div className="hf-skeleton-interview-copy"><Shape width="62%" height="14px" /><Shape width="44%" height="9px" /><Shape width="76%" height="9px" /></div>
                    <Shape width="74px" height="24px" rounded />
                </article>
            ))}
        </div>
    )
}

function CompanyGrid({ count }) {
    return (
        <div className="hf-skeleton-company-grid">
            {Array.from({ length: count }, (_, index) => (
                <article className="hf-skeleton-company-card" key={index}>
                    <Shape width="56px" height="56px" rounded />
                    <Shape width="66%" height="14px" />
                    <Shape width="46%" height="9px" />
                    <Shape width="38%" height="9px" />
                    <Shape width="96px" height="28px" rounded />
                </article>
            ))}
        </div>
    )
}

function Profile() {
    return (
        <div className="hf-skeleton-profile">
            <section className="hf-skeleton-profile-hero">
                <Shape width="76px" height="76px" rounded />
                <div><Shape width="36%" height="17px" /><Shape width="52%" height="10px" /><Shape width="28%" height="9px" /></div>
                <Shape width="108px" height="32px" rounded />
            </section>
            {Array.from({ length: 3 }, (_, index) => (
                <section className="hf-skeleton-profile-panel" key={index}>
                    <div className="hf-skeleton-panel-heading"><Shape width="34%" height="14px" /><Shape width="54px" height="24px" rounded /></div>
                    <div className="hf-skeleton-form-grid">
                        {Array.from({ length: index === 1 ? 4 : 2 }, (_, fieldIndex) => (
                            <div className="hf-skeleton-field" key={fieldIndex}><Shape width="32%" height="8px" /><Shape width="100%" height="39px" rounded /></div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
}

function Form({ count = 6 }) {
    return (
        <div className="hf-skeleton-form-page">
            <section className="hf-skeleton-form-intro"><Shape width="110px" height="9px" /><Shape width="44%" height="24px" /><Shape width="72%" height="10px" /></section>
            <section className="hf-skeleton-profile-panel">
                <div className="hf-skeleton-panel-heading"><Shape width="38%" height="15px" /></div>
                <div className="hf-skeleton-form-grid">
                    {Array.from({ length: count }, (_, index) => (
                        <div className={`hf-skeleton-field ${index === count - 1 && count % 2 ? 'is-wide' : ''}`} key={index}>
                            <Shape width={`${28 + (index % 3) * 9}%`} height="8px" />
                            <Shape width="100%" height={index % 4 === 3 ? '78px' : '42px'} rounded />
                        </div>
                    ))}
                </div>
                <div className="hf-skeleton-form-actions"><Shape width="110px" height="36px" rounded /></div>
            </section>
        </div>
    )
}

function Table({ count, columns = 6 }) {
    return (
        <div className="hf-skeleton-table" style={{ '--hf-sk-columns': columns }}>
            <div className="hf-skeleton-table-head">{Array.from({ length: columns }, (_, index) => <Shape key={index} width={`${52 + (index % 3) * 12}%`} height="9px" />)}</div>
            {Array.from({ length: count }, (_, rowIndex) => (
                <div className="hf-skeleton-table-row" key={rowIndex}>
                    {Array.from({ length: columns }, (_, columnIndex) => <Shape key={columnIndex} width={`${44 + ((rowIndex + columnIndex) % 3) * 14}%`} height={columnIndex === 0 ? '12px' : '9px'} />)}
                </div>
            ))}
        </div>
    )
}

function Chart({ donut = false }) {
    return (
        <div className={`hf-skeleton-chart ${donut ? 'is-donut' : ''}`}>
            {donut ? (
                <><Shape width="148px" height="148px" rounded /><div className="hf-skeleton-chart-legend">{[0, 1, 2, 3].map(index => <Shape key={index} width={`${72 + index * 3}%`} height="9px" />)}</div></>
            ) : (
                <><div className="hf-skeleton-chart-axis">{[0, 1, 2, 3].map(index => <Shape key={index} width="100%" height="1px" />)}</div><div className="hf-skeleton-chart-bars">{[42, 66, 54, 82, 60, 94].map((height, index) => <Shape key={index} width="30px" height={`${height}%`} rounded />)}</div></>
            )}
        </div>
    )
}

function Dashboard() {
    return (
        <div className="hf-skeleton-dashboard">
            <div className="hf-skeleton-stats-grid">{Array.from({ length: 4 }, (_, index) => <article className="hf-skeleton-stat-card" key={index}><Shape width="42%" height="9px" /><Shape width="34%" height="23px" /><Shape width="64%" height="8px" /></article>)}</div>
            <div className="hf-skeleton-dashboard-charts"><section className="hf-skeleton-profile-panel"><Shape width="34%" height="14px" /><Chart /></section><section className="hf-skeleton-profile-panel"><Shape width="38%" height="14px" /><Chart donut /></section></div>
            <section className="hf-skeleton-profile-panel"><Shape width="32%" height="14px" /><NotificationList count={3} /></section>
        </div>
    )
}

function Collections({ count }) {
    return (
        <div className="hf-skeleton-collections">
            <aside className="hf-skeleton-collections-sidebar"><Shape width="65%" height="10px" />{Array.from({ length: 4 }, (_, index) => <Shape key={index} width="100%" height="38px" rounded />)}<Shape width="100%" height="78px" rounded /></aside>
            <section className="hf-skeleton-collections-content"><Shape width="36%" height="19px" /><Shape width="58%" height="9px" />{Array.from({ length: count }, (_, index) => <div className="hf-skeleton-collection-row" key={index}><Shape width="42px" height="42px" rounded /><div><Shape width="55%" height="12px" /><Shape width="80%" height="9px" /></div><Shape width="82px" height="28px" rounded /></div>)}</section>
        </div>
    )
}

function JobDetails() {
    return (
        <div className="hf-skeleton-job-details">
            <section className="hf-skeleton-profile-panel"><Shape width="90px" height="9px" /><Shape width="62%" height="24px" /><Shape width="38%" height="10px" /><div className="hf-skeleton-chip-row"><Shape width="70px" height="22px" rounded /><Shape width="82px" height="22px" rounded /><Shape width="92px" height="22px" rounded /></div></section>
            <div className="hf-skeleton-details-columns"><section className="hf-skeleton-profile-panel"><Shape width="38%" height="15px" /><Lines count={7} /></section><aside className="hf-skeleton-profile-panel"><Shape width="42%" height="15px" /><Shape width="72%" height="12px" /><Shape width="100%" height="40px" rounded /><Shape width="100%" height="40px" rounded /></aside></div>
        </div>
    )
}

function ScreeningQuestions({ count }) {
    return <div className="hf-skeleton-screening-list">{Array.from({ length: count }, (_, index) => <article className="hf-skeleton-profile-panel" key={index}><Shape width="24%" height="9px" /><Shape width="82%" height="13px" /><Shape width="46%" height="9px" /></article>)}</div>
}

export default function SkeletonLoader({ variant = 'job-list', count = 4, columns = 6, className = '', compact = false }) {
    const safeCount = Math.max(1, Math.min(Number(count) || 4, 10))
    let content

    switch (variant) {
        case 'job-grid': content = <JobGrid count={safeCount} />; break
        case 'job-list': content = <JobList count={safeCount} />; break
        case 'application-list': content = <ApplicationList count={safeCount} />; break
        case 'notifications': content = <NotificationList count={safeCount} compact={compact} />; break
        case 'interviews': content = <InterviewList count={safeCount} />; break
        case 'companies': content = <CompanyGrid count={safeCount} />; break
        case 'profile': content = <Profile />; break
        case 'form': content = <Form count={safeCount + 2} />; break
        case 'table': content = <Table count={safeCount} columns={Math.max(2, Math.min(Number(columns) || 6, 8))} />; break
        case 'chart': content = <Chart />; break
        case 'donut': content = <Chart donut />; break
        case 'dashboard': content = <Dashboard />; break
        case 'collections': content = <Collections count={safeCount} />; break
        case 'job-details': content = <JobDetails />; break
        case 'screening': content = <ScreeningQuestions count={safeCount} />; break
        case 'inline': content = <Shape width="54px" height="12px" />; break
        default: content = <NotificationList count={safeCount} compact={compact} />
    }

    return (
        <div className={`hf-skeleton-loader ${compact ? 'is-compact' : ''} ${className}`.trim()} role="status" aria-label="Loading content" aria-busy="true">
            <span className="hf-sr-only">Loading content</span>
            {content}
        </div>
    )
}
